const path = require('path');
const fs = require('fs').promises;
const config = require('../config');
const logger = require('../utils/logger');
const { extractExifThumbnail, getPhotoDate } = require('../utils/exifHelper');
const { 
  ensureDirectoryExists, 
  fileExists, 
  getFileStats, 
  readDirectory,
  getFileExtension,
  shuffleArray 
} = require('../utils/fileHelper');

class ImageService {
  constructor() {
    this.images = [];
    this.newImages = new Set();
    this.priorityImages = new Set();
    this.excludedImages = new Set();
    this.currentPhotosPath = config.photosPath;
    this.imageOrder = [];
    this.currentIndex = 0;
    this.isPaused = false;
    this.intervalId = null;
  }

  /**
   * Initialize the image service
   */
  async initialize() {
    await ensureDirectoryExists(this.currentPhotosPath);
    await this.loadImages();
    // Start slideshow timer after loading images
    this.startSlideshowTimer();
  }

  /**
   * Load images from the photos directory
   */
  async loadImages() {
    try {
      const files = await readDirectory(this.currentPhotosPath);
      const imageFiles = files.filter(file => 
        config.supportedFormats.includes(getFileExtension(file))
      );

      // Process images in parallel with controlled concurrency
      const batchSize = 10;
      const newImagesList = [];
      
      for (let i = 0; i < imageFiles.length; i += batchSize) {
        const batch = imageFiles.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            const filePath = path.join(this.currentPhotosPath, file);
            const stats = await getFileStats(filePath);
            
            if (!stats) return null;

            const imageInfo = {
              filename: file,
              path: `/photos/${file}`, // Web-accessible path
              fullPath: filePath, // Keep full path for internal use
              size: stats.size,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              modified: stats.mtime, // Alias for compatibility
              photoDate: await getPhotoDate(filePath),
              thumbnail: await extractExifThumbnail(filePath),
              isNew: this.newImages.has(file),
              isPriority: this.priorityImages.has(file),
              isExcluded: this.excludedImages.has(file)
            };

            return imageInfo;
          })
        );

        newImagesList.push(...batchResults.filter(img => img !== null));
      }

      // Sort by photo date (newest first)
      newImagesList.sort((a, b) => b.photoDate - a.photoDate);

      this.images = newImagesList;
      this.updateImageOrder();
      
      logger.info(`Loaded ${this.images.length} images from ${this.currentPhotosPath}`);
      return this.images;
    } catch (error) {
      logger.error('Error loading images:', error);
      this.images = [];
      return [];
    }
  }

  /**
   * Update the image display order based on settings
   */
  updateImageOrder() {
    // Filter out excluded images
    let availableImages = this.images
      .filter(img => !img.isExcluded)
      .map(img => img.filename);

    // Handle priority images
    const priorityList = Array.from(this.priorityImages).filter(img => 
      availableImages.includes(img)
    );
    
    const regularImages = availableImages.filter(img => 
      !this.priorityImages.has(img)
    );

    // Shuffle if enabled
    if (config.defaults.shuffle) {
      shuffleArray(regularImages);
    }

    // Combine priority images first, then regular images
    this.imageOrder = [...priorityList, ...regularImages];
    
    // Reset index if out of bounds
    if (this.currentIndex >= this.imageOrder.length) {
      this.currentIndex = 0;
    }

    logger.debug(`Updated image order: ${this.imageOrder.length} images (${priorityList.length} priority)`);
    
    // Restart timer with new image order
    this.restartSlideshowTimer();
  }

  /**
   * Get all images list
   */
  getAllImages() {
    return this.images;
  }

  /**
   * Get images for slideshow (filtered)
   */
  getSlideshowImages() {
    return this.imageOrder.map(filename => 
      this.images.find(img => img.filename === filename)
    ).filter(img => img !== undefined);
  }

  /**
   * Get current image
   */
  getCurrentImage() {
    if (this.imageOrder.length === 0) return null;
    const filename = this.imageOrder[this.currentIndex];
    return this.images.find(img => img.filename === filename);
  }

  /**
   * Get next image
   */
  getNextImage() {
    if (this.imageOrder.length === 0) return null;
    const nextIndex = (this.currentIndex + 1) % this.imageOrder.length;
    const filename = this.imageOrder[nextIndex];
    return this.images.find(img => img.filename === filename);
  }

  /**
   * Move to next image
   */
  nextImage() {
    if (this.imageOrder.length === 0) return null;
    this.currentIndex = (this.currentIndex + 1) % this.imageOrder.length;
    return this.getCurrentImage();
  }

  /**
   * Move to previous image
   */
  previousImage() {
    if (this.imageOrder.length === 0) return null;
    this.currentIndex = (this.currentIndex - 1 + this.imageOrder.length) % this.imageOrder.length;
    return this.getCurrentImage();
  }

  /**
   * Jump to specific image
   */
  jumpToImage(index) {
    if (index >= 0 && index < this.imageOrder.length) {
      this.currentIndex = index;
      return this.getCurrentImage();
    }
    return null;
  }

  /**
   * Add image to the collection
   */
  async addImage(filename) {
    const filePath = path.join(this.currentPhotosPath, filename);
    
    if (!await fileExists(filePath)) {
      logger.warn(`Image file not found: ${filePath}`);
      return false;
    }

    const stats = await getFileStats(filePath);
    if (!stats) return false;

    const imageInfo = {
      filename,
      path: `/photos/${filename}`, // Web-accessible path
      fullPath: filePath, // Keep full path for internal use
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      modified: stats.mtime, // Alias for compatibility
      photoDate: await getPhotoDate(filePath),
      thumbnail: await extractExifThumbnail(filePath),
      isNew: true,
      isPriority: false,
      isExcluded: false
    };

    // Add to new images set
    this.newImages.add(filename);
    
    // Add to images array
    this.images.push(imageInfo);
    
    // Re-sort by date
    this.images.sort((a, b) => b.photoDate - a.photoDate);
    
    // Update order
    this.updateImageOrder();
    
    logger.info(`Added new image: ${filename}`);
    return true;
  }

  /**
   * Remove image from the collection
   */
  removeImage(filename) {
    const index = this.images.findIndex(img => img.filename === filename);
    if (index !== -1) {
      this.images.splice(index, 1);
      this.newImages.delete(filename);
      this.priorityImages.delete(filename);
      this.excludedImages.delete(filename);
      this.updateImageOrder();
      logger.info(`Removed image: ${filename}`);
      return true;
    }
    return false;
  }

  /**
   * Toggle image exclusion
   */
  toggleImageExclusion(filename) {
    const image = this.images.find(img => img.filename === filename);
    if (image) {
      if (this.excludedImages.has(filename)) {
        this.excludedImages.delete(filename);
        image.isExcluded = false;
      } else {
        this.excludedImages.add(filename);
        image.isExcluded = true;
      }
      this.updateImageOrder();
      return image.isExcluded;
    }
    return null;
  }

  /**
   * Toggle image priority
   */
  toggleImagePriority(filename) {
    const image = this.images.find(img => img.filename === filename);
    if (image) {
      if (this.priorityImages.has(filename)) {
        this.priorityImages.delete(filename);
        image.isPriority = false;
      } else {
        this.priorityImages.add(filename);
        image.isPriority = true;
      }
      this.updateImageOrder();
      return image.isPriority;
    }
    return null;
  }

  /**
   * Mark image as seen (not new)
   */
  markImageAsSeen(filename) {
    const image = this.images.find(img => img.filename === filename);
    if (image && image.isNew) {
      this.newImages.delete(filename);
      image.isNew = false;
      return true;
    }
    return false;
  }

  /**
   * Change photos path
   */
  async changePhotosPath(newPath) {
    const resolvedPath = path.resolve(newPath);
    
    if (!await fileExists(resolvedPath)) {
      throw new Error(`Directory does not exist: ${resolvedPath}`);
    }

    const stats = await getFileStats(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }

    this.currentPhotosPath = resolvedPath;
    this.newImages.clear();
    this.priorityImages.clear();
    this.excludedImages.clear();
    
    await this.loadImages();
    logger.info(`Changed photos path to: ${resolvedPath}`);
    
    return resolvedPath;
  }

  /**
   * Get slideshow state
   */
  getSlideshowState() {
    const currentImage = this.getCurrentImage();
    const nextImage = this.getNextImage();
    
    // Find original indices in the full images array
    const originalIndex = currentImage ? this.images.findIndex(img => img.filename === currentImage.filename) : -1;
    const nextOriginalIndex = nextImage ? this.images.findIndex(img => img.filename === nextImage.filename) : -1;
    
    return {
      currentImage,
      currentIndex: this.currentIndex,
      originalIndex,
      nextImage,
      nextOriginalIndex,
      totalImages: this.imageOrder.length,
      totalOriginalImages: this.images.length,
      isPlaying: !this.isPaused,
      isPaused: this.isPaused,
      interval: config.slideInterval,
      settings: config.getSettings()
    };
  }

  /**
   * Pause slideshow
   */
  pauseSlideshow() {
    this.isPaused = true;
    return this.getSlideshowState();
  }

  /**
   * Resume slideshow
   */
  resumeSlideshow() {
    this.isPaused = false;
    this.startSlideshowTimer();
    return this.getSlideshowState();
  }

  /**
   * Start slideshow timer
   */
  startSlideshowTimer() {
    this.stopSlideshowTimer();
    
    if (this.imageOrder.length > 1 && !this.isPaused) {
      this.intervalId = setInterval(() => {
        logger.debug('Server timer: moving to next image');
        const nextImage = this.nextImage();
        if (nextImage) {
          // Import socketService here to avoid circular dependency
          const socketService = require('./socketService');
          socketService.broadcastImageChange(nextImage);
          socketService.broadcastSlideshowState();
        }
      }, config.slideInterval);
      logger.debug(`Slideshow timer started (interval: ${config.slideInterval}ms)`);
    }
  }

  /**
   * Stop slideshow timer
   */
  stopSlideshowTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.debug('Slideshow timer stopped');
    }
  }

  /**
   * Restart slideshow timer
   */
  restartSlideshowTimer() {
    if (!this.isPaused) {
      this.startSlideshowTimer();
    }
  }

  /**
   * Pause slideshow
   */
  pauseSlideshow() {
    this.isPaused = true;
    this.stopSlideshowTimer();
    return this.getSlideshowState();
  }

  /**
   * Get current photos path
   */
  getCurrentPhotosPath() {
    return this.currentPhotosPath;
  }
}

module.exports = new ImageService();
