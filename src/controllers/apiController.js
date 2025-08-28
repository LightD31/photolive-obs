const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const imageService = require('../services/imageService');
const watermarkService = require('../services/watermarkService');
const fileWatcherService = require('../services/fileWatcherService');
const socketService = require('../services/socketService');
const { isPathSafe } = require('../utils/fileHelper');

const router = express.Router();

/**
 * Get slideshow state
 */
router.get('/slideshow/state', (req, res) => {
  try {
    const state = imageService.getSlideshowState();
    res.json({ success: true, data: state });
  } catch (error) {
    logger.error('Error getting slideshow state:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get all images
 */
router.get('/images', (req, res) => {
  try {
    const images = imageService.getAllImages();
    const slideshowImages = imageService.getSlideshowImages();
    const settings = config.getSettings();
    
    res.json({ 
      success: true, 
      data: { 
        images, 
        slideshowImages,
        settings 
      } 
    });
  } catch (error) {
    logger.error('Error getting images:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Reload images
 */
router.post('/images/reload', async (req, res) => {
  try {
    const images = await imageService.loadImages();
    socketService.broadcastImagesUpdate();
    
    res.json({ 
      success: true, 
      message: `Reloaded ${images.length} images`,
      data: { count: images.length } 
    });
  } catch (error) {
    logger.error('Error reloading images:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Change photos path
 */
router.post('/photos/path', async (req, res) => {
  try {
    const { path: newPath } = req.body;
    
    if (!newPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'Path is required' 
      });
    }

    // Basic path validation - just check if it's a string and not empty
    if (typeof newPath !== 'string' || newPath.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid path' 
      });
    }

    const resolvedPath = await imageService.changePhotosPath(newPath);
    
    // Update file watcher
    await fileWatcherService.changeWatchPath(resolvedPath);
    
    // Broadcast updates
    socketService.broadcastImagesUpdate();
    
    res.json({ 
      success: true, 
      message: `Photos path changed to: ${resolvedPath}`,
      data: { path: resolvedPath } 
    });
  } catch (error) {
    logger.error('Error changing photos path:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Get settings
 */
router.get('/settings', (req, res) => {
  try {
    const settings = config.getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Error getting settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Update settings
 */
router.post('/settings', (req, res) => {
  try {
    const updatedSettings = config.updateSettings(req.body);
    
    // Update image order if shuffle setting changed
    if (req.body.shuffle !== undefined) {
      imageService.updateImageOrder();
    }
    
    // Restart timer if interval changed
    if (req.body.interval !== undefined) {
      imageService.restartSlideshowTimer();
    }
    
    // Broadcast settings update
    socketService.broadcastSettingsUpdate(updatedSettings);
    
    res.json({ 
      success: true, 
      message: 'Settings updated',
      data: updatedSettings 
    });
  } catch (error) {
    logger.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get watermarks
 */
router.get('/watermarks', (req, res) => {
  try {
    const watermarks = watermarkService.getWatermarks();
    res.json({ success: true, data: watermarks });
  } catch (error) {
    logger.error('Error getting watermarks:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Delete watermark
 */
router.delete('/watermarks/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const deleted = await watermarkService.deleteWatermark(filename);
    
    if (deleted) {
      res.json({ 
        success: true, 
        message: `Watermark ${filename} deleted` 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Watermark not found' 
      });
    }
  } catch (error) {
    logger.error('Error deleting watermark:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Server status
 */
router.get('/status', (req, res) => {
  try {
    const status = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connectedClients: socketService.getConnectedClientsCount(),
      fileWatcher: fileWatcherService.getStatus(),
      imagesCount: imageService.getAllImages().length,
      slideshowImagesCount: imageService.getSlideshowImages().length
    };
    
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Error getting server status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Control slideshow
 */
router.post('/slideshow/:action', (req, res) => {
  try {
    const { action } = req.params;
    let result = null;
    
    switch (action) {
      case 'next':
        result = imageService.nextImage();
        break;
      case 'previous':
        result = imageService.previousImage();
        break;
      case 'pause':
        result = imageService.pauseSlideshow();
        break;
      case 'resume':
        result = imageService.resumeSlideshow();
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid action' 
        });
    }
    
    // Broadcast state update
    socketService.broadcastSlideshowState();
    
    res.json({ 
      success: true, 
      message: `Slideshow ${action} executed`,
      data: result 
    });
  } catch (error) {
    logger.error(`Error executing slideshow ${req.params.action}:`, error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Jump to image by index in slideshow order
 */
router.post('/slideshow/jump/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    
    if (isNaN(index) || index < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid index' 
      });
    }
    
    const image = imageService.jumpToImage(index);
    
    if (image) {
      socketService.broadcastSlideshowState();
      res.json({ 
        success: true, 
        message: `Jumped to image ${index}`,
        data: image 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Image not found at index' 
      });
    }
  } catch (error) {
    logger.error('Error jumping to image:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Jump to image by filename
 */
router.post('/slideshow/jump-to/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    const image = imageService.jumpToImageByFilename(filename);
    
    if (image) {
      socketService.broadcastSlideshowState();
      res.json({ 
        success: true, 
        message: `Jumped to image ${filename}`,
        data: image 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Image not found or not in slideshow' 
      });
    }
  } catch (error) {
    logger.error('Error jumping to image by filename:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Toggle image properties
 */
router.post('/images/:filename/:action', (req, res) => {
  try {
    const { filename, action } = req.params;
    let result = null;
    
    switch (action) {
      case 'exclude':
        result = imageService.toggleImageExclusion(filename);
        break;

      case 'seen':
        result = imageService.markImageAsSeen(filename);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid action' 
        });
    }
    
    if (result !== null && result !== false) {
      socketService.broadcastImagesUpdate();
      res.json({ 
        success: true, 
        message: `Image ${filename} ${action} toggled`,
        data: { [action]: result } 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Image not found' 
      });
    }
  } catch (error) {
    logger.error(`Error toggling image ${req.params.action}:`, error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get locales for i18n
 */
router.get('/locales/:locale', (req, res) => {
  try {
    const { locale } = req.params;
    const localePath = path.join(__dirname, '../../locales', `${locale}.json`);
    
    if (fs.existsSync(localePath)) {
      const localeData = JSON.parse(fs.readFileSync(localePath, 'utf8'));
      res.json({ success: true, data: localeData });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Locale not found' 
      });
    }
  } catch (error) {
    logger.error('Error loading locale:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
