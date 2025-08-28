const socketIo = require('socket.io');
const config = require('../config');
const logger = require('../utils/logger');
const imageService = require('./imageService');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
  }

  /**
   * Initialize Socket.IO with the HTTP server
   */
  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: config.corsOrigins,
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupEventHandlers();
    logger.info('Socket.IO initialized');
    return this.io;
  }

  /**
   * Set up Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const clientInfo = {
      id: socket.id,
      connectedAt: new Date(),
      userAgent: socket.handshake.headers['user-agent']
    };
    
    this.connectedClients.set(socket.id, clientInfo);
    logger.info(`Client connected: ${socket.id} (Total: ${this.connectedClients.size})`);

    // Send initial data
    this.sendInitialData(socket);

    // Set up event listeners
    socket.on('disconnect', () => this.handleDisconnect(socket));
    socket.on('next-image', () => this.handleNextImage(socket));
    socket.on('prev-image', () => this.handlePreviousImage(socket));
    socket.on('jump-to-image', (data) => this.handleJumpToImage(socket, data));
    socket.on('pause-slideshow', () => this.handlePauseSlideshow(socket));
    socket.on('resume-slideshow', () => this.handleResumeSlideshow(socket));
    socket.on('get-slideshow-state', () => this.handleGetSlideshowState(socket));
    socket.on('toggle-image-exclusion', (data) => this.handleToggleImageExclusion(socket, data));
    socket.on('toggle-image-priority', (data) => this.handleToggleImagePriority(socket, data));
    socket.on('mark-image-seen', (data) => this.handleMarkImageSeen(socket, data));
    socket.on('update-settings', (data) => this.handleUpdateSettings(socket, data));
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(socket) {
    this.connectedClients.delete(socket.id);
    logger.info(`Client disconnected: ${socket.id} (Total: ${this.connectedClients.size})`);
  }

  /**
   * Send initial data to newly connected client
   */
  sendInitialData(socket) {
    const state = imageService.getSlideshowState();
    const images = imageService.getAllImages();
    
    socket.emit('images-updated', {
      images,
      slideshowImages: imageService.getSlideshowImages(),
      settings: state.settings
    });
    
    socket.emit('slideshow-state', state);
  }

  /**
   * Handle next image request
   */
  handleNextImage(socket) {
    const image = imageService.nextImage();
    if (image) {
      this.broadcastSlideshowState();
      logger.debug(`Next image: ${image.filename}`);
    }
  }

  /**
   * Handle previous image request
   */
  handlePreviousImage(socket) {
    const image = imageService.previousImage();
    if (image) {
      this.broadcastSlideshowState();
      logger.debug(`Previous image: ${image.filename}`);
    }
  }

  /**
   * Handle jump to image request
   */
  handleJumpToImage(socket, data) {
    const { index } = data;
    const image = imageService.jumpToImage(index);
    if (image) {
      this.broadcastSlideshowState();
      logger.debug(`Jumped to image ${index}: ${image.filename}`);
    }
  }

  /**
   * Handle pause slideshow request
   */
  handlePauseSlideshow(socket) {
    const state = imageService.pauseSlideshow();
    this.broadcastSlideshowState();
    logger.info('Slideshow paused');
  }

  /**
   * Handle resume slideshow request
   */
  handleResumeSlideshow(socket) {
    const state = imageService.resumeSlideshow();
    this.broadcastSlideshowState();
    logger.info('Slideshow resumed');
  }

  /**
   * Handle get slideshow state request
   */
  handleGetSlideshowState(socket) {
    const state = imageService.getSlideshowState();
    socket.emit('slideshow-state', state);
  }

  /**
   * Handle toggle image exclusion
   */
  handleToggleImageExclusion(socket, data) {
    const { filename } = data;
    const isExcluded = imageService.toggleImageExclusion(filename);
    
    if (isExcluded !== null) {
      this.broadcastImagesUpdate();
      logger.info(`Image ${filename} exclusion toggled: ${isExcluded}`);
    }
  }

  /**
   * Handle toggle image priority
   */
  handleToggleImagePriority(socket, data) {
    const { filename } = data;
    const isPriority = imageService.toggleImagePriority(filename);
    
    if (isPriority !== null) {
      this.broadcastImagesUpdate();
      logger.info(`Image ${filename} priority toggled: ${isPriority}`);
    }
  }

  /**
   * Handle mark image as seen
   */
  handleMarkImageSeen(socket, data) {
    const { filename } = data;
    const marked = imageService.markImageAsSeen(filename);
    
    if (marked) {
      this.broadcastImagesUpdate();
      logger.debug(`Image ${filename} marked as seen`);
    }
  }

  /**
   * Handle settings update
   */
  handleUpdateSettings(socket, data) {
    const updatedSettings = config.updateSettings(data);
    
    // Update image order if shuffle setting changed
    if (data.shuffle !== undefined) {
      imageService.updateImageOrder();
    }
    
    this.broadcastSettingsUpdate(updatedSettings);
    logger.info('Settings updated:', data);
  }

  /**
   * Broadcast slideshow state to all clients
   */
  broadcastSlideshowState() {
    const state = imageService.getSlideshowState();
    this.io.emit('slideshow-state', state);
  }

  /**
   * Broadcast images update to all clients
   */
  broadcastImagesUpdate() {
    const images = imageService.getAllImages();
    const slideshowImages = imageService.getSlideshowImages();
    const settings = config.getSettings();
    
    this.io.emit('images-updated', {
      images,
      slideshowImages,
      settings
    });
  }

  /**
   * Broadcast settings update to all clients
   */
  broadcastSettingsUpdate(settings) {
    this.io.emit('settings-updated', settings);
  }

  /**
   * Broadcast image change event
   */
  broadcastImageChange(image) {
    this.io.emit('image-changed', image);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  /**
   * Get connected clients info
   */
  getConnectedClients() {
    return Array.from(this.connectedClients.values());
  }
}

module.exports = new SocketService();
