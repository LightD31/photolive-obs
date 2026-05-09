# PhotoLive

Real-time event photography slideshow, packaged as a **desktop app**. Cameras (Sony A7IV) FTP into the app; the app renders a slideshow page that displays on any browser-capable screen — PC HDMI, Chromecast/Apple TV, OBS browser source.

## What it does

A team of photographers shoots a live event. Each camera's "Auto FTP" pushes JPEGs to this server. The server hashes/dedups, extracts EXIF, generates display + thumbnail renditions via Sharp, and broadcasts an `image.added` event over WebSocket. An audience-facing slideshow page picks up new images and rotates through them with a configurable transition. An operator drives the control panel from the desktop app (or any browser pointed at the server): caption images live, drag-to-reorder the upcoming queue, approve images before the audience sees them (in approval mode), and see camera-to-screen latency in real time.

## Stack

- **Desktop host**: Electron 33 — boots the server in-process and opens the operator UI in a window.
- **Server**: Node 22, TypeScript (strict), Fastify, `@fastify/websocket`, better-sqlite3 + Drizzle, Sharp + exifr inside a piscina worker pool, ftp-srv with multi-user auth, Pino, Zod.
- **Web**: Vite, React 19, TanStack Router/Query, Zustand, Tailwind 4, shadcn-ui-derived primitives, Lucide icons.
- **Packaging**: electron-builder → NSIS installer + portable ZIP for Windows; AppImage + RPM + DEB for Linux.

## Install (operators)

Download the latest release from the [Releases page](../../releases) and pick:

| Platform | Artifact | Notes |
| --- | --- | --- |
| Windows | `Photolive-<v>-setup.exe` | NSIS installer. SmartScreen will warn "unknown publisher" on first launch — click **More info → Run anyway**. v1 builds are unsigned. |
| Windows (no install) | `Photolive-<v>-windows-x64.zip` | Portable. Unzip and run `Photolive.exe`. |
| Linux (any distro w/ FUSE) | `Photolive-<v>-x86_64.AppImage` | `chmod +x` and double-click. Needs `fuse2`. |
| Fedora/RHEL | `Photolive-<v>-x86_64.rpm` | `sudo dnf install ./Photolive-...rpm` |
| Debian/Ubuntu | `Photolive-<v>-amd64.deb` | `sudo apt install ./Photolive-...deb` |

On first launch:

1. The app generates a 256-bit auth token and writes `<dataDir>/settings.json` (mode 0600).
2. The control panel opens at `http://127.0.0.1:3001/` inside the Electron window.
3. Open **Settings** to change the FTP port range, OBS WebSocket URL, log level, etc. — no `.env` to edit, no restart for hot-reloadable fields.

### Where data lives

By default, photos and the SQLite DB land in a `data/` folder **next to the app executable** (matches the old portable feel). When that location is read-only — Windows Program Files installs, AppImages mounted on `/tmp/.mount_*` — the app falls back to `userData`:

| Platform | Fallback `userData` path |
| --- | --- |
| Windows (per-user) | `%LOCALAPPDATA%\Programs\Photolive\data` |
| Windows (per-machine fallback) | `%APPDATA%\Photolive\data` |
| Linux | `~/.config/Photolive/data` |

Settings → **Data directory override** lets you pick anywhere (e.g. an external drive). The resolved path is shown next to the override input.

### Upgrading from v0.1 (the old standalone tarball/RPM)

If a `.env` from the old build is found next to the executable (or in `/etc/photolive.env`, or `~/.config/photolive/photolive.env`), the desktop app imports its values into the new `settings.json` on first run and shows a one-time confirmation dialog. Your existing auth token, FTP setup, and OBS URL carry over. Existing absolute paths in `DATABASE_PATH` / `PHOTOS_ROOT` / `RENDITIONS_ROOT` are preserved so the existing data dir keeps working in place.

## Camera setup (Sony A7IV)

1. In the operator UI, open **Photographers** for the active event and add a row.
2. The server issues an FTP user/pass and shows a QR code with `ftp://user:pass@host:port`.
3. Configure the A7IV's "Auto FTP" with these credentials. Photos taken on that body are attributed to that photographer in the DB and (optionally) on the slideshow overlay.
4. Recommended: in the camera's "Setting the image size to be transferred for JPEG/HEIF images" menu, pick **Small** for sub-second upload latency. The server still generates display + thumb renditions; a 2 MP source is plenty for 1080p audience screens.

## Curation modes

Per event, set one of:

- `auto` — every ingested image enters the slideshow.
- `auto-skip-blurry` — images with `sharpness_score` below a threshold are auto-excluded; one-click re-include from the queue.
- `approval` — every image lands in a pending tray; operator approves before the audience sees it.

## OBS integration

Two ways:

- **Browser source** (always works): point OBS at `http://<your-machine>:3001/slideshow/?token=<your-token>`. Token is in the desktop app under Settings → Authentication. Use `Settings → Network → Bind host = 0.0.0.0` for LAN access from another OBS box.
- **WebSocket** (optional): set `OBS WebSocket URL` and `Password` in Settings → OBS WebSocket. The server can then drive scene switches; reload the OBS connection live without a server restart.

## Workspace layout

```
apps/
  desktop/        # Electron host (main process + preload + IPC)
  server/         # Fastify + DB + ingest pipeline (also runnable headless)
  web-control/    # React operator UI (served by the server at /)
  web-slideshow/  # React audience-facing display (served at /slideshow/)
packages/
  shared/         # Types, WS event payloads, Zod schemas (server + client)
data/             # gitignored: SQLite DB, photos, renditions
```

## Running from source (developers / NAS / remote-server users)

Requires Node 22 and pnpm 9 (`corepack enable` will activate pnpm if needed).

```bash
pnpm install
cp apps/server/.env.example .env   # set PHOTOLIVE_AUTH_TOKEN
pnpm dev                           # server + both web apps in dev mode
```

Then open <http://localhost:3001/> for the operator panel and <http://localhost:3001/slideshow/> for the OBS browser source.

You can also run the server in JSON-config mode (no `.env`):

```bash
pnpm --filter @photolive/server gen-token   # prints a fresh 256-bit token
# put it in a settings.json — see apps/server/src/config.ts for shape
pnpm --filter @photolive/server exec tsx src/main.ts --settings ./settings.json
```

When bootstrapped from a JSON file, `PUT /api/app-settings` is enabled and edits hot-reload (OBS, FTP, log level) or report `requiresRestart` (port, host, paths, CORS origins). Bootstrapped from `.env`, mutations return 409 — edit `.env` and restart.

To launch Electron from source:

```bash
pnpm --filter @photolive/desktop dev    # builds shared+server+web bundles+desktop, then electron .
```

After the first install you may need to electron-rebuild native modules:

```bash
pnpm --filter @photolive/desktop run rebuild-native
```

To produce platform installers locally:

```bash
pnpm --filter @photolive/desktop package:linux   # AppImage + RPM + DEB
pnpm --filter @photolive/desktop package:win     # NSIS + portable ZIP (cross-build needs wine)
```

CI builds all five artifacts on push of a `v*` tag — see `.github/workflows/release.yml`.

## License

Private.
