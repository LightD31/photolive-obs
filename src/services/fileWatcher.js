const chokidar = require('chokidar');
const path = require('path');
const Logger = require('../utils/logger');

class FileWatcher {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
    this.watcher = null;
    this.currentPath = null;
    this.recursive = false;
    this.eventHandlers = {};
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  emit(event, ...args) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          this.logger.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  start(photosPath, recursive = false) {
    this.stop();

    this.currentPath = photosPath;
    this.recursive = recursive;

    const watchOptions = {
      ignored: /^\./, // Ignore hidden files
      persistent: true,
      ignoreInitial: true
    };

    if (recursive) {
      this.logger.debug('Setting up recursive file monitoring');
    }

    this.watcher = chokidar.watch(photosPath, watchOptions);

    this.watcher
      .on('add', async (filePath) => {
        try {
          const filename = path.basename(filePath);
          const ext = path.extname(filename).toLowerCase();
          
          this.logger.debug(`📁 File system event: ADD - ${filePath}`);
          this.logger.debug(`Extension: ${ext}, Supported: ${this.config.supportedFormats.includes(ext)}`);
          
          if (this.config.supportedFormats.includes(ext)) {
            const relativePath = path.relative(this.currentPath, filePath);
            const trackingKey = this.recursive ? relativePath : filename;
            
            this.logger.info(`🆕 WATCHER: New image detected - ${trackingKey}`);
            this.emit('imageAdded', filePath, trackingKey);
          } else {
            this.logger.debug(`Ignoring non-image file: ${filename}`);
          }
        } catch (error) {
          this.logger.error('Error processing file addition:', error);
        }
      })
      .on('unlink', (filePath) => {
        try {
          const filename = path.basename(filePath);
          const relativePath = path.relative(this.currentPath, filePath);
          const trackingKey = this.recursive ? relativePath : filename;
          
          this.logger.info(`🗑️ WATCHER: Image deleted - ${trackingKey}`);
          this.logger.debug(`Full path: ${filePath}`);
          this.emit('imageRemoved', filePath, trackingKey);
        } catch (error) {
          this.logger.error('Error processing file removal:', error);
        }
      })
      .on('addDir', (dirPath) => {
        if (this.recursive) {
          const relativePath = path.relative(this.currentPath, dirPath);
          this.logger.debug(`New directory detected: ${relativePath}`);
          this.emit('directoryAdded', dirPath, relativePath);
        }
      })
      .on('unlinkDir', (dirPath) => {
        if (this.recursive) {
          const relativePath = path.relative(this.currentPath, dirPath);
          this.logger.debug(`Directory removed: ${relativePath}`);
          this.emit('directoryRemoved', dirPath, relativePath);
        }
      })
      .on('error', error => {
        this.logger.error('Watcher error:', error);
        this.emit('error', error);
        
        // Attempt to restart watcher on critical error
        setTimeout(() => {
          this.logger.info('Attempting to restart watcher...');
          this.start(this.currentPath, this.recursive);
        }, 5000);
      });

    const mode = this.recursive ? 'recursive' : 'non-recursive';
    this.logger.info(`Monitoring folder: ${photosPath} (${mode})`);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.logger.debug('File watcher stopped');
    }
  }

  updateRecursive(recursive) {
    if (this.recursive !== recursive && this.currentPath) {
      this.recursive = recursive;
      this.logger.debug(`Recursive search mode changed to: ${recursive}`);
      this.start(this.currentPath, recursive);
    }
  }

  isWatching() {
    return this.watcher !== null;
  }

  getCurrentPath() {
    return this.currentPath;
  }

  isRecursive() {
    return this.recursive;
  }
}

module.exports = FileWatcher;