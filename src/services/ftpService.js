const { EventEmitter } = require('events');
const FtpSrv = require('ftp-srv');
const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/logger');

/**
 * Optional FTP server service for direct file transfer integration.
 * When enabled, photographers can upload images directly via FTP,
 * and the application knows exactly when a file transfer is complete
 * (unlike file system watching which may catch partial writes).
 */
class FtpService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.logger = Logger.getInstance();
    this.ftpServer = null;
    this.isRunning = false;
    this.connections = 0;
    this.totalUploads = 0;

    // FTP settings with defaults
    this.settings = {
      enabled: config.ftp?.enabled || false,
      port: config.ftp?.port || 2121,
      username: config.ftp?.username || 'photolive',
      password: config.ftp?.password || 'photolive',
      pasv_min: config.ftp?.pasv_min || 1024,
      pasv_max: config.ftp?.pasv_max || 1048,
    };
  }

  /**
   * Start the FTP server
   * @param {string} photosPath - The root directory for FTP uploads
   */
  async start(photosPath) {
    if (!this.settings.enabled) {
      this.logger.debug('FTP server is disabled');
      return;
    }

    if (this.isRunning) {
      this.logger.warn('FTP server is already running');
      return;
    }

    this.photosPath = path.resolve(photosPath);

    // Ensure photos directory exists
    await fs.mkdir(this.photosPath, { recursive: true });

    try {
      const url = `ftp://0.0.0.0:${this.settings.port}`;
      this.ftpServer = new FtpSrv({
        url,
        pasv_url: '127.0.0.1',
        pasv_min: this.settings.pasv_min,
        pasv_max: this.settings.pasv_max,
        anonymous: false,
        greeting: ['Welcome to PhotoLive OBS FTP Server'],
      });

      this.ftpServer.on('login', ({ connection, username, password }, resolve, reject) => {
        if (username === this.settings.username && password === this.settings.password) {
          this.connections++;
          this.logger.info(`FTP client connected: ${connection.ip} (${this.connections} active)`);
          this.emit('clientConnected', { ip: connection.ip, connections: this.connections });

          // Set up upload completion handler
          connection.on('STOR', (error, filePath) => {
            if (error) {
              this.logger.error(`FTP upload error: ${error.message}`);
              return;
            }
            this._handleUploadComplete(filePath);
          });

          connection.on('close', () => {
            this.connections = Math.max(0, this.connections - 1);
            this.logger.info(`FTP client disconnected: ${connection.ip} (${this.connections} active)`);
            this.emit('clientDisconnected', { ip: connection.ip, connections: this.connections });
          });

          resolve({ root: this.photosPath });
        } else {
          this.logger.warn(`FTP login failed from ${connection.ip}: invalid credentials`);
          reject(new Error('Invalid credentials'));
        }
      });

      this.ftpServer.on('client-error', ({ connection, context, error }) => {
        this.logger.error(`FTP client error (${connection?.ip || 'unknown'}): ${error.message}`);
      });

      await this.ftpServer.listen();
      this.isRunning = true;

      this.logger.info(`FTP server started on port ${this.settings.port}`);
      this.logger.info(`FTP credentials: ${this.settings.username} / ${this.settings.password}`);
      this.emit('started', { port: this.settings.port });
    } catch (error) {
      this.logger.error(`Failed to start FTP server: ${error.message}`);
      this.isRunning = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Handle completed FTP upload - the file is fully written at this point
   * @param {string} filePath - Absolute path to the uploaded file
   */
  _handleUploadComplete(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const supportedFormats = this.config.supportedFormats || ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];

    if (!supportedFormats.includes(ext)) {
      this.logger.debug(`FTP: Ignoring non-image file: ${path.basename(filePath)}`);
      return;
    }

    const filename = path.basename(filePath);
    const relativePath = path.relative(this.photosPath, filePath);
    // Use the same trackingKey logic as FileWatcher
    const trackingKey = relativePath.includes(path.sep) ? relativePath : filename;

    this.totalUploads++;
    this.logger.info(`FTP upload complete: ${trackingKey} (total: ${this.totalUploads})`);

    // Emit imageAdded event - identical to FileWatcher's event signature
    this.emit('imageAdded', filePath, trackingKey);
  }

  /**
   * Stop the FTP server
   */
  async stop() {
    if (!this.ftpServer) return;

    try {
      this.ftpServer.close();
      this.isRunning = false;
      this.connections = 0;
      this.logger.info('FTP server stopped');
      this.emit('stopped');
    } catch (error) {
      this.logger.error(`Error stopping FTP server: ${error.message}`);
    }

    this.ftpServer = null;
  }

  /**
   * Update target photos path (e.g. when user changes folder)
   * @param {string} newPath - New photos directory path
   */
  async updatePhotosPath(newPath) {
    this.photosPath = path.resolve(newPath);
    this.logger.info(`FTP root directory updated: ${this.photosPath}`);

    // If running, restart to apply new root
    if (this.isRunning) {
      await this.stop();
      await this.start(newPath);
    }
  }

  /**
   * Update FTP settings and optionally restart
   * @param {object} newSettings - Partial settings to update
   */
  async updateSettings(newSettings) {
    const wasRunning = this.isRunning;
    const wasEnabled = this.settings.enabled;

    Object.assign(this.settings, newSettings);

    // If we just got enabled, start the server
    if (this.settings.enabled && !wasEnabled && this.photosPath) {
      await this.start(this.photosPath);
      return;
    }

    // If we just got disabled, stop the server
    if (!this.settings.enabled && wasEnabled) {
      await this.stop();
      return;
    }

    // If settings changed while running, restart
    if (wasRunning && this.settings.enabled) {
      const needsRestart = (
        newSettings.port !== undefined ||
        newSettings.username !== undefined ||
        newSettings.password !== undefined ||
        newSettings.pasv_min !== undefined ||
        newSettings.pasv_max !== undefined
      );

      if (needsRestart) {
        await this.stop();
        await this.start(this.photosPath);
      }
    }
  }

  /**
   * Get current FTP server status
   */
  getStatus() {
    return {
      enabled: this.settings.enabled,
      running: this.isRunning,
      port: this.settings.port,
      username: this.settings.username,
      connections: this.connections,
      totalUploads: this.totalUploads,
    };
  }

  /**
   * Get current settings (without password)
   */
  getSettings() {
    return {
      enabled: this.settings.enabled,
      port: this.settings.port,
      username: this.settings.username,
      password: this.settings.password,
      pasv_min: this.settings.pasv_min,
      pasv_max: this.settings.pasv_max,
    };
  }
}

module.exports = FtpService;
