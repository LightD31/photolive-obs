# PhotoLive OBS Plugin Installation Guide

## Overview

The PhotoLive OBS Plugin is a native OBS Studio plugin that provides real-time photo slideshow functionality. Unlike the standalone web application, this plugin integrates directly into OBS Studio and manages the web server automatically.

## Prerequisites

### Software Requirements
- **OBS Studio** (version 28.0 or higher)
- **Node.js** (version 14 or higher) - Required for the embedded web server
- **npm** - Comes with Node.js installation

### Build Requirements (if building from source)
- **CMake** (version 3.16 or higher)
- **C++ Compiler** (Visual Studio 2019+ on Windows, GCC/Clang on Linux/macOS)
- **OBS Studio development libraries**

## Installation

### Option 1: Pre-built Plugin (Recommended)

1. **Download** the latest plugin release for your platform
2. **Extract** the plugin files
3. **Copy** plugin files to your OBS plugins directory:
   - **Windows**: `C:\Program Files\obs-studio\obs-plugins\64bit\`
   - **macOS**: `/Applications/OBS.app/Contents/PlugIns/`
   - **Linux**: `/usr/lib/obs-plugins/` or `~/.config/obs-studio/plugins/`
4. **Restart** OBS Studio

### Option 2: Build from Source

1. **Clone** the repository:
   ```bash
   git clone https://github.com/LightD31/photolive-obs.git
   cd photolive-obs
   ```

2. **Install** Node.js dependencies:
   ```bash
   cd web-app
   npm install
   cd ..
   ```

3. **Build** the plugin:
   - **Linux/macOS**: `./build.sh`
   - **Windows**: Run `build.bat`

4. **Install** the built plugin files to your OBS plugins directory

## Usage

### Adding PhotoLive Slideshow Source

1. **Open** OBS Studio
2. In your scene, click the **"+"** button to add a new source
3. Select **"PhotoLive Slideshow"** from the list
4. **Configure** the source properties:
   - **Photos Folder**: Path to your photos directory
   - **Auto-start slideshow**: Whether to start automatically
   - **Width/Height**: Slideshow dimensions
5. Click **"OK"** to add the source

### Configuration

#### Source Properties
- **Photos Folder**: Directory containing your photos
- **Auto-start slideshow**: Automatically start when source becomes active
- **Width**: Slideshow width in pixels
- **Height**: Slideshow height in pixels
- **Open Control Interface**: Button to open the web-based control panel

#### Control Interface

The plugin automatically starts a web server and provides a control interface accessible at `http://localhost:3001/control`.

**Features:**
- Real-time photo preview grid
- Slideshow controls (play/pause/next/previous)
- Interval adjustment (1-30 seconds)
- Visual filters (sepia, grayscale, blur, etc.)
- Watermark settings (text or image)
- Language selection (English/French)
- Shuffle and repeat options

### Photo Management

1. **Add photos** to your configured photos folder
2. **Supported formats**: JPG, JPEG, PNG, GIF, BMP, TIFF, WebP
3. **Automatic detection**: New photos are detected automatically
4. **Real-time updates**: Changes appear immediately in OBS

### Keyboard Shortcuts

When the slideshow source is active:
- **→** or **Space**: Next image
- **←**: Previous image
- **P**: Pause/Play

## Troubleshooting

### Plugin Not Loading
- Verify OBS Studio version compatibility (28.0+)
- Check that Node.js is installed and accessible
- Ensure plugin files are in the correct directory
- Check OBS Studio logs for error messages

### Web Server Not Starting
- Verify Node.js installation: `node --version`
- Check if port 3001 is available
- Review plugin logs in OBS Studio
- Try different port range (plugin auto-detects 3001-3010)

### Photos Not Appearing
- Verify photos folder path is correct
- Check photo file formats are supported
- Ensure photos folder has read permissions
- Review file monitoring logs

### Performance Issues
- Reduce photo file sizes (< 2MB recommended)
- Limit photos folder contents (< 1000 images)
- Increase slideshow interval
- Use SSD storage for better performance

### Browser Source Issues
- The plugin automatically creates a browser source
- If issues occur, restart OBS Studio
- Check that browser source plugin is available

## Technical Details

### Architecture
The plugin consists of:
- **C++ Plugin Core**: Native OBS integration
- **Embedded Web Server**: Node.js application from original project
- **Browser Source**: Automatic browser source management
- **File Monitoring**: Real-time photo detection

### File Locations
- **Plugin**: OBS plugins directory
- **Web Application**: Plugin data directory (`web-app/`)
- **Configuration**: Plugin config directory
- **Photos**: User-configurable directory
- **Logs**: OBS Studio log files

### Network
- **Local only**: Server runs on localhost
- **Port range**: 3001-3010 (auto-detection)
- **No external access**: Secure by design

## Migration from Standalone Application

If you were using the standalone PhotoLive OBS web application:

1. **Install** the plugin as described above
2. **Copy** your photos to the new photos folder
3. **Remove** the old browser source from OBS
4. **Add** the new PhotoLive Slideshow source
5. **Configure** settings in the plugin properties

The plugin provides the same functionality with better integration and automatic management.

## Support

- **Documentation**: Check this guide and the main README
- **Issues**: Report bugs on GitHub
- **Logs**: Check OBS Studio logs for troubleshooting

## License

MIT License - See LICENSE file for details.