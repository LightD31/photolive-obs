const Logger = require('../utils/logger');

class SlideshowService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
    
    // Image data
    this.currentImages = [];
    this.shuffledImages = [];
    
    // Settings
    this.settings = {
      ...config.defaults,
      photosPath: config.photosPath
    };
    
    // State
    this.state = {
      currentIndex: 0,
      isPlaying: true,
      currentImage: null
    };
    
    // Timer management
    this.slideshowTimer = null;
    
    // Queue system
    this.newImageQueue = [];
    this.isProcessingQueue = false;
    this.queueTimer = null;
    this.originalSlideshowIndex = -1;
  }

  // Image list management
  updateImages(images) {
    this.currentImages = images;
    this.updateShuffledImagesList();
    this.updateSlideshowState();
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getAllImagesList() {
    return this.settings.shuffleImages ? this.shuffledImages : this.currentImages;
  }

  getCurrentImagesList() {
    const allImages = this.settings.shuffleImages ? this.shuffledImages : this.currentImages;
    const excludedImages = this.settings.excludedImages || [];
    
    let filteredImages = allImages.filter(image => !excludedImages.includes(image.filename));
    
    if (this.settings.repeatLatest && filteredImages.length > 0) {
      const latestCount = Math.min(this.settings.latestCount || 5, filteredImages.length);
      filteredImages = filteredImages.slice(0, latestCount);
      this.logger.debug(`Latest mode: showing ${latestCount} latest images of ${allImages.length} total`);
    }
    
    return filteredImages;
  }

  updateShuffledImagesList(newImageAdded = null) {
    if (!this.settings.shuffleImages) {
      this.shuffledImages = [...this.currentImages];
      this.logger.debug('Normal mode: chronological order');
      return;
    }

    const newImages = this.currentImages.filter(img => img.isNew);
    const existingImages = this.currentImages.filter(img => !img.isNew);

    if (newImages.length > 0) {
      this.shuffledImages = this.shuffleArray([...this.currentImages]);
      this.logger.debug(`Shuffle mode: ${newImages.length} new images integrated with ${existingImages.length} existing images`);
      this.logger.debug('New images added to shuffle:', newImages.map(img => img.filename));
    } else {
      this.shuffledImages = this.shuffleArray([...this.currentImages]);
      this.logger.debug(`Shuffle mode: ${this.currentImages.length} total images shuffled`);
    }
  }

  // State management
  updateSlideshowState(emitEvent = true) {
    const imagesList = this.getCurrentImagesList();
    
    if (imagesList.length === 0) {
      this.state.currentImage = null;
      this.state.currentIndex = 0;
      return;
    }

    if (this.state.currentIndex >= imagesList.length) {
      this.state.currentIndex = 0;
    } else if (this.state.currentIndex < 0) {
      this.state.currentIndex = imagesList.length - 1;
    }

    this.state.currentImage = imagesList[this.state.currentIndex];
    
    const originalIndex = this.state.currentImage ? 
      this.currentImages.findIndex(img => img.filename === this.state.currentImage.filename) : -1;
    
    let nextImage = null;
    let nextOriginalIndex = -1;
    
    // If there are queued images, show the first queued image as next
    if (this.newImageQueue.length > 0) {
      const nextQueuePath = this.newImageQueue[0];
      nextImage = this.currentImages.find(img => 
        img.filename === require('path').basename(nextQueuePath) || 
        img.path === nextQueuePath
      );
      nextOriginalIndex = nextImage ? 
        this.currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
    } else if (imagesList.length > 1) {
      const nextIndex = (this.state.currentIndex + 1) % imagesList.length;
      nextImage = imagesList[nextIndex];
      nextOriginalIndex = nextImage ? 
        this.currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
    }
    
    if (emitEvent && this.eventEmitter) {
      this.eventEmitter('slideshow-state', {
        currentImage: this.state.currentImage,
        currentIndex: this.state.currentIndex,
        originalIndex: originalIndex,
        nextImage: nextImage,
        nextOriginalIndex: nextOriginalIndex,
        isPlaying: this.state.isPlaying,
        totalImages: imagesList.length,
        totalOriginalImages: this.currentImages.length
      });
    }
  }

  changeImage(direction = 1) {
    const imagesList = this.getCurrentImagesList();
    if (imagesList.length === 0) return;
    
    const oldIndex = this.state.currentIndex;
    let newIndex = this.state.currentIndex + direction;
    
    if (newIndex >= imagesList.length) {
      newIndex = 0;
    } else if (newIndex < 0) {
      newIndex = imagesList.length - 1;
    }
    
    this.state.currentIndex = newIndex;
    this.state.currentImage = imagesList[this.state.currentIndex];
    
    this.logger.debug(`Changed image: ${oldIndex} -> ${newIndex} (direction: ${direction}), current: ${this.state.currentImage?.filename}`);
    
    const originalIndex = this.state.currentImage ? 
      this.currentImages.findIndex(img => img.filename === this.state.currentImage.filename) : -1;
    
    let nextImage = null;
    let nextOriginalIndex = -1;
    
    // If there are queued images, show the first queued image as next
    if (this.newImageQueue.length > 0) {
      const nextQueuePath = this.newImageQueue[0];
      nextImage = this.currentImages.find(img => 
        img.filename === require('path').basename(nextQueuePath) || 
        img.path === nextQueuePath
      );
      nextOriginalIndex = nextImage ? 
        this.currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
    } else if (imagesList.length > 1) {
      const nextIndex = (this.state.currentIndex + 1) % imagesList.length;
      nextImage = imagesList[nextIndex];
      nextOriginalIndex = nextImage ? 
        this.currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
    }
    
    if (this.eventEmitter) {
      this.eventEmitter('image-changed', {
        currentImage: this.state.currentImage,
        currentIndex: this.state.currentIndex,
        originalIndex: originalIndex,
        nextImage: nextImage,
        nextOriginalIndex: nextOriginalIndex,
        direction: direction,
        totalImages: imagesList.length
      });
    }
  }

  jumpToImage(index) {
    const imagesList = this.getCurrentImagesList();
    if (index >= 0 && index < imagesList.length) {
      const previousIndex = this.state.currentIndex;
      
      this.state.currentIndex = index;
      this.state.currentImage = imagesList[this.state.currentIndex];
      
      const direction = index > previousIndex ? 1 : (index < previousIndex ? -1 : 0);
      
      this.logger.debug(`Jumped to image: ${previousIndex} -> ${index}, current: ${this.state.currentImage?.filename}`);
      
      const originalIndex = this.state.currentImage ? 
        this.currentImages.findIndex(img => img.filename === this.state.currentImage.filename) : -1;
      
      let nextImage = null;
      let nextOriginalIndex = -1;
      if (imagesList.length > 1) {
        const nextIndex = (this.state.currentIndex + 1) % imagesList.length;
        nextImage = imagesList[nextIndex];
        nextOriginalIndex = nextImage ? 
          this.currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
      }
      
      if (this.eventEmitter) {
        this.eventEmitter('image-changed', {
          currentImage: this.state.currentImage,
          currentIndex: this.state.currentIndex,
          originalIndex: originalIndex,
          nextImage: nextImage,
          nextOriginalIndex: nextOriginalIndex,
          direction: direction,
          totalImages: imagesList.length
        });
      }
    }
  }

  // Timer management
  startSlideshowTimer() {
    this.stopSlideshowTimer();
    
    const imagesList = this.getCurrentImagesList();
    if (imagesList.length > 1 && this.state.isPlaying) {
      this.slideshowTimer = setInterval(() => {
        this.logger.debug('Server timer: moving to next image');
        
        // Check if we should start processing the queue instead of normal slideshow
        if (this.isProcessingQueue && this.newImageQueue.length > 0) {
          this.logger.debug('Timer expired, starting queue processing');
          this.stopSlideshowTimer();
          this.processImageQueue();
        } else {
          this.changeImage(1);
        }
      }, this.settings.interval);
      this.logger.debug(`Slideshow timer started (interval: ${this.settings.interval}ms)`);
    }
  }

  stopSlideshowTimer() {
    if (this.slideshowTimer) {
      clearInterval(this.slideshowTimer);
      this.slideshowTimer = null;
      this.logger.debug('Slideshow timer stopped');
    }
  }

  restartSlideshowTimer() {
    if (this.state.isPlaying) {
      this.startSlideshowTimer();
    }
  }

  // Playback control
  pause() {
    this.state.isPlaying = false;
    this.stopSlideshowTimer();
    this.updateSlideshowState();
    this.logger.debug('Slideshow paused');
  }

  resume() {
    this.state.isPlaying = true;
    this.startSlideshowTimer();
    this.updateSlideshowState();
    this.logger.debug('Slideshow resumed');
  }

  // Settings management
  updateSettings(newSettings) {
    const previousShuffleState = this.settings.shuffleImages;
    this.settings = { ...this.settings, ...newSettings };
    
    if (newSettings.shuffleImages !== undefined && previousShuffleState !== newSettings.shuffleImages) {
      this.logger.debug(`Shuffle mode changed: ${previousShuffleState} → ${newSettings.shuffleImages}`);
      
      const currentImageFilename = this.state.currentImage ? this.state.currentImage.filename : null;
      
      this.updateShuffledImagesList();
      
      const imagesList = this.getCurrentImagesList();
      if (currentImageFilename && imagesList.length > 0) {
        const newIndex = imagesList.findIndex(img => img.filename === currentImageFilename);
        if (newIndex !== -1) {
          this.state.currentIndex = newIndex;
        } else {
          this.state.currentIndex = 0;
        }
      } else {
        this.state.currentIndex = 0;
      }
      
      if (this.state.currentIndex >= imagesList.length) {
        this.state.currentIndex = 0;
      }
      
      this.updateSlideshowState();
    }
    
    if (newSettings.interval) {
      this.restartSlideshowTimer();
    }
  }

  toggleImageExclusion(filename) {
    const excludedImages = this.settings.excludedImages || [];
    const isExcluded = excludedImages.includes(filename);
    
    if (isExcluded) {
      this.settings.excludedImages = excludedImages.filter(img => img !== filename);
      this.logger.debug(`Image ${filename} reintegrated into slideshow`);
    } else {
      this.settings.excludedImages = [...excludedImages, filename];
      this.logger.debug(`Image ${filename} excluded from slideshow`);
    }
    
    let shouldRestartTimer = false;
    
    const filteredImages = this.getCurrentImagesList();
    if (filteredImages.length === 0) {
      this.state.currentImage = null;
      this.state.currentIndex = 0;
      shouldRestartTimer = true;
    } else if (this.state.currentImage && this.settings.excludedImages.includes(this.state.currentImage.filename)) {
      this.state.currentIndex = 0;
      this.updateSlideshowState();
      shouldRestartTimer = true;
    }
    
    if (shouldRestartTimer) {
      this.restartSlideshowTimer();
    }
  }

  // Queue management
  addImageToQueue(imagePath) {
    this.logger.debug(`Adding image to queue: ${imagePath}`);
    this.newImageQueue.push(imagePath);
    this.logger.debug(`Queue length after adding ${imagePath}: ${this.newImageQueue.length}`);
    
    // Update the next image preview to show the queued image
    this.updateSlideshowState();
    
    if (!this.isProcessingQueue && this.newImageQueue.length > 0) {
      this.logger.debug(`Queue not processing and has ${this.newImageQueue.length} images, scheduling queue processing`);
      this.scheduleQueueProcessing();
    }
  }

  scheduleQueueProcessing() {
    if (this.isProcessingQueue) return;

    this.logger.debug('Scheduling queue processing after current timer expires');
    
    this.originalSlideshowIndex = this.state.currentIndex;
    this.logger.debug(`Saved original slideshow index: ${this.originalSlideshowIndex}`);
    
    // Don't stop the current timer - let it finish naturally
    // The queue will be processed when the timer fires
    this.isProcessingQueue = true;
  }

  processImageQueue() {
    this.logger.debug(`processImageQueue called, queue length: ${this.newImageQueue.length}, isProcessingQueue: ${this.isProcessingQueue}`);
    
    if (this.newImageQueue.length === 0) {
      this.logger.debug('Queue processing complete, resuming normal slideshow');
      this.isProcessingQueue = false;
      
      if (this.originalSlideshowIndex !== -1) {
        const imagesList = this.getCurrentImagesList();
        const resumeIndex = (this.originalSlideshowIndex + 1) % imagesList.length;
        const resumeImage = imagesList[resumeIndex];
        
        if (resumeImage) {
          this.state.currentIndex = resumeIndex;
          this.state.currentImage = resumeImage;
          this.logger.debug(`Resuming slideshow at index ${resumeIndex}: ${resumeImage.filename}`);
          
          const originalIndex = this.currentImages.findIndex(img => img.filename === resumeImage.filename);
          
          let nextImage = null;
          let nextOriginalIndex = -1;
          if (imagesList.length > 1) {
            const nextIndex = (this.state.currentIndex + 1) % imagesList.length;
            nextImage = imagesList[nextIndex];
            nextOriginalIndex = nextImage ? 
              this.currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
          }
          
          if (this.eventEmitter) {
            this.eventEmitter('image-changed', {
              currentImage: this.state.currentImage,
              currentIndex: this.state.currentIndex,
              originalIndex: originalIndex,
              nextImage: nextImage,
              nextOriginalIndex: nextOriginalIndex,
              direction: 1,
              totalImages: imagesList.length,
              isQueueProcessing: false,
              queueLength: 0
            });
          }
        }
        
        this.originalSlideshowIndex = -1;
      }
      
      this.restartSlideshowTimer();
      return;
    }
    
    if (!this.isProcessingQueue) {
      this.isProcessingQueue = true;
      this.logger.debug(`Starting queue processing with ${this.newImageQueue.length} images`);
    }
    
    const nextImagePath = this.newImageQueue.shift();
    this.logger.debug(`Processing next image from queue: ${nextImagePath}, remaining queue length: ${this.newImageQueue.length}`);
    
    const nextImage = this.currentImages.find(img => 
      img.filename === require('path').basename(nextImagePath) || 
      img.path === nextImagePath
    );
    
    if (nextImage) {
      this.logger.debug(`Processing queued image: ${nextImage.filename}`);
      
      const imagesList = this.getCurrentImagesList();
      const newIndex = imagesList.findIndex(img => img.filename === nextImage.filename);
      
      if (newIndex !== -1) {
        this.state.currentIndex = newIndex;
        this.state.currentImage = nextImage;
        
        const originalIndex = this.currentImages.findIndex(img => img.filename === nextImage.filename);
        
        let nextQueueImage = null;
        let nextOriginalIndex = -1;
        
        if (this.newImageQueue.length > 0) {
          const nextQueuePath = this.newImageQueue[0];
          nextQueueImage = this.currentImages.find(img => 
            img.filename === require('path').basename(nextQueuePath) || 
            img.path === nextQueuePath
          );
          nextOriginalIndex = nextQueueImage ? 
            this.currentImages.findIndex(img => img.filename === nextQueueImage.filename) : -1;
          this.logger.debug(`Next image will be from queue: ${nextQueuePath}`);
        } else {
          if (this.originalSlideshowIndex !== -1) {
            const resumeIndex = (this.originalSlideshowIndex + 1) % imagesList.length;
            nextQueueImage = imagesList[resumeIndex];
            nextOriginalIndex = nextQueueImage ? 
              this.currentImages.findIndex(img => img.filename === nextQueueImage.filename) : -1;
            this.logger.debug(`Next image will be from normal slideshow resuming at index ${resumeIndex}`);
          }
        }
        
        if (this.eventEmitter) {
          this.eventEmitter('image-changed', {
            currentImage: this.state.currentImage,
            currentIndex: this.state.currentIndex,
            originalIndex: originalIndex,
            nextImage: nextQueueImage,
            nextOriginalIndex: nextOriginalIndex,
            direction: 1,
            totalImages: imagesList.length,
            isQueueProcessing: true,
            queueLength: this.newImageQueue.length
          });
        }
        
        this.logger.debug(`Scheduling next queue processing in ${this.settings.interval}ms`);
        this.queueTimer = setTimeout(() => {
          this.processImageQueue();
        }, this.settings.interval);
      } else {
        this.logger.warn(`Queued image ${nextImage.filename} not found in current images list, skipping`);
        this.processImageQueue();
      }
    } else {
      this.logger.warn(`Queued image not found: ${nextImagePath}, skipping`);
      this.processImageQueue();
    }
  }

  stopQueueProcessing() {
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = null;
    }
    this.isProcessingQueue = false;
    this.newImageQueue = [];
    this.logger.debug('Queue processing stopped');
  }

  // Event emitter setup
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }

  // Getters
  getState() {
    return this.state;
  }

  getSettings() {
    return this.settings;
  }

  getCurrentImages() {
    return this.currentImages;
  }
}

module.exports = SlideshowService;