# PhotoLive OBS

A Node.js application that monitors a photo folder and displays images in a slideshow for OBS Studio browser sources. The application provides real-time file monitoring and a web-based control interface.

> ⚠️ **Security Warning**: This application is intended for local development and testing purposes only. Do not expose this application to the internet or use it in production environments without proper security review and hardening.

> 🤖 **AI Generated Code**: This application is 100% AI-generated "vibe coded" software. Expect unconventional patterns, potential bugs, and code that works but may not follow best practices. Use at your own risk.

## Features

- Real-time file monitoring with automatic image detection
- Web interface for OBS Studio browser sources
- **Native desktop app with folder browser dialogs**
- Control interface with image preview grid
- **Executable packaging for Windows, macOS, and Linux**
- Multilingual support (English and French)
- Visual filters (Sepia, B&W, Blur, Brightness, Contrast, Vintage, Cool, Warm)
- Text and image watermarks
- Configurable slideshow interval (1-30 seconds)
- Keyboard shortcuts for navigation
- Shuffle mode and repeat options
- WebSocket real-time synchronization

## Installation

### Prerequisites

- Node.js (version 14 or higher)
- npm

### Setup

1. Clone the repository:
```bash
git clone https://github.com/LightD31/photolive-obs.git
cd photolive-obs
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
# Web application mode
npm start

# Desktop application mode (with native folder dialogs)
npm run electron
```

The web application runs at `http://localhost:3001`

### Creating Executables

To create standalone executable files:

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build-win     # Windows executable
npm run build-mac     # macOS application
npm run build-linux   # Linux AppImage
```

Built executables will be in the `dist/` folder and can be distributed without requiring Node.js installation.

## Usage

### Folder Selection

**Desktop App (Electron):**
- Click the "📁 Browse..." button to open native OS folder dialog
- Use Ctrl/Cmd+O keyboard shortcut
- Selected folder is automatically applied

**Web Browser:**
- Type folder path manually in the text input
- Click "Change" to apply the new folder

### OBS Studio Setup

1. Add a "Browser" source to your OBS scene
2. Set URL to: `http://localhost:3001`
3. Configure dimensions as needed (e.g., 1920x1080)

### Photo Management

1. Add images to the `photos/` folder
2. Supported formats: JPG, JPEG, PNG, GIF, BMP, TIFF, WebP
3. New images are detected automatically

### Control Interface

Access the control interface at: `http://localhost:3001/control`

Available controls:
- Play/pause slideshow
- Manual navigation (previous/next/jump to image)
- Interval configuration (1-30 seconds)
- Language selection (English/French)
- Visual filters
- Watermark settings (text or image)
- Folder management
- Shuffle and repeat options

### Keyboard Shortcuts

- `→` or `Space`: Next image
- `←`: Previous image  
- `P`: Pause/Play

## Configuration

### File Structure

```
photolive-obs/
├── server.js              # Main Express server
├── config/default.json    # Application configuration
├── locales/               # Translation files (en.json, fr.json)
├── photos/                # Default images folder
├── uploads/               # Watermark images storage
└── public/                # Static web files
    ├── slideshow.html     # OBS slideshow page
    ├── control.html       # Control interface
    ├── css/               # Stylesheets
    └── js/                # Client-side scripts
```

### Settings

Configuration is stored in `config/default.json`:

- Server port (default: 3001)
- Photos folder path
- Slideshow interval limits
- Supported image formats
- Default language and options

## Technical Details

Built with Node.js and Express, using:

- Socket.IO for real-time communication
- Chokidar for file system monitoring
- Multer for file uploads
- Custom internationalization system

### API Endpoints

- `GET /api/images` - List images with metadata
- `GET /api/settings` - Get slideshow configuration
- `POST /api/settings` - Update settings
- `POST /api/photos-path` - Change photos folder
- `GET /api/locales/:language` - Get translations
- `GET /api/watermarks` - List watermark images
- `POST /api/watermark-upload` - Upload watermark image

## Troubleshooting

**Application won't start:**
- Verify Node.js installation: `node --version`
- Install dependencies: `npm install`
- Check port 3001 availability

**Images don't appear:**
- Verify `photos/` folder exists
- Check image format support
- Review console for errors

**OBS issues:**
- Test URL in web browser first: `http://localhost:3001`
- Verify browser source configuration

**Performance issues:**
- Reduce image file sizes (< 2MB recommended)
- Limit folder contents (< 1000 images)
- Increase slideshow interval
- Use SSD storage for better performance

## License

MIT License

## Contributing

Contributions welcome. Please report bugs and suggest features through GitHub issues.

## Support

1. Check this documentation
2. Review existing issues
3. Create a new issue if needed
