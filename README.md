# PhotoLive OBS 📸

A real-time photo slideshow application specifically designed for OBS Studio integration. This Node.js web application automatically monitors a photo folder and displays images in a customizable slideshow that can be integrated directly into OBS as a browser source.

**Version 1.0.0** - A complete web-based solution built with Node.js, Express, and WebSockets for seamless real-time photo streaming.

> ⚠️ **Security Warning**: This application has been entirely "vibe coded" and may contain security vulnerabilities. It is intended for local development and testing purposes only. Do not expose this application to the internet or use it in production environments without proper security review and hardening.

## ✨ Main Features

- 🔄 **Real-time monitoring** - Automatically detects new images added to the folder with Chokidar file watcher
- 🌐 **Web interface for OBS** - Optimized slideshow page for seamless OBS Studio browser source integration  
- 🎛️ **Advanced control interface** - Comprehensive web-based control panel with real-time preview
- 🌍 **Multilingual support** - Full internationalization with English and French languages, automatic browser detection
- 🎨 **Visual filters** - 9 built-in filters: Sepia, B&W, Blur, Brightness, Contrast, Vintage, Cool, Warm
- 🏷️ **Dual watermark support** - Custom text watermarks OR image watermarks (PNG) with flexible positioning
- 📁 **Dynamic folder management** - Change photo source folder on-the-fly through the control interface
- ⚡ **Real-time updates** - WebSocket communication for instant synchronization across all clients
- 📱 **Responsive design** - Control interface adapts to all screen sizes and devices
- ⌨️ **Keyboard shortcuts** - Quick slideshow control for streamlined operation
- 🔧 **Advanced options** - Shuffle mode, repeat latest images, transparent backgrounds, configurable intervals
- 🔄 **Hot reload** - New images appear automatically without restart or manual refresh

## 🚀 Installation and startup

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**

```bash
git clone https://github.com/LightD31/photolive-obs.git
cd photolive-obs
```

2. **Install dependencies**

```bash
npm install
```

3. **Start the application**

```bash
npm start
```

The application will be accessible at: `http://localhost:3001`

## 🌍 Multilingual Support

PhotoLive OBS includes comprehensive internationalization (i18n) support with intelligent language detection.

### Available Languages

- **English (en)** - Complete interface translation
- **French (fr)** - Interface complète en français

### Language Detection

The application automatically detects the user's language preference through:

1. **Saved preference** - Previously selected language in the control interface
2. **Browser settings** - Automatic detection from `navigator.language`
3. **Fallback** - Default to English if no preference is found

### Language Selection

Users can change the interface language through:

- **Control interface** - Language dropdown in the Quick Settings section
- **Automatic persistence** - Selected language is saved and remembered
- **Real-time switching** - Interface updates immediately without page reload

### Supported Interface Elements

All user-facing text is translated including:

- Control interface labels and buttons
- Status messages and notifications
- Filter and watermark option names
- Section headers and instructions
- Error messages and tooltips

## 📋 Usage

### Configuration in OBS Studio

1. **Add a "Browser" source** to your OBS scene
2. **Configure the URL**: `http://localhost:3001`
3. **Set dimensions** according to your needs (e.g.: 1920x1080)
4. **Enable "Refresh browser when scene becomes active"** (optional)

### Photo management

1. **Add your images** to the `photos/` folder of the project
2. **Supported formats**: JPG, JPEG, PNG, GIF, BMP, TIFF, WebP
3. **Automatic monitoring** - New images will appear automatically

### Control interface

Access the control interface at: `http://localhost:3001/control`

#### Available controls

- ▶️ **Play/Pause** slideshow with real-time state sync
- ⏭️ **Manual navigation** (previous/next/jump to specific image)
- ⏱️ **Configurable interval** for automatic image changes (1-30 seconds)
- 🌍 **Language selection** - Switch between English and French with automatic browser detection
- 🎨 **Visual filters**: None, Sepia, B&W, Blur, Brightness, Contrast, Vintage, Cool, Warm
- 🏷️ **Watermark options**: 
  - Text watermarks with custom content
  - Image watermarks (PNG upload support)
  - 5 position options with size and opacity controls
- 📁 **Folder management**: Change photo source folder dynamically
- 🔧 **Advanced settings**: 
  - Shuffle images randomly
  - Repeat only latest N images
  - Transparent background for OBS
  - Real-time image count and status

### Keyboard shortcuts

On the slideshow page (`http://localhost:3001`):

- `→` or `Space`: Next image
- `←`: Previous image  
- `P`: Pause/Play

On the control interface:

- Same shortcuts available (except when typing in a field)

## 🛠️ Configuration

### Folder structure

```text
photolive-obs/
├── server.js              # Main Express server with WebSocket support
├── package.json           # npm configuration and dependencies
├── config/
│   └── default.json       # Complete application configuration
├── locales/               # Internationalization files
│   ├── en.json           # English translations
│   └── fr.json           # French translations
├── photos/                # Default images folder (auto-created)
├── uploads/               # Watermark images storage (auto-created)
└── public/                # Static web files served by Express
    ├── slideshow.html     # OBS-optimized slideshow page
    ├── control.html       # Advanced control interface
    ├── css/
    │   ├── slideshow.css  # Slideshow styling and effects
    │   └── control.css    # Control interface styling
    └── js/
        ├── slideshow.js   # WebSocket client for slideshow
        ├── control.js     # Control interface logic
        └── i18n.js        # Internationalization system
```

### Server configuration

The `config/default.json` file contains comprehensive application settings:

```json
{
  "server": {
    "port": 3001,
    "photosPath": "./photos",
    "allowedOrigins": ["*"]
  },
  "slideshow": {
    "interval": 5000,
    "minInterval": 1000,
    "maxInterval": 30000,
    "supportedFormats": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"],
    "maxImageSize": "10MB",
    "thumbnailSize": 200
  },
  "features": {
    "filters": [...],
    "watermarkPositions": [...],
    "watermarkTypes": [
      { "id": "text", "name": "Texte" },
      { "id": "image", "name": "Image PNG" }
    ]
  },
  "defaults": {
    "shuffleImages": true,
    "transparentBackground": true,
    "repeatLatest": false,
    "latestCount": 5,
    "language": "en"
  }
}
```

## 🏗️ Technical Architecture

PhotoLive OBS is built as a modern web application using:

- **Backend**: Node.js with Express framework
- **Real-time communication**: Socket.IO for WebSocket connections
- **File monitoring**: Chokidar for cross-platform file system watching  
- **File uploads**: Multer for handling watermark image uploads
- **Internationalization**: Custom i18n system with automatic browser language detection
- **Security**: Input validation, path traversal protection, file type verification
- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Styling**: CSS Grid, Flexbox, and CSS animations for smooth image display

### Key Dependencies

- `express` - Web server framework
- `socket.io` - Real-time bidirectional communication
- `chokidar` - File system watcher
- `multer` - Multipart form data handling
- `cors` - Cross-origin resource sharing

## 🔧 Development

### Available scripts

- `npm start`: Start production server
- `npm run dev`: Start development server (identical for now)

### REST API

The application exposes a comprehensive REST API:

#### Core endpoints
- `GET /api/images` - Retrieve list of images with metadata (filename, size, timestamps, new status)
- `GET /api/settings` - Get current slideshow configuration
- `POST /api/settings` - Update slideshow settings (interval, filter, watermark, etc.)

#### Folder management
- `POST /api/photos-path` - Change the source photos folder dynamically

#### Internationalization
- `GET /api/locales/:language` - Get translations for specified language (en, fr)

#### Watermark management
- `GET /api/watermarks` - List available watermark images
- `POST /api/watermark-upload` - Upload new watermark image (PNG format)

#### Image serving
- `GET /photos/:filename` - Serve images from current photos folder with security validation

### WebSocket Events

#### Events emitted by server
- `images-updated` - New list of detected images with settings
- `settings-updated` - Updated slideshow configuration
- `slideshow-state` - Current slideshow state (current image, index, play status)
- `image-changed` - Notification when current image changes

#### Events received from clients
- `next-image` - Advance to next image
- `prev-image` - Go to previous image  
- `jump-to-image` - Jump to specific image by index
- `pause-slideshow` - Pause automatic progression
- `resume-slideshow` - Resume automatic progression
- `get-slideshow-state` - Request current slideshow state

## 🎯 Use Cases

### Live streaming and events

- **Wedding photography** - Display photos taken during the ceremony in real-time
- **Conference presentations** - Show speaker photos, audience shots, or event highlights
- **Concert visuals** - Dynamic backdrop with artist photos and fan submissions
- **Gaming streams** - Showcase community art, screenshots, or memorable moments

### Content creation

- **Twitch/YouTube integration** - Automated photo rotations during stream breaks
- **Podcast visuals** - Display guest photos, topic-related images, or listener submissions
- **Educational content** - Visual aids that update automatically during lessons
- **Product showcases** - Rotating product photography for e-commerce streams

### Professional applications

- **Photography portfolios** - Real-time client galleries that update as you shoot
- **Digital signage** - Dynamic displays for businesses, galleries, or exhibitions
- **Event displays** - Information screens with rotating content at venues
- **Surveillance monitoring** - Continuous display of security camera snapshots

## 🔍 Troubleshooting

### Application won't start

- Check that Node.js is installed: `node --version`
- Check that dependencies are installed: `npm install`
- Check that port 3001 is not in use

### Images don't appear

- Check that the `photos/` folder exists
- Check supported image formats
- Check the control interface console for errors

### OBS doesn't load the page

- Check the URL: `http://localhost:3001`
- Test first in a web browser
- Check browser source settings in OBS

### Performance issues

- **Reduce image size** (recommended: < 2MB per image, max 10MB supported)
- **Limit folder contents** (< 1000 images recommended for optimal performance)
- **Increase image change interval** to reduce CPU usage
- **Disable shuffle mode** for better performance with large image sets
- **Use SSD storage** for faster image loading

### Watermark issues

- **Text watermark not showing**: Check watermark is enabled and text is not empty
- **Image watermark not appearing**: Ensure uploaded file is PNG format and < 5MB
- **Watermark position issues**: Try different position settings in control interface

### Network and connectivity

- **Control interface not responding**: Check WebSocket connection in browser console
- **Images not syncing**: Verify both slideshow and control pages are connected
- **Slow image loading**: Check network speed and image file sizes

### Language and localization

- **Interface not in expected language**: Check browser language settings or use language selector in control interface
- **Missing translations**: Verify localization files exist in `/locales/` directory
- **Language not persisting**: Check browser localStorage and ensure settings are saved properly
- **Translation loading errors**: Check browser console for failed requests to `/api/locales/` endpoints

## 📝 License

MIT License - You are free to use, modify and distribute this application.

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Propose new features  
- Improve documentation
- Submit pull requests

## 📞 Support

For any questions or problems:

1. First consult this documentation
2. Check existing issues
3. Create a new issue if necessary

---

**PhotoLive OBS** - Transform your photos into a professional slideshow for OBS Studio! 🎬✨
