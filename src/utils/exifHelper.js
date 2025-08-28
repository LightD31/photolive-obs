const exifr = require('exifr');
const fs = require('fs').promises;
const logger = require('./logger');

class ExifSemaphore {
  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
    this.currentCount = 0;
    this.waitingQueue = [];
  }

  async acquire() {
    if (this.currentCount < this.maxConcurrent) {
      this.currentCount++;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  release() {
    this.currentCount--;
    if (this.waitingQueue.length > 0) {
      this.currentCount++;
      const resolve = this.waitingQueue.shift();
      resolve();
    }
  }

  async withLock(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

const exifSemaphore = new ExifSemaphore(5);

/**
 * Extract EXIF thumbnail from image file
 * @param {string} filePath - Path to the image file
 * @returns {Promise<string|null>} Base64 encoded thumbnail or null
 */
async function extractExifThumbnail(filePath) {
  return exifSemaphore.withLock(async () => {
    try {
      const thumbnail = await exifr.thumbnail(filePath);
      if (thumbnail && thumbnail.length > 0) {
        const base64 = Buffer.from(thumbnail).toString('base64');
        const mimeType = 'image/jpeg';
        return `data:${mimeType};base64,${base64}`;
      }
    } catch (error) {
      logger.debug(`No EXIF thumbnail for ${filePath}:`, error.message);
    }
    return null;
  });
}

/**
 * Extract photo date using EXIF data with fallback to file system
 * @param {string} filePath - Path to the image file
 * @returns {Promise<Date>} Photo date
 */
async function getPhotoDate(filePath) {
  return exifSemaphore.withLock(async () => {
    try {
      // Try to get EXIF data
      const exifData = await exifr.parse(filePath, {
        pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTimeDigitized']
      });

      if (exifData) {
        // Priority order for date fields
        const dateFields = [
          'DateTimeOriginal',
          'CreateDate',
          'DateTimeDigitized',
          'ModifyDate'
        ];

        for (const field of dateFields) {
          if (exifData[field]) {
            const date = parseExifDate(exifData[field]);
            if (date && !isNaN(date.getTime())) {
              logger.debug(`Using EXIF ${field} for ${filePath}: ${date.toISOString()}`);
              return date;
            }
          }
        }
      }
    } catch (error) {
      logger.debug(`Error reading EXIF from ${filePath}:`, error.message);
    }

    // Fallback to file system dates
    try {
      const stats = await fs.stat(filePath);
      const date = stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : stats.mtime;
      logger.debug(`Using file system date for ${filePath}: ${date.toISOString()}`);
      return date;
    } catch (error) {
      logger.error(`Error getting file stats for ${filePath}:`, error);
      return new Date();
    }
  });
}

/**
 * Helper function to convert EXIF date strings to Date objects
 * @param {any} exifDate - EXIF date value
 * @returns {Date|null} Parsed date or null
 */
function parseExifDate(exifDate) {
  if (!exifDate) return null;

  // If it's already a Date object
  if (exifDate instanceof Date) {
    return exifDate;
  }

  // If it's a string
  if (typeof exifDate === 'string') {
    // Handle EXIF date format: "YYYY:MM:DD HH:MM:SS"
    const exifPattern = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;
    const match = exifDate.match(exifPattern);
    
    if (match) {
      const [_, year, month, day, hour, minute, second] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
    }

    // Try parsing as ISO string or other standard format
    const parsed = new Date(exifDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // If it's a number (timestamp)
  if (typeof exifDate === 'number') {
    return new Date(exifDate);
  }

  return null;
}

module.exports = {
  extractExifThumbnail,
  getPhotoDate,
  parseExifDate
};
