# PhotoLive OBS - GitHub Copilot Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

PhotoLive OBS is a Node.js real-time photo slideshow application for OBS Studio integration. The application automatically monitors a photo folder and displays images in a customizable slideshow that can be integrated directly into OBS as a browser source.

## Working Effectively

### Bootstrap and Installation
- Install Node.js (version 14 or higher required): Check with `node --version`
- Install dependencies: `npm install` -- takes ~7 seconds. No timeout needed.
- Start application: `npm start` -- starts immediately (under 1 second). No timeout needed.
- Application runs on: `http://localhost:3001`
- Control interface: `http://localhost:3001/control`
- OBS slideshow page: `http://localhost:3001`

### Development Commands
- `npm start`: Start production server (identical to dev for this application)
- `npm run dev`: Start development server (same as npm start)
- `npm run clean`: Remove dist, node_modules, package-lock.json
- `npm run reinstall`: Clean and reinstall dependencies

### Debug Logging
- **Enable debug logging**: Set `LOG_LEVEL=DEBUG` environment variable before starting
- **Windows PowerShell**: `$env:LOG_LEVEL="DEBUG"; node server.js`
- **Windows Command Prompt**: `set LOG_LEVEL=DEBUG && node server.js`
- **Linux/macOS**: `LOG_LEVEL=DEBUG node server.js`
- **Debug levels available**: ERROR, WARN, INFO, DEBUG (default: INFO)
- **Debug output includes**: File monitoring events, WebSocket connections, API requests, image processing, real-time state changes

### No Build Process Required
- This application requires NO building, compiling, or transpilation
- Static files served directly from `/public` directory
- Server-side is vanilla Node.js with Express
- Frontend is vanilla JavaScript, HTML, CSS

## Validation

### Always Test Core Functionality
After making any changes, ALWAYS validate with this complete end-to-end scenario:

1. **Start the application**: `npm start`
2. **Create test images**: Use the Python script below to generate sample images
3. **Test slideshow page**: Navigate to `http://localhost:3001` and verify images display
4. **Test control interface**: Navigate to `http://localhost:3001/control` and verify:
   - Image grid shows all photos with thumbnails
   - Current preview updates in real-time
   - Play/pause controls work
   - Settings (filters, watermarks, interval) apply immediately
   - Real-time synchronization between slideshow and control pages
5. **Test API endpoints**: `curl http://localhost:3001/api/images` and `curl http://localhost:3001/api/settings`
6. **Test file monitoring**: Add new images to `/photos` folder and verify automatic detection

### Sample Image Generation
ALWAYS use this Python script to create test images for validation:

```python
# Run: python3 -c "exec(open('create_test_images.py').read())"
import os
from PIL import Image, ImageDraw, ImageFont

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
        
        try:
            title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 60)
            subtitle_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 32)
        except:
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
        
        title = f'Test Image {image_count:02d}'
        bbox = draw.textbbox((0, 0), title, font=title_font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        title_x = (width - text_width) // 2
        title_y = height // 2 - text_height
        
        draw.text((title_x + 2, title_y + 2), title, fill=(0, 0, 0, 128), font=title_font)
        draw.text((title_x, title_y), title, fill=style['text_color'], font=title_font)
        
        subtitle = f"{format_info['name']} • {format_info['ratio']} • {style['theme']}"
        subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
        subtitle_x = (width - subtitle_width) // 2
        subtitle_y = title_y + text_height + 20
        
        draw.text((subtitle_x + 1, subtitle_y + 1), subtitle, fill=(0, 0, 0, 100), font=subtitle_font)
        draw.text((subtitle_x, subtitle_y), subtitle, fill='white', font=subtitle_font)
        
        filename = f'test_image_{image_count:02d}_{format_info["name"].lower().replace(" ", "_")}_{style["theme"].lower()}.jpg'
        quality = 95 if width * height > 2000000 else 85
        img.save(os.path.join(photos_dir, filename), 'JPEG', quality=quality, optimize=True)
        print(f'✓ Created: {filename} ({width}×{height})')
        image_count += 1

print(f'\n🎉 {len(formats) * len(styles)} sample images created!')
```

## Application Architecture

### Key Components
- **server.js**: Main Express server with Socket.IO WebSocket support
- **config/default.json**: Complete application configuration
- **public/slideshow.html**: OBS-optimized slideshow page
- **public/control.html**: Advanced control interface
- **public/js/slideshow.js**: WebSocket client for real-time slideshow
- **public/js/control.js**: Control interface with real-time preview grid
- **photos/**: Default images folder (auto-created, auto-monitored)
- **uploads/**: Watermark images storage (auto-created)

### Technologies
- **Backend**: Node.js, Express, Socket.IO, Chokidar (file watching), Multer (uploads)
- **Frontend**: Vanilla JavaScript, HTML, CSS (no frameworks or build tools)
- **Real-time**: WebSocket communication via Socket.IO
- **File Monitoring**: Chokidar cross-platform file system watcher

### Key Dependencies
- `express`: Web server framework
- `socket.io`: Real-time bidirectional communication  
- `chokidar`: File system watcher for automatic image detection
- `multer`: Multipart form data handling for watermark uploads
- `cors`: Cross-origin resource sharing support

## Configuration

### Default Settings (config/default.json)
- **Server port**: 3001 (configurable via PORT environment variable)
- **Photos folder**: `./photos` (changeable via control interface)
- **Slideshow interval**: 5 seconds (1-30 seconds range)
- **Supported formats**: .jpg, .jpeg, .png, .gif, .bmp, .tiff, .webp
- **Default features**: Shuffle enabled, transparent background, watermarks disabled

### Environment Variables
- `PORT`: Server port (default: 3001)
- `ALLOWED_ORIGINS`: Comma-separated CORS origins (default: localhost:3001)

## API Reference

### REST Endpoints
- `GET /api/images`: List all images with metadata (filename, size, timestamps, new status)
- `GET /api/settings`: Get current slideshow configuration
- `POST /api/settings`: Update slideshow settings (interval, filter, watermark options)
- `POST /api/photos-path`: Change source photos folder dynamically
- `GET /api/watermarks`: List available watermark images
- `POST /api/watermark-upload`: Upload new watermark image (PNG format)
- `GET /photos/:filename`: Serve images with security validation

### WebSocket Events
**Server to Client:**
- `images-updated`: New image list and settings
- `settings-updated`: Updated configuration
- `slideshow-state`: Current state (image, index, play status)
- `image-changed`: Image transition notification

**Client to Server:**
- `next-image`, `prev-image`: Navigation controls
- `jump-to-image`: Jump to specific image
- `pause-slideshow`, `resume-slideshow`: Playback control
- `get-slideshow-state`: Request current state
- `toggle-image-exclusion`: Include/exclude images

## Common Development Tasks

### Adding New Features
1. **Server-side changes**: Modify `server.js` for new API endpoints or WebSocket events
2. **Client-side changes**: Update `public/js/control.js` or `public/js/slideshow.js`
3. **Configuration**: Add new settings to `config/default.json`
4. **ALWAYS test with complete validation workflow** after changes

### Debugging
- **Server logs**: Check console output for file detection, WebSocket events, API requests
- **Client logs**: Open browser developer tools for WebSocket connections, API responses
- **File monitoring**: Verify Chokidar detects file system changes in photos folder
- **Real-time sync**: Test simultaneous control and slideshow pages for synchronization

### Performance Considerations
- **Image optimization**: Recommended <2MB per image, max 10MB supported
- **Folder size**: <1000 images recommended for optimal performance
- **Network**: All communication is localhost by default (no external dependencies)

## Troubleshooting

### Application Won't Start
- Verify Node.js version: `node --version` (requires 14+)
- Check port availability: `netstat -tulpn | grep 3001`
- Reinstall dependencies: `npm run reinstall`

### Images Don't Appear
- Verify photos folder exists and contains supported formats
- Check file permissions on photos directory
- Monitor server console for file detection messages
- Test API: `curl http://localhost:3001/api/images`

### Real-time Features Not Working
- Check WebSocket connection in browser developer tools
- Verify both slideshow and control pages are open simultaneously
- Restart application if WebSocket connections are stale

### Performance Issues
- Reduce image file sizes (use JPG with 85-95% quality)
- Limit photos folder to <1000 images
- Increase slideshow interval to reduce CPU usage
- Disable shuffle mode for large image sets

## File Structure Reference

```
photolive-obs/
├── server.js              # Main Express server + Socket.IO + Chokidar
├── package.json           # Dependencies and npm scripts
├── config/
│   └── default.json       # Application configuration
├── photos/                # Images folder (auto-created, auto-monitored)
├── uploads/               # Watermark images (auto-created)
├── public/                # Static web files served by Express
│   ├── slideshow.html     # OBS-optimized slideshow page
│   ├── control.html       # Advanced control interface
│   ├── css/
│   │   ├── slideshow.css  # Slideshow styling and transitions
│   │   └── control.css    # Control interface styling
│   └── js/
│       ├── slideshow.js   # WebSocket client for slideshow
│       └── control.js     # Control interface with real-time grid
├── .github/
│   └── copilot-instructions.md  # This file
└── README.md              # User documentation
```

## Security Considerations

### Important Notes
- **Local development only**: Not hardened for production internet exposure
- **Input validation**: Server validates file paths and types but review before production
- **CORS**: Configured for localhost by default
- **File uploads**: Limited to PNG watermarks with size restrictions

### For Production Use
- Review and harden all input validation
- Configure proper CORS origins
- Add authentication if needed
- Review file upload security
- Test with security scanners

## OBS Studio Integration

### Setup Instructions for Users
1. Add Browser Source in OBS
2. Set URL to: `http://localhost:3001`
3. Set dimensions (e.g., 1920x1080 for Full HD)
4. Optional: Enable "Refresh browser when scene becomes active"
5. Use control interface at `http://localhost:3001/control` for management

### Keyboard Shortcuts
- **→** or **Space**: Next image
- **←**: Previous image
- **P**: Pause/Play

Both slideshow and control pages support these shortcuts when not typing in input fields.

## Development Workflow Summary

1. **Start**: `npm start` (immediate startup)
2. **Create test data**: Run Python image generation script
3. **Validate core functionality**: Complete end-to-end testing workflow
4. **Make changes**: Modify server.js, public/ files, or config/
5. **Test immediately**: Verify with slideshow + control interface
6. **Debug**: Check server console and browser developer tools
7. **Iterate**: Restart only if needed (most changes don't require restart)

Always follow the complete validation workflow after any code changes to ensure functionality remains intact.