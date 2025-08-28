const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const imageService = require('../services/imageService');
const { isPathSafe } = require('../utils/fileHelper');

const router = express.Router();

/**
 * Serve photos from the current photos directory
 * Route: /photos/:filename
 */
router.get('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Validation du nom de fichier/chemin
    if (!filename || filename.includes('..')) {
      return res.status(400).json({ error: 'Chemin de fichier invalide' });
    }
    
    // Vérifier l'extension
    const ext = path.extname(filename).toLowerCase();
    if (!config.supportedFormats.includes(ext)) {
      return res.status(400).json({ error: 'Format de fichier non supporté' });
    }
    
    // Get current photos path from image service
    const currentPhotosPath = imageService.getCurrentPhotosPath();
    const filePath = path.join(currentPhotosPath, filename);
    
    // Vérifier que le fichier existe et est dans le dossier autorisé
    const resolvedPath = path.resolve(filePath);
    const resolvedPhotosPath = path.resolve(currentPhotosPath);
    
    if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
      return res.status(403).json({ error: 'Accès interdit' });
    }
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Image non trouvée' });
    }
    
    res.sendFile(resolvedPath, (err) => {
      if (err) {
        logger.error('Error sending file:', err);
        res.status(404).json({ error: 'Image non trouvée' });
      }
    });
  } catch (error) {
    logger.error('Error in /photos route:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * Serve photos from subdirectories
 * Route: /photos/:subfolder/:filename
 */
router.get('/:subfolder/:filename', (req, res) => {
  try {
    const subfolder = req.params.subfolder;
    const filename = req.params.filename;
    const relativePath = path.join(subfolder, filename);
    
    // Validation du chemin
    if (!filename || !subfolder || relativePath.includes('..')) {
      return res.status(400).json({ error: 'Chemin de fichier invalide' });
    }
    
    // Additional safety check
    if (!isPathSafe(relativePath)) {
      return res.status(400).json({ error: 'Chemin de fichier invalide' });
    }
    
    // Vérifier l'extension
    const ext = path.extname(filename).toLowerCase();
    if (!config.supportedFormats.includes(ext)) {
      return res.status(400).json({ error: 'Format de fichier non supporté' });
    }
    
    // Get current photos path from image service
    const currentPhotosPath = imageService.getCurrentPhotosPath();
    const filePath = path.join(currentPhotosPath, relativePath);
    
    // Vérifier que le fichier existe et est dans le dossier autorisé
    const resolvedPath = path.resolve(filePath);
    const resolvedPhotosPath = path.resolve(currentPhotosPath);
    
    if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
      return res.status(403).json({ error: 'Accès interdit' });
    }
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Image non trouvée' });
    }
    
    res.sendFile(resolvedPath, (err) => {
      if (err) {
        logger.error('Error sending file:', err);
        res.status(404).json({ error: 'Image non trouvée' });
      }
    });
  } catch (error) {
    logger.error('Error in /photos subfolder route:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * Serve photos from nested subdirectories
 * Route: /photos/:subfolder/:nestedfolder/:filename
 */
router.get('/:subfolder/:nestedfolder/:filename', (req, res) => {
  try {
    const subfolder = req.params.subfolder;
    const nestedfolder = req.params.nestedfolder;
    const filename = req.params.filename;
    const relativePath = path.join(subfolder, nestedfolder, filename);
    
    // Validation du chemin
    if (!filename || !subfolder || !nestedfolder || relativePath.includes('..')) {
      return res.status(400).json({ error: 'Chemin de fichier invalide' });
    }
    
    // Additional safety check
    if (!isPathSafe(relativePath)) {
      return res.status(400).json({ error: 'Chemin de fichier invalide' });
    }
    
    // Vérifier l'extension
    const ext = path.extname(filename).toLowerCase();
    if (!config.supportedFormats.includes(ext)) {
      return res.status(400).json({ error: 'Format de fichier non supporté' });
    }
    
    // Get current photos path from image service
    const currentPhotosPath = imageService.getCurrentPhotosPath();
    const filePath = path.join(currentPhotosPath, relativePath);
    
    // Vérifier que le fichier existe et est dans le dossier autorisé
    const resolvedPath = path.resolve(filePath);
    const resolvedPhotosPath = path.resolve(currentPhotosPath);
    
    if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
      return res.status(403).json({ error: 'Accès interdit' });
    }
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Image non trouvée' });
    }
    
    res.sendFile(resolvedPath, (err) => {
      if (err) {
        logger.error('Error sending file:', err);
        res.status(404).json({ error: 'Image non trouvée' });
      }
    });
  } catch (error) {
    logger.error('Error in /photos nested folder route:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
