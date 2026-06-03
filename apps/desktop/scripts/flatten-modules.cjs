#!/usr/bin/env node
'use strict';
/**
 * Flatten a pnpm "isolated" node_modules into a flat, npm-style tree of REAL
 * directories (no symlinks, no junctions, no .pnpm virtual store).
 *
 * Why this exists
 * ---------------
 * `pnpm deploy` always emits the isolated layout: packages live in a
 * node_modules/.pnpm virtual store and are reached through symlinks (Linux) or
 * directory junctions (Windows). electron-builder dereferences the top-level
 * links when it copies server-runtime as extraResources, which turns each
 * direct dependency into a real directory but strands its transitive deps —
 * e.g. chokidar's `readdirp`, which only ever existed inside .pnpm. The app
 * then crashes at runtime with "Cannot find package 'readdirp'".
 *
 * `pnpm deploy` has no option to emit a hoisted tree (it always creates a
 * localized virtual store), and node-linker=hoisted can only be set
 * workspace-wide (which breaks electron-builder elsewhere). So we transform the
 * deployed tree ourselves.
 *
 * Strategy
 * --------
 * Hoist every package to the top level (first version seen wins). When a second
 * *different* version of the same name is needed, nest that whole sub-closure
 * under its dependent (classic npm style) so resolution stays correct. The
 * result contains only real directories and survives electron-builder's copy on
 * every platform. Handles symlinks and Windows junctions alike.
 */
const fs = require('node:fs');
const path = require('node:path');

// A directory junction (Windows) is not reported as a symlink by lstat, but it
// does respond to readlink; a real directory throws. This catches both.
function isLink(p) {
  try {
    fs.readlinkSync(p);
    return true;
  } catch {
    return false;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Leaf packages in a node_modules dir, descending one level into @scopes.
// Skips dotted entries (.bin, .pnpm, .modules.yaml, ...).
function listPackages(nmDir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(nmDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(nmDir, e.name);
    if (e.name.startsWith('@')) {
      let scoped;
      try {
        scoped = fs.readdirSync(full, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const s of scoped) {
        if (s.name.startsWith('.')) continue;
        out.push({ name: `${e.name}/${s.name}`, dir: path.join(full, s.name) });
      }
    } else {
      out.push({ name: e.name, dir: full });
    }
  }
  return out;
}

// realDir = .../.pnpm/<entry>/node_modules/<name>  (name may be '@scope/pkg').
// The package's resolved deps are its siblings in that node_modules dir.
function entryNmOf(realDir, name) {
  return name.includes('/') ? path.dirname(path.dirname(realDir)) : path.dirname(realDir);
}

function instanceFromLink(linkDir) {
  const realDir = fs.realpathSync(linkDir);
  const pkg = readJson(path.join(realDir, 'package.json'));
  return { name: pkg.name, version: pkg.version, realDir };
}

// The resolved direct dependencies of an instance: the junction/symlink
// siblings of its owner directory in the .pnpm entry's node_modules.
function depsOf(inst) {
  const enm = entryNmOf(inst.realDir, inst.name);
  return listPackages(enm)
    .filter((p) => p.name !== inst.name && isLink(p.dir))
    .map((p) => instanceFromLink(p.dir));
}

function copyPackage(realDir, destDir) {
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  // dereference resolves junctions/symlinks to real files in the copy.
  fs.cpSync(realDir, destDir, { recursive: true, dereference: true });
}

function destOf(nmDir, name) {
  return path.join(nmDir, ...name.split('/'));
}

/**
 * Transform an isolated pnpm node_modules into a flat tree of real dirs.
 * Operates by staging a sibling `<nm>.flat` then swapping it in atomically-ish.
 * No-op if the tree is already flat (no .pnpm store).
 */
function flatten(nm) {
  if (!fs.existsSync(path.join(nm, '.pnpm'))) return;

  const staged = `${nm}.flat`;
  fs.rmSync(staged, { recursive: true, force: true });
  fs.mkdirSync(staged, { recursive: true });

  const topVersion = new Map(); // name -> version placed at the top level

  // Place a package and its full sub-closure nested under `hostNm`,
  // self-contained. Used for conflicting versions that can't own the top slot.
  function placeNested(inst, hostNm, seen) {
    const dest = destOf(hostNm, inst.name);
    if (fs.existsSync(dest)) return; // already satisfied within this host
    if (seen.has(inst.realDir)) return; // dependency cycle
    copyPackage(inst.realDir, dest);
    const childSeen = new Set(seen).add(inst.realDir);
    const childNm = path.join(dest, 'node_modules');
    for (const d of depsOf(inst)) placeNested(d, childNm, childSeen);
  }

  // Returns true if `inst` is resolvable from the top level after the call,
  // false if a different version already owns the top slot (caller nests it).
  function placeTop(inst) {
    const v = topVersion.get(inst.name);
    if (v === inst.version) return true;
    if (v !== undefined) return false;
    copyPackage(inst.realDir, destOf(staged, inst.name));
    topVersion.set(inst.name, inst.version);
    const ownNm = path.join(destOf(staged, inst.name), 'node_modules');
    for (const d of depsOf(inst)) {
      if (!placeTop(d)) placeNested(d, ownNm, new Set());
    }
    return true;
  }

  for (const p of listPackages(nm)) {
    if (isLink(p.dir)) placeTop(instanceFromLink(p.dir));
  }

  // Windows-safe swap: move the original aside, move the flat tree into place,
  // then delete the original. Deleting `nm` and immediately reusing the name
  // races the filesystem and throws EPERM, so we rename instead.
  const aside = `${nm}.old-${process.pid}`;
  fs.rmSync(aside, { recursive: true, force: true });
  fs.renameSync(nm, aside);
  try {
    fs.renameSync(staged, nm);
  } catch (err) {
    fs.renameSync(aside, nm); // restore on failure
    throw err;
  }
  fs.rmSync(aside, { recursive: true, force: true });
}

module.exports = { flatten };

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: flatten-modules.cjs <node_modules-dir>');
    process.exit(2);
  }
  flatten(path.resolve(target));
  console.log(`[flatten] flattened ${target}`);
}
