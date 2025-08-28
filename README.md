# PhotoLive OBS

> 🤖 **Vibe Coded**: This project was built with AI assistance and may contain experimental patterns or unconventional approaches.

A Node.js photo slideshow app for OBS Studio. Watches folders, shows images, has a web control interface.

> ⚠️ **Local Use Only**: Built for local streaming setups. Don't put this on the internet without security review.

## Features

- Watches photo folders and auto-updates slideshow
- Web control interface with image grid
- Visual filters and transitions
- Watermarks (text or image)
- WebSocket sync between control and display
- Keyboard shortcuts
- English/French interface
- Works on Windows, macOS, Linux

## Setup

Need Node.js 14+.

```bash
git clone https://github.com/LightD31/photolive-obs.git
cd photolive-obs
npm install
npm start
```

URLs:
- Slideshow: `http://localhost:3001`
- Control: `http://localhost:3001/control`

## Usage

### OBS Setup
1. Add Browser Source
2. URL: `http://localhost:3001`
3. Set your resolution

### Photos
- Put images in `./photos/` folder
- Supports: JPG, PNG, GIF, BMP, TIFF, WebP
- Auto-detects new images

### Controls
- Control page: `http://localhost:3001/control`
- Arrow keys or space for navigation
- P to pause/play

## Tech Stack

- Node.js + Express
- Socket.IO for real-time updates
- Chokidar for file watching
- EXIFR for image metadata
- Vanilla JS frontend

## Configuration

Environment variables:
- `PORT` - Server port (default: 3001)
- `LOG_LEVEL` - ERROR, WARN, INFO, DEBUG
- `ALLOWED_ORIGINS` - CORS origins

Config file: `config/default.json`

## Troubleshooting

**App won't start:**
- Check Node.js version (need 14+)
- Try `npm run clean && npm install`
- Check if port 3001 is free

**Images not showing:**
- Check `photos/` folder exists
- Verify image formats are supported
- Look at console for errors

**OBS not working:**
- Test URL in browser first
- Check OBS browser source settings
- Try refreshing the source

## Development

```bash
npm run test:logging  # Test log levels
LOG_LEVEL=DEBUG npm start  # Debug mode
```
