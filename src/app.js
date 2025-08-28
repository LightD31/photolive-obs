const express = require('express');
const http = require('http');
const path = require('path');

// Configuration and utilities
const config = require('./config');
const logger = require('./utils/logger');

// Middleware
const corsMiddleware = require('./middleware/cors');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Controllers
const apiController = require('./controllers/apiController');
const uploadController = require('./controllers/uploadController');

// Services
const imageService = require('./services/imageService');
const watermarkService = require('./services/watermarkService');
const fileWatcherService = require('./services/fileWatcherService');
const socketService = require('./services/socketService');

class PhotoLiveApp {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.isStarted = false;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      logger.info('Initializing PhotoLive OBS Server...');
      
      // Initialize services
      await this.initializeServices();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Setup file watching
      this.setupFileWatching();
      
      // Initialize Socket.IO
      socketService.initialize(this.server);
      
      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Initialize all services
   */
  async initializeServices() {
    logger.info('Initializing services...');
    
    // Initialize image service
    await imageService.initialize();
    
    // Initialize watermark service
    await watermarkService.initialize();
    
    logger.info('Services initialized');
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Request logging
    this.app.use(requestLogger);
    
    // CORS
    this.app.use(corsMiddleware);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files
    this.app.use(express.static(config.publicPath));
    this.app.use('/photos', express.static(config.photosPath));
    this.app.use('/uploads', express.static(config.uploadsPath));
    
    logger.info('Middleware configured');
  }

  /**
   * Setup application routes
   */
  setupRoutes() {
    // API routes
    this.app.use('/api', apiController);
    this.app.use('/api/upload', uploadController);
    
    // Root route - serve control interface
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(config.publicPath, 'control.html'));
    });
    
    // Slideshow route
    this.app.get('/slideshow', (req, res) => {
      res.sendFile(path.join(config.publicPath, 'slideshow.html'));
    });
    
    logger.info('Routes configured');
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      this.gracefulShutdown('SIGINT');
    });
    
    // Handle SIGTERM
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      this.gracefulShutdown('SIGTERM');
    });
    
    logger.info('Error handling configured');
  }

  /**
   * Setup file watching
   */
  setupFileWatching() {
    // Start watching the photos directory
    fileWatcherService.startWatching(config.photosPath);
    
    // Handle file watcher events
    fileWatcherService.on('image:added', async (data) => {
      logger.info(`New image detected: ${data.filename}`);
      const added = await imageService.addImage(data.filename);
      if (added) {
        socketService.broadcastImagesUpdate();
      }
    });
    
    fileWatcherService.on('image:removed', (data) => {
      logger.info(`Image removed: ${data.filename}`);
      const removed = imageService.removeImage(data.filename);
      if (removed) {
        socketService.broadcastImagesUpdate();
      }
    });
    
    fileWatcherService.on('image:changed', (data) => {
      logger.debug(`Image changed: ${data.filename}`);
      // Could trigger thumbnail regeneration if needed
    });
    
    fileWatcherService.on('error', (error) => {
      logger.error('File watcher error:', error);
    });
    
    logger.info('File watching configured');
  }

  /**
   * Start the server
   */
  async start() {
    if (this.isStarted) {
      logger.warn('Server is already started');
      return;
    }

    try {
      await this.initialize();
      
      this.server.listen(config.port, () => {
        this.isStarted = true;
        logger.info(`PhotoLive OBS Server started on port ${config.port}`);
        logger.info(`Control interface: http://localhost:${config.port}/`);
        logger.info(`Slideshow interface: http://localhost:${config.port}/slideshow`);
        logger.info(`Photos directory: ${config.photosPath}`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(signal) {
    if (!this.isStarted) {
      return;
    }

    logger.info(`Graceful shutdown initiated (${signal})`);
    
    try {
      // Stop accepting new connections
      this.server.close(async () => {
        logger.info('HTTP server closed');
        
        // Stop file watcher
        await fileWatcherService.stopWatching();
        logger.info('File watcher stopped');
        
        // Close any other resources here if needed
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
      
      // Force close after timeout
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
      
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Get Express app instance
   */
  getApp() {
    return this.app;
  }

  /**
   * Get HTTP server instance
   */
  getServer() {
    return this.server;
  }
}

module.exports = PhotoLiveApp;
