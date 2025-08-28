const path = require('path');
const fs = require('fs');

class Config {
  constructor() {
    this.loadConfiguration();
  }

  loadConfiguration() {
    try {
      const configPath = path.join(__dirname, '../../config/default.json');
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Server configuration
      this.port = process.env.PORT || configData.server.port;
      this.logLevel = process.env.LOG_LEVEL || configData.server.logLevel || 'INFO';
      this.photosPath = path.resolve(__dirname, '../..', configData.server.photosPath);
      this.publicPath = path.join(__dirname, '../../public');
      this.uploadsPath = path.join(__dirname, '../../uploads');
      
      // Slideshow configuration
      this.slideInterval = configData.slideshow.interval;
      this.supportedFormats = configData.slideshow.supportedFormats;
      
      // Features configuration
      this.filters = configData.features.filters;
      this.watermarkPositions = configData.features.watermarkPositions;
      this.watermarkTypes = configData.features.watermarkTypes || [
        { id: 'text', name: 'Text' },
        { id: 'image', name: 'PNG Image' }
      ];
      this.watermarkSizes = configData.features.watermarkSizes || [
        { id: 'small', name: 'Small', scale: 0.5 },
        { id: 'medium', name: 'Medium', scale: 1.0 },
        { id: 'large', name: 'Large', scale: 1.5 },
        { id: 'xlarge', name: 'Extra Large', scale: 2.0 }
      ];
      
      // Default settings
      // Merge with defaults to ensure all properties exist
      this.defaults = {
        shuffle: true,
        filter: 'none',
        transition: 'none',
        watermark: {
          enabled: false,
          type: 'text',
          text: 'PhotoLive OBS',
          position: 'bottom-right',
          opacity: 0.8,
          size: 'medium',
          image: null
        },
        backgroundColor: 'transparent',
        repeatLatest: false,
        latestCount: 5,
        recursiveSearch: false,
        excludedImages: [],
        ...configData.defaults
      };
      
      // CORS configuration
      this.corsOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : ["http://localhost:3001", "http://127.0.0.1:3001"];
        
    } catch (error) {
      console.warn('Unable to load config/default.json, using default configuration:', error.message);
      this.setDefaultConfiguration();
    }
  }

  setDefaultConfiguration() {
    this.port = process.env.PORT || 3001;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.photosPath = path.join(__dirname, '../../photos');
    this.publicPath = path.join(__dirname, '../../public');
    this.uploadsPath = path.join(__dirname, '../../uploads');
    this.slideInterval = 5000;
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];
    this.filters = [
      { id: 'none', name: 'None' },
      { id: 'grayscale', name: 'Grayscale' },
      { id: 'sepia', name: 'Sepia' },
      { id: 'blur', name: 'Blur' },
      { id: 'brightness', name: 'Brightness' },
      { id: 'contrast', name: 'Contrast' },
      { id: 'saturate', name: 'Saturate' }
    ];
    this.watermarkPositions = [
      { id: 'top-left', name: 'Top Left' },
      { id: 'top-right', name: 'Top Right' },
      { id: 'bottom-left', name: 'Bottom Left' },
      { id: 'bottom-right', name: 'Bottom Right' },
      { id: 'center', name: 'Center' }
    ];
    this.watermarkTypes = [
      { id: 'text', name: 'Text' },
      { id: 'image', name: 'PNG Image' }
    ];
    this.watermarkSizes = [
      { id: 'small', name: 'Small', scale: 0.5 },
      { id: 'medium', name: 'Medium', scale: 1.0 },
      { id: 'large', name: 'Large', scale: 1.5 },
      { id: 'xlarge', name: 'Extra Large', scale: 2.0 }
    ];
    this.defaults = {
      shuffle: true,
      filter: 'none',
      transition: 'none',
      watermark: {
        enabled: false,
        type: 'text',
        text: 'PhotoLive OBS',
        position: 'bottom-right',
        opacity: 0.8,
        size: 'medium',
        image: null
      },
      backgroundColor: 'transparent',
      repeatLatest: false,
      latestCount: 5,
      recursiveSearch: false,
      excludedImages: []
    };
    this.corsOrigins = ["http://localhost:3001", "http://127.0.0.1:3001"];
  }

  getSettings() {
    return {
      interval: this.slideInterval,
      shuffle: this.defaults.shuffle,
      shuffleImages: this.defaults.shuffle, // Alias for compatibility
      filter: this.defaults.filter,
      transition: this.defaults.transition || 'none',
      
      // Flatten watermark settings for compatibility
      showWatermark: this.defaults.watermark.enabled,
      watermarkText: this.defaults.watermark.text,
      watermarkType: this.defaults.watermark.type,
      watermarkImage: this.defaults.watermark.image,
      watermarkPosition: this.defaults.watermark.position,
      watermarkSize: this.defaults.watermark.size,
      watermarkOpacity: Math.round(this.defaults.watermark.opacity * 100),
      
      backgroundColor: this.defaults.backgroundColor,
      transparentBackground: this.defaults.backgroundColor === 'transparent',
      
      // Additional settings for compatibility
      repeatLatest: this.defaults.repeatLatest || false,
      latestCount: this.defaults.latestCount || 5,
      recursiveSearch: this.defaults.recursiveSearch || false,
      excludedImages: this.defaults.excludedImages || [],
      photosPath: this.photosPath,
      
      // Configuration arrays
      filters: this.filters,
      watermarkPositions: this.watermarkPositions,
      watermarkTypes: this.watermarkTypes,
      watermarkSizes: this.watermarkSizes
    };
  }

  updateSettings(newSettings) {
    if (newSettings.interval !== undefined) {
      this.slideInterval = newSettings.interval;
    }
    if (newSettings.shuffle !== undefined || newSettings.shuffleImages !== undefined) {
      this.defaults.shuffle = newSettings.shuffle || newSettings.shuffleImages;
    }
    if (newSettings.filter !== undefined) {
      this.defaults.filter = newSettings.filter;
    }
    if (newSettings.transition !== undefined) {
      this.defaults.transition = newSettings.transition;
    }
    
    // Handle flat watermark settings
    if (newSettings.showWatermark !== undefined) {
      this.defaults.watermark.enabled = newSettings.showWatermark;
    }
    if (newSettings.watermarkText !== undefined) {
      this.defaults.watermark.text = newSettings.watermarkText;
    }
    if (newSettings.watermarkType !== undefined) {
      this.defaults.watermark.type = newSettings.watermarkType;
    }
    if (newSettings.watermarkImage !== undefined) {
      this.defaults.watermark.image = newSettings.watermarkImage;
    }
    if (newSettings.watermarkPosition !== undefined) {
      this.defaults.watermark.position = newSettings.watermarkPosition;
    }
    if (newSettings.watermarkSize !== undefined) {
      this.defaults.watermark.size = newSettings.watermarkSize;
    }
    if (newSettings.watermarkOpacity !== undefined) {
      this.defaults.watermark.opacity = newSettings.watermarkOpacity / 100;
    }
    
    // Handle nested watermark settings
    if (newSettings.watermark !== undefined) {
      this.defaults.watermark = { ...this.defaults.watermark, ...newSettings.watermark };
    }
    
    if (newSettings.backgroundColor !== undefined) {
      this.defaults.backgroundColor = newSettings.backgroundColor;
    }
    if (newSettings.transparentBackground !== undefined) {
      this.defaults.backgroundColor = newSettings.transparentBackground ? 'transparent' : '#000000';
    }
    
    // Additional settings
    if (newSettings.repeatLatest !== undefined) {
      this.defaults.repeatLatest = newSettings.repeatLatest;
    }
    if (newSettings.latestCount !== undefined) {
      this.defaults.latestCount = newSettings.latestCount;
    }
    if (newSettings.recursiveSearch !== undefined) {
      this.defaults.recursiveSearch = newSettings.recursiveSearch;
    }
    if (newSettings.excludedImages !== undefined) {
      this.defaults.excludedImages = newSettings.excludedImages;
    }
    
    return this.getSettings();
  }
}

module.exports = new Config();
