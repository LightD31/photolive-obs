PhotoLive OBS - Executable Creation Guide

## Overview

PhotoLive OBS now supports creating standalone executables with native folder selection dialogs using Electron. This allows users to easily browse and select photo folders from anywhere on their computer without manually typing paths.

## Features Added

### Native Folder Selection
- **Browse Button**: Added a "Browse..." button next to the folder path input
- **Native Dialogs**: Uses OS-native folder selection dialogs when running as Electron app
- **Web Fallback**: Gracefully falls back to manual input when running in web browser
- **Auto-Apply**: Selected folder is automatically applied when chosen through native dialog

### Executable Packaging
- **Cross-Platform**: Supports Windows (.exe), macOS (.dmg), and Linux (.AppImage)
- **Self-Contained**: Includes Node.js runtime and all dependencies
- **Menu Integration**: Native application menus with keyboard shortcuts
- **Multiple Windows**: Can open separate slideshow windows for OBS

## Usage

### Running the Electron App (Development)

```bash
# Start in Electron mode
npm run electron

# Start with live reload (development)
npm run electron-dev
```

### Building Executables

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build-win     # Windows
npm run build-mac     # macOS  
npm run build-linux   # Linux

# Build for all platforms (requires appropriate build environment)
npm run build -- --publish=never
```

#### Windows Build Notes

The Windows build is configured to skip code signing to avoid permission issues during development. If you encounter errors like "cannot create symbolic link" or permission issues, ensure:

- You're running the command in a regular command prompt (not as administrator)
- The build configuration correctly disables code signing (already configured)
- Your system has the latest Node.js and npm versions

For production releases, you can add code signing certificates by modifying the `win` section in `package.json`.

### Using the Native Folder Picker

1. **In Electron App**: Click the "📁 Browse..." button to open native folder dialog
2. **In Web Browser**: Button shows fallback message, use manual input instead
3. **Keyboard Shortcut**: Ctrl/Cmd+O opens folder dialog from main menu

## File Structure

```
photolive-obs/
├── main.js           # Electron main process
├── preload.js        # Electron preload script (security bridge)
├── server.js         # Express server (unchanged)
├── public/           # Web interface (enhanced)
│   ├── control.html  # Added browse button
│   └── js/control.js # Added native picker support
└── dist/             # Built executables (after build)
```

## Configuration

The build configuration in `package.json` supports:

- **Windows**: NSIS installer
- **macOS**: DMG disk image  
- **Linux**: AppImage portable format
- **Auto-Update**: Ready for future update mechanisms
- **Icons**: Uses favicon.ico (can be customized)

## Technical Details

### Electron Security
- **Context Isolation**: Enabled for security
- **No Node Integration**: Renderer process is sandboxed
- **Preload Script**: Secure bridge for native API access

### Compatibility
- **Web Mode**: All existing functionality works in browser
- **Electron Mode**: Enhanced with native dialogs and menus
- **Server Mode**: Express server runs identically in both modes

## Development Notes

### Adding Native Features
To add more native functionality:

1. Add IPC handlers in `main.js`
2. Expose APIs in `preload.js`  
3. Use APIs in renderer via `window.electronAPI`
4. Always provide web fallbacks

### Build Requirements
- Node.js 14+ 
- Electron 28+
- Platform-specific build tools for cross-compilation

### Distribution
Built executables are self-contained and can be distributed without requiring Node.js installation on target machines.