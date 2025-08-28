# Logging Improvements

## Overview
The logging system has been cleaned up and standardized across the PhotoLive OBS application to provide better debugging capabilities and cleaner output.

## Changes Made

### 1. Logger Class Improvements (`src/utils/logger.js`)
- **Better level validation**: Invalid log levels now default to INFO instead of causing errors
- **Consistent formatting**: All log messages now have uniform timestamp and level formatting
- **Improved spacing**: Log level labels are now properly aligned for better readability

### 2. Log Level Usage Standards
- **ERROR**: Critical errors that prevent normal operation
- **WARN**: Important issues that don't stop execution but need attention
- **INFO**: Important operational information (startup, shutdown, major state changes)
- **DEBUG**: Detailed information for troubleshooting and development

### 3. Message Cleanup Across Services

#### App.js (`src/app.js`)
- Removed excessive emojis and formatting from log messages
- Simplified file addition/removal messages
- Made shutdown messages more concise
- Used appropriate log levels for different types of events

#### FileWatcher (`src/services/fileWatcher.js`)
- Cleaned up file system event messages
- Removed emoji decorations
- Used DEBUG level for detailed file operations
- Used WARN level for error recovery attempts

#### ImageService (`src/services/imageService.js`)
- Simplified EXIF processing messages
- Reduced verbosity of thumbnail extraction logs
- Made error messages more concise
- Used appropriate levels for different operations

#### SlideshowService (`src/services/slideshowService.js`)
- Cleaned up queue processing messages
- Simplified image navigation logs
- Made timer and state change messages more concise
- Improved readability of shuffle mode messages

#### SocketService (`src/services/socketService.js`)
- Simplified client connection messages
- Made user action logs more concise
- Used appropriate levels for different socket events

#### API Routes (`src/routes/api.js`)
- Cleaned up settings change messages
- Made file upload logs more appropriate
- Simplified path validation messages

## Environment Variable Support

The application supports the `LOG_LEVEL` environment variable:

```bash
# Windows PowerShell
$env:LOG_LEVEL="DEBUG"; npm start

# Windows Command Prompt
set LOG_LEVEL=DEBUG && npm start

# Linux/macOS
LOG_LEVEL=DEBUG npm start
```

## Testing

A test script has been added to verify logging levels work correctly:

```bash
npm run test:logging
```

This script tests all log levels and validates that:
- Each level shows appropriate messages
- Invalid log levels default to INFO
- Message formatting is consistent

## Benefits

1. **Cleaner Output**: Removed excessive emojis and verbose messages
2. **Better Debugging**: Appropriate use of DEBUG level for detailed information
3. **Consistent Formatting**: All log messages follow the same format
4. **Proper Level Usage**: Each log level is used for its intended purpose
5. **Environment Control**: Easy to adjust logging verbosity via environment variables

## Usage Examples

### Production (minimal logging)
```bash
LOG_LEVEL=ERROR npm start
```

### Development (detailed logging)
```bash
LOG_LEVEL=DEBUG npm start
```

### Normal operation (default)
```bash
npm start  # Uses INFO level from config
```