const path = require('path');
const fs = require('fs').promises;
const config = require('../config');
const logger = require('../utils/logger');
const { ensureDirectoryExists, readDirectory, getFileExtension } = require('../utils/fileHelper');

class WatermarkService {
  constructor() {
    this.watermarksPath = path.join(config.uploadsPath, 'watermarks');
    this.watermarks = [];
  }

  /**
   * Initialize the watermark service
   */
  async initialize() {
    await ensureDirectoryExists(this.watermarksPath);
    await this.loadWatermarks();
  }

  /**
   * Load available watermarks
   */
  async loadWatermarks() {
    try {
      const files = await readDirectory(this.watermarksPath);
      this.watermarks = files.filter(file => 
        getFileExtension(file) === '.png'
      ).map(file => ({
        filename: file,
        path: path.join(this.watermarksPath, file),
        url: `/uploads/watermarks/${file}`
      }));
      
      logger.info(`Loaded ${this.watermarks.length} watermarks`);
      return this.watermarks;
    } catch (error) {
      logger.error('Error loading watermarks:', error);
      this.watermarks = [];
      return [];
    }
  }

  /**
   * Get all watermarks
   */
  getWatermarks() {
    return this.watermarks;
  }

  /**
   * Add a new watermark
   */
  async addWatermark(filename, buffer) {
    const filePath = path.join(this.watermarksPath, filename);
    
    try {
      await fs.writeFile(filePath, buffer);
      
      const watermark = {
        filename,
        path: filePath,
        url: `/uploads/watermarks/${filename}`
      };
      
      this.watermarks.push(watermark);
      logger.info(`Added watermark: ${filename}`);
      
      return watermark;
    } catch (error) {
      logger.error(`Error saving watermark ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Delete a watermark
   */
  async deleteWatermark(filename) {
    const index = this.watermarks.findIndex(w => w.filename === filename);
    
    if (index === -1) {
      return false;
    }

    const filePath = path.join(this.watermarksPath, filename);
    
    try {
      await fs.unlink(filePath);
      this.watermarks.splice(index, 1);
      logger.info(`Deleted watermark: ${filename}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting watermark ${filename}:`, error);
      return false;
    }
  }

  /**
   * Check if watermark exists
   */
  watermarkExists(filename) {
    return this.watermarks.some(w => w.filename === filename);
  }
}

module.exports = new WatermarkService();
