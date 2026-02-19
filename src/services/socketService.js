const { EventEmitter } = require('events');
const Logger = require('../utils/logger');

class SocketService extends EventEmitter {
  constructor(io, config) {
    super();
    this.io = io;
    this.config = config;
    this.logger = Logger.getInstance();
    this.slideshowService = null;
    this.imageService = null;
  }

  setSlideshowService(slideshowService) {
    this.slideshowService = slideshowService;
    // Set up event emitter for slideshow service
    slideshowService.setEventEmitter((event, data) => {
      this.io.emit(event, data);
    });
  }

  setImageService(imageService) {
    this.imageService = imageService;
  }

  initialize() {
    this.io.on('connection', (socket) => {
      this.logger.debug(`Client connected: ${socket.id}`);
      
      // Global error handler for unhandled Socket.IO events
      socket.on('error', (error) => {
        this.logger.error(`Socket error for client ${socket.id}:`, error);
      });

      // Handle any uncaught exceptions in socket event handlers
      socket.use((packet, next) => {
        try {
          next();
        } catch (error) {
          this.logger.error(`Uncaught error in socket middleware for ${socket.id}:`, error);
          next(error);
        }
      });
      
      // Send current state to new client
      try {
        this.sendCurrentState(socket);
      } catch (error) {
        this.logger.error(`Error sending current state to client ${socket.id}:`, error);
      }
      
      // Set up event handlers
      this.setupSocketHandlers(socket);

      socket.on('disconnect', (reason) => {
        this.logger.debug(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });
    });

    // Global error handler for Socket.IO server
    this.io.engine.on('connection_error', (err) => {
      this.logger.error('Socket.IO connection error:', err);
    });
  }

  sendCurrentState(socket) {
    if (!this.slideshowService) return;

    try {
      const state = this.slideshowService.getState();
      const settings = this.slideshowService.getSettings();
      const currentImages = this.slideshowService.getCurrentImages();
      
      // Send image list with timeout protection
      const imagesData = {
        allImages: this.slideshowService.getAllImagesList(),
        images: this.slideshowService.getCurrentImagesList(),
        settings: settings
      };
      
      // Use setTimeout to prevent blocking operations
      setImmediate(() => {
        try {
          socket.emit('images-updated', imagesData);
        } catch (error) {
          this.logger.error('Error emitting images-updated:', error);
        }
      });
      
      // Send slideshow state - trigger the service's own state update to get proper next image logic
      this.slideshowService.updateSlideshowState(false); // Don't emit event to avoid loop
      
      const imagesList = this.slideshowService.getCurrentImagesList();
      const originalIndex = state.currentImage ? 
        currentImages.findIndex(img => img.filename === state.currentImage.filename) : -1;
      
      let nextImage = null;
      let nextOriginalIndex = -1;
      
      // Use same logic as slideshow service for next image
      if (this.slideshowService.newImageQueue && this.slideshowService.newImageQueue.length > 0) {
        const nextQueuePath = this.slideshowService.newImageQueue[0];
        nextImage = currentImages.find(img => 
          img.filename === require('path').basename(nextQueuePath) || 
          img.path === nextQueuePath
        );
        nextOriginalIndex = nextImage ? 
          currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
      } else if (imagesList.length > 1) {
        const nextIndex = (state.currentIndex + 1) % imagesList.length;
        nextImage = imagesList[nextIndex];
        nextOriginalIndex = nextImage ? 
          currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
      }
      
      const slideshowStateData = {
        currentImage: state.currentImage,
        currentIndex: state.currentIndex,
        originalIndex: originalIndex,
        nextImage: nextImage,
        nextOriginalIndex: nextOriginalIndex,
        isPlaying: state.isPlaying,
        totalImages: imagesList.length,
        totalOriginalImages: currentImages.length,
        interval: settings.interval
      };

      // Use setTimeout to prevent blocking operations
      setImmediate(() => {
        try {
          socket.emit('slideshow-state', slideshowStateData);
        } catch (error) {
          this.logger.error('Error emitting slideshow-state:', error);
        }
      });
      
    } catch (error) {
      this.logger.error('Error in sendCurrentState:', error);
    }
  }

  setupSocketHandlers(socket) {
    // Navigation controls - wrapped with error handling
    socket.on('next-image', (callback) => {
      try {
        this.logger.debug('Next image requested');
        if (this.slideshowService) {
          this.slideshowService.changeImage(1);
          this.slideshowService.restartSlideshowTimer();
        }
        // Acknowledge the request if callback provided
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        this.logger.error('Error handling next-image request:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('prev-image', (callback) => {
      try {
        this.logger.debug('Previous image requested');
        if (this.slideshowService) {
          this.slideshowService.changeImage(-1);
          this.slideshowService.restartSlideshowTimer();
        }
        // Acknowledge the request if callback provided
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        this.logger.error('Error handling prev-image request:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('jump-to-image', (index, callback) => {
      try {
        if (this.slideshowService) {
          this.slideshowService.jumpToImage(index);
          this.slideshowService.restartSlideshowTimer();
        }
        // Acknowledge the request if callback provided
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        this.logger.error('Error handling jump-to-image request:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    // Playback controls - wrapped with error handling
    socket.on('pause-slideshow', (callback) => {
      try {
        if (this.slideshowService) {
          this.slideshowService.pause();
          socket.broadcast.emit('pause-slideshow');
          this.logger.debug('Slideshow paused by client');
        }
        // Acknowledge the request if callback provided
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        this.logger.error('Error handling pause-slideshow request:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('resume-slideshow', (callback) => {
      try {
        if (this.slideshowService) {
          this.slideshowService.resume();
          socket.broadcast.emit('resume-slideshow');
          this.logger.debug('Slideshow resumed by client');
        }
        // Acknowledge the request if callback provided
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        this.logger.error('Error handling resume-slideshow request:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('get-slideshow-state', (callback) => {
      try {
        this.sendCurrentState(socket);
        // Acknowledge the request if callback provided
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        this.logger.error('Error handling get-slideshow-state request:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    // Image management - wrapped with error handling
    socket.on('rescan-images', (callback) => {
      try {
        this.logger.debug('Manual rescan requested');
        this.emit('rescan-requested');
        // Acknowledge the request if callback provided
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        this.logger.error('Error handling rescan-images request:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('toggle-image-exclusion', (filename, callback) => {
      try {
        if (typeof filename !== 'string') {
          const errorMsg = 'Invalid filename for exclusion toggle';
          this.logger.error(errorMsg, filename);
          if (typeof callback === 'function') {
            callback({ success: false, error: errorMsg });
          }
          return;
        }

        if (this.slideshowService) {
          this.slideshowService.toggleImageExclusion(filename);
          
          // Broadcast updated settings and images to all clients
          const settings = this.slideshowService.getSettings();
          this.io.emit('settings-updated', settings);
          this.io.emit('images-updated', {
            allImages: this.slideshowService.getAllImagesList(),
            images: this.slideshowService.getCurrentImagesList(),
            settings: settings
          });
        }
        
        // Acknowledge the request if callback provided
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        this.logger.error('Error toggling image exclusion:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });
  }

  // Broadcast methods with error handling
  broadcastScanProgress(data) {
    try {
      this.io.emit('scan-progress', data);
    } catch (error) {
      this.logger.error('Error broadcasting scan progress:', error);
    }
  }

  broadcastImagesUpdated(data) {
    try {
      this.io.emit('images-updated', data);
    } catch (error) {
      this.logger.error('Error broadcasting images updated:', error);
    }
  }

  broadcastSettingsUpdated(settings) {
    try {
      this.io.emit('settings-updated', settings);
    } catch (error) {
      this.logger.error('Error broadcasting settings updated:', error);
    }
  }

  broadcastSlideshowState(state) {
    try {
      this.io.emit('slideshow-state', state);
    } catch (error) {
      this.logger.error('Error broadcasting slideshow state:', error);
    }
  }

  broadcastImageChanged(data) {
    try {
      this.io.emit('image-changed', data);
    } catch (error) {
      this.logger.error('Error broadcasting image changed:', error);
    }
  }
}

module.exports = SocketService;