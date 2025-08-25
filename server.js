const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const cors = require('cors');
const multer = require('multer');

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
      filters: [
        { id: 'none', name: 'Aucun' },
        { id: 'sepia', name: 'Sépia' },
        { id: 'grayscale', name: 'Noir & Blanc' }
      ],
      defaults: {
        interval: 5000,
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
        transparentBackground: false,
        excludedImages: []
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
// Servir les filigranes uploadés
app.use('/uploads/watermarks', express.static(path.join(__dirname, 'uploads', 'watermarks')));
// Note: La route /photos est maintenant gérée dynamiquement

// Configuration multer pour les uploads de filigranes
const watermarkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads', 'watermarks');
    // Créer le dossier s'il n'existe pas
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique avec timestamp
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
    // Vérifier le type de fichier
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont acceptés'), false);
    }
  }
});

// Variables globales
let currentImages = [];
let shuffledImages = []; // Version mélangée des images
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

// Timer du diaporama côté serveur
let slideshowTimer = null;

// Fonction pour mélanger un tableau (Fisher-Yates shuffle)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Fonction pour obtenir la liste complète d'images (pour l'affichage de la grille)
function getAllImagesList() {
  return slideshowSettings.shuffleImages ? shuffledImages : currentImages;
}

// Fonction pour obtenir la liste d'images actuelle filtrée (pour le diaporama)
function getCurrentImagesList() {
  const allImages = slideshowSettings.shuffleImages ? shuffledImages : currentImages;
  const excludedImages = slideshowSettings.excludedImages || [];
  
  // Filtrer les images exclues
  return allImages.filter(image => !excludedImages.includes(image.filename));
}

// Fonction pour créer/mettre à jour la liste mélangée
function updateShuffledImagesList(newImageAdded = null) {
  if (!slideshowSettings.shuffleImages) {
    // Mode normal : utiliser l'ordre chronologique
    shuffledImages = [...currentImages];
    console.log('Mode normal: ordre chronologique');
    return;
  }

  // Séparer les nouvelles images des existantes
  const newImages = currentImages.filter(img => img.isNew);
  const existingImages = currentImages.filter(img => !img.isNew);

  // Mélanger les images existantes
  const shuffledExisting = shuffleArray([...existingImages]);
  
  // Priorité : nouvelles images d'abord, puis les existantes mélangées
  shuffledImages = [...newImages, ...shuffledExisting];
  
  console.log(`🔀 Mode mélangé: ${newImages.length} nouvelles images en priorité, ${existingImages.length} existantes mélangées`);
  
  if (newImages.length > 0) {
    console.log('📸 Nouvelles images:', newImages.map(img => img.filename));
  }
}

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
    
    // Créer/mettre à jour la liste mélangée selon les paramètres
    updateShuffledImagesList(newImageFilename);
    
    // Mettre à jour l'état du diaporama
    updateSlideshowState();
    
    // Émettre la liste mise à jour aux clients avec la liste appropriée
    io.emit('images-updated', {
      allImages: getAllImagesList(), // Liste complète pour l'affichage de la grille
      images: getCurrentImagesList(), // Liste filtrée pour le diaporama
      settings: slideshowSettings,
      newImageAdded: newImageFilename
    });

    // Redémarrer le timer du diaporama si nécessaire
    restartSlideshowTimer();

    console.log(`${images.length} images trouvées dans ${currentPhotosPath}${newImageFilename ? ` (nouvelle: ${newImageFilename})` : ''}`);
    return images;
  } catch (error) {
    console.error('Erreur lors du scan des images:', error);
    return [];
  }
}

// Mettre à jour l'état du diaporama
function updateSlideshowState(emitEvent = true) {
  const imagesList = getCurrentImagesList();
  
  if (imagesList.length === 0) {
    slideshowState.currentImage = null;
    slideshowState.currentIndex = 0;
    return;
  }

  // S'assurer que l'index est valide
  if (slideshowState.currentIndex >= imagesList.length) {
    slideshowState.currentIndex = 0;
  } else if (slideshowState.currentIndex < 0) {
    slideshowState.currentIndex = imagesList.length - 1;
  }

  slideshowState.currentImage = imagesList[slideshowState.currentIndex];
  
  // Émettre l'état mis à jour aux clients uniquement si demandé
  if (emitEvent) {
    io.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: imagesList.length
    });
  }
}

// Changer d'image avec émission d'événement
function changeImage(direction = 1) {
  const imagesList = getCurrentImagesList();
  if (imagesList.length === 0) return;
  
  slideshowState.currentIndex += direction;
  updateSlideshowState(false); // Don't emit slideshow-state event, we'll emit image-changed instead
  
  // Émettre le changement d'image aux clients slideshow
  io.emit('image-changed', {
    currentImage: slideshowState.currentImage,
    currentIndex: slideshowState.currentIndex,
    direction: direction
  });
}

// Démarrer le timer du diaporama côté serveur
function startSlideshowTimer() {
  stopSlideshowTimer();
  
  const imagesList = getCurrentImagesList();
  if (imagesList.length > 1 && slideshowState.isPlaying) {
    slideshowTimer = setInterval(() => {
      console.log('Timer serveur: passage à l\'image suivante');
      changeImage(1);
    }, slideshowSettings.interval);
    console.log(`Timer du diaporama démarré (intervalle: ${slideshowSettings.interval}ms)`);
  }
}

// Arrêter le timer du diaporama
function stopSlideshowTimer() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
    console.log('Timer du diaporama arrêté');
  }
}

// Redémarrer le timer avec de nouveaux paramètres
function restartSlideshowTimer() {
  if (slideshowState.isPlaying) {
    startSlideshowTimer();
  }
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
    allImages: getAllImagesList(),
    images: getCurrentImagesList(),
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
      'transparentBackground', 'photosPath', 'excludedImages'
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
          case 'excludedImages':
            if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
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
    
    const previousShuffleState = slideshowSettings.shuffleImages;
    slideshowSettings = { ...slideshowSettings, ...newSettings };
    
    // Si l'état du mélange a changé, recréer la liste mélangée
    if (newSettings.shuffleImages !== undefined && previousShuffleState !== newSettings.shuffleImages) {
      console.log(`🔄 Mode mélange changé: ${previousShuffleState} → ${newSettings.shuffleImages}`);
      updateShuffledImagesList();
      
      // Réajuster l'index si nécessaire
      const imagesList = getCurrentImagesList();
      if (slideshowState.currentIndex >= imagesList.length) {
        slideshowState.currentIndex = 0;
      }
      
      // Mettre à jour l'état du diaporama pour refléter la nouvelle liste
      updateSlideshowState();
      
      // Émettre la nouvelle liste d'images aux clients
      io.emit('images-updated', {
        allImages: getAllImagesList(),
        images: getCurrentImagesList(),
        settings: slideshowSettings
      });
    }
    
    // Si l'intervalle a changé, redémarrer le timer
    if (newSettings.interval) {
      restartSlideshowTimer();
    }
    
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

// Route pour uploader un filigrane
app.post('/api/watermark-upload', uploadWatermark.single('watermark'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    console.log('Filigrane uploadé:', req.file.filename);

    // Retourner le chemin du fichier uploadé
    const filePath = `/uploads/watermarks/${req.file.filename}`;
    
    res.json({
      success: true,
      filePath: filePath,
      filename: req.file.filename,
      originalName: req.file.originalname
    });
  } catch (error) {
    console.error('Erreur lors de l\'upload du filigrane:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
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
    allImages: getAllImagesList(),
    images: getCurrentImagesList(),
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
    // Redémarrer le timer pour réinitialiser l'intervalle
    restartSlideshowTimer();
    socket.broadcast.emit('next-image');
  });

  socket.on('prev-image', () => {
    changeImage(-1);
    // Redémarrer le timer pour réinitialiser l'intervalle
    restartSlideshowTimer();
    socket.broadcast.emit('prev-image');
  });

  socket.on('jump-to-image', (index) => {
    const imagesList = getCurrentImagesList();
    if (index >= 0 && index < imagesList.length) {
      const previousIndex = slideshowState.currentIndex;
      slideshowState.currentIndex = index;
      updateSlideshowState(false); // Don't emit slideshow-state, we'll emit image-changed instead
      
      // Determine direction for transition
      const direction = index > previousIndex ? 1 : -1;
      
      // Emit image-changed event for smooth transition
      io.emit('image-changed', {
        currentImage: slideshowState.currentImage,
        currentIndex: slideshowState.currentIndex,
        direction: direction
      });
      
      // Redémarrer le timer pour réinitialiser l'intervalle
      restartSlideshowTimer();
    }
  });

  socket.on('pause-slideshow', () => {
    slideshowState.isPlaying = false;
    stopSlideshowTimer();
    
    io.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: currentImages.length
    });
    socket.broadcast.emit('pause-slideshow');
    console.log('Diaporama mis en pause par un client');
  });

  socket.on('resume-slideshow', () => {
    slideshowState.isPlaying = true;
    startSlideshowTimer();
    
    io.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: currentImages.length
    });
    socket.broadcast.emit('resume-slideshow');
    console.log('Diaporama repris par un client');
  });

  socket.on('get-slideshow-state', () => {
    socket.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: currentImages.length
    });
  });

  socket.on('toggle-image-exclusion', (filename) => {
    try {
      if (typeof filename !== 'string') {
        console.error('Invalid filename for exclusion toggle:', filename);
        return;
      }

      const excludedImages = slideshowSettings.excludedImages || [];
      const isExcluded = excludedImages.includes(filename);
      
      if (isExcluded) {
        // Remove from excluded list
        slideshowSettings.excludedImages = excludedImages.filter(img => img !== filename);
        console.log(`Image ${filename} réintégrée dans le diaporama`);
      } else {
        // Add to excluded list
        slideshowSettings.excludedImages = [...excludedImages, filename];
        console.log(`Image ${filename} exclue du diaporama`);
      }
      
      // Update slideshow state if current image was excluded
      const filteredImages = getCurrentImagesList();
      if (filteredImages.length === 0) {
        slideshowState.currentImage = null;
        slideshowState.currentIndex = 0;
      } else if (slideshowState.currentImage && slideshowSettings.excludedImages.includes(slideshowState.currentImage.filename)) {
        // Current image was excluded, move to next available image
        slideshowState.currentIndex = 0;
        updateSlideshowState();
      }
      
      // Restart slideshow timer with new filtered list
      restartSlideshowTimer();
      
      // Broadcast updated settings and images to all clients
      io.emit('settings-updated', slideshowSettings);
      io.emit('images-updated', {
        allImages: getAllImagesList(),
        images: getCurrentImagesList(),
        settings: slideshowSettings
      });
      
    } catch (error) {
      console.error('Error toggling image exclusion:', error);
    }
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
    
    // Démarrer le timer du diaporama
    startSlideshowTimer();
    
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
  
  // Arrêter le timer du diaporama
  stopSlideshowTimer();
  
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
  
  // Arrêter le timer du diaporama
  stopSlideshowTimer();
  
  if (fileWatcher) {
    fileWatcher.close();
  }
  server.close(() => {
    process.exit(0);
  });
});
