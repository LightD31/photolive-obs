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

// 1. pnpm deploy -- materialises @photolive/server with a flat prod
//    node_modules under server-runtime/. Run from the repo root.
sh(`pnpm --filter @photolive/server deploy --prod "${serverRuntime}"`, {
  cwd: repoRoot,
});

// 2. Drizzle migrations live next to the source, not the dist — copy them
//    into the runtime so app.ts's findMigrationsFolder candidates hit.
const drizzleSrc = path.join(repoRoot, 'apps', 'server', 'drizzle');
const drizzleDst = path.join(serverRuntime, 'drizzle');
fs.cpSync(drizzleSrc, drizzleDst, { recursive: true });
console.log(`copied drizzle migrations -> ${drizzleDst}`);

// 3. Rebuild native modules against Electron's Node ABI. We do this here
//    so server-runtime is fully Electron-ready before electron-builder
//    starts packing — avoiding a separate beforeBuild hook race.
const electronRebuildBin = path.join(
  desktopRoot,
  'node_modules',
  '.bin',
  'electron-rebuild',
);
if (fs.existsSync(electronRebuildBin)) {
  sh(`"${electronRebuildBin}" -m "${serverRuntime}" -f`, { cwd: desktopRoot });
} else {
  console.warn('[stage] electron-rebuild not found; native modules may have wrong ABI');
}

console.log('\n[stage] done. server-runtime ready under apps/desktop/server-runtime/');
