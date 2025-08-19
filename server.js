const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const cors = require('cors');
const sharp = require('sharp');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
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
      slideInterval: configData.defaults.interval,
      supportedFormats: configData.slideshow.supportedFormats,
      transitions: configData.features.transitions,
      filters: configData.features.filters,
      watermarkPositions: configData.features.watermarkPositions,
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
        watermarkPosition: 'bottom-right',
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
app.use(express.json());
app.use(express.static(config.publicPath));
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
      const filename = path.basename(filePath);
      const ext = path.extname(filename).toLowerCase();
      
      if (config.supportedFormats.includes(ext)) {
        console.log(`Nouvelle image détectée: ${filename}`);
        
        // Marquer comme nouvelle image
        newlyAddedImages.add(filename);
        
        // Rescanner avec information de la nouvelle image
        scanImages(filename);
        
        // Nettoyer le marquage après 5 minutes
        setTimeout(() => {
          newlyAddedImages.delete(filename);
          console.log(`Image ${filename} n'est plus considérée comme nouvelle`);
        }, 5 * 60 * 1000);
      }
    })
    .on('unlink', (filePath) => {
      const filename = path.basename(filePath);
      console.log(`Image supprimée: ${filename}`);
      
      // Retirer du tracker des nouvelles images si présent
      newlyAddedImages.delete(filename);
      
      scanImages(); // Rescanner toutes les images
    })
    .on('error', error => console.error('Erreur du watcher:', error));

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
  slideshowSettings = { ...slideshowSettings, ...req.body };
  
  // Émettre les nouveaux réglages aux clients
  io.emit('settings-updated', slideshowSettings);
  
  res.json(slideshowSettings);
});

// Route pour changer le dossier de photos
app.post('/api/photos-path', async (req, res) => {
  try {
    const { photosPath } = req.body;
    
    console.log('Demande de changement de dossier:', photosPath);
    
    if (!photosPath) {
      return res.status(400).json({ error: 'Chemin du dossier requis' });
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
  const filename = req.params.filename;
  const filePath = path.join(currentPhotosPath, filename);
  
  // Vérifier que le fichier existe et est dans le dossier autorisé
  const resolvedPath = path.resolve(filePath);
  const resolvedPhotosPath = path.resolve(currentPhotosPath);
  
  if (!resolvedPath.startsWith(resolvedPhotosPath)) {
    return res.status(403).json({ error: 'Accès interdit' });
  }
  
  res.sendFile(resolvedPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Image non trouvée' });
    }
  });
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

  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
  });

  // Gestion des commandes de contrôle
  socket.on('next-image', () => {
    socket.broadcast.emit('next-image');
  });

  socket.on('prev-image', () => {
    socket.broadcast.emit('prev-image');
  });

  socket.on('pause-slideshow', () => {
    socket.broadcast.emit('pause-slideshow');
  });

  socket.on('resume-slideshow', () => {
    socket.broadcast.emit('resume-slideshow');
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
        server.listen(config.port, () => {
          console.log(`PhotoLive OBS server démarré sur http://localhost:${config.port}`);
          console.log(`Interface de contrôle: http://localhost:${config.port}/control`);
          console.log(`Diaporama pour OBS: http://localhost:${config.port}/`);
          console.log(`Dossier photos surveillé: ${currentPhotosPath}`);
        });
      } else {
        console.error('Erreur lors du démarrage du serveur:', err);
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
  }
}

// Démarrage
initialize();
