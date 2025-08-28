const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

// Import services and utilities
const config = require('./config');
const Logger = require('./utils/logger');
const ImageService = require('./services/imageService');
const SlideshowService = require('./services/slideshowService');
const FileWatcher = require('./services/fileWatcher');
const SocketService = require('./services/socketService');

// Import routes and middleware
const createApiRoutes = require('./routes/api');
const createImageRoutes = require('./routes/images');
const createSecurityMiddleware = require('./middleware/security');
const createErrorHandler = require('./middleware/errorHandler');

class PhotoLiveApp {
  constructor() {
    this.config = config.get();
    this.logger = new Logger(this.config.logLevel);
    
    // Express app and server
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS ? 
          process.env.ALLOWED_ORIGINS.split(',') : 
          ["http://localhost:3001", "http://127.0.0.1:3001"],
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    // Services
    this.imageService = new ImageService(this.config);
    this.slideshowService = new SlideshowService(this.config);
    this.fileWatcher = new FileWatcher(this.config);
    this.socketService = new SocketService(this.io, this.config);
    
    // Current photos path
    this.currentPhotosPath = this.config.photosPath;
    
    // Initialize
    this.setupMiddleware();
    this.setupRoutes();
    this.setupServices();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Basic middleware
    this.app.use(cors());
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    
    // Security middleware
    this.app.use(createSecurityMiddleware(this.config));
    
    // Static files
    this.app.use(express.static(this.config.publicPath));
    this.app.use('/watermarks', express.static(path.join(__dirname, '..', 'watermarks')));
    this.app.use('/uploads/watermarks', express.static(path.join(__dirname, '..', 'uploads', 'watermarks')));
  }

  setupRoutes() {
    // Make io available to routes
    this.app.set('io', this.io);
    
    // API routes
    const apiRoutes = createApiRoutes(this.config, this.slideshowService, this.imageService);
    this.app.use('/api', apiRoutes);
    
    // Image serving routes
    const { router: imageRoutes, updatePhotosPath } = createImageRoutes(this.config);
    this.app.use('/photos', imageRoutes);
    this.updateImageRoutesPath = updatePhotosPath;
    
    // Main routes
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(this.config.publicPath, 'slideshow.html'));
    });
    
    this.app.get('/control', (req, res) => {
      res.sendFile(path.join(this.config.publicPath, 'control.html'));
    });
    
    // Error handling middleware (must be last)
    this.app.use(createErrorHandler(this.config));
  }

  setupServices() {
    // Connect services
    this.socketService.setSlideshowService(this.slideshowService);
    this.socketService.setImageService(this.imageService);
    
    // Initialize socket service
    this.socketService.initialize();
  }

  setupEventHandlers() {
    // File watcher events
    this.fileWatcher.on('imageAdded', async (filePath, trackingKey) => {
      this.logger.info(`🆕 FILE ADDED: ${trackingKey} at ${filePath}`);
      this.logger.debug(`Marking as new and starting scan process...`);
      
      this.imageService.markAsNew(trackingKey);
      
      // Silent scan to load image data
      this.logger.debug(`Scanning images after adding ${trackingKey}...`);
      const images = await this.imageService.scanImages(
        this.currentPhotosPath, 
        this.slideshowService.getSettings().recursiveSearch
      );
      
      this.logger.debug(`Scan complete: ${images.length} total images found`);
      this.slideshowService.updateImages(images);
      
      // Emit updated images to UI
      this.logger.debug(`Broadcasting image update to clients...`);
      this.socketService.broadcastImagesUpdated({
        allImages: this.slideshowService.getAllImagesList(),
        images: this.slideshowService.getCurrentImagesList(),
        settings: this.slideshowService.getSettings(),
        newImageAdded: trackingKey
      });
      
      // Add to queue for display
      this.logger.debug(`Adding ${trackingKey} to slideshow queue`);
      this.slideshowService.addImageToQueue(trackingKey);
      this.logger.info(`✅ FILE PROCESSING COMPLETE: ${trackingKey}`);
    });

    this.fileWatcher.on('imageRemoved', async (filePath, trackingKey) => {
      this.logger.info(`🗑️ FILE REMOVED: ${trackingKey} at ${filePath}`);
      
      const currentImageFilename = this.slideshowService.getState().currentImage?.filename;
      const wasCurrentImageDeleted = (currentImageFilename === path.basename(filePath));
      
      this.logger.debug(`Current image: ${currentImageFilename}, deleted image: ${path.basename(filePath)}`);
      this.logger.debug(`Was current image deleted: ${wasCurrentImageDeleted}`);
      
      // Rescan images
      this.logger.debug(`Rescanning images after removal...`);
      await this.scanImages();
      
      if (wasCurrentImageDeleted) {
        this.logger.info(`⚠️ CURRENT IMAGE DELETED: Slideshow state updated`);
      }
      this.logger.info(`✅ FILE REMOVAL COMPLETE: ${trackingKey}`);
    });

    this.fileWatcher.on('directoryRemoved', async () => {
      if (this.slideshowService.getSettings().recursiveSearch) {
        await this.scanImages();
      }
    });

    this.fileWatcher.on('error', (error) => {
      this.logger.error('File watcher error:', error);
    });

    // Socket service events
    this.socketService.on('rescan-requested', async () => {
      await this.scanImages();
    });

    // App-level events for settings changes
    this.app.on('recursiveSearchChanged', (recursive) => {
      this.fileWatcher.updateRecursive(recursive);
      this.scanImages();
    });

    this.app.on('photosPathChanged', async (newPath) => {
      await this.changePhotosPath(newPath);
    });
  }

  async scanImages(newImageFilename = null) {
    try {
      // Emit scan start
      this.socketService.broadcastScanProgress({
        status: 'started',
        message: 'Starting image scan...'
      });
      
      const images = await this.imageService.scanImages(
        this.currentPhotosPath,
        this.slideshowService.getSettings().recursiveSearch,
        (progress) => {
          this.socketService.broadcastScanProgress({
            status: 'scanning',
            current: progress.current,
            total: progress.total,
            currentFile: progress.currentFile,
            percentage: Math.round((progress.current / progress.total) * 100)
          });
        }
      );
      
      this.slideshowService.updateImages(images);
      this.slideshowService.restartSlideshowTimer();
      
      // Emit scan complete
      this.socketService.broadcastScanProgress({
        status: 'completed',
        totalImages: images.length,
        message: `Scan completed: ${images.length} images found`
      });
      
      // Emit updated list to clients
      this.socketService.broadcastImagesUpdated({
        allImages: this.slideshowService.getAllImagesList(),
        images: this.slideshowService.getCurrentImagesList(),
        settings: this.slideshowService.getSettings(),
        newImageAdded: newImageFilename
      });

      this.logger.info(`${images.length} images found in ${this.currentPhotosPath}${newImageFilename ? ` (new: ${newImageFilename})` : ''}`);
      return images;
    } catch (error) {
      this.logger.error('Error scanning images:', error);
      
      this.socketService.broadcastScanProgress({
        status: 'error',
        message: 'Error scanning images: ' + error.message
      });
      
      return [];
    }
  }

  async changePhotosPath(newPath) {
    this.currentPhotosPath = newPath;
    this.slideshowService.updateSettings({ photosPath: newPath });
    
    // Update image routes
    this.updateImageRoutesPath(newPath);
    
    // Clear new images tracker
    this.imageService.clearNewImages();
    
    // Restart file watching
    this.fileWatcher.start(newPath, this.slideshowService.getSettings().recursiveSearch);
    
    // Rescan images
    await this.scanImages();
  }

  async initialize() {
    try {
      // Create photos directory if it doesn't exist
      await fs.mkdir(this.currentPhotosPath, { recursive: true });
      
      // Initial image scan
      await this.scanImages();
      
      // Start file watching
      this.fileWatcher.start(this.currentPhotosPath, this.slideshowService.getSettings().recursiveSearch);
      
      // Start slideshow timer
      this.slideshowService.startSlideshowTimer();
      
      this.logger.info('PhotoLive OBS application initialized successfully');
    } catch (error) {
      this.logger.error('Error during initialization:', error);
      throw error;
    }
  }

  async start() {
    await this.initialize();
    
    const startServer = () => {
      this.logger.info(`PhotoLive OBS server started on http://localhost:${this.config.port}`);
      this.logger.info(`Control interface: http://localhost:${this.config.port}/control`);
      this.logger.info(`Slideshow for OBS: http://localhost:${this.config.port}/`);
      this.logger.info(`Photos folder monitored: ${this.currentPhotosPath}`);
    };

    this.server.listen(this.config.port, startServer).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        this.logger.warn(`Port ${this.config.port} already in use, trying port ${this.config.port + 1}...`);
        this.config.port = this.config.port + 1;
        
        if (this.config.port > 3010) {
          this.logger.error('Unable to find free port between 3001 and 3010');
          process.exit(1);
        }
        
        this.server.listen(this.config.port, startServer);
      } else {
        this.logger.error('Error starting server:', err);
        process.exit(1);
      }
    });
  }

  async gracefulShutdown(signal) {
    this.logger.info(`\n${signal} received. Starting graceful shutdown...`);
    
    try {
      // Stop file watcher
      this.fileWatcher.stop();
      this.logger.info('File watcher stopped');
      
      // Stop slideshow service
      this.slideshowService.stopSlideshowTimer();
      this.slideshowService.stopQueueProcessing();
      this.logger.info('Slideshow service stopped');
      
      // Close socket connections
      this.io.close(() => {
        this.logger.info('Socket.io connections closed');
      });
      
      // Close HTTP server
      this.server.close(() => {
        this.logger.info('HTTP server closed');
        process.exit(0);
      });
      
      // Force exit after 10 seconds
      setTimeout(() => {
        this.logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
      
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

module.exports = PhotoLiveApp;