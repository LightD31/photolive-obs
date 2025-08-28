# PhotoLive OBS

A sophisticated Node.js application that provides real-time photo slideshow functionality specifically designed for OBS Studio browser source integration. Features comprehensive image management, professional control interface, advanced visual effects, and seamless real-time synchronization.

> ⚠️ **Security Notice**: This application is optimized for local development and streaming environments. Production deployment requires additional security hardening and review.

> 🎨 **AI-Enhanced Development**: This application showcases modern web technologies and real-time communication patterns, demonstrating advanced JavaScript techniques and professional-grade user interface design.

## ✨ Key Features

### Real-time Image Management
- **Intelligent folder monitoring** with automatic image detection and EXIF metadata parsing
- **Cross-platform file watching** supporting Windows, macOS, and Linux environments  
- **Comprehensive format support**: JPG, JPEG, PNG, GIF, BMP, TIFF, WebP with size validation
- **Recursive subfolder scanning** with configurable depth and filtering options
- **Priority queue system** for seamless new image integration during live sessions

### Professional Control Interface
- **Grid-based image browser** with thumbnail previews, zoom controls, and sorting options
- **Real-time slideshow preview** with current and next image synchronization
- **Advanced settings management** including intervals, transitions, filters, and watermarks
- **Dynamic folder switching** without application restart or service interruption
- **Comprehensive image exclusion system** for selective slideshow content control

### Advanced Visual Effects
- **8 professional visual filters**: Sepia, Black & White, Blur, Brightness, Contrast, Vintage, Cool, Warm
- **4 smooth transition effects**: None, Fade, Slide, Zoom with configurable durations
- **Dual watermark system**: Custom text watermarks and uploaded PNG image watermarks
- **Flexible positioning**: 9 watermark positions with size and opacity controls
- **Background transparency** optimized for OBS Studio green screen and scene composition

### Real-time Synchronization
- **WebSocket-based communication** ensuring instant updates across all connected interfaces
- **Multi-client support** with simultaneous control and display page synchronization
- **Automatic reconnection** with graceful degradation and recovery mechanisms
- **Live setting updates** with immediate visual feedback and validation
- **Performance monitoring** with connection status and scan progress indicators

### Streaming & Broadcasting
- **OBS Studio optimization** with browser source integration and performance tuning
- **Keyboard navigation** supporting arrow keys, spacebar, and pause controls
- **Multilingual interface** with English and French language support
- **Configurable intervals** from 1-30 seconds with millisecond precision
- **Shuffle and repeat modes** with latest-only filtering for dynamic content management

## 🚀 Installation & Setup

### Prerequisites

- **Node.js 14+**: Download from [nodejs.org](https://nodejs.org/)
- **npm package manager**: Included with Node.js installation
- **Modern web browser**: Chrome, Firefox, Edge, or Safari for optimal experience

### Quick Start

1. **Clone the repository:**

```bash
git clone https://github.com/LightD31/photolive-obs.git
cd photolive-obs
```

2. **Install dependencies:**

```bash
npm install
```

3. **Start the application:**

```bash
npm start
```

**Application URLs:**
- **Slideshow (for OBS):** `http://localhost:3001`
- **Control Interface:** `http://localhost:3001/control`

### Development Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server (same as start)
npm run clean      # Remove dependencies and build artifacts
npm run reinstall  # Clean installation of all dependencies
```

## 📖 Usage Guide

### OBS Studio Integration

**Browser Source Setup:**

1. **Add Browser Source** to your OBS scene
2. **Configure URL:** `http://localhost:3001`
3. **Set dimensions** (e.g., 1920×1080 for Full HD, 3840×2160 for 4K)
4. **Enable options:**
   - ✅ "Shutdown source when not visible" (performance optimization)
   - ✅ "Refresh browser when scene becomes active" (reliability)

### Photo Management

**Folder Setup:**

- **Default location:** `./photos/` directory (auto-created)
- **Supported formats:** JPG, JPEG, PNG, GIF, BMP, TIFF, WebP
- **Automatic detection:** New images are detected and queued instantly
- **Subfolder support:** Enable recursive scanning in control interface
- **Performance tip:** Keep folders under 1000 images for optimal performance

### Control Interface Features

**Access:** `http://localhost:3001/control`

**Core Controls:**

- **▶️ Play/pause slideshow** with real-time synchronization
- **⏮️ ⏭️ Manual navigation** (previous/next/jump to specific image)
- **⚙️ Interval configuration** (1-30 seconds with millisecond precision)
- **🌐 Language selection** (English/French with instant switching)
- **🎨 Visual filters** and transition effects
- **🏷️ Watermark settings** (text or uploaded PNG images)
- **📁 Dynamic folder management** with automatic rescanning
- **🔀 Shuffle and repeat options** with latest-only mode

### Keyboard Shortcuts

**Global shortcuts (work in both slideshow and control interfaces):**

- **→ (Right Arrow)** or **Space:** Next image
- **← (Left Arrow):** Previous image  
- **P:** Toggle play/pause

*Note: Shortcuts are disabled when typing in input fields*

## ⚙️ Configuration & Technical Details

### Project Architecture

```text
photolive-obs/
├── server.js              # Express server with Socket.IO (2000+ lines)
├── config/default.json    # Comprehensive application settings
├── locales/               # English and French translations
├── photos/                # Auto-monitored images folder
├── uploads/watermarks/    # PNG watermark storage
└── public/                # Static web interface files
    ├── slideshow.html     # OBS-optimized slideshow display
    ├── control.html       # Professional control interface
    ├── css/               # Modern responsive stylesheets
    └── js/                # Advanced JavaScript modules
```

### Core Technologies

**Backend Architecture:**
- **Node.js & Express 5.x:** High-performance web server with static file serving
- **Socket.IO 4.x:** Real-time bidirectional WebSocket communication
- **Chokidar 4.x:** Cross-platform file system monitoring with recursive support
- **EXIFR 7.x:** Comprehensive EXIF metadata extraction from image files
- **Multer 2.x:** Secure multipart form handling for watermark uploads

**Frontend Technologies:**
- **Vanilla JavaScript (ES6+):** Modern async/await patterns, destructuring, template literals
- **CSS Grid & Flexbox:** Responsive layouts with hardware-accelerated transitions
- **WebSocket Integration:** Real-time state synchronization without page refreshes
- **Custom Internationalization:** Dynamic language switching with pluralization support

### Advanced Settings

**Server Configuration:**
- **Port:** 3001 (configurable via `PORT` environment variable)
- **CORS Origins:** Localhost by default (`ALLOWED_ORIGINS` for production)
- **Logging:** ERROR, WARN, INFO, DEBUG levels (`LOG_LEVEL` environment variable)

**Image Processing:**
- **Format Support:** JPG, JPEG, PNG, GIF, BMP, TIFF, WebP with comprehensive validation
- **Size Limits:** 10MB maximum, 2MB recommended for optimal performance
- **EXIF Metadata:** Camera settings, GPS coordinates, timestamps, lens information
- **Performance:** <1000 images recommended, SSD storage preferred

**Visual Effects:**
- **Filters:** Sepia, Black & White, Blur, Brightness, Contrast, Vintage, Cool, Warm
- **Transitions:** None, Fade (1s), Slide (1s), Zoom (1.5s) with CSS hardware acceleration
- **Watermarks:** Text with custom fonts, PNG images with position/size/opacity controls

### API Endpoints

**REST API:**
- `GET /api/images` — Complete image listing with EXIF metadata and file information
- `GET /api/settings` — Current slideshow configuration and user preferences
- `POST /api/settings` — Real-time setting updates with validation and WebSocket broadcast
- `POST /api/photos-path` — Dynamic folder switching with automatic rescanning
- `GET /api/locales/:language` — Translation data for English and French interfaces
- `GET /api/watermarks` — Available watermark images with metadata
- `POST /api/watermark-upload` — Secure PNG upload with size validation

**WebSocket Events:**
- Real-time image list updates, settings synchronization, slideshow state management
- Scan progress monitoring, connection status, error handling with automatic reconnection

## 🔧 Troubleshooting & Support

### Common Issues

**Application Startup Problems:**

- Verify Node.js installation: `node --version` (requires 14+)
- Clear dependencies and reinstall: `npm run clean && npm install`
- Check port availability: Change PORT environment variable if 3001 is occupied
- Review console output for specific error messages and stack traces

**Image Detection Issues:**

- Verify `photos/` folder exists with supported image formats
- Check file permissions and read access on image directories
- Monitor server console for file system monitoring errors
- Test recursive scanning toggle in control interface settings

**OBS Integration Problems:**

- Test URL in web browser first: `http://localhost:3001`
- Verify browser source configuration matches application URL
- Check OBS hardware acceleration settings for performance
- Ensure transparent background setting aligns with OBS scene requirements

**Performance Optimization:**

- Reduce image file sizes (< 2MB recommended, 10MB maximum)
- Limit folder contents to < 1000 images for optimal grid performance
- Increase slideshow interval for resource-intensive systems
- Use SSD storage for faster file system operations
- Monitor memory usage during extended sessions with large image collections

### Advanced Diagnostics

**Debug Logging:**
```bash
# Windows PowerShell
$env:LOG_LEVEL="DEBUG"; npm start

# Command Prompt
set LOG_LEVEL=DEBUG && npm start

# Linux/macOS
LOG_LEVEL=DEBUG npm start
```

**Performance Monitoring:**
- WebSocket connection status in browser developer tools
- File system events and EXIF processing in server console
- Memory usage and image loading performance
- API response times and error rates

### Getting Help

1. **Documentation:** Review this README and GitHub repository documentation
2. **Issue Tracking:** Check existing issues for similar problems and solutions
3. **Bug Reports:** Create detailed bug reports with:
   - System information (OS, Node.js version, browser)
   - Console output and error messages
   - Steps to reproduce the issue
   - Expected vs actual behavior
4. **Feature Requests:** Submit enhancement ideas through GitHub issues

### Contributing

We welcome contributions! Please:
- Fork the repository and create feature branches
- Follow existing code style and documentation patterns
- Add comprehensive test coverage for new features
- Update documentation for user-facing changes
- Submit pull requests with detailed descriptions

### License & Support

**License:** MIT License - see repository for full terms

**Support Channels:**
- GitHub Issues for bug reports and feature requests
- Documentation and code examples in repository
- Community discussions and troubleshooting guidance
