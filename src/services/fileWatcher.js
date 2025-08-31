const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/logger');

class FileWatcher {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
    this.watcher = null;
    this.currentPath = null;
    this.recursive = false;
    this.eventHandlers = {};
    this.pendingFiles = new Map(); // Track files being copied
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
          
          this.logger.debug(`File added: ${filePath}`);
          
          if (this.config.supportedFormats.includes(ext)) {
            await this.waitForFileCopyComplete(filePath);
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
          
          this.logger.debug(`Image deleted: ${trackingKey}`);
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
        this.logger.error('File watcher error:', error);
        this.emit('error', error);
        
        setTimeout(() => {
          this.logger.warn('Restarting file watcher after error');
          this.start(this.currentPath, this.recursive);
        }, 5000);
      });

    this.logger.info(`File monitoring started: ${photosPath} (${this.recursive ? 'recursive' : 'non-recursive'})`);
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

  async waitForFileCopyComplete(filePath) {
    const filename = path.basename(filePath);
    const relativePath = path.relative(this.currentPath, filePath);
    const trackingKey = this.recursive ? relativePath : filename;
    
    // Cancel any existing check for this file
    if (this.pendingFiles.has(filePath)) {
      clearTimeout(this.pendingFiles.get(filePath));
    }
    
    let lastSize = -1;
    let stableCount = 0;
    const requiredStableChecks = 3;
    const checkInterval = 100; // ms
    
    const checkFileStability = async () => {
      try {
        const stats = await fs.stat(filePath);
        const currentSize = stats.size;
        
        if (currentSize === lastSize && currentSize > 0) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            this.pendingFiles.delete(filePath);
            this.logger.debug(`File copy complete: ${trackingKey}`);
            this.emit('imageAdded', filePath, trackingKey);
            return;
          }
        } else {
          stableCount = 0;
        }
        
        lastSize = currentSize;
        
        const timeoutId = setTimeout(checkFileStability, checkInterval);
        this.pendingFiles.set(filePath, timeoutId);
        
      } catch (error) {
        this.pendingFiles.delete(filePath);
        this.logger.warn(`File became unavailable during copy check: ${trackingKey}`);
      }
    };
    
    // Start the stability check
    const timeoutId = setTimeout(checkFileStability, checkInterval);
    this.pendingFiles.set(filePath, timeoutId);
  }
}

module.exports = FileWatcher;