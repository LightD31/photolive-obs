const chokidar = require('chokidar');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { getFileExtension } = require('../utils/fileHelper');

class FileWatcherService {
  constructor() {
    this.watcher = null;
    this.watchPath = null;
    this.listeners = new Map();
  }

  /**
   * Start watching a directory
   */
  startWatching(dirPath, options = {}) {
    // Stop existing watcher if any
    this.stopWatching();

    this.watchPath = dirPath;
    
    const watchOptions = {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      ...options
    };

    this.watcher = chokidar.watch(dirPath, watchOptions);

    // Set up event handlers
    this.watcher
      .on('add', (filePath) => this.handleFileAdd(filePath))
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('unlink', (filePath) => this.handleFileRemove(filePath))
      .on('error', (error) => this.handleError(error))
      .on('ready', () => {
        logger.info(`File watcher ready, monitoring: ${dirPath}`);
      });

    return this.watcher;
  }

  /**
   * Stop watching
   */
  async stopWatching() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.watchPath = null;
      logger.info('File watcher stopped');
    }
  }

  /**
   * Handle file addition
   */
  handleFileAdd(filePath) {
    const filename = path.basename(filePath);
    const ext = getFileExtension(filename);
    
    if (config.supportedFormats.includes(ext)) {
      logger.info(`New image detected: ${filename}`);
      this.emit('image:added', { filename, path: filePath });
    }
  }

  /**
   * Handle file change
   */
  handleFileChange(filePath) {
    const filename = path.basename(filePath);
    const ext = getFileExtension(filename);
    
    if (config.supportedFormats.includes(ext)) {
      logger.debug(`Image changed: ${filename}`);
      this.emit('image:changed', { filename, path: filePath });
    }
  }

  /**
   * Handle file removal
   */
  handleFileRemove(filePath) {
    const filename = path.basename(filePath);
    const ext = getFileExtension(filename);
    
    if (config.supportedFormats.includes(ext)) {
      logger.info(`Image removed: ${filename}`);
      this.emit('image:removed', { filename, path: filePath });
    }
  }

  /**
   * Handle watcher errors
   */
  handleError(error) {
    logger.error('File watcher error:', error);
    this.emit('error', error);
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return this;
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
    return this;
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Change watch path
   */
  async changeWatchPath(newPath) {
    logger.info(`Changing watch path from ${this.watchPath} to ${newPath}`);
    await this.startWatching(newPath);
  }

  /**
   * Get current watch status
   */
  getStatus() {
    return {
      isWatching: !!this.watcher,
      watchPath: this.watchPath
    };
  }
}

module.exports = new FileWatcherService();
