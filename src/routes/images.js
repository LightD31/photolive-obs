const express = require('express');
const path = require('path');
const Logger = require('../utils/logger');

function createImageRoutes(config) {
  const router = express.Router();
  const logger = new Logger(config.logLevel);
  
  let currentPhotosPath = config.photosPath;

  const updatePhotosPath = (newPath) => {
    currentPhotosPath = newPath;
  };

  const handleSendFileError = (err, res, filename) => {
    if (err) {
      if (err.code === 'ECONNABORTED') {
        logger.debug('Client aborted request for:', filename);
      } else {
        logger.error('Error sending file:', err);
      }
      if (!res.headersSent) {
        res.status(404).json({ error: 'Image not found' });
      }
    }
  };

  router.get('/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      
      if (!filename || filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid file path' });
      }
      
      const ext = path.extname(filename).toLowerCase();
      if (!config.supportedFormats.includes(ext)) {
        return res.status(400).json({ error: 'Unsupported file format' });
      }
      
      const filePath = path.join(currentPhotosPath, filename);
      const resolvedPath = path.resolve(filePath);
      const resolvedPhotosPath = path.resolve(currentPhotosPath);
      
      if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      res.sendFile(resolvedPath, (err) => handleSendFileError(err, res, filename));
    } catch (error) {
      logger.error('Error in /photos route:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  router.get('/:subfolder/:filename', (req, res) => {
    try {
      const subfolder = req.params.subfolder;
      const filename = req.params.filename;
      const relativePath = path.join(subfolder, filename);
      
      if (!filename || !subfolder || relativePath.includes('..')) {
        return res.status(400).json({ error: 'Invalid file path' });
      }
      
      const ext = path.extname(filename).toLowerCase();
      if (!config.supportedFormats.includes(ext)) {
        return res.status(400).json({ error: 'Unsupported file format' });
      }
      
      const filePath = path.join(currentPhotosPath, relativePath);
      const resolvedPath = path.resolve(filePath);
      const resolvedPhotosPath = path.resolve(currentPhotosPath);
      
      if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      res.sendFile(resolvedPath, (err) => handleSendFileError(err, res, relativePath));
    } catch (error) {
      logger.error('Error in /photos route:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  router.get('/:subfolder/:nestedfolder/:filename', (req, res) => {
    try {
      const subfolder = req.params.subfolder;
      const nestedfolder = req.params.nestedfolder;
      const filename = req.params.filename;
      const relativePath = path.join(subfolder, nestedfolder, filename);
      
      if (!filename || !subfolder || !nestedfolder || relativePath.includes('..')) {
        return res.status(400).json({ error: 'Invalid file path' });
      }
      
      const ext = path.extname(filename).toLowerCase();
      if (!config.supportedFormats.includes(ext)) {
        return res.status(400).json({ error: 'Unsupported file format' });
      }
      
      const filePath = path.join(currentPhotosPath, relativePath);
      const resolvedPath = path.resolve(filePath);
      const resolvedPhotosPath = path.resolve(currentPhotosPath);
      
      if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      res.sendFile(resolvedPath, (err) => handleSendFileError(err, res, relativePath));
    } catch (error) {
      logger.error('Error in /photos route:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  return { router, updatePhotosPath };
}

module.exports = createImageRoutes;