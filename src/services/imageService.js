const fs = require('fs').promises;
const path = require('path');
const exifr = require('exifr');
const Logger = require('../utils/logger');

class ExifSemaphore {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.running < this.maxConcurrent) {
        this.running++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.running++;
      next();
    }
  }

  async execute(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

class ImageService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
    this.exifSemaphore = new ExifSemaphore(3);
    this.newlyAddedImages = new Set();
  }

  async extractExifThumbnail(filePath) {
    let buffer = null;
    try {
      buffer = await fs.readFile(filePath);
      const thumbnailBuffer = await exifr.thumbnail(buffer);
      
      if (thumbnailBuffer && thumbnailBuffer.length > 0) {
        const base64Thumbnail = Buffer.from(thumbnailBuffer).toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Thumbnail}`;
        this.logger.debug(`Extracted EXIF thumbnail for ${path.basename(filePath)} (${thumbnailBuffer.length} bytes)`);
        return dataUrl;
      }
      
      return null;
    } catch (error) {
      this.logger.debug(`No EXIF thumbnail found for ${path.basename(filePath)}: ${error.message}`);
      return null;
    } finally {
      buffer = null;
    }
  }

  async getPhotoDate(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      return await this.exifSemaphore.execute(async () => {
        let buffer = null;
        try {
          buffer = await fs.readFile(filePath);
          
          const options = {
            pick: [
              'DateTimeOriginal', 'DateTime', 'CreateDate', 'DateTimeDigitized',
              'ModifyDate', 'FileModifyDate', 'SubSecDateTimeOriginal',
              'OffsetTimeOriginal', 'GPSDateTime'
            ],
            skip: ['thumbnail', 'ifd1', 'interop'],
            chunked: false,
            tiff: {
              skip: ['thumbnail', 'ifd1']
            }
          };
          
          const exifData = await exifr.parse(buffer, options);
          this.logger.debug(`EXIF data for ${path.basename(filePath)}:`, exifData);
          
          const parseExifDate = (dateValue) => {
            if (!dateValue) return null;
            
            if (dateValue instanceof Date && !isNaN(dateValue)) {
              return dateValue;
            }
            
            if (typeof dateValue === 'string') {
              const exifDateRegex = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;
              const match = dateValue.match(exifDateRegex);
              if (match) {
                const [, year, month, day, hour, minute, second] = match;
                const parsedDate = new Date(
                  parseInt(year),
                  parseInt(month) - 1,
                  parseInt(day),
                  parseInt(hour),
                  parseInt(minute),
                  parseInt(second)
                );
                return !isNaN(parsedDate) ? parsedDate : null;
              }
              
              const fallbackDate = new Date(dateValue);
              return !isNaN(fallbackDate) ? fallbackDate : null;
            }
            
            return null;
          };
          
          const dateCandidates = [
            exifData?.DateTimeOriginal,
            exifData?.CreateDate,
            exifData?.DateTimeDigitized,
            exifData?.DateTime,
            exifData?.SubSecDateTimeOriginal,
            exifData?.ModifyDate
          ];
          
          for (const candidate of dateCandidates) {
            const parsedDate = parseExifDate(candidate);
            if (parsedDate) {
              this.logger.debug(`Found EXIF date for ${path.basename(filePath)}: ${parsedDate}`);
              return parsedDate;
            }
          }
          
          this.logger.debug(`No valid EXIF date found for ${path.basename(filePath)}`);
          
        } catch (error) {
          this.logger.debug(`Could not read EXIF date for ${path.basename(filePath)}: ${error.message}`);
        } finally {
          buffer = null;
        }
        
        this.logger.debug(`No EXIF date available for ${path.basename(filePath)}, falling back to file system date`);
        return stats.birthtime || stats.mtime;
      });
    } catch (error) {
      this.logger.warn(`Could not get date for ${path.basename(filePath)}: ${error.message}`);
      return new Date();
    }
  }

  async processImageFile(filePath, relativePath = '') {
    try {
      const stats = await fs.stat(filePath);
      const photoDate = await this.getPhotoDate(filePath);
      
      let thumbnailDataUrl = null;
      try {
        thumbnailDataUrl = await this.exifSemaphore.execute(async () => {
          return await this.extractExifThumbnail(filePath);
        });
      } catch (error) {
        this.logger.debug(`Thumbnail extraction failed for ${relativePath || path.basename(filePath)}: ${error.message}`);
      }
      
      const filename = relativePath || path.basename(filePath);
      
      return {
        filename: filename,
        path: `/photos/${filename.replace(/\\/g, '/')}`,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        photoDate: photoDate,
        isNew: this.newlyAddedImages.has(filename),
        thumbnail: thumbnailDataUrl
      };
    } catch (error) {
      this.logger.warn(`Error processing image ${relativePath || path.basename(filePath)}: ${error.message}`);
      return null;
    }
  }

  async scanImagesRecursive(dirPath, relativePath = '', progressCallback = null) {
    const images = [];
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      const imageFiles = [];
      const subdirectories = [];
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        const itemRelativePath = relativePath ? path.join(relativePath, item.name) : item.name;
        
        if (item.isDirectory()) {
          subdirectories.push({ fullPath, itemRelativePath });
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (this.config.supportedFormats.includes(ext)) {
            imageFiles.push({ fullPath, itemRelativePath });
          }
        }
      }
      
      const BATCH_SIZE = 5;
      const BATCH_DELAY = 10;
      
      const totalFiles = imageFiles.length;
      let processedFiles = 0;
      
      for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
        const batch = imageFiles.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.all(
          batch.map(async ({ fullPath, itemRelativePath }) => {
            const result = await this.processImageFile(fullPath, itemRelativePath);
            processedFiles++;
            
            if (progressCallback) {
              progressCallback({
                current: processedFiles,
                total: totalFiles,
                currentFile: itemRelativePath,
                isRecursive: true
              });
            }
            
            return result;
          })
        );
        
        images.push(...batchResults.filter(result => result !== null));
        
        if (BATCH_DELAY > 0 && i + BATCH_SIZE < imageFiles.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      for (const { fullPath, itemRelativePath } of subdirectories) {
        try {
          const subImages = await this.scanImagesRecursive(fullPath, itemRelativePath, progressCallback);
          images.push(...subImages);
        } catch (error) {
          this.logger.warn(`Error scanning subdirectory ${itemRelativePath}: ${error.message}`);
        }
      }
      
    } catch (error) {
      this.logger.error(`Error scanning directory ${dirPath}:`, error);
    }
    
    return images;
  }

  async scanImages(photosPath, recursive = false, progressCallback = null) {
    try {
      let images = [];
      
      if (recursive) {
        images = await this.scanImagesRecursive(photosPath, '', progressCallback);
        this.logger.debug(`Recursive scan found ${images.length} images`);
      } else {
        const files = await fs.readdir(photosPath);
        const imageFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return this.config.supportedFormats.includes(ext);
        });

        const BATCH_SIZE = 5;
        const BATCH_DELAY = 10;
        
        const totalFiles = imageFiles.length;
        let processedFiles = 0;

        for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
          const batch = imageFiles.slice(i, i + BATCH_SIZE);
          
          const batchResults = await Promise.all(
            batch.map(async (file) => {
              const filePath = path.join(photosPath, file);
              const result = await this.processImageFile(filePath);
              processedFiles++;
              
              if (progressCallback) {
                progressCallback({
                  current: processedFiles,
                  total: totalFiles,
                  currentFile: file,
                  percentage: Math.round((processedFiles / totalFiles) * 100)
                });
              }
              
              return result;
            })
          );
          
          images.push(...batchResults.filter(result => result !== null));
          
          if (BATCH_DELAY > 0 && i + BATCH_SIZE < imageFiles.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
          }
        }
      }

      images.sort((a, b) => a.photoDate - b.photoDate);
      return images;
    } catch (error) {
      this.logger.error('Error scanning images:', error);
      return [];
    }
  }

  markAsNew(filename) {
    this.newlyAddedImages.add(filename);
    
    setTimeout(() => {
      try {
        this.newlyAddedImages.delete(filename);
        this.logger.debug(`Image ${filename} is no longer considered new`);
        
        if (this.newlyAddedImages.size > 100) {
          this.logger.warn(`Cleaning image tracker: ${this.newlyAddedImages.size} entries`);
          this.newlyAddedImages.clear();
        }
      } catch (error) {
        this.logger.error('Error cleaning image tracker:', error);
      }
    }, 5 * 60 * 1000);
  }

  clearNewImages() {
    this.newlyAddedImages.clear();
  }
}

module.exports = ImageService;