const Logger = require('../utils/logger');

class SocketService {
  constructor(io, config) {
    this.io = io;
    this.config = config;
    this.logger = new Logger(config.logLevel);
    this.slideshowService = null;
    this.imageService = null;
    this.eventHandlers = {};
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
          this.logger.error(`Error in socket event handler for ${event}:`, error);
        }
      });
    }
  }

  initialize() {
    this.io.on('connection', (socket) => {
      this.logger.debug(`Client connected: ${socket.id}`);
      
      // Send current state to new client
      this.sendCurrentState(socket);
      
      // Set up event handlers
      this.setupSocketHandlers(socket);

      socket.on('disconnect', () => {
        this.logger.debug(`Client disconnected: ${socket.id}`);
      });
    });
  }

  sendCurrentState(socket) {
    if (!this.slideshowService) return;

    const state = this.slideshowService.getState();
    const settings = this.slideshowService.getSettings();
    const currentImages = this.slideshowService.getCurrentImages();
    
    // Send image list
    socket.emit('images-updated', {
      allImages: this.slideshowService.getAllImagesList(),
      images: this.slideshowService.getCurrentImagesList(),
      settings: settings
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
    
    socket.emit('slideshow-state', {
      currentImage: state.currentImage,
      currentIndex: state.currentIndex,
      originalIndex: originalIndex,
      nextImage: nextImage,
      nextOriginalIndex: nextOriginalIndex,
      isPlaying: state.isPlaying,
      totalImages: imagesList.length,
      totalOriginalImages: currentImages.length
    });
  }

  setupSocketHandlers(socket) {
    // Navigation controls
    socket.on('next-image', () => {
      this.logger.debug('Next image requested');
      if (this.slideshowService) {
        this.slideshowService.changeImage(1);
        this.slideshowService.restartSlideshowTimer();
      }
    });

    socket.on('prev-image', () => {
      this.logger.debug('Previous image requested');
      if (this.slideshowService) {
        this.slideshowService.changeImage(-1);
        this.slideshowService.restartSlideshowTimer();
      }
    });

    socket.on('jump-to-image', (index) => {
      if (this.slideshowService) {
        this.slideshowService.jumpToImage(index);
        this.slideshowService.restartSlideshowTimer();
      }
    });

    // Playback controls
    socket.on('pause-slideshow', () => {
      if (this.slideshowService) {
        this.slideshowService.pause();
        socket.broadcast.emit('pause-slideshow');
        this.logger.debug('Slideshow paused by client');
      }
    });

    socket.on('resume-slideshow', () => {
      if (this.slideshowService) {
        this.slideshowService.resume();
        socket.broadcast.emit('resume-slideshow');
        this.logger.debug('Slideshow resumed by client');
      }
    });

    socket.on('get-slideshow-state', () => {
      this.sendCurrentState(socket);
    });

    // Image management
    socket.on('rescan-images', () => {
      this.logger.debug('Manual rescan requested');
      this.emit('rescan-requested');
    });

    socket.on('toggle-image-exclusion', (filename) => {
      try {
        if (typeof filename !== 'string') {
          this.logger.error('Invalid filename for exclusion toggle:', filename);
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
      } catch (error) {
        this.logger.error('Error toggling image exclusion:', error);
      }
    });
  }

  // Broadcast methods
  broadcastScanProgress(data) {
    this.io.emit('scan-progress', data);
  }

  broadcastImagesUpdated(data) {
    this.io.emit('images-updated', data);
  }

  broadcastSettingsUpdated(settings) {
    this.io.emit('settings-updated', settings);
  }

  broadcastSlideshowState(state) {
    this.io.emit('slideshow-state', state);
  }

  broadcastImageChanged(data) {
    this.io.emit('image-changed', data);
  }
}

module.exports = SocketService;