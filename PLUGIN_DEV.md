# PhotoLive OBS Plugin Development Notes

## Plugin Architecture

This plugin converts the existing Node.js web application into a native OBS Studio plugin using a hybrid approach:

### Components

1. **C++ Plugin Core** (`src/`)
   - `plugin-main.cpp/h`: Main plugin entry points and lifecycle management
   - `node-server.cpp/h`: Node.js server lifecycle management
   - `photolive-source.cpp/h`: OBS source implementation
   - `photolive-config.cpp/h`: Configuration management

2. **Embedded Web Application** (`web-app/`)
   - Complete copy of the original Node.js application
   - Managed automatically by the plugin
   - Runs on localhost with auto-detected port

3. **Build System** (`CMakeLists.txt`)
   - Cross-platform CMake configuration
   - Automatic dependency management
   - Installation package creation

### Integration Strategy

**Hybrid Plugin Approach:**
- Embeds the existing Node.js web application
- C++ plugin manages web server lifecycle
- Automatic browser source creation and management
- Preserves all existing functionality

**Benefits:**
- Minimal changes to working codebase
- Native OBS integration
- Automatic server management
- User-friendly installation

### Build Process

1. **Preparation**: Copy web application to `web-app/` directory
2. **Dependencies**: Install Node.js dependencies in web-app
3. **Compilation**: Build C++ plugin using CMake
4. **Packaging**: Create installation package with all components

### Installation Locations

**Windows:**
- Plugin: `%PROGRAMFILES%\obs-studio\obs-plugins\64bit\photolive-obs.dll`
- Data: `%PROGRAMFILES%\obs-studio\data\obs-plugins\photolive-obs\`

**macOS:**
- Plugin: `/Applications/OBS.app/Contents/PlugIns/photolive-obs.so`
- Data: `/Applications/OBS.app/Contents/Resources/data/obs-plugins/photolive-obs/`

**Linux:**
- Plugin: `/usr/lib/obs-plugins/photolive-obs.so`
- Data: `/usr/share/obs/obs-plugins/photolive-obs/`

### Configuration

The plugin stores configuration in OBS's standard configuration directory:
- Source settings: Stored per-source by OBS
- Global settings: Stored in plugin config directory
- Web application: Uses embedded config/default.json

### Development Workflow

1. **Modify** web application in root directory
2. **Test** standalone application: `npm start`
3. **Copy** changes to `web-app/` directory
4. **Build** plugin using build scripts
5. **Test** plugin in OBS Studio

### Future Enhancements

- **Native UI**: Replace web interface with native OBS UI
- **Direct Integration**: Bypass browser source for better performance
- **Advanced Features**: Plugin-specific features not available to web apps
- **Settings Migration**: Import/export settings between installations

## Migration Path

For users migrating from standalone to plugin:

1. **Backup** existing photos and settings
2. **Install** plugin
3. **Configure** photos path in plugin source properties
4. **Remove** old browser source
5. **Add** new PhotoLive Slideshow source

The plugin provides the same functionality with improved integration and user experience.