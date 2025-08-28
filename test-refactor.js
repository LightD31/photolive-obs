#!/usr/bin/env node

/**
 * Test script for PhotoLive OBS refactored architecture
 * Validates that all modules load correctly and basic functionality works
 */

const path = require('path');
const fs = require('fs');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

function success(...args) { log(colors.green, '✅', ...args); }
function error(...args) { log(colors.red, '❌', ...args); }
function warning(...args) { log(colors.yellow, '⚠️ ', ...args); }
function info(...args) { log(colors.cyan, 'ℹ️ ', ...args); }

let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function test(description, testFn) {
  try {
    const result = testFn();
    if (result) {
      success(description);
      testResults.passed++;
    } else {
      error(description);
      testResults.failed++;
    }
    return result;
  } catch (err) {
    error(`${description} - Error: ${err.message}`);
    testResults.failed++;
    return false;
  }
}

function testFileExists(filePath, description) {
  return test(`${description}: ${filePath}`, () => {
    return fs.existsSync(filePath);
  });
}

function testModuleLoads(modulePath, description) {
  return test(`${description}: ${modulePath}`, () => {
    try {
      require(modulePath);
      return true;
    } catch (error) {
      console.error(`    Module load error: ${error.message}`);
      return false;
    }
  });
}

async function testBasicFunctionality() {
  info('Testing basic functionality...');
  
  try {
    // Test config module
    const config = require('./src/config');
    test('Config has required properties', () => {
      return config.port && config.photosPath && config.publicPath;
    });
    
    // Test logger
    const logger = require('./src/utils/logger');
    test('Logger has required methods', () => {
      return typeof logger.info === 'function' && 
             typeof logger.error === 'function' &&
             typeof logger.warn === 'function' &&
             typeof logger.debug === 'function';
    });
    
    // Test file helper
    const fileHelper = require('./src/utils/fileHelper');
    test('FileHelper has required functions', () => {
      return typeof fileHelper.ensureDirectoryExists === 'function' &&
             typeof fileHelper.fileExists === 'function' &&
             typeof fileHelper.shuffleArray === 'function';
    });
    
    // Test EXIF helper
    const exifHelper = require('./src/utils/exifHelper');
    test('ExifHelper has required functions', () => {
      return typeof exifHelper.extractExifThumbnail === 'function' &&
             typeof exifHelper.getPhotoDate === 'function';
    });
    
    return true;
  } catch (error) {
    error(`Basic functionality test failed: ${error.message}`);
    return false;
  }
}

async function testServices() {
  info('Testing services...');
  
  try {
    // Test image service (should not fail to load)
    test('Image service loads', () => {
      const imageService = require('./src/services/imageService');
      return typeof imageService.initialize === 'function';
    });
    
    // Test watermark service
    test('Watermark service loads', () => {
      const watermarkService = require('./src/services/watermarkService');
      return typeof watermarkService.initialize === 'function';
    });
    
    // Test file watcher service
    test('File watcher service loads', () => {
      const fileWatcherService = require('./src/services/fileWatcherService');
      return typeof fileWatcherService.startWatching === 'function';
    });
    
    // Test socket service
    test('Socket service loads', () => {
      const socketService = require('./src/services/socketService');
      return typeof socketService.initialize === 'function';
    });
    
    return true;
  } catch (error) {
    error(`Services test failed: ${error.message}`);
    return false;
  }
}

async function testControllers() {
  info('Testing controllers...');
  
  try {
    // Test API controller
    test('API controller loads', () => {
      const apiController = require('./src/controllers/apiController');
      return typeof apiController === 'function' || typeof apiController === 'object';
    });
    
    // Test upload controller
    test('Upload controller loads', () => {
      const uploadController = require('./src/controllers/uploadController');
      return typeof uploadController === 'function' || typeof uploadController === 'object';
    });
    
    return true;
  } catch (error) {
    error(`Controllers test failed: ${error.message}`);
    return false;
  }
}

async function testMiddleware() {
  info('Testing middleware...');
  
  try {
    // Test error handler
    test('Error handler loads', () => {
      const errorHandler = require('./src/middleware/errorHandler');
      return typeof errorHandler.errorHandler === 'function';
    });
    
    // Test CORS
    test('CORS middleware loads', () => {
      const corsMiddleware = require('./src/middleware/cors');
      return typeof corsMiddleware === 'function';
    });
    
    // Test request logger
    test('Request logger loads', () => {
      const requestLogger = require('./src/middleware/requestLogger');
      return typeof requestLogger === 'function';
    });
    
    return true;
  } catch (error) {
    error(`Middleware test failed: ${error.message}`);
    return false;
  }
}

async function testApp() {
  info('Testing main application...');
  
  try {
    // Test main app
    test('Main app loads', () => {
      const PhotoLiveApp = require('./src/app');
      return typeof PhotoLiveApp === 'function';
    });
    
    // Test app instantiation
    test('App can be instantiated', () => {
      const PhotoLiveApp = require('./src/app');
      const app = new PhotoLiveApp();
      return app && typeof app.initialize === 'function';
    });
    
    return true;
  } catch (error) {
    error(`Main app test failed: ${error.message}`);
    return false;
  }
}

async function testDirectoryStructure() {
  info('Testing directory structure...');
  
  const requiredFiles = [
    'src/app.js',
    'src/config/index.js',
    'src/controllers/apiController.js',
    'src/controllers/uploadController.js',
    'src/middleware/errorHandler.js',
    'src/middleware/cors.js',
    'src/middleware/requestLogger.js',
    'src/services/imageService.js',
    'src/services/watermarkService.js',
    'src/services/fileWatcherService.js',
    'src/services/socketService.js',
    'src/utils/logger.js',
    'src/utils/exifHelper.js',
    'src/utils/fileHelper.js',
    'server-new.js',
    'migrate.js',
    'REFACTOR.md'
  ];
  
  requiredFiles.forEach(file => {
    testFileExists(file, 'Required file exists');
  });
  
  return true;
}

async function checkDependencies() {
  info('Checking dependencies...');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['express', 'socket.io', 'chokidar', 'cors', 'multer', 'exifr'];
  
  requiredDeps.forEach(dep => {
    test(`Dependency ${dep} is present`, () => {
      return packageJson.dependencies && packageJson.dependencies[dep];
    });
  });
  
  return true;
}

async function runAllTests() {
  console.log('=== PhotoLive OBS Refactor Tests ===\n');
  
  // Test directory structure
  await testDirectoryStructure();
  console.log();
  
  // Check dependencies
  await checkDependencies();
  console.log();
  
  // Test module loading
  info('Testing module loading...');
  
  // Test utilities first (no dependencies)
  testModuleLoads('./src/utils/logger', 'Logger utility');
  testModuleLoads('./src/utils/fileHelper', 'File helper utility');
  testModuleLoads('./src/utils/exifHelper', 'EXIF helper utility');
  console.log();
  
  // Test config
  testModuleLoads('./src/config', 'Configuration module');
  console.log();
  
  // Test middleware
  await testMiddleware();
  console.log();
  
  // Test services (may have circular dependencies, test loading only)
  await testServices();
  console.log();
  
  // Test controllers
  await testControllers();
  console.log();
  
  // Test main app
  await testApp();
  console.log();
  
  // Test basic functionality
  await testBasicFunctionality();
  console.log();
  
  // Print results
  console.log('=== Test Results ===');
  success(`Passed: ${testResults.passed}`);
  if (testResults.failed > 0) {
    error(`Failed: ${testResults.failed}`);
  }
  if (testResults.warnings > 0) {
    warning(`Warnings: ${testResults.warnings}`);
  }
  
  console.log();
  
  if (testResults.failed === 0) {
    success('All tests passed! 🎉');
    success('The refactored architecture is ready to use.');
    console.log();
    info('Next steps:');
    console.log('1. Start the refactored server: node server-new.js');
    console.log('2. Test the web interface at http://localhost:3001');
    console.log('3. If everything works, run: node migrate.js');
  } else {
    error('Some tests failed. Please fix the issues before proceeding.');
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    error(`Test execution failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runAllTests, test, testResults };
