const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["http://localhost:3001", "http://127.0.0.1:3001"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Chargement de la configuration
function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config', 'default.json');
    const configData = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
    return {
      port: process.env.PORT || configData.server.port,
      photosPath: path.resolve(__dirname, configData.server.photosPath),
      publicPath: path.join(__dirname, 'public'),
      slideInterval: configData.slideshow.interval,
      supportedFormats: configData.slideshow.supportedFormats,
      transitions: configData.features.transitions,
      filters: configData.features.filters,
      watermarkPositions: configData.features.watermarkPositions,
      watermarkTypes: configData.features.watermarkTypes || [
        { id: 'text', name: 'Texte' },
        { id: 'image', name: 'Image PNG' }
      ],
      watermarkSizes: configData.features.watermarkSizes || [
        { id: 'small', name: 'Petit', scale: 0.5 },
        { id: 'medium', name: 'Moyen', scale: 1.0 },
        { id: 'large', name: 'Grand', scale: 1.5 },
        { id: 'xlarge', name: 'Très grand', scale: 2.0 }
      ],
      defaults: configData.defaults
    };
  } catch (error) {
    console.warn('Impossible de charger config/default.json, utilisation de la configuration par défaut:', error.message);
    // Configuration de fallback
    return {
      port: process.env.PORT || 3001,
      photosPath: path.join(__dirname, 'photos'),
      publicPath: path.join(__dirname, 'public'),
      slideInterval: 5000,
      supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'],
      transitions: [
        { id: 'none', name: 'Aucune', duration: 0 },
        { id: 'fade', name: 'Fondu', duration: 1000 },
        { id: 'slide', name: 'Glissement', duration: 1000 },
        { id: 'zoom', name: 'Zoom', duration: 1500 }
      ],
      filters: [
        { id: 'none', name: 'Aucun' },
        { id: 'sepia', name: 'Sépia' },
        { id: 'grayscale', name: 'Noir & Blanc' }
      ],
      defaults: {
        interval: 5000,
        transition: 'fade',
        filter: 'none',
        showWatermark: false,
        watermarkText: 'PhotoLive OBS',
        watermarkType: 'text',
        watermarkImage: '',
        watermarkPosition: 'bottom-right',
        watermarkSize: 'medium',
        watermarkOpacity: 80,
        shuffleImages: false,
        repeatLatest: false,
        latestCount: 5,
        transparentBackground: false
      }
    };
  }
}

const config = loadConfig();

// Log de la configuration chargée
console.log('Configuration chargée:');
console.log('- Port:', config.port);
console.log('- Dossier photos:', config.photosPath);
console.log('- Intervalles par défaut:', config.defaults.interval);
console.log('- Arrière-plan transparent par défaut:', config.defaults.transparentBackground);
console.log('- Mélange des images par défaut:', config.defaults.shuffleImages);

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Limiter la taille des requêtes JSON
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Middleware de sécurité basique
app.use((req, res, next) => {
  // Headers de sécurité
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Logging des requêtes suspectes
  if (req.url.includes('..') || req.url.includes('%2e%2e')) {
    console.warn(`Tentative de path traversal détectée: ${req.url} depuis ${req.ip}`);
    return res.status(400).json({ error: 'Requête invalide' });
  }
  
  next();
});

app.use(express.static(config.publicPath));
// Servir les filigranes statiquement
app.use('/watermarks', express.static(path.join(__dirname, 'watermarks')));
// Note: La route /photos est maintenant gérée dynamiquement

// Variables globales
let currentImages = [];
let newlyAddedImages = new Set(); // Tracker des nouvelles images
let currentPhotosPath = config.photosPath; // Dossier photos actuel
let fileWatcher = null; // Instance du watcher de fichiers
let slideshowSettings = {
  ...config.defaults,
  photosPath: config.photosPath, // Ajouter le chemin dans les settings
};

// État du diaporama
let slideshowState = {
  currentIndex: 0,
  isPlaying: true,
  currentImage: null
};

// Fonction pour scanner les images
async function scanImages(newImageFilename = null) {
  try {
    const files = await fs.readdir(currentPhotosPath);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return config.supportedFormats.includes(ext);
    });

    const images = [];
    for (const file of imageFiles) {
      const filePath = path.join(currentPhotosPath, file);
      const stats = await fs.stat(filePath);
      
      images.push({
        filename: file,
        path: `/photos/${file}`,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isNew: newlyAddedImages.has(file) // Marquer les nouvelles images
      });
    }

    // Trier par date de modification (plus récent en premier)
    images.sort((a, b) => b.modified - a.modified);
    
    currentImages = images;
    
    // Mettre à jour l'état du diaporama
    updateSlideshowState();
    
    // Émettre la liste mise à jour aux clients
    io.emit('images-updated', {
      images: currentImages,
      settings: slideshowSettings,
      newImageAdded: newImageFilename
    });

    console.log(`${images.length} images trouvées dans ${currentPhotosPath}${newImageFilename ? ` (nouvelle: ${newImageFilename})` : ''}`);
    return images;
  } catch (error) {
    console.error('Erreur lors du scan des images:', error);
    return [];
  }
}

// Mettre à jour l'état du diaporama
function updateSlideshowState() {
  if (currentImages.length === 0) {
    slideshowState.currentImage = null;
    slideshowState.currentIndex = 0;
    return;
  }

  // S'assurer que l'index est valide
  if (slideshowState.currentIndex >= currentImages.length) {
    slideshowState.currentIndex = 0;
  } else if (slideshowState.currentIndex < 0) {
    slideshowState.currentIndex = currentImages.length - 1;
  }

  slideshowState.currentImage = currentImages[slideshowState.currentIndex];
  
  // Émettre l'état mis à jour aux clients
  io.emit('slideshow-state', {
    currentImage: slideshowState.currentImage,
    currentIndex: slideshowState.currentIndex,
    isPlaying: slideshowState.isPlaying,
    totalImages: currentImages.length
  });
}

// Changer d'image avec émission d'événement
function changeImage(direction = 1) {
  if (currentImages.length === 0) return;
  
  slideshowState.currentIndex += direction;
  updateSlideshowState();
  
  // Émettre le changement d'image aux clients slideshow
  io.emit('image-changed', {
    currentImage: slideshowState.currentImage,
    currentIndex: slideshowState.currentIndex,
    direction: direction
  });
}

// Surveillance des changements de fichiers
function setupFileWatcher() {
  // Arrêter le watcher précédent s'il existe
  if (fileWatcher) {
    fileWatcher.close();
    console.log('Arrêt de la surveillance précédente');
  }

  fileWatcher = chokidar.watch(currentPhotosPath, {
    ignored: /^\./, // Ignorer les fichiers cachés
    persistent: true,
    ignoreInitial: true
  });

  fileWatcher
    .on('add', (filePath) => {
      try {
        const filename = path.basename(filePath);
        const ext = path.extname(filename).toLowerCase();
        
        if (config.supportedFormats.includes(ext)) {
          console.log(`Nouvelle image détectée: ${filename}`);
          
          // Marquer comme nouvelle image
          newlyAddedImages.add(filename);
          
          // Rescanner avec information de la nouvelle image
          scanImages(filename);
          
          // Nettoyer le marquage après 5 minutes avec gestion d'erreurs
          setTimeout(() => {
            try {
              newlyAddedImages.delete(filename);
              console.log(`Image ${filename} n'est plus considérée comme nouvelle`);
              
              // Nettoyage périodique pour éviter les fuites mémoire
              if (newlyAddedImages.size > 100) {
                console.warn(`Nettoyage forcé du tracker d'images: ${newlyAddedImages.size} entrées`);
                newlyAddedImages.clear();
              }
            } catch (error) {
              console.error('Erreur lors du nettoyage du tracker d\'images:', error);
            }
          }, 5 * 60 * 1000);
        }
      } catch (error) {
        console.error('Erreur lors du traitement d\'ajout de fichier:', error);
      }
    })
    .on('unlink', (filePath) => {
      try {
        const filename = path.basename(filePath);
        console.log(`Image supprimée: ${filename}`);
        
        // Retirer du tracker des nouvelles images si présent
        newlyAddedImages.delete(filename);
        
        scanImages(); // Rescanner toutes les images
      } catch (error) {
        console.error('Erreur lors du traitement de suppression de fichier:', error);
      }
    })
    .on('error', error => {
      console.error('Erreur du watcher:', error);
      // Tentative de redémarrage du watcher en cas d'erreur critique
      setTimeout(() => {
        console.log('Tentative de redémarrage du watcher...');
        setupFileWatcher();
      }, 5000);
    });

  console.log(`Surveillance du dossier: ${currentPhotosPath}`);
}

// Routes API
app.get('/api/images', (req, res) => {
  res.json({
    images: currentImages,
    settings: slideshowSettings
  });
});

app.get('/api/settings', (req, res) => {
  res.json(slideshowSettings);
});

app.post('/api/settings', (req, res) => {
  try {
    // Validation des données d'entrée
    const allowedSettings = [
      'interval', 'transition', 'filter', 'showWatermark', 'watermarkText',
      'watermarkType', 'watermarkImage', 'watermarkPosition', 'watermarkSize',
      'watermarkOpacity', 'shuffleImages', 'repeatLatest', 'latestCount',
      'transparentBackground', 'photosPath'
    ];
    
    const newSettings = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedSettings.includes(key)) {
        // Validation spécifique par type
        switch (key) {
          case 'interval':
            if (typeof value === 'number' && value >= 1000 && value <= 60000) {
              newSettings[key] = value;
            }
            break;
          case 'watermarkOpacity':
            if (typeof value === 'number' && value >= 0 && value <= 100) {
              newSettings[key] = value;
            }
            break;
          case 'latestCount':
            if (typeof value === 'number' && value >= 1 && value <= 50) {
              newSettings[key] = value;
            }
            break;
          case 'watermarkText':
            if (typeof value === 'string' && value.length <= 200) {
              newSettings[key] = value;
            }
            break;
          case 'showWatermark':
          case 'shuffleImages':
          case 'repeatLatest':
          case 'transparentBackground':
            if (typeof value === 'boolean') {
              newSettings[key] = value;
            }
            break;
          default:
            if (typeof value === 'string' && value.length <= 100) {
              newSettings[key] = value;
            }
        }
      }
    }
    
    slideshowSettings = { ...slideshowSettings, ...newSettings };
    
    // Émettre les nouveaux réglages aux clients
    io.emit('settings-updated', slideshowSettings);
    
    res.json(slideshowSettings);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    res.status(400).json({ error: 'Données de paramètres invalides' });
  }
});

// Route pour lister les filigranes disponibles
app.get('/api/watermarks', async (req, res) => {
  try {
    const watermarksPath = path.join(__dirname, 'watermarks');
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
    console.error('Erreur lors de la lecture des filigranes:', error);
    res.json([]);
  }
});

// Route pour changer le dossier de photos
app.post('/api/photos-path', async (req, res) => {
  try {
    const { photosPath } = req.body;
    
    console.log('Demande de changement de dossier:', photosPath);
    
    if (!photosPath || typeof photosPath !== 'string') {
      return res.status(400).json({ error: 'Chemin du dossier requis et doit être une chaîne' });
    }
    
    // Validation supplémentaire du chemin
    if (photosPath.includes('..') || photosPath.length > 500) {
      return res.status(400).json({ error: 'Chemin de dossier invalide' });
    }

    // Résoudre le chemin pour obtenir le chemin absolu
    const resolvedPath = path.resolve(photosPath);
    console.log('Chemin résolu:', resolvedPath);

    // Vérifier que le dossier existe
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Le chemin spécifié n\'est pas un dossier' });
      }
    } catch (error) {
      console.log('Erreur lors de la vérification du dossier:', error.message);
      return res.status(400).json({ error: 'Le dossier spécifié n\'existe pas ou n\'est pas accessible' });
    }

    // Mettre à jour le chemin actuel
    currentPhotosPath = resolvedPath;
    slideshowSettings.photosPath = currentPhotosPath;
    
    console.log('Nouveau dossier défini:', currentPhotosPath);
    
    // Nettoyer le tracker des nouvelles images
    newlyAddedImages.clear();
    
    // Redémarrer la surveillance des fichiers
    setupFileWatcher();
    
    // Rescanner les images du nouveau dossier
    await scanImages();
    
    console.log(`Dossier de photos changé vers: ${currentPhotosPath}`);
    
    res.json({ 
      success: true, 
      photosPath: currentPhotosPath,
      message: 'Dossier changé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors du changement de dossier:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Route dynamique pour servir les photos du dossier actuel
app.get('/photos/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Validation du nom de fichier
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Nom de fichier invalide' });
    }
    
    // Vérifier l'extension
    const ext = path.extname(filename).toLowerCase();
    if (!config.supportedFormats.includes(ext)) {
      return res.status(400).json({ error: 'Format de fichier non supporté' });
    }
    
    const filePath = path.join(currentPhotosPath, filename);
    
    // Vérifier que le fichier existe et est dans le dossier autorisé
    const resolvedPath = path.resolve(filePath);
    const resolvedPhotosPath = path.resolve(currentPhotosPath);
    
    if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
      return res.status(403).json({ error: 'Accès interdit' });
    }
    
    res.sendFile(resolvedPath, (err) => {
      if (err) {
        console.error('Erreur lors de l\'envoi du fichier:', err);
        res.status(404).json({ error: 'Image non trouvée' });
      }
    });
  } catch (error) {
    console.error('Erreur dans la route /photos:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Route pour le diaporama OBS
app.get('/', (req, res) => {
  res.sendFile(path.join(config.publicPath, 'slideshow.html'));
});

// Route pour l'interface de contrôle
app.get('/control', (req, res) => {
  res.sendFile(path.join(config.publicPath, 'control.html'));
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  console.log('Client connecté:', socket.id);
  
  // Envoyer l'état actuel au nouveau client
  socket.emit('images-updated', {
    images: currentImages,
    settings: slideshowSettings
  });
  
  // Envoyer l'état actuel du diaporama
  socket.emit('slideshow-state', {
    currentImage: slideshowState.currentImage,
    currentIndex: slideshowState.currentIndex,
    isPlaying: slideshowState.isPlaying,
    totalImages: currentImages.length
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
  });

  // Gestion des commandes de contrôle
  socket.on('next-image', () => {
    changeImage(1);
    socket.broadcast.emit('next-image');
  });

  socket.on('prev-image', () => {
    changeImage(-1);
    socket.broadcast.emit('prev-image');
  });

  socket.on('jump-to-image', (index) => {
    if (index >= 0 && index < currentImages.length) {
      slideshowState.currentIndex = index;
      updateSlideshowState();
      io.emit('jump-to-image', index);
    }
  });

  socket.on('pause-slideshow', () => {
    slideshowState.isPlaying = false;
    io.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: currentImages.length
    });
    socket.broadcast.emit('pause-slideshow');
  });

  socket.on('resume-slideshow', () => {
    slideshowState.isPlaying = true;
    io.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: currentImages.length
    });
    socket.broadcast.emit('resume-slideshow');
  });

  socket.on('get-slideshow-state', () => {
    socket.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: currentImages.length
    });
  });
});

// Initialisation
async function initialize() {
  try {
    // Créer le dossier photos s'il n'existe pas
    await fs.mkdir(currentPhotosPath, { recursive: true });
    
    // Scanner les images initiales
    await scanImages();
    
    // Démarrer la surveillance des fichiers
    setupFileWatcher();
    
    // Démarrer le serveur
    server.listen(config.port, () => {
      console.log(`PhotoLive OBS server démarré sur http://localhost:${config.port}`);
      console.log(`Interface de contrôle: http://localhost:${config.port}/control`);
      console.log(`Diaporama pour OBS: http://localhost:${config.port}/`);
      console.log(`Dossier photos surveillé: ${currentPhotosPath}`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${config.port} déjà utilisé, tentative sur le port ${config.port + 1}...`);
        config.port = config.port + 1;
        
        // Éviter une boucle infinie
        if (config.port > 3010) {
          console.error('Impossible de trouver un port libre entre 3001 et 3010');
          process.exit(1);
        }
        
        server.listen(config.port, () => {
          console.log(`PhotoLive OBS server démarré sur http://localhost:${config.port}`);
          console.log(`Interface de contrôle: http://localhost:${config.port}/control`);
          console.log(`Diaporama pour OBS: http://localhost:${config.port}/`);
          console.log(`Dossier photos surveillé: ${currentPhotosPath}`);
        });
      } else {
        console.error('Erreur lors du démarrage du serveur:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
  }
}

// Démarrage
initialize();

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\nArrêt du serveur...');
  if (fileWatcher) {
    fileWatcher.close();
    console.log('Surveillance des fichiers arrêtée');
  }
  server.close(() => {
    console.log('Serveur arrêté proprement');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nArrêt du serveur (SIGTERM)...');
  if (fileWatcher) {
    fileWatcher.close();
  }
  server.close(() => {
    process.exit(0);
  });
});
