# PhotoLive

Real-time event photography slideshow. Cameras (Sony A7IV) FTP into a local server; the server renders a slideshow page that displays on any browser-capable screen — PC HDMI, Chromecast/Apple TV, OBS browser source.

## What it does

A team of photographers shoots a live event. Each camera's "Auto FTP" pushes JPEGs to this server. The server hashes/dedups, extracts EXIF, generates display + thumbnail renditions via Sharp, and broadcasts an `image.added` event over WebSocket. An audience-facing slideshow page picks up new images and rotates through them with a configurable transition. An operator drives the control panel from a laptop or iPad: caption images live, drag-to-reorder the upcoming queue, approve images before the audience sees them (in approval mode), and see camera-to-screen latency in real time.

## Stack

- **Server**: Node 22, TypeScript (strict), Fastify, `@fastify/websocket`, better-sqlite3 + Drizzle, Sharp + exifr inside a piscina worker pool, ftp-srv with multi-user auth, Pino, Zod
- **Web**: Vite, React 19, TanStack Router/Query, Zustand, Tailwind 4, shadcn-ui-derived primitives, Lucide icons, react-i18next
- **Tooling**: pnpm workspaces, Biome, Vitest, Playwright

## Quick start

Requires Node 22 and pnpm 9 (`corepack enable` will activate pnpm if needed).

```bash
pnpm install
cp .env.example .env       # set PHOTOLIVE_AUTH_TOKEN
pnpm db:migrate
pnpm dev                   # server + both web apps
```

Then:

- **Audience slideshow**: <http://localhost:3001/>
- **Operator control panel**: <http://localhost:3002/>

## Workspace layout

```
apps/
  server/         # Fastify + DB + ingest pipeline
  web-control/    # React operator UI
  web-slideshow/  # React audience-facing display (Chromecast-friendly)
packages/
  shared/         # Types, WS event payloads, Zod schemas (server + client)
data/             # gitignored: SQLite DB, photos, renditions
```

## Camera setup (Sony A7IV)

1. In the operator UI, open **Photographers** for the active event and add a row.
2. The server issues an FTP user/pass and shows a QR code with `ftp://user:pass@host:port`.
3. Configure the A7IV's "Auto FTP" with these credentials. Photos taken on that body are attributed to that photographer in the DB and (optionally) on the slideshow overlay.
4. Recommended: in the camera's "Setting the image size to be transferred for JPEG/HEIF images" menu, pick `Small` for sub-second upload latency. The server still generates display + thumb renditions; a 2 MP source is plenty for 1080p audience screens.

## Curation modes

Per event, set one of:

- `auto` — every ingested image enters the slideshow.
- `auto-skip-blurry` — images with `sharpness_score` below a threshold are auto-excluded; one-click re-include.
- `approval` — every image lands in a pending tray; operator approves before the audience sees it.

## License

Private.
