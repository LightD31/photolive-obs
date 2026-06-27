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
const { flatten } = require('./flatten-modules.cjs');

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
//    under server-runtime/. Run from the repo root. pnpm always uses its
//    isolated layout here (a .pnpm virtual store reached via symlinks on Linux
//    and junctions on Windows); deploy has no option to emit a hoisted tree.
sh(`pnpm --filter @photolive/server deploy --prod "${serverRuntime}"`, {
  cwd: repoRoot,
});

// 1a. Drop source-only config the deploy carries over. tsconfig*.json has a
//     relative `extends` that no longer resolves once copied here; it's dead
//     weight in a runtime artifact (we ship compiled dist/) and trips Vite's
//     tsconfig scanner when the web apps rebuild against the workspace tree.
for (const f of fs.readdirSync(serverRuntime)) {
  if (/^tsconfig.*\.json$/.test(f)) {
    fs.rmSync(path.join(serverRuntime, f), { force: true });
    console.log(`[stage] removed source-only ${f} from server-runtime`);
  }
}

// 1b. Flatten the isolated tree into real directories. electron-builder
//     dereferences the top-level links when copying server-runtime as
//     extraResources, which would strand transitive deps that only live under
//     .pnpm (e.g. chokidar -> readdirp) -> runtime "Cannot find package"
//     crash. A flat npm-style tree of real dirs survives the copy and resolves
//     on every platform. See flatten-modules.cjs.
const nodeModules = path.join(serverRuntime, 'node_modules');
flatten(nodeModules);

// 1c. Fail fast if anything didn't flatten. A surviving .pnpm store or a
//     missing transitive dep means the packaged app would crash at runtime —
//     catch it here instead of after a user installs and clicks.
if (fs.existsSync(path.join(nodeModules, '.pnpm'))) {
  throw new Error('[stage] node_modules/.pnpm still present after flatten — tree is not flat');
}
for (const dep of ['readdirp']) {
  if (!fs.existsSync(path.join(nodeModules, dep, 'package.json'))) {
    throw new Error(`[stage] expected transitive dependency "${dep}" missing after flatten`);
  }
}
console.log('[stage] flattened server-runtime/node_modules — no .pnpm, transitive deps hoisted');

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
