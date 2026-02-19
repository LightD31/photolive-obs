# PhotoLive OBS - GitHub Copilot Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

PhotoLive OBS is a sophisticated Node.js real-time photo slideshow application designed specifically for OBS Studio browser source integration. It provides automatic folder monitoring, real-time synchronization, comprehensive control interface, and advanced features including watermarks, visual filters, EXIF metadata parsing, and multilingual support.

## Core Features & Capabilities

### Real-time Photo Management
- **Automatic folder monitoring**: Uses Chokidar for cross-platform file system watching
- **EXIF metadata parsing**: Full camera data extraction (camera, lens, settings, GPS, timestamps)
- **Dynamic image detection**: Supports .jpg, .jpeg, .png, .gif, .bmp, .tiff, .webp formats
- **Recursive folder scanning**: Optional subfolder monitoring
- **Priority queuing**: New images automatically queued for display
- **Image exclusion system**: Toggle individual images in/out of slideshow

### Advanced Slideshow Controls
- **Real-time synchronization**: WebSocket-based communication between slideshow and control pages
- **Visual filters**: Sepia, Black & White, Blur, Brightness, Contrast, Vintage, Cool, Warm
- **Transition effects**: None, Fade, Slide, Zoom with configurable durations
- **Watermark system**: Text and image watermarks with position, size, opacity controls
- **Flexible intervals**: 1-30 second configurable timing
- **Playback modes**: Shuffle, repeat, latest-only (configurable count)
- **Background options**: Transparent or colored backgrounds for OBS integration

### Professional Control Interface
- **Grid-based image browser**: Thumbnail grid with zoom levels and sorting options
- **Real-time preview**: Current and next image preview synchronized with slideshow
- **Advanced folder management**: Dynamic folder switching with automatic rescanning
- **Watermark upload system**: PNG file upload with validation and preview
- **Comprehensive settings**: All slideshow parameters controllable in real-time
- **Performance monitoring**: Scan progress indicators and connection status
- **Export capabilities**: URL copying for OBS setup

### Internationalization & Accessibility
- **Multilingual support**: English and French with dynamic language switching
- **Keyboard shortcuts**: Arrow keys, spacebar, P for pause across all interfaces
- **Responsive design**: Optimized for various screen sizes and OBS browser sources
- **Visual feedback**: Status indicators, notifications, and progress tracking

## Working Effectively

### Quick Start & Installation
- Install Node.js (version 14 or higher required): Check with `node --version`
- Install dependencies: `npm install` -- takes ~7 seconds. No timeout needed.
- Start application: `npm start` -- starts immediately (under 1 second). No timeout needed.
- Application runs on: `http://localhost:3001`
- Control interface: `http://localhost:3001/control`
- OBS slideshow page: `http://localhost:3001`

### Development Commands
- `npm start`: Start production server (identical to dev for this application)
- `npm run dev`: Start development server (same as npm start)
- `npm test`: Run Jest test suite
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Run tests with coverage report
- `npm run lint`: Run ESLint on source files
- `npm run lint:fix`: Run ESLint with auto-fix
- `npm run clean`: Remove dist, node_modules, package-lock.json
- `npm run reinstall`: Clean and reinstall dependencies

### Debug Logging
- **Enable debug logging**: Set `LOG_LEVEL=DEBUG` in `.env` file or as environment variable
- **Windows PowerShell**: `$env:LOG_LEVEL="DEBUG"; node server.js`
- **Windows Command Prompt**: `set LOG_LEVEL=DEBUG && node server.js`
- **Linux/macOS**: `LOG_LEVEL=DEBUG node server.js`
- **Using .env file**: Copy `.env.example` to `.env` and set `LOG_LEVEL=DEBUG`
- **Debug levels available**: ERROR, WARN, INFO, DEBUG (default: INFO)
- **Debug output includes**: File monitoring events, WebSocket connections, API requests, image processing, real-time state changes

### Key Dependencies & Technologies
- **Backend**: Node.js, Express.js 5.x, Socket.IO 4.x for real-time communication
- **File Monitoring**: Chokidar 4.x for cross-platform file system watching
- **Image Processing**: EXIFR 7.x for comprehensive EXIF metadata extraction
- **File Uploads**: Multer 2.x for multipart form handling (watermark uploads)
- **Validation**: Zod for schema-based API input validation
- **Compression**: compression middleware for HTTP gzip/deflate
- **Environment**: dotenv for .env file support
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 with CSS Grid and Flexbox
- **Real-time Communication**: WebSocket via Socket.IO for bidirectional updates
- **Testing**: Jest for unit and integration tests
- **Linting**: ESLint with recommended rules
- **Cross-Platform**: Windows, macOS, Linux support with native file watching

## Validation

### Always Test Complete Feature Set
After making any changes, ALWAYS validate with this comprehensive end-to-end scenario:

1. **Start the application**: `npm start` (immediate startup)
2. **Create test images**: Use the comprehensive Python script below for realistic test data
3. **Test slideshow functionality**: Navigate to `http://localhost:3001` and verify:
   - Images display with proper transitions and filters
   - Keyboard controls work (arrows, spacebar, P for pause)
   - Background transparency settings apply correctly
4. **Test control interface**: Navigate to `http://localhost:3001/control` and verify:
   - Image grid displays with thumbnails and metadata
   - Real-time preview updates synchronously with slideshow
   - All playback controls function (play/pause, navigation, jump to image)
   - Settings apply immediately (filters, watermarks, intervals, transitions)
   - Folder management works (change folder, rescan, recursive search)
   - Watermark upload and configuration functions properly
   - Language switching updates all interface elements
5. **Test real-time synchronization**: 
   - Open both slideshow and control pages simultaneously
   - Verify changes in control interface immediately reflect in slideshow
   - Test WebSocket reconnection by temporarily stopping/starting server
6. **Test API endpoints**: Verify all REST endpoints respond correctly
7. **Test file monitoring**: Add/remove images and verify automatic detection and queue updates
8. **Test advanced features**: Shuffle mode, exclusion system, metadata parsing, latest-only mode

### Comprehensive Test Image Generation
ALWAYS use this enhanced Python script to create realistic test images with full EXIF metadata:

```python
# Run: python create_test_images.py
# This script creates 9 test images with realistic EXIF metadata including:
# - Camera settings (ISO, aperture, shutter speed, focal length)
# - GPS coordinates (every 3rd image)
# - Realistic timestamps and camera equipment data
# - Multiple formats: landscape HD, portrait, square
# - Various color themes for visual distinction

import os
import time
import datetime
from PIL import Image, ImageDraw, ImageFont

# Create comprehensive test images with metadata
def create_test_images():
    photos_dir = './photos'
    os.makedirs(photos_dir, exist_ok=True)
    
    formats = [
        {'name': 'Landscape HD', 'width': 1920, 'height': 1080, 'ratio': '16:9'},
        {'name': 'Portrait', 'width': 1080, 'height': 1920, 'ratio': '9:16'},
        {'name': 'Square', 'width': 1080, 'height': 1080, 'ratio': '1:1'},
    ]
    
    styles = [
        {'theme': 'Blue', 'bg_color': (52, 152, 219), 'text_color': (255, 255, 255)},
        {'theme': 'Green', 'bg_color': (46, 204, 113), 'text_color': (255, 255, 255)},
        {'theme': 'Red', 'bg_color': (231, 76, 60), 'text_color': (255, 255, 255)},
    ]
    
    image_count = 1
    for format_info in formats:
        for style in styles:
            width, height = format_info['width'], format_info['height']
            img = Image.new('RGB', (width, height), style['bg_color'])
            draw = ImageDraw.Draw(img)
            
            # Use default font for cross-platform compatibility
            try:
                font = ImageFont.truetype("arial.ttf", 60) if os.name == 'nt' else ImageFont.load_default()
            except:
                font = ImageFont.load_default()
            
            title = f'Test Image {image_count:02d}'
            subtitle = f"{format_info['name']} • {format_info['ratio']} • {style['theme']}"
            
            # Center the text
            title_bbox = draw.textbbox((0, 0), title, font=font)
            title_width = title_bbox[2] - title_bbox[0]
            title_height = title_bbox[3] - title_bbox[1]
            title_x = (width - title_width) // 2
            title_y = height // 2 - title_height
            
            # Draw title with shadow
            draw.text((title_x + 2, title_y + 2), title, fill=(0, 0, 0, 128), font=font)
            draw.text((title_x, title_y), title, fill=style['text_color'], font=font)
            
            # Draw subtitle
            subtitle_bbox = draw.textbbox((0, 0), subtitle, font=font)
            subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
            subtitle_x = (width - subtitle_width) // 2
            subtitle_y = title_y + title_height + 20
            
            draw.text((subtitle_x + 1, subtitle_y + 1), subtitle, fill=(0, 0, 0, 100), font=font)
            draw.text((subtitle_x, subtitle_y), subtitle, fill='white', font=font)
            
            filename = f'test_image_{image_count:02d}_{format_info["name"].lower().replace(" ", "_")}_{style["theme"].lower()}.jpg'
            filepath = os.path.join(photos_dir, filename)
            
            # Save with high quality
            img.save(filepath, 'JPEG', quality=95, optimize=True)
            print(f'✓ Created: {filename} ({width}×{height})')
            image_count += 1
    
    print(f'\n🎉 {len(formats) * len(styles)} test images created in {photos_dir}/')

if __name__ == "__main__":
    create_test_images()
```

## Application Architecture

### Core Server Components
- **server.js**: Entry point — loads dotenv, creates PhotoLiveApp, handles graceful shutdown
- **src/app.js**: Main application class `PhotoLiveApp` orchestrating all services:
  - Express.js web server with compression and static file serving
  - Socket.IO WebSocket server for real-time bidirectional communication
  - Service initialization and event wiring
  - Graceful shutdown handling
- **src/services/**: Business logic services:
  - **imageService.js**: Image scanning, EXIF extraction, thumbnail generation, semaphore-based concurrency
  - **slideshowService.js**: Slideshow state machine, timer, queue system, playback control
  - **fileWatcher.js**: Chokidar-based file system watcher (extends Node.js EventEmitter)
  - **socketService.js**: Socket.IO event handling and broadcasting (extends Node.js EventEmitter)
- **src/routes/**: Express route handlers:
  - **api.js**: REST API for settings, images, watermarks, locales, folder management
  - **images.js**: Secure image serving with path validation
- **src/middleware/**: Express middleware:
  - **security.js**: Security headers (SAMEORIGIN for OBS, XSS protection, Referrer-Policy)
  - **errorHandler.js**: Centralized error handling (Multer errors, generic errors)
- **src/validation/**: Input validation schemas:
  - **schemas.js**: Zod schemas for settings and photos-path validation
- **src/config/index.js**: ConfigManager singleton loading config/default.json with fallback
- **src/utils/logger.js**: Logger singleton with configurable levels (ERROR, WARN, INFO, DEBUG)

### Configuration & Internationalization
- **config/default.json**: Comprehensive application configuration (74 lines)
  - Server settings (port, CORS, logging)
  - Slideshow parameters (intervals, supported formats, transitions)
  - Filter and watermark definitions
  - Default values for all features
- **locales/**: Complete i18n system with English and French translations
  - Dynamic language switching without page reload
  - Comprehensive UI element translations
  - Pluralization and context-aware translations

### Frontend Architecture
- **public/slideshow.html**: OBS-optimized slideshow display
  - Fullscreen-ready design with CSS Grid layout
  - Hardware-accelerated CSS transitions
  - Keyboard navigation support
  - Real-time WebSocket integration
- **public/control.html**: Professional control interface (500+ lines)
  - Responsive grid-based image browser with zoom and sort controls
  - Real-time preview synchronization
  - Comprehensive settings management
  - Progress indicators and status monitoring
- **public/js/slideshow.js**: Slideshow client logic (700+ lines)
  - Advanced image preloading and caching
  - CSS filter and transition management
  - Watermark rendering system
  - WebSocket event handling
- **public/js/control-new.js**: Control interface logic (modular)
  - Uses modules from public/js/modules/
  - Real-time state synchronization
  - File upload handling
- **public/js/modules/**: Modular JavaScript components
  - **socketClient.js**: WebSocket client with reconnection logic
  - **imageGrid.js**: Grid rendering with zoom and sort controls  
  - **slideshowControls.js**: Playback control UI module
  - **settingsManager.js**: Settings synchronization module

### File System & Storage
- **photos/**: Auto-created images folder with intelligent monitoring
  - Support for 7 image formats with size validation
  - Recursive subfolder scanning (optional)
  - Metadata extraction and caching
  - Priority queue for new image display
- **uploads/watermarks/**: PNG watermark storage with validation
  - File size limits and format validation
  - Unique filename generation
  - Automatic cleanup of unused files

## Advanced Configuration

### Comprehensive Settings (config/default.json)
- **Server Configuration**:
  - Port: 3001 (configurable via PORT environment variable)
  - CORS origins: localhost by default, configurable via ALLOWED_ORIGINS
  - Log level: INFO (DEBUG, WARN, ERROR available)
- **Image Management**:
  - Photos folder: `./photos` (changeable via control interface)
  - Supported formats: .jpg, .jpeg, .png, .gif, .bmp, .tiff, .webp
  - Max file size: 10MB with performance recommendations
  - Recursive scanning: Configurable subfolder monitoring
- **Slideshow Features**:
  - Interval range: 1-30 seconds with millisecond precision
  - Transitions: None, Fade, Slide, Zoom with configurable durations
  - Filters: 8 visual filters including vintage, cool, warm effects
  - Background: Transparent or colored options for OBS integration
- **Watermark System**:
  - Types: Text with custom messages, PNG image upload
  - Positions: 9 position options (corners, edges, center)
  - Sizes: Small, medium, large with percentage-based scaling
  - Opacity: 0-100% with real-time preview
- **Advanced Options**:
  - Shuffle mode with intelligent randomization
  - Latest-only mode with configurable count (1-20 images)
  - Image exclusion system for selective display
  - Real-time folder switching without restart

### Environment Variables
- `PORT`: Server port (default: 3001)
- `ALLOWED_ORIGINS`: Comma-separated CORS origins for security
- `LOG_LEVEL`: Logging verbosity (ERROR, WARN, INFO, DEBUG)
- `NODE_ENV`: Environment mode affects default settings

## Comprehensive API Reference

### REST Endpoints
- `GET /api/images`: Complete image listing with metadata
  - Returns: filename, size, timestamps, EXIF data, new status, exclusion state
  - Includes: Camera settings, GPS coordinates, technical specifications
- `GET /api/settings`: Current slideshow configuration
  - All user preferences, folder settings, feature toggles
- `POST /api/settings`: Update slideshow configuration
  - Real-time setting updates with immediate WebSocket broadcast
  - Validation and error handling for all parameters
- `POST /api/photos-path`: Dynamic folder switching
  - Change source folder with automatic rescanning and validation
- `GET /api/locales/:language`: Internationalization data
  - Complete translation objects for English and French
- `GET /api/watermarks`: List available watermark images
  - Uploaded PNG files with metadata and file information
- `POST /api/watermark-upload`: Upload new watermark image
  - PNG validation, size limits, unique filename generation
- `GET /photos/:filename`: Secure image serving
  - Path validation, format checking, performance optimization

### WebSocket Events (Real-time Communication)
**Server to Client:**
- `images-updated`: Complete image list with settings
  - Triggered by: File system changes, folder switches, setting updates
  - Payload: All images for grid, filtered images for slideshow, metadata
- `settings-updated`: Configuration changes
  - Real-time synchronization of all slideshow parameters
- `slideshow-state`: Current playback state
  - Current image, index, play/pause status, queue information
- `image-changed`: Image transition notifications
  - Image data, transition timing, next image preview
- `scan-progress`: Folder scanning progress
  - Progress percentage, current file, completion status

**Client to Server:**
- `next-image`, `prev-image`: Navigation controls with validation
- `jump-to-image`: Direct image selection with index verification
- `pause-slideshow`, `resume-slideshow`: Playback control
- `get-slideshow-state`: State synchronization request
- `toggle-image-exclusion`: Include/exclude images from slideshow

## Professional Development Workflow

### Adding New Features
1. **Server-side implementation**: Add/modify services in `src/services/`, routes in `src/routes/`, or validation in `src/validation/`
2. **Client-side integration**: Update `public/js/control-new.js`, `public/js/modules/`, and/or `public/js/slideshow.js`
3. **Configuration integration**: Add new settings to `config/default.json` with appropriate defaults
4. **Validation**: Add Zod schema validation in `src/validation/schemas.js` for new settings
5. **Internationalization**: Update `locales/en.json` and `locales/fr.json` for new UI strings
6. **HTML structure**: Modify `public/control.html` or `public/slideshow.html` for new interface elements
7. **CSS styling**: Update `public/css/control.css` or `public/css/slideshow.css` for visual changes
8. **Tests**: Add Jest tests in `tests/unit/` for new service logic and validation
9. **ALWAYS execute complete validation workflow** after any modifications

### Advanced Debugging & Diagnostics
- **Server-side debugging**:
  - Enable DEBUG logging: `$env:LOG_LEVEL="DEBUG"; node server.js` (PowerShell) or set in `.env`
  - Monitor: File detection events, WebSocket connections, API requests, image processing
  - EXIF parsing errors, queue management, performance metrics
- **Client-side debugging**:
  - Browser developer tools for WebSocket connections and API responses
  - Console logging for state synchronization, grid rendering, event handling
  - Network tab for image loading performance and API timing
- **Real-time synchronization testing**:
  - Multiple browser windows for simultaneous control and slideshow testing
  - WebSocket reconnection testing with server restarts
  - Cross-browser compatibility verification

### Performance Optimization Guidelines
- **Image recommendations**:
  - Optimal size: <2MB per image for smooth transitions
  - Maximum supported: 10MB with performance warnings
  - Recommended formats: JPEG for photos, PNG for graphics
- **Folder management**:
  - Optimal count: <1000 images for best grid performance
  - Large folders: Use latest-only mode or image exclusion
  - Subfolder scanning: Enable recursive search only when necessary
- **System performance**:
  - SSD storage recommended for large image collections
  - Monitor memory usage with large EXIF datasets
  - Network bandwidth considerations for remote folders
- **Browser optimization**:
  - Image preloading limits to prevent memory issues
  - Grid virtualization for large image collections
  - Debounced updates to prevent excessive API calls

## Comprehensive Troubleshooting Guide

### Application Startup Issues
- **Node.js compatibility**: Verify version 14+ with `node --version`
- **Dependencies**: Clean install with `npm run clean && npm install`
- **Port conflicts**: Check port 3001 availability or set custom PORT environment variable
- **File permissions**: Verify read/write access to photos and uploads directories
- **Windows-specific**: Ensure PowerShell execution policy allows script running

### Image Detection & Display Problems
- **Folder verification**: Confirm photos folder exists with supported image formats
- **File permissions**: Check read access on image files and parent directories
- **Format support**: Verify files have extensions: .jpg, .jpeg, .png, .gif, .bmp, .tiff, .webp
- **EXIF processing**: Monitor console for metadata parsing errors
- **Queue management**: Check debug logs for image queuing and priority handling
- **Memory issues**: Monitor system memory usage with large image collections

### Real-time Synchronization Issues
- **WebSocket connections**: Verify connections in browser developer tools Network tab
- **Browser compatibility**: Test with Chrome, Firefox, Edge for WebSocket support
- **Network configuration**: Check localhost connectivity and firewall settings
- **State desync**: Restart application to reset WebSocket connections
- **Multiple clients**: Test behavior with multiple control interfaces simultaneously

### Performance & Optimization
- **Large image collections**: Use latest-only mode or image exclusion for >1000 images
- **Slow loading**: Reduce image file sizes or increase slideshow intervals
- **Memory consumption**: Monitor browser memory usage during extended sessions
- **Grid rendering**: Adjust zoom levels for better performance with many images
- **Network bottlenecks**: Consider local SSD storage for faster file access

### OBS Studio Integration
- **Browser source setup**: Verify URL `http://localhost:3001` in OBS
- **Dimensions**: Match OBS browser source size to intended display resolution
- **Performance**: Test with hardware acceleration enabled in OBS
- **Background transparency**: Ensure transparent background setting matches OBS needs
- **Audio issues**: Verify no audio elements interfere with OBS audio setup

### Advanced Diagnostics
- **Debug logging**: Enable comprehensive logging with `LOG_LEVEL=DEBUG`
- **API testing**: Manually test endpoints with curl or browser developer tools
- **File system monitoring**: Verify Chokidar events in debug logs
- **Database/cache**: Clear browser cache and restart for clean state
- **Cross-platform**: Test file path handling on different operating systems

## Professional File Structure Reference

```
photolive-obs/
├── server.js                    # Entry point — loads dotenv, creates PhotoLiveApp
│
├── src/                         # Modular server-side code
│   ├── app.js                  # Main PhotoLiveApp class (Express + Socket.IO + services)
│   ├── config/
│   │   └── index.js            # ConfigManager singleton (loads config/default.json)
│   ├── middleware/
│   │   ├── security.js         # Security headers (SAMEORIGIN, XSS, Referrer-Policy)
│   │   └── errorHandler.js     # Centralized error handling
│   ├── routes/
│   │   ├── api.js              # REST API routes (settings, images, watermarks, locales)
│   │   └── images.js           # Secure image serving with path validation
│   ├── services/
│   │   ├── imageService.js     # Image scanning, EXIF extraction, thumbnails
│   │   ├── slideshowService.js # Slideshow state machine, timer, queue
│   │   ├── fileWatcher.js      # Chokidar file watcher (extends EventEmitter)
│   │   └── socketService.js    # Socket.IO event handling (extends EventEmitter)
│   ├── utils/
│   │   └── logger.js           # Logger singleton (ERROR/WARN/INFO/DEBUG)
│   └── validation/
│       └── schemas.js          # Zod schemas for API input validation
│
├── package.json                # Dependencies and npm scripts
├── jest.config.js              # Jest test configuration
├── eslint.config.js            # ESLint flat config
├── .env.example                # Environment variables template
│
├── tests/                      # Automated test suite
│   └── unit/
│       ├── logger.test.js
│       ├── slideshowService.test.js
│       └── validation.test.js
│
├── config/
│   └── default.json            # Application configuration
│
├── locales/
│   ├── en.json
│   └── fr.json
│
├── photos/                     # Auto-created images folder
│
├── uploads/
│   └── watermarks/
│
├── public/
│   ├── slideshow.html
│   ├── control.html
│   ├── css/
│   │   ├── slideshow.css
│   │   └── control.css
│   └── js/
│       ├── slideshow.js
│       ├── control-new.js      # Modular control interface
│       ├── i18n.js
│       └── modules/
│           ├── socketClient.js
│           ├── imageGrid.js
│           ├── slideshowControls.js
│           └── settingsManager.js
│
├── create_test_images.py
├── start.bat / start.ps1 / start.sh
│
├── .github/
│   └── copilot-instructions.md # This comprehensive documentation
│
└── README.md                  # User-facing documentation and setup guide
```

## Security & Production Considerations

### Security Framework
- **Input validation**: Comprehensive server-side validation for all API endpoints
- **File path security**: Path traversal prevention and validation for image serving
- **Upload security**: File type validation, size limits, and secure filename generation
- **CORS configuration**: Configurable origins with localhost defaults
- **XSS prevention**: HTML escaping and content validation in client interfaces
- **WebSocket security**: Connection validation and rate limiting

### Production Readiness Assessment
- **Current status**: Designed for local development and testing environments
- **Security review needed**: Input validation, authentication, and authorization systems
- **Performance optimization**: Caching strategies, CDN integration, database optimization
- **Monitoring**: Health checks, error tracking, and performance metrics
- **Scalability**: Multi-instance support, load balancing, and state management

### Recommended Production Hardening
1. **Authentication system**: User authentication and session management
2. **HTTPS enforcement**: TLS/SSL certificate configuration
3. **Rate limiting**: API endpoint protection and DoS prevention
4. **Input sanitization**: Enhanced validation for all user inputs
5. **Error handling**: Secure error messages without information disclosure
6. **Audit logging**: Comprehensive activity logging and monitoring
7. **Security headers**: CSP, HSTS, and other security headers implementation

## Professional OBS Studio Integration

### Complete Setup Guide for Content Creators
1. **Add Browser Source**: Create new Browser Source in OBS scene
2. **Configure URL**: Set to `http://localhost:3001` for slideshow display
3. **Set Dimensions**: Configure resolution (1920x1080 for Full HD, 3840x2160 for 4K)
4. **Performance Options**: 
   - Enable "Shutdown source when not visible" for resource optimization
   - Enable "Refresh browser when scene becomes active" for reliability
   - Set custom CSS for additional styling if needed
5. **Control Interface**: Use `http://localhost:3001/control` for real-time management
6. **Background Integration**: Enable transparent background for seamless scene composition

### Advanced OBS Integration Features
- **Multiple scenes**: Create different browser sources with varied settings
- **Scene transitions**: Coordinate with OBS scene transitions for smooth shows
- **Audio considerations**: No audio elements to interfere with OBS audio mixing
- **Performance monitoring**: Monitor CPU/GPU usage during live streaming
- **Backup sources**: Configure failover browser sources for reliability

### Professional Keyboard Shortcuts
Both slideshow and control interfaces support:
- **→ (Right Arrow)** or **Space**: Advance to next image
- **← (Left Arrow)**: Return to previous image
- **P**: Toggle play/pause state
- **Shortcuts work globally** when focus is not in input fields

### Streaming Workflow Integration
1. **Pre-stream setup**: Verify all images loaded and queue populated
2. **Live control**: Use control interface for real-time slideshow management
3. **Scene coordination**: Sync slideshow timing with other OBS scene elements
4. **Performance monitoring**: Watch for memory usage and frame rate impact
5. **Backup planning**: Have alternative media sources ready for technical issues

## Professional Development Workflow Summary

### Optimal Development Cycle
1. **Environment setup**: `npm start` (immediate startup, no build process required)
2. **Test data creation**: Execute comprehensive Python image generation script
3. **Complete feature validation**: Follow comprehensive end-to-end testing workflow
4. **Code modification**: Edit services in `src/`, client JavaScript, CSS, or configuration files
5. **Real-time testing**: Validate changes across slideshow and control interfaces simultaneously
6. **Performance verification**: Monitor WebSocket connections, API response times, image loading
7. **Cross-platform testing**: Verify functionality across Windows, macOS, Linux environments
8. **Production preparation**: Review security considerations and performance optimizations
9. **Iterative improvement**: Continuous validation with complete test scenarios

### Development Best Practices
- **No build process**: Direct file editing with immediate results
- **Real-time debugging**: Use DEBUG logging level for comprehensive diagnostics
- **Multi-interface testing**: Always test slideshow and control interfaces together
- **Performance awareness**: Monitor memory usage, file system performance, WebSocket efficiency
- **Security mindset**: Consider input validation and security implications for new features
- **Internationalization**: Update translation files for any new UI elements
- **Documentation maintenance**: Keep instructions current with implementation changes

### Code Quality Standards
- **Vanilla JavaScript**: No frameworks or transpilation required
- **Modern ES6+ features**: Async/await, destructuring, template literals
- **Comprehensive error handling**: Try-catch blocks, validation, user feedback
- **Performance optimization**: Debouncing, caching, efficient DOM manipulation
- **Accessibility compliance**: Semantic HTML, keyboard navigation, screen reader support
- **Cross-browser compatibility**: Chrome, Firefox, Edge, Safari support

Always execute the complete validation workflow after any code modifications to ensure all features remain functional and properly integrated.