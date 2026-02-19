const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/logger');
const { settingsSchema, photosPathSchema } = require('../validation/schemas');

function createApiRoutes(config, slideshowService, _imageService) {
  const router = express.Router();
  const logger = Logger.getInstance();

  // Multer configuration for watermark uploads
  const watermarkStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'watermarks');
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const extension = path.extname(file.originalname);
      const name = path.basename(file.originalname, extension);
      cb(null, `${name}_${timestamp}${extension}`);
    }
  });

  const uploadWatermark = multer({
    storage: watermarkStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are accepted'), false);
      }
    }
  });

  // Get images
  router.get('/images', (req, res) => {
    res.json({
      allImages: slideshowService.getAllImagesList(),
      images: slideshowService.getCurrentImagesList(),
      settings: slideshowService.getSettings()
    });
  });

  // Get settings
  router.get('/settings', (req, res) => {
    res.json(slideshowService.getSettings());
  });

  // Update settings
  router.post('/settings', (req, res) => {
    try {
      const result = settingsSchema.safeParse(req.body);
      
      if (!result.success) {
        const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return res.status(400).json({ error: 'Invalid settings', details: errors });
      }
      
      const newSettings = result.data;
      
      slideshowService.updateSettings(newSettings);
      
      // Emit WebSocket event to all clients
      const io = req.app.get('io');
      if (io) {
        io.emit('settings-updated', slideshowService.getSettings());
      }
      
      // Emit events for specific setting changes
      if (newSettings.recursiveSearch !== undefined) {
        logger.debug(`Recursive search: ${newSettings.recursiveSearch}`);
        req.app.emit('recursiveSearchChanged', newSettings.recursiveSearch);
      }
      
      res.json(slideshowService.getSettings());
    } catch (error) {
      logger.error('Error updating settings:', error);
      res.status(400).json({ error: 'Invalid settings data' });
    }
  });

  // Get available watermarks
  router.get('/watermarks', async (req, res) => {
    try {
      const watermarksPath = path.join(__dirname, '..', '..', 'watermarks');
      const files = await fs.readdir(watermarksPath);
      
      const watermarkImages = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
      }).map(filename => ({
        filename,
        name: path.parse(filename).name,
        path: `/watermarks/${filename}`
      }));
      
      res.json(watermarkImages);
    } catch (error) {
      logger.error('Error reading watermarks:', error);
      res.json([]);
    }
  });

  // Upload watermark
  router.post('/watermark-upload', uploadWatermark.single('watermark'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      logger.debug(`Watermark uploaded: ${req.file.filename}`);

      const filePath = `/uploads/watermarks/${req.file.filename}`;
      
      res.json({
        success: true,
        filePath: filePath,
        filename: req.file.filename,
        originalName: req.file.originalname
      });
    } catch (error) {
      logger.error('Error uploading watermark:', error);
      res.status(500).json({ error: 'Upload error' });
    }
  });

  // Get language files
  router.get('/locales/:language', async (req, res) => {
    try {
      const language = req.params.language;
      
      if (!/^[a-z]{2}$/.test(language)) {
        return res.status(400).json({ error: 'Invalid language code' });
      }
      
      const localesPath = path.join(__dirname, '..', '..', 'locales', `${language}.json`);
      
      try {
        const localeData = await fs.readFile(localesPath, 'utf8');
        const translations = JSON.parse(localeData);
        
        res.set({
          'Cache-Control': 'public, max-age=3600',
          'Content-Type': 'application/json'
        });
        
        res.json(translations);
      } catch (_fileError) {
        logger.warn(`Locale file not found: ${language}`);
        res.status(404).json({ error: `Language '${language}' not available` });
      }
    } catch (error) {
      logger.error('Error serving locale:', error);
      res.status(500).json({ error: 'Failed to load language file' });
    }
  });

  // Change photos folder
  router.post('/photos-path', async (req, res) => {
    try {
      const result = photosPathSchema.safeParse(req.body);
      
      if (!result.success) {
        const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return res.status(400).json({ error: 'Invalid path', details: errors });
      }

      const { photosPath } = result.data;
      const resolvedPath = path.resolve(photosPath);
      logger.debug(`Resolved path: ${resolvedPath}`);

      try {
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
          return res.status(400).json({ error: 'Specified path is not a directory' });
        }
      } catch (error) {
        logger.debug(`Folder check error: ${error.message}`);
        return res.status(400).json({ error: 'Specified folder does not exist or is not accessible' });
      }

      // Emit event for folder change
      req.app.emit('photosPathChanged', resolvedPath);
      
      logger.info(`Photos folder changed: ${resolvedPath}`);
      
      res.json({ 
        success: true, 
        photosPath: resolvedPath,
        message: 'Folder changed successfully'
      });
    } catch (error) {
      logger.error('Error changing folder:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = createApiRoutes;