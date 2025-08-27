# PhotoLive OBS

A real-time photo slideshow solution for OBS Studio with automatic folder monitoring and web-based control interface. Available as both a standalone web application and a native OBS Studio plugin.

## 🎯 Choose Your Integration Method

### Option 1: **OBS Plugin** (Recommended)
- **Native OBS integration** - No manual browser source setup required
- **Automatic server management** - Plugin handles web server lifecycle
- **Streamlined workflow** - One-click installation and configuration
- **📖 [Plugin Installation Guide](PLUGIN_INSTALL.md)**

### Option 2: **Standalone Web Application**
- **Manual browser source setup** - Add `http://localhost:3001` as browser source
- **Separate server process** - Run Node.js server independently
- **More control** - Direct access to web application files
- **📖 [Web Application Setup](#installation)** (below)

> ⚠️ **Security Warning**: This application is intended for local development and testing purposes only. Do not expose this application to the internet or use it in production environments without proper security review and hardening.

> 🤖 **AI Generated Code**: This application is 100% AI-generated "vibe coded" software. Expect unconventional patterns, potential bugs, and code that works but may not follow best practices. Use at your own risk.

## Features

- **Dual Integration Options**: Native OBS plugin or standalone web application
- Real-time file monitoring with automatic image detection
- Web interface for OBS Studio browser sources
- Control interface with image preview grid
- Multilingual support (English and French)
- Visual filters (Sepia, B&W, Blur, Brightness, Contrast, Vintage, Cool, Warm)
- Text and image watermarks
- Configurable slideshow interval (1-30 seconds)
- Keyboard shortcuts for navigation
- Shuffle mode and repeat options
- WebSocket real-time synchronization

## Installation

### OBS Plugin Installation

For the native OBS plugin experience, see the **[Plugin Installation Guide](PLUGIN_INSTALL.md)**.

### Standalone Web Application Setup

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
npm start
```

The application runs at `http://localhost:3001`

## Usage

### OBS Plugin Usage

If you installed the native plugin:
1. Add **"PhotoLive Slideshow"** source to your OBS scene
2. Configure photos folder and dimensions in source properties
3. Use **"Open Control Interface"** button to access advanced controls
4. Photos are automatically detected and displayed

For detailed plugin usage, see the **[Plugin Installation Guide](PLUGIN_INSTALL.md)**.

### Standalone Web Application Usage

#### OBS Studio Setup

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
