const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // Keep sync version only for initial config load
const chokidar = require('chokidar');
const cors = require('cors');
const multer = require('multer');
const exifr = require('exifr');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["http://localhost:3001", "http://127.0.0.1:3001"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Simple logger utility
const LogLevel = {
  ERROR: 0,
  WARN: 1, 
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(level = 'INFO') {
    this.setLevel(level);
  }

  setLevel(level) {
    this.level = typeof level === 'string' ? LogLevel[level.toUpperCase()] : level;
  }

  error(...args) {
    if (this.level >= LogLevel.ERROR) {
      console.error(...args);
    }
  }

  warn(...args) {
    if (this.level >= LogLevel.WARN) {
      console.warn(...args);
    }
  }

  info(...args) {
    if (this.level >= LogLevel.INFO) {
      console.log(...args);
    }
  }

  debug(...args) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(...args);
    }
  }
}

// Initialize logger (will be updated after config loads)
let logger = new Logger('INFO');

// Configuration loading - needs to be synchronous for initial startup
function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config', 'default.json');
    const configData = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
    return {
      port: process.env.PORT || configData.server.port,
      logLevel: process.env.LOG_LEVEL || configData.server.logLevel || 'INFO',
      photosPath: path.resolve(__dirname, configData.server.photosPath),
      publicPath: path.join(__dirname, 'public'),
      slideInterval: configData.slideshow.interval,
      supportedFormats: configData.slideshow.supportedFormats,
      filters: configData.features.filters,
      watermarkPositions: configData.features.watermarkPositions,
      watermarkTypes: configData.features.watermarkTypes || [
        { id: 'text', name: 'Text' },
        { id: 'image', name: 'PNG Image' }
      ],
      watermarkSizes: configData.features.watermarkSizes || [
        { id: 'small', name: 'Small', scale: 0.5 },
        { id: 'medium', name: 'Medium', scale: 1.0 },
        { id: 'large', name: 'Large', scale: 1.5 },
        { id: 'xlarge', name: 'Extra Large', scale: 2.0 }
      ],
      defaults: configData.defaults
    };
  } catch (error) {
    console.warn('Unable to load config/default.json, using default configuration:', error.message);
    // Fallback configuration
    return {
      port: process.env.PORT || 3001,
      logLevel: process.env.LOG_LEVEL || 'INFO',
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

// Update logger with configured log level
logger.setLevel(config.logLevel);

// Log loaded configuration
logger.info('Configuration loaded:');
logger.info('- Port:', config.port);
logger.info('- Photos folder:', config.photosPath);
logger.info('- Log level:', config.logLevel);
logger.debug('- Default interval:', config.defaults.interval);
logger.debug('- Default transparent background:', config.defaults.transparentBackground);
logger.debug('- Default shuffle images:', config.defaults.shuffleImages);

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
    logger.warn(`Tentative de path traversal détectée: ${req.url} depuis ${req.ip}`);
    return res.status(400).json({ error: 'Invalid request' });
  }
  
  next();
});

app.use(express.static(config.publicPath));
// Serve watermarks statically
app.use('/watermarks', express.static(path.join(__dirname, 'watermarks')));
// Serve uploaded watermarks
app.use('/uploads/watermarks', express.static(path.join(__dirname, 'uploads', 'watermarks')));
// Note: The /photos route is now handled dynamically

// Multer configuration for watermark uploads
const watermarkStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads', 'watermarks');
    // Create folder if it doesn't exist - use async version
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
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
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are accepted'), false);
    }
  }
});

// Global variables
let currentImages = [];
let shuffledImages = []; // Shuffled version of images
let newlyAddedImages = new Set(); // Tracker for new images
let currentPhotosPath = config.photosPath; // Current photos folder
let fileWatcher = null; // File watcher instance
let slideshowSettings = {
  ...config.defaults,
  photosPath: config.photosPath, // Add path to settings
};

// État du diaporama
let slideshowState = {
  currentIndex: 0,
  isPlaying: true,
  currentImage: null
};

// Server-side slideshow timer
let slideshowTimer = null;

// New image queue system
let newImageQueue = []; // Queue of new images to display
let isProcessingQueue = false; // Flag to track if we're processing the queue
let queueTimer = null; // Timer for queue processing

// Semaphore to limit concurrent EXIF operations and prevent file descriptor exhaustion
class ExifSemaphore {
  constructor(maxConcurrent = 3) { // Reduced from 10 to 3 for more conservative approach
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.running < this.maxConcurrent) {
        this.running++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.running++;
      next();
    }
  }

  async execute(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// Global semaphore to limit concurrent EXIF operations - using very conservative limit
const exifSemaphore = new ExifSemaphore(3);

// Function to extract EXIF thumbnail from image file
async function extractExifThumbnail(filePath) {
  let buffer = null;
  try {
    // Read file into buffer to avoid file handle issues
    buffer = await fs.readFile(filePath);
    
    // Use exifr to extract thumbnail from buffer instead of file path
    const thumbnailBuffer = await exifr.thumbnail(buffer);
    
    if (thumbnailBuffer && thumbnailBuffer.length > 0) {
      // Convert buffer to base64 data URL
      const base64Thumbnail = Buffer.from(thumbnailBuffer).toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Thumbnail}`;
      logger.debug(`Extracted EXIF thumbnail for ${path.basename(filePath)} (${thumbnailBuffer.length} bytes)`);
      return dataUrl;
    }
    
    return null;
  } catch (error) {
    logger.debug(`No EXIF thumbnail found for ${path.basename(filePath)}: ${error.message}`);
    return null;
  } finally {
    // Ensure buffer is released for garbage collection
    buffer = null;
  }
}

// Function to extract photo date using EXIF data with fallback to file system
async function getPhotoDate(filePath) {
  try {
    // Get file stats first (always needed for fallback)
    const stats = await fs.stat(filePath);
    
    // Always try EXIF data first (more accurate) - with concurrency control
    return await exifSemaphore.execute(async () => {
      let buffer = null;
      try {
        // Read file into buffer to avoid file handle issues
        buffer = await fs.readFile(filePath);
        
        // Configure options to read comprehensive date-related EXIF tags
        const options = {
          // Read all common date-related EXIF tags from different camera manufacturers
          pick: [
            'DateTimeOriginal', 'DateTime', 'CreateDate', 'DateTimeDigitized',
            'ModifyDate', 'FileModifyDate', 'SubSecDateTimeOriginal',
            'OffsetTimeOriginal', 'GPSDateTime'
          ],
          // Skip unnecessary parsing to reduce processing
          skip: ['thumbnail', 'ifd1', 'interop'],
          // Disable chunked reading since we're using buffer
          chunked: false,
          // Use the most efficient parsing approach
          tiff: {
            skip: ['thumbnail', 'ifd1']
          }
        };
        
        // Use the static parse method with buffer instead of file path
        const exifData = await exifr.parse(buffer, options);
        
        // Enhanced logging to help debug EXIF issues
        logger.debug(`EXIF data for ${path.basename(filePath)}:`, exifData);
        
        // Helper function to convert EXIF date strings to Date objects
        const parseExifDate = (dateValue) => {
          if (!dateValue) return null;
          
          // If it's already a Date object and valid, return it
          if (dateValue instanceof Date && !isNaN(dateValue)) {
            return dateValue;
          }
          
          // If it's a string, try to parse it
          if (typeof dateValue === 'string') {
            // EXIF dates are typically in format "YYYY:MM:DD HH:MM:SS"
            const exifDateRegex = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;
            const match = dateValue.match(exifDateRegex);
            if (match) {
              const [, year, month, day, hour, minute, second] = match;
              const parsedDate = new Date(
                parseInt(year),
                parseInt(month) - 1, // Month is 0-indexed in JS
                parseInt(day),
                parseInt(hour),
                parseInt(minute),
                parseInt(second)
              );
              return !isNaN(parsedDate) ? parsedDate : null;
            }
            
            // Try standard Date parsing as fallback
            const fallbackDate = new Date(dateValue);
            return !isNaN(fallbackDate) ? fallbackDate : null;
          }
          
          return null;
        };
        
        // Try to get the original photo date in order of preference
        const dateCandidates = [
          exifData?.DateTimeOriginal,    // Camera capture time (preferred)
          exifData?.CreateDate,          // File creation in camera
          exifData?.DateTimeDigitized,   // Digital conversion time
          exifData?.DateTime,            // General date/time (often modification)
          exifData?.SubSecDateTimeOriginal, // High precision capture time
          exifData?.ModifyDate           // Last modification
        ];
        
        for (const candidate of dateCandidates) {
          const parsedDate = parseExifDate(candidate);
          if (parsedDate) {
            logger.debug(`Found EXIF date for ${path.basename(filePath)}: ${parsedDate} (from field containing: ${candidate})`);
            return parsedDate;
          }
        }
        
        logger.debug(`No valid EXIF date found for ${path.basename(filePath)}, available fields:`, Object.keys(exifData || {}));
        
      } catch (error) {
        // EXIF reading failed
        logger.debug(`Could not read EXIF date for ${path.basename(filePath)}: ${error.message}`);
      } finally {
        // Ensure buffer is released for garbage collection
        buffer = null;
      }
      
      // Fall back to file system date (creation time with modification fallback)
      logger.debug(`No EXIF date available for ${path.basename(filePath)}, falling back to file system date`);
      return stats.birthtime || stats.mtime;
    });
  } catch (error) {
    logger.warn(`Could not get date for ${path.basename(filePath)}: ${error.message}`);
    return new Date(); // Use current time as last resort
  }
}

// Fonction pour mélanger un tableau (Fisher-Yates shuffle)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Function to get complete image list (for grid display)
function getAllImagesList() {
  return slideshowSettings.shuffleImages ? shuffledImages : currentImages;
}

// Function to get current filtered image list (for slideshow)
function getCurrentImagesList() {
  const allImages = slideshowSettings.shuffleImages ? shuffledImages : currentImages;
  const excludedImages = slideshowSettings.excludedImages || [];
  
  // Filter excluded images
  let filteredImages = allImages.filter(image => !excludedImages.includes(image.filename));
  
  // Apply repeatLatest filter if enabled
  if (slideshowSettings.repeatLatest && filteredImages.length > 0) {
    const latestCount = Math.min(slideshowSettings.latestCount || 5, filteredImages.length);
    filteredImages = filteredImages.slice(0, latestCount);
    logger.debug(`Mode repeatLatest: affichage des ${latestCount} dernières images sur ${allImages.length} total`);
  }
  
  return filteredImages;
}

// Function to create/update shuffled image list
function updateShuffledImagesList(newImageAdded = null) {
  if (!slideshowSettings.shuffleImages) {
    // Normal mode: use chronological order
    shuffledImages = [...currentImages];
    logger.debug('Mode normal: ordre chronologique');
    return;
  }

  // Separate new images from existing ones
  const newImages = currentImages.filter(img => img.isNew);
  const existingImages = currentImages.filter(img => !img.isNew);

  // Shuffle existing images
  const shuffledExisting = shuffleArray([...existingImages]);
  
  // Priority: new images first, then shuffled existing ones
  shuffledImages = [...newImages, ...shuffledExisting];
  
  logger.debug(`🔀 Shuffle mode: ${newImages.length} new images priority, ${existingImages.length} existing shuffled`);
  
  if (newImages.length > 0) {
    logger.debug('📸 New images:', newImages.map(img => img.filename));
  }
}

// Function to recursively scan for image files with optimized processing
async function scanImagesRecursive(dirPath, relativePath = '', progressCallback = null) {
  const images = [];
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    // First, collect all image files and subdirectories
    const imageFiles = [];
    const subdirectories = [];
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const itemRelativePath = relativePath ? path.join(relativePath, item.name) : item.name;
      
      if (item.isDirectory()) {
        subdirectories.push({ fullPath, itemRelativePath });
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (config.supportedFormats.includes(ext)) {
          imageFiles.push({ fullPath, itemRelativePath });
        }
      }
    }
    
    // Process image files with consistent batching for EXIF processing
    const BATCH_SIZE = 5; // Small batches for EXIF processing
    const BATCH_DELAY = 10; // Small delay between batches to prevent overload
    
    const totalFiles = imageFiles.length;
    let processedFiles = 0;
    
    for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
      const batch = imageFiles.slice(i, i + BATCH_SIZE);
      
      // Process batch with Promise.all for controlled concurrency
      const batchResults = await Promise.all(
        batch.map(async ({ fullPath, itemRelativePath }) => {
          try {
            const stats = await fs.stat(fullPath);
            const photoDate = await getPhotoDate(fullPath);
            
            // Extract EXIF thumbnail for all images
            let thumbnailDataUrl = null;
            try {
              thumbnailDataUrl = await exifSemaphore.execute(async () => {
                return await extractExifThumbnail(fullPath);
              });
            } catch (error) {
              logger.debug(`Thumbnail extraction failed for ${itemRelativePath}: ${error.message}`);
            }
            
            processedFiles++;
            
            // Emit progress if callback provided
            if (progressCallback) {
              progressCallback({
                current: processedFiles,
                total: totalFiles,
                currentFile: itemRelativePath,
                isRecursive: true
              });
            }
            
            return {
              filename: itemRelativePath,
              path: `/photos/${itemRelativePath.replace(/\\/g, '/')}`, // Ensure forward slashes for web
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime,
              photoDate: photoDate,
              isNew: newlyAddedImages.has(itemRelativePath), // Use relative path for tracking
              thumbnail: thumbnailDataUrl // Add thumbnail data URL
            };
          } catch (error) {
            logger.warn(`Error processing image ${itemRelativePath}: ${error.message}`);
            return null;
          }
        })
      );
      
      // Add successful results to images array
      images.push(...batchResults.filter(result => result !== null));
      
      // Add delay between batches only for EXIF mode to prevent overwhelming the system
      if (BATCH_DELAY > 0 && i + BATCH_SIZE < imageFiles.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    
    // Recursively process subdirectories
    for (const { fullPath, itemRelativePath } of subdirectories) {
      try {
        const subImages = await scanImagesRecursive(fullPath, itemRelativePath, progressCallback);
        images.push(...subImages);
      } catch (error) {
        logger.warn(`Error scanning subdirectory ${itemRelativePath}: ${error.message}`);
      }
    }
    
  } catch (error) {
    logger.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return images;
}

// Fonction pour scanner les images
async function scanImages(newImageFilename = null) {
  try {
    let images = [];
    
    // Emit scan start event
    io.emit('scan-progress', {
      status: 'started',
      message: 'Starting image scan...'
    });
    
    if (slideshowSettings.recursiveSearch) {
      // Recursive scanning with optimized processing
      images = await scanImagesRecursive(currentPhotosPath, '', (progress) => {
        // Emit progress updates
        io.emit('scan-progress', {
          status: 'scanning',
          current: progress.current,
          total: progress.total,
          currentFile: progress.currentFile,
          percentage: Math.round((progress.current / progress.total) * 100)
        });
      });
      logger.debug(`Recursive scan found ${images.length} images`);
    } else {
      // Original non-recursive scanning with optimized processing
      const files = await fs.readdir(currentPhotosPath);
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return config.supportedFormats.includes(ext);
      });

      // Process images with consistent batching for EXIF processing
      const BATCH_SIZE = 5; // Small batches for EXIF processing
      const BATCH_DELAY = 10; // Small delay between batches to prevent overload
      
      const totalFiles = imageFiles.length;
      let processedFiles = 0;

      for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
        const batch = imageFiles.slice(i, i + BATCH_SIZE);
        
        // Process batch with Promise.all for controlled concurrency
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            try {
              const filePath = path.join(currentPhotosPath, file);
              const stats = await fs.stat(filePath);
              
              // Get the date using EXIF with filesystem fallback
              const photoDate = await getPhotoDate(filePath);
              
              // Extract EXIF thumbnail for all images
              let thumbnailDataUrl = null;
              try {
                thumbnailDataUrl = await exifSemaphore.execute(async () => {
                  return await extractExifThumbnail(filePath);
                });
              } catch (error) {
                logger.debug(`Thumbnail extraction failed for ${file}: ${error.message}`);
              }
              
              processedFiles++;
              
              // Emit progress update
              io.emit('scan-progress', {
                status: 'scanning',
                current: processedFiles,
                total: totalFiles,
                currentFile: file,
                percentage: Math.round((processedFiles / totalFiles) * 100)
              });
              
              return {
                filename: file,
                path: `/photos/${file}`,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                photoDate: photoDate, // Date from chosen source (filesystem by default, EXIF if configured)
                isNew: newlyAddedImages.has(file), // Mark new images
                thumbnail: thumbnailDataUrl // Add thumbnail data URL
              };
            } catch (error) {
              logger.warn(`Error processing image ${file}: ${error.message}`);
              return null;
            }
          })
        );
        
        // Add successful results to images array
        images.push(...batchResults.filter(result => result !== null));
        
        // Add delay between batches only for EXIF mode to prevent overwhelming the system
        if (BATCH_DELAY > 0 && i + BATCH_SIZE < imageFiles.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
    }

    // Sort by photo date (oldest first - ascending chronological order)
    images.sort((a, b) => a.photoDate - b.photoDate);
    
    currentImages = images;
    
    // Create/update shuffled list according to parameters
    updateShuffledImagesList(newImageFilename);
    
    // Update slideshow state
    updateSlideshowState();
    
    // Emit scan complete event
    io.emit('scan-progress', {
      status: 'completed',
      totalImages: images.length,
      message: `Scan completed: ${images.length} images found`
    });
    
    // Emit updated list to clients with appropriate list
    io.emit('images-updated', {
      allImages: getAllImagesList(), // Complete list for grid display
      images: getCurrentImagesList(), // Filtered list for slideshow
      settings: slideshowSettings,
      newImageAdded: newImageFilename
    });

    // Restart slideshow timer if necessary
    restartSlideshowTimer();

    logger.info(`${images.length} images found in ${currentPhotosPath}${newImageFilename ? ` (new: ${newImageFilename})` : ''} (using EXIF dates with filesystem fallback)`);
    return images;
  } catch (error) {
    logger.error('Error scanning images:', error);
    
    // Emit error event
    io.emit('scan-progress', {
      status: 'error',
      message: 'Error scanning images: ' + error.message
    });
    
    return [];
  }
}

// Silent image scanning for queue processing (doesn't emit events or restart timers)
async function scanImagesForQueue(newImageFilename = null) {
  try {
    let images = [];
    
    if (slideshowSettings.recursiveSearch) {
      // Recursive scanning with optimized processing
      images = await scanImagesRecursive(currentPhotosPath);
    } else {
      // Non-recursive: scan only the base directory
      const items = await fs.readdir(currentPhotosPath, { withFileTypes: true });
      const imageFiles = items
        .filter(item => item.isFile())
        .map(item => item.name)
        .filter(filename => {
          const ext = path.extname(filename).toLowerCase();
          return config.supportedFormats.includes(ext);
        });

      // Process images with semaphore to prevent resource exhaustion
      for (const filename of imageFiles) {
        const imagePath = path.join(currentPhotosPath, filename);
        
        const imageData = await exifSemaphore.execute(async () => {
          const stats = await fs.stat(imagePath);
          const photoDate = await getPhotoDate(imagePath);
          const thumbnail = await extractExifThumbnail(imagePath);
          
          return {
            filename: filename,
            path: `/photos/${filename}`,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            photoDate: photoDate, // Use consistent field name with regular scanning
            isNew: newlyAddedImages.has(filename),
            thumbnail: thumbnail
          };
        });
        
        images.push(imageData);
      }
    }

    // Sort by photo date (oldest first - ascending chronological order)
    images.sort((a, b) => a.photoDate - b.photoDate);
    
    // Update global images array silently
    currentImages = images;
    
    // Update shuffled images list
    updateShuffledImagesList(newImageFilename);
    
    logger.debug(`Silent scan completed: ${images.length} images, new: ${newImageFilename || 'none'}`);
    return images;
  } catch (error) {
    logger.error('Error in silent image scan:', error);
    return [];
  }
}

// Update slideshow state
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
  
  // Calculate original index (position in chronological order)
  const originalIndex = slideshowState.currentImage ? 
    currentImages.findIndex(img => img.filename === slideshowState.currentImage.filename) : -1;
  
  // Calculate next image information
  let nextImage = null;
  let nextOriginalIndex = -1;
  if (imagesList.length > 1) {
    const nextIndex = (slideshowState.currentIndex + 1) % imagesList.length;
    nextImage = imagesList[nextIndex];
    nextOriginalIndex = nextImage ? 
      currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
  }
  
  // Émettre l'état mis à jour aux clients uniquement si demandé
  if (emitEvent) {
    io.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      originalIndex: originalIndex,
      nextImage: nextImage,
      nextOriginalIndex: nextOriginalIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: imagesList.length,
      totalOriginalImages: currentImages.length
    });
  }
}

// Changer d'image avec émission d'événement
function changeImage(direction = 1) {
  const imagesList = getCurrentImagesList();
  if (imagesList.length === 0) return;
  
  // Calculate new index with proper wrap-around
  const oldIndex = slideshowState.currentIndex;
  let newIndex = slideshowState.currentIndex + direction;
  
  // Handle wrap-around properly
  if (newIndex >= imagesList.length) {
    newIndex = 0;
  } else if (newIndex < 0) {
    newIndex = imagesList.length - 1;
  }
  
  // Update the current index
  slideshowState.currentIndex = newIndex;
  slideshowState.currentImage = imagesList[slideshowState.currentIndex];
  
  logger.debug(`Changed image: ${oldIndex} -> ${newIndex} (direction: ${direction}), current: ${slideshowState.currentImage?.filename}`);
  
  // Calculate original index for the changed image
  const originalIndex = slideshowState.currentImage ? 
    currentImages.findIndex(img => img.filename === slideshowState.currentImage.filename) : -1;
  
  // Calculate next image information
  let nextImage = null;
  let nextOriginalIndex = -1;
  if (imagesList.length > 1) {
    const nextIndex = (slideshowState.currentIndex + 1) % imagesList.length;
    nextImage = imagesList[nextIndex];
    nextOriginalIndex = nextImage ? 
      currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
  }
  
  // Émettre le changement d'image aux clients slideshow
  io.emit('image-changed', {
    currentImage: slideshowState.currentImage,
    currentIndex: slideshowState.currentIndex,
    originalIndex: originalIndex,
    nextImage: nextImage,
    nextOriginalIndex: nextOriginalIndex,
    direction: direction,
    totalImages: imagesList.length
  });
}

// Démarrer le timer du diaporama côté serveur
function startSlideshowTimer() {
  stopSlideshowTimer();
  
  const imagesList = getCurrentImagesList();
  if (imagesList.length > 1 && slideshowState.isPlaying) {
    slideshowTimer = setInterval(() => {
      logger.debug('Server timer: moving to next image');
      changeImage(1);
    }, slideshowSettings.interval);
    logger.debug(`Slideshow timer started (interval: ${slideshowSettings.interval}ms)`);
  }
}

// Arrêter le timer du diaporama
function stopSlideshowTimer() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
    logger.debug('Slideshow timer stopped');
  }
}

// Restart timer with new parameters
function restartSlideshowTimer() {
  if (slideshowState.isPlaying && !isProcessingQueue) {
    startSlideshowTimer();
  }
}

// Queue management functions
function addImageToQueue(imagePath) {
  logger.debug(`Adding image to queue: ${imagePath}`);
  newImageQueue.push(imagePath);
  
  // If not already processing queue, schedule queue processing after current timer finishes
  if (!isProcessingQueue && newImageQueue.length === 1) {
    scheduleQueueProcessing();
  }
}

function scheduleQueueProcessing() {
  if (isProcessingQueue) {
    return; // Already processing
  }
  
  logger.debug('Scheduling queue processing after current timer finishes');
  
  // Stop the normal slideshow timer to prevent it from changing images during queue processing
  stopSlideshowTimer();
  
  // Start queue processing immediately (the current image is already displayed)
  processImageQueue();
}

function processImageQueue() {
  if (newImageQueue.length === 0) {
    // Queue is empty, resume normal slideshow
    logger.debug('Queue processing complete, resuming normal slideshow');
    isProcessingQueue = false;
    restartSlideshowTimer();
    return;
  }
  
  if (!isProcessingQueue) {
    isProcessingQueue = true;
    logger.debug(`Starting queue processing with ${newImageQueue.length} images`);
  }
  
  // Get next image from queue
  const nextImagePath = newImageQueue.shift();
  
  // Find the image in the current images list to get full image data
  const nextImage = currentImages.find(img => 
    img.filename === path.basename(nextImagePath) || 
    img.path === nextImagePath
  );
  
  if (nextImage) {
    logger.debug(`Processing queued image: ${nextImage.filename}`);
    
    // Update slideshow state to the queued image
    const imagesList = getCurrentImagesList();
    const newIndex = imagesList.findIndex(img => img.filename === nextImage.filename);
    
    if (newIndex !== -1) {
      slideshowState.currentIndex = newIndex;
      slideshowState.currentImage = nextImage;
      
      // Emit image change event
      const originalIndex = currentImages.findIndex(img => img.filename === nextImage.filename);
      
      // Calculate next image information (from queue or normal slideshow)
      let nextQueueImage = null;
      let nextOriginalIndex = -1;
      
      if (newImageQueue.length > 0) {
        // Next image is from queue
        const nextQueuePath = newImageQueue[0];
        nextQueueImage = currentImages.find(img => 
          img.filename === path.basename(nextQueuePath) || 
          img.path === nextQueuePath
        );
        nextOriginalIndex = nextQueueImage ? 
          currentImages.findIndex(img => img.filename === nextQueueImage.filename) : -1;
      } else {
        // Next image would be from normal slideshow after queue finishes
        const nextIndex = (slideshowState.currentIndex + 1) % imagesList.length;
        nextQueueImage = imagesList[nextIndex];
        nextOriginalIndex = nextQueueImage ? 
          currentImages.findIndex(img => img.filename === nextQueueImage.filename) : -1;
      }
      
      io.emit('image-changed', {
        currentImage: slideshowState.currentImage,
        currentIndex: slideshowState.currentIndex,
        originalIndex: originalIndex,
        nextImage: nextQueueImage,
        nextOriginalIndex: nextOriginalIndex,
        direction: 1, // Always forward for queue processing
        totalImages: imagesList.length,
        isQueueProcessing: true,
        queueLength: newImageQueue.length
      });
      
      // Schedule the next image in the queue or resume normal slideshow
      queueTimer = setTimeout(() => {
        processImageQueue();
      }, slideshowSettings.interval);
    } else {
      logger.warn(`Queued image ${nextImage.filename} not found in current images list, skipping`);
      // Skip this image and process next
      processImageQueue();
    }
  } else {
    logger.warn(`Queued image not found: ${nextImagePath}, skipping`);
    // Skip this image and process next
    processImageQueue();
  }
}

function stopQueueProcessing() {
  if (queueTimer) {
    clearTimeout(queueTimer);
    queueTimer = null;
  }
  isProcessingQueue = false;
  newImageQueue = [];
  logger.debug('Queue processing stopped');
}

// File change monitoring
function setupFileWatcher() {
  // Arrêter le watcher précédent s'il existe
  if (fileWatcher) {
    fileWatcher.close();
    logger.debug('Stopping previous monitoring');
  }

  const watchOptions = {
    ignored: /^\./, // Ignorer les fichiers cachés
    persistent: true,
    ignoreInitial: true
  };

  // Enable recursive watching if the setting is enabled
  if (slideshowSettings.recursiveSearch) {
    // Chokidar watches recursively by default, no need to set specific option
    logger.debug('Setting up recursive file monitoring');
  }

  fileWatcher = chokidar.watch(currentPhotosPath, watchOptions);

  fileWatcher
    .on('add', async (filePath) => {
      try {
        const filename = path.basename(filePath);
        const ext = path.extname(filename).toLowerCase();
        
        if (config.supportedFormats.includes(ext)) {
          // For recursive monitoring, use the relative path from the base photos directory
          const relativePath = path.relative(currentPhotosPath, filePath);
          const trackingKey = slideshowSettings.recursiveSearch ? relativePath : filename;
          
          logger.debug(`New image detected: ${trackingKey}`);
          
          // Mark as new image using appropriate key
          newlyAddedImages.add(trackingKey);
          
          // Instead of immediate scanning, first do a silent scan to load the image data
          // then add to queue for ordered display and emit UI update
          await scanImagesForQueue(trackingKey);
          
          // Emit updated images to UI so control interface shows new images immediately
          io.emit('images-updated', {
            allImages: getAllImagesList(), // Complete list for grid display
            images: getCurrentImagesList(), // Filtered list for slideshow
            settings: slideshowSettings,
            newImageAdded: trackingKey
          });
          
          // Add to queue for sequential display
          addImageToQueue(trackingKey);
          
          // Clean marking after 5 minutes with error handling
          setTimeout(() => {
            try {
              newlyAddedImages.delete(trackingKey);
              logger.debug(`Image ${trackingKey} is no longer considered new`);
              
              // Nettoyage périodique pour éviter les fuites mémoire
              if (newlyAddedImages.size > 100) {
                logger.warn(`Nettoyage forcé du tracker d'images: ${newlyAddedImages.size} entrées`);
                newlyAddedImages.clear();
              }
            } catch (error) {
              logger.error('Error cleaning image tracker:', error);
            }
          }, 5 * 60 * 1000);
        }
      } catch (error) {
        logger.error('Error processing file addition:', error);
      }
    })
    .on('unlink', (filePath) => {
      try {
        const filename = path.basename(filePath);
        const relativePath = path.relative(currentPhotosPath, filePath);
        const trackingKey = slideshowSettings.recursiveSearch ? relativePath : filename;
        
        logger.debug(`Image supprimée: ${trackingKey}`);
        
        // Remove from new images tracker if present
        newlyAddedImages.delete(trackingKey);
        
        scanImages(); // Rescan all images
      } catch (error) {
        logger.error('Error processing file removal:', error);
      }
    })
    .on('addDir', (dirPath) => {
      if (slideshowSettings.recursiveSearch) {
        const relativePath = path.relative(currentPhotosPath, dirPath);
        logger.debug(`New directory detected: ${relativePath}`);
      }
    })
    .on('unlinkDir', (dirPath) => {
      if (slideshowSettings.recursiveSearch) {
        const relativePath = path.relative(currentPhotosPath, dirPath);
        logger.debug(`Directory removed: ${relativePath}`);
        // Rescan when directories are removed in recursive mode
        scanImages();
      }
    })
    .on('error', error => {
      logger.error('Watcher error:', error);
      // Tentative de redémarrage du watcher en cas d'erreur critique
      setTimeout(() => {
        logger.info('Tentative de redémarrage du watcher...');
        setupFileWatcher();
      }, 5000);
    });

  const mode = slideshowSettings.recursiveSearch ? 'recursive' : 'non-recursive';
  logger.info(`Monitoring folder: ${currentPhotosPath} (${mode})`);
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
      'transparentBackground', 'photosPath', 'excludedImages', 'language',
      'recursiveSearch'
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
          case 'recursiveSearch':
            if (typeof value === 'boolean') {
              newSettings[key] = value;
            }
            break;
          case 'excludedImages':
            if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
              newSettings[key] = value;
            }
            break;
          case 'language':
            if (typeof value === 'string' && ['en', 'fr'].includes(value)) {
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
      logger.debug(`🔄 Mode mélange changé: ${previousShuffleState} → ${newSettings.shuffleImages}`);
      
      // Remember the current image before shuffling to keep it as current
      const currentImageFilename = slideshowState.currentImage ? slideshowState.currentImage.filename : null;
      
      updateShuffledImagesList();
      
      // After shuffling, find the current image in the new list and update index accordingly
      const imagesList = getCurrentImagesList();
      if (currentImageFilename && imagesList.length > 0) {
        const newIndex = imagesList.findIndex(img => img.filename === currentImageFilename);
        if (newIndex !== -1) {
          // Found the current image in the new list, update index to point to it
          slideshowState.currentIndex = newIndex;
        } else {
          // Current image not found (maybe excluded), reset to 0
          slideshowState.currentIndex = 0;
        }
      } else {
        // No current image or empty list, reset to 0
        slideshowState.currentIndex = 0;
      }
      
      // Ensure index is still valid after all adjustments
      if (slideshowState.currentIndex >= imagesList.length) {
        slideshowState.currentIndex = 0;
      }
      
      // Update slideshow state to reflect new list
      updateSlideshowState();
      
      // Emit new image list to clients
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
    
    // If recursive search setting changed, restart file watcher and rescan
    if (newSettings.recursiveSearch !== undefined) {
      logger.debug(`🔄 Recursive search mode changed to: ${newSettings.recursiveSearch}`);
      setupFileWatcher();
      // Rescan images with new recursive setting
      scanImages();
    }
    
    // Émettre les nouveaux réglages aux clients
    io.emit('settings-updated', slideshowSettings);
    
    res.json(slideshowSettings);
  } catch (error) {
    logger.error('Error updating settings:', error);
    res.status(400).json({ error: 'Données de paramètres invalides' });
  }
});

// Route to list available watermarks
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
    logger.error('Error reading watermarks:', error);
    res.json([]);
  }
});

// Route to upload a watermark
app.post('/api/watermark-upload', uploadWatermark.single('watermark'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    logger.info('Watermark uploaded:', req.file.filename);

    // Return the uploaded file path
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

// Route to serve language files
app.get('/api/locales/:language', async (req, res) => {
  try {
    const language = req.params.language;
    
    // Validate language parameter
    if (!/^[a-z]{2}$/.test(language)) {
      return res.status(400).json({ error: 'Invalid language code' });
    }
    
    const localesPath = path.join(__dirname, 'locales', `${language}.json`);
    
    try {
      const localeData = await fs.readFile(localesPath, 'utf8');
      const translations = JSON.parse(localeData);
      
      // Set proper cache headers for translations
      res.set({
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Type': 'application/json'
      });
      
      res.json(translations);
    } catch (fileError) {
      logger.error(`Locale file not found: ${language}`, fileError);
      res.status(404).json({ error: `Language '${language}' not available` });
    }
  } catch (error) {
    logger.error('Error serving locale:', error);
    res.status(500).json({ error: 'Failed to load language file' });
  }
});

// Route to change photos folder
app.post('/api/photos-path', async (req, res) => {
  try {
    const { photosPath } = req.body;
    
    logger.debug('Demande de changement de dossier:', photosPath);
    
    if (!photosPath || typeof photosPath !== 'string') {
      return res.status(400).json({ error: 'Chemin du dossier requis et doit être une chaîne' });
    }
    
    // Validation supplémentaire du chemin
    if (photosPath.includes('..') || photosPath.length > 500) {
      return res.status(400).json({ error: 'Chemin de dossier invalide' });
    }

    // Résoudre le chemin pour obtenir le chemin absolu
    const resolvedPath = path.resolve(photosPath);
    logger.debug('Chemin résolu:', resolvedPath);

    // Vérifier que le dossier existe
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Le chemin spécifié n\'est pas un dossier' });
      }
    } catch (error) {
      logger.debug('Error checking folder:', error.message);
      return res.status(400).json({ error: 'Le dossier spécifié n\'existe pas ou n\'est pas accessible' });
    }

    // Update current path
    currentPhotosPath = resolvedPath;
    slideshowSettings.photosPath = currentPhotosPath;
    
    logger.debug('New folder set:', currentPhotosPath);
    
    // Clean new images tracker
    newlyAddedImages.clear();
    
    // Restart file watching
    setupFileWatcher();
    
    // Rescan images from new folder
    await scanImages();
    
    logger.info(`Photos folder changed to: ${currentPhotosPath}`);
    
    res.json({ 
      success: true, 
      photosPath: currentPhotosPath,
      message: 'Folder changed successfully'
    });
  } catch (error) {
    logger.error('Error changing folder:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Route dynamique pour servir les photos du dossier actuel
// Photos route with subdirectory support
app.get('/photos/:filename', (req, res) => {
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
    
    const filePath = path.join(currentPhotosPath, filename);
    
    // Vérifier que le fichier existe et est dans le dossier autorisé
    const resolvedPath = path.resolve(filePath);
    const resolvedPhotosPath = path.resolve(currentPhotosPath);
    
    if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
      return res.status(403).json({ error: 'Accès interdit' });
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

// Route for subdirectory photos
app.get('/photos/:subfolder/:filename', (req, res) => {
  try {
    const subfolder = req.params.subfolder;
    const filename = req.params.filename;
    const relativePath = path.join(subfolder, filename);
    
    // Validation du chemin
    if (!filename || !subfolder || relativePath.includes('..')) {
      return res.status(400).json({ error: 'Chemin de fichier invalide' });
    }
    
    // Vérifier l'extension
    const ext = path.extname(filename).toLowerCase();
    if (!config.supportedFormats.includes(ext)) {
      return res.status(400).json({ error: 'Format de fichier non supporté' });
    }
    
    const filePath = path.join(currentPhotosPath, relativePath);
    
    // Vérifier que le fichier existe et est dans le dossier autorisé
    const resolvedPath = path.resolve(filePath);
    const resolvedPhotosPath = path.resolve(currentPhotosPath);
    
    if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
      return res.status(403).json({ error: 'Accès interdit' });
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

// Route for nested subdirectory photos
app.get('/photos/:subfolder/:nestedfolder/:filename', (req, res) => {
  try {
    const subfolder = req.params.subfolder;
    const nestedfolder = req.params.nestedfolder;
    const filename = req.params.filename;
    const relativePath = path.join(subfolder, nestedfolder, filename);
    
    // Validation du chemin
    if (!filename || !subfolder || !nestedfolder || relativePath.includes('..')) {
      return res.status(400).json({ error: 'Chemin de fichier invalide' });
    }
    
    // Vérifier l'extension
    const ext = path.extname(filename).toLowerCase();
    if (!config.supportedFormats.includes(ext)) {
      return res.status(400).json({ error: 'Format de fichier non supporté' });
    }
    
    const filePath = path.join(currentPhotosPath, relativePath);
    
    // Vérifier que le fichier existe et est dans le dossier autorisé
    const resolvedPath = path.resolve(filePath);
    const resolvedPhotosPath = path.resolve(currentPhotosPath);
    
    if (!resolvedPath.startsWith(resolvedPhotosPath + path.sep) && resolvedPath !== resolvedPhotosPath) {
      return res.status(403).json({ error: 'Accès interdit' });
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

// Route pour le diaporama OBS
app.get('/', (req, res) => {
  res.sendFile(path.join(config.publicPath, 'slideshow.html'));
});

// Route for the control interface
app.get('/control', (req, res) => {
  res.sendFile(path.join(config.publicPath, 'control.html'));
});

// Route for test navigation (debug)
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test_navigation.html'));
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  logger.debug('Client connected:', socket.id);
  
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
    originalIndex: slideshowState.currentImage ? 
      currentImages.findIndex(img => img.filename === slideshowState.currentImage.filename) : -1,
    isPlaying: slideshowState.isPlaying,
    totalImages: getCurrentImagesList().length,
    totalOriginalImages: currentImages.length
  });

  socket.on('disconnect', () => {
    logger.debug('Client disconnected:', socket.id);
  });

  // Handle control commands
  socket.on('next-image', () => {
    logger.debug('Next image requested from client');
    changeImage(1);
    // Restart timer to reset interval
    restartSlideshowTimer();
  });

  socket.on('prev-image', () => {
    logger.debug('Previous image requested from client');
    changeImage(-1);
    // Restart timer to reset interval
    restartSlideshowTimer();
  });

  socket.on('jump-to-image', (index) => {
    const imagesList = getCurrentImagesList();
    if (index >= 0 && index < imagesList.length) {
      const previousIndex = slideshowState.currentIndex;
      
      // Update to new index
      slideshowState.currentIndex = index;
      slideshowState.currentImage = imagesList[slideshowState.currentIndex];
      
      // Determine direction for transition
      const direction = index > previousIndex ? 1 : (index < previousIndex ? -1 : 0);
      
      logger.debug(`Jumped to image: ${previousIndex} -> ${index}, current: ${slideshowState.currentImage?.filename}`);
      
      // Calculate original index for the jumped image
      const originalIndex = slideshowState.currentImage ? 
        currentImages.findIndex(img => img.filename === slideshowState.currentImage.filename) : -1;
      
      // Calculate next image information
      let nextImage = null;
      let nextOriginalIndex = -1;
      if (imagesList.length > 1) {
        const nextIndex = (slideshowState.currentIndex + 1) % imagesList.length;
        nextImage = imagesList[nextIndex];
        nextOriginalIndex = nextImage ? 
          currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
      }
      
      // Emit image-changed event for smooth transition
      io.emit('image-changed', {
        currentImage: slideshowState.currentImage,
        currentIndex: slideshowState.currentIndex,
        originalIndex: originalIndex,
        nextImage: nextImage,
        nextOriginalIndex: nextOriginalIndex,
        direction: direction,
        totalImages: imagesList.length
      });
      
      // Restart timer to reset interval
      restartSlideshowTimer();
    }
  });

  socket.on('pause-slideshow', () => {
    slideshowState.isPlaying = false;
    stopSlideshowTimer();
    
    const imagesList = getCurrentImagesList();
    const originalIndex = slideshowState.currentImage ? 
      currentImages.findIndex(img => img.filename === slideshowState.currentImage.filename) : -1;
    
    // Calculate next image information
    let nextImage = null;
    let nextOriginalIndex = -1;
    if (imagesList.length > 1) {
      const nextIndex = (slideshowState.currentIndex + 1) % imagesList.length;
      nextImage = imagesList[nextIndex];
      nextOriginalIndex = nextImage ? 
        currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
    }
    
    io.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      originalIndex: originalIndex,
      nextImage: nextImage,
      nextOriginalIndex: nextOriginalIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: imagesList.length,
      totalOriginalImages: currentImages.length
    });
    socket.broadcast.emit('pause-slideshow');
    logger.debug('Slideshow paused by a client');
  });

  socket.on('resume-slideshow', () => {
    slideshowState.isPlaying = true;
    startSlideshowTimer();
    
    const imagesList = getCurrentImagesList();
    const originalIndex = slideshowState.currentImage ? 
      currentImages.findIndex(img => img.filename === slideshowState.currentImage.filename) : -1;
    
    // Calculate next image information
    let nextImage = null;
    let nextOriginalIndex = -1;
    if (imagesList.length > 1) {
      const nextIndex = (slideshowState.currentIndex + 1) % imagesList.length;
      nextImage = imagesList[nextIndex];
      nextOriginalIndex = nextImage ? 
        currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
    }
    
    io.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      originalIndex: originalIndex,
      nextImage: nextImage,
      nextOriginalIndex: nextOriginalIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: imagesList.length,
      totalOriginalImages: currentImages.length
    });
    socket.broadcast.emit('resume-slideshow');
    logger.debug('Slideshow resumed by a client');
  });

  socket.on('get-slideshow-state', () => {
    const imagesList = getCurrentImagesList();
    const originalIndex = slideshowState.currentImage ? 
      currentImages.findIndex(img => img.filename === slideshowState.currentImage.filename) : -1;
    
    // Calculate next image information
    let nextImage = null;
    let nextOriginalIndex = -1;
    if (imagesList.length > 1) {
      const nextIndex = (slideshowState.currentIndex + 1) % imagesList.length;
      nextImage = imagesList[nextIndex];
      nextOriginalIndex = nextImage ? 
        currentImages.findIndex(img => img.filename === nextImage.filename) : -1;
    }
      
    socket.emit('slideshow-state', {
      currentImage: slideshowState.currentImage,
      currentIndex: slideshowState.currentIndex,
      originalIndex: originalIndex,
      nextImage: nextImage,
      nextOriginalIndex: nextOriginalIndex,
      isPlaying: slideshowState.isPlaying,
      totalImages: imagesList.length,
      totalOriginalImages: currentImages.length
    });
  });

  // Handle manual rescan request
  socket.on('rescan-images', () => {
    logger.info('Manual rescan requested by client');
    scanImages();
  });

  socket.on('toggle-image-exclusion', (filename) => {
    try {
      if (typeof filename !== 'string') {
        logger.error('Invalid filename for exclusion toggle:', filename);
        return;
      }

      const excludedImages = slideshowSettings.excludedImages || [];
      const isExcluded = excludedImages.includes(filename);
      
      if (isExcluded) {
        // Remove from excluded list
        slideshowSettings.excludedImages = excludedImages.filter(img => img !== filename);
        logger.debug(`Image ${filename} reintegrated into slideshow`);
      } else {
        // Add to excluded list
        slideshowSettings.excludedImages = [...excludedImages, filename];
        logger.debug(`Image ${filename} excluded from slideshow`);
      }
      
      // Track if we need to restart timer (only if current image state changes)
      let shouldRestartTimer = false;
      
      // Update slideshow state if current image was excluded
      const filteredImages = getCurrentImagesList();
      if (filteredImages.length === 0) {
        slideshowState.currentImage = null;
        slideshowState.currentIndex = 0;
        shouldRestartTimer = true; // No images left, need to stop timer
      } else if (slideshowState.currentImage && slideshowSettings.excludedImages.includes(slideshowState.currentImage.filename)) {
        // Current image was excluded, move to next available image
        slideshowState.currentIndex = 0;
        updateSlideshowState();
        shouldRestartTimer = true; // Current image changed, need to reset timer
      }
      
      // Only restart slideshow timer if the current image state changed
      if (shouldRestartTimer) {
        restartSlideshowTimer();
      }
      
      // Broadcast updated settings and images to all clients
      io.emit('settings-updated', slideshowSettings);
      io.emit('images-updated', {
        allImages: getAllImagesList(),
        images: getCurrentImagesList(),
        settings: slideshowSettings
      });
      
    } catch (error) {
      logger.error('Error toggling image exclusion:', error);
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
    
    // Fonction pour afficher les messages de démarrage
    const logServerStarted = () => {
      logger.info(`PhotoLive OBS server started on http://localhost:${config.port}`);
      logger.info(`Control interface: http://localhost:${config.port}/control`);
      logger.info(`Slideshow for OBS: http://localhost:${config.port}/`);
      logger.info(`Photos folder monitored: ${currentPhotosPath}`);
    };

    // Démarrer le serveur
    server.listen(config.port, logServerStarted).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${config.port} already in use, trying port ${config.port + 1}...`);
        config.port = config.port + 1;
        
        // Avoid infinite loop
        if (config.port > 3010) {
          logger.error('Impossible de trouver un port libre entre 3001 et 3010');
          process.exit(1);
        }
        
        server.listen(config.port, logServerStarted);
      } else {
        logger.error('Error starting server:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Error during initialization:', error);
  }
}

// Démarrage
initialize();

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Stop file watcher
    if (fileWatcher) {
      await fileWatcher.close();
      logger.info('File watcher closed');
    }
    
    // Stop slideshow timer
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      logger.info('Slideshow timer stopped');
    }
    
    // Stop queue processing
    stopQueueProcessing();
    logger.info('Queue processing stopped');
    
    // Close socket connections
    io.close(() => {
      logger.info('Socket.io connections closed');
    });
    
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  logger.info('\nStopping server...');
  
  // Arrêter le timer du diaporama
  stopSlideshowTimer();
  
  // Stop queue processing
  stopQueueProcessing();
  
  if (fileWatcher) {
    fileWatcher.close();
    logger.info('File monitoring stopped');
  }
  server.close(() => {
    logger.info('Server stopped cleanly');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('\nStopping server (SIGTERM)...');
  
  // Arrêter le timer du diaporama
  stopSlideshowTimer();
  
  // Stop queue processing
  stopQueueProcessing();
  
  if (fileWatcher) {
    fileWatcher.close();
  }
  server.close(() => {
    process.exit(0);
  });
});
