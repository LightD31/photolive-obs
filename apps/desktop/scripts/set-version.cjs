#!/usr/bin/env node
/**
 * Syncs apps/desktop/package.json `version` to the release version so
 * electron-builder's ${version} artifact macro (installer name, exe/zip
 * filenames, NSIS "Photolive X.Y.Z" label) matches the pushed git tag.
 *
 * Version source, in order: argv[2], then $GITHUB_REF_NAME (the tag CI is
 * building). A leading `v` is stripped. With no version provided this is a
 * no-op so local `pnpm package:*` builds keep whatever's already in the file.
 *
 * Cross-platform (plain Node) so the same step works on the Windows and Linux
 * release runners.
 */
const fs = require('node:fs');
const path = require('node:path');

const raw = (process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '').trim();
const version = raw.replace(/^v/, '');
if (!version) {
  console.log('[set-version] no version provided; leaving package.json unchanged');
  process.exit(0);
}
if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version)) {
  throw new Error(`[set-version] "${version}" is not a valid semver version`);
}

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const previous = pkg.version;
if (previous === version) {
  console.log(`[set-version] apps/desktop/package.json already at ${version}`);
  process.exit(0);
}
pkg.version = version;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`[set-version] apps/desktop/package.json version ${previous} -> ${version}`);
