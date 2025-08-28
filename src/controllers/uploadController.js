const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');
const logger = require('../utils/logger');
const watermarkService = require('../services/watermarkService');
const { ensureDirectoryExists } = require('../utils/fileHelper');

const router = express.Router();

// Configure multer for watermark uploads
const watermarkStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const watermarksPath = path.join(config.uploadsPath, 'watermarks');
      await ensureDirectoryExists(watermarksPath);
      cb(null, watermarksPath);
    } catch (error) {
      logger.error('Error creating watermarks directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const timestamp = Date.now();
    const originalName = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname);
    const filename = `${originalName}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const watermarkUpload = multer({
  storage: watermarkStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allow common image formats for watermarks
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPEG, GIF, WebP) are allowed for watermarks'), false);
    }
  }
});

/**
 * Upload watermark
 */
router.post('/watermark', watermarkUpload.single('watermark'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    // Read the uploaded file
    const fileBuffer = await fs.readFile(req.file.path);
    
    // Add to watermark service
    const watermark = await watermarkService.addWatermark(req.file.filename, fileBuffer);
    
    logger.info(`Watermark uploaded: ${req.file.filename}`);
    
    // Return the path relative to uploads for the frontend
    const relativePath = `/uploads/watermarks/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      message: 'Watermark uploaded successfully',
      data: { 
        ...watermark,
        path: relativePath 
      } 
    });
  } catch (error) {
    logger.error('Error uploading watermark:', error);
    
    // Clean up uploaded file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up uploaded file:', cleanupError);
      }
    }
    
    if (error.message.includes('image files')) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }
});

/**
 * Handle multer errors
 */
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        error: 'File size too large. Maximum 5MB allowed.' 
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        success: false, 
        error: 'Too many files. Only one file allowed.' 
      });
    }
  }
  
  logger.error('Upload error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

module.exports = router;
