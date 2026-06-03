#!/usr/bin/env node
/**
 * Stages a self-contained @photolive/server (with prod node_modules) into
 * `apps/desktop/server-runtime/` via `pnpm --filter @photolive/server deploy`.
 *
 * Why: electron-builder errors when its asar walker dereferences workspace
 * symlinks (node_modules/@photolive/server -> ../../server) and finds files
 * outside the project root. By copying the server's prod tree into a real
 * subdirectory of apps/desktop/ we avoid the symlink dereference entirely.
 *
 * After staging we electron-rebuild any natives in server-runtime/node_modules
 * so they match Electron's ABI before electron-builder packs them.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const desktopRoot = path.resolve(__dirname, '..');
const serverRuntime = path.join(desktopRoot, 'server-runtime');
const repoRoot = path.resolve(desktopRoot, '..', '..');

function sh(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

if (fs.existsSync(serverRuntime)) {
  fs.rmSync(serverRuntime, { recursive: true, force: true });
}

// 1. pnpm deploy -- materialises @photolive/server with a prod node_modules
//    under server-runtime/. Run from the repo root.
//
//    Force the *hoisted* node-linker for the deployed tree. With pnpm's
//    default isolated linker, transitive deps live under node_modules/.pnpm/
//    and are reached via symlinks (e.g. chokidar -> readdirp). electron-builder
//    dereferences symlinks when copying extraResources, so chokidar lands as a
//    real dir but its sibling readdirp symlink is lost -> runtime crash
//    "Cannot find package 'readdirp'". A hoisted (flat, npm-style) layout puts
//    every dep at the top level as a real directory with no symlinks to break.
//    Scoped to this subprocess only — apps/desktop/node_modules (where
//    electron-builder finds Electron) keeps the repo's isolated linker.
sh(`pnpm --filter @photolive/server deploy --prod "${serverRuntime}"`, {
  cwd: repoRoot,
  env: { ...process.env, NPM_CONFIG_NODE_LINKER: 'hoisted' },
});

// 1b. Fail fast if the deploy didn't actually hoist. A leftover .pnpm virtual
//     store means the isolated linker was used and transitive deps are still
//     symlink-only — the packaged app would crash at runtime once
//     electron-builder dereferences those symlinks. Catching it here turns a
//     "user installs and clicks, then it crashes" loop into a CI failure.
const nodeModules = path.join(serverRuntime, 'node_modules');
if (fs.existsSync(path.join(nodeModules, '.pnpm'))) {
  throw new Error(
    '[stage] server-runtime/node_modules/.pnpm exists — deploy ignored ' +
      'NPM_CONFIG_NODE_LINKER=hoisted. Transitive deps (e.g. readdirp) would be ' +
      'symlink-only and break once electron-builder copies extraResources.',
  );
}
// Spot-check a transitive dep that previously went missing (chokidar -> readdirp).
for (const dep of ['readdirp']) {
  if (!fs.existsSync(path.join(nodeModules, dep, 'package.json'))) {
    throw new Error(
      `[stage] expected hoisted transitive dependency "${dep}" not found at ` +
        `${path.join(nodeModules, dep)} — the runtime would fail to resolve it.`,
    );
  }
}
console.log('[stage] verified flat (hoisted) node_modules — no .pnpm store, readdirp present');

// 2. Drizzle migrations live next to the source, not the dist — copy them
//    into the runtime so app.ts's findMigrationsFolder candidates hit.
const drizzleSrc = path.join(repoRoot, 'apps', 'server', 'drizzle');
const drizzleDst = path.join(serverRuntime, 'drizzle');
fs.cpSync(drizzleSrc, drizzleDst, { recursive: true });
console.log(`copied drizzle migrations -> ${drizzleDst}`);

// 3. Rebuild native modules against Electron's Node ABI. We do this here
//    so server-runtime is fully Electron-ready before electron-builder
//    starts packing — avoiding a separate beforeBuild hook race.
const rebuildCandidates = [
  // pnpm isolated layout (default)
  path.join(desktopRoot, 'node_modules', '.bin', 'electron-rebuild'),
  // pnpm hoisted layout (NPM_CONFIG_NODE_LINKER=hoisted) or workspace-root install
  path.join(repoRoot, 'node_modules', '.bin', 'electron-rebuild'),
];
const electronRebuildBin = rebuildCandidates.find((p) => fs.existsSync(p));
if (!electronRebuildBin) {
  throw new Error(
    `[stage] electron-rebuild not found in any of:\n  ${rebuildCandidates.join('\n  ')}\nDid you run pnpm install? Native modules will have the wrong ABI without rebuild.`,
  );
}
sh(`"${electronRebuildBin}" -m "${serverRuntime}" -f`, { cwd: desktopRoot });

console.log('\n[stage] done. server-runtime ready under apps/desktop/server-runtime/');
