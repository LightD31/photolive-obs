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
      this.defaults = configData.defaults;
      
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
      watermark: {
        enabled: false,
        type: 'text',
        text: 'PhotoLive',
        position: 'bottom-right',
        opacity: 0.7,
        size: 'medium',
        image: null
      },
      backgroundColor: 'transparent'
    };
    this.corsOrigins = ["http://localhost:3001", "http://127.0.0.1:3001"];
  }

  getSettings() {
    return {
      interval: this.slideInterval,
      shuffle: this.defaults.shuffle,
      filter: this.defaults.filter,
      watermark: this.defaults.watermark,
      backgroundColor: this.defaults.backgroundColor,
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
    if (newSettings.shuffle !== undefined) {
      this.defaults.shuffle = newSettings.shuffle;
    }
    if (newSettings.filter !== undefined) {
      this.defaults.filter = newSettings.filter;
    }
    if (newSettings.watermark !== undefined) {
      this.defaults.watermark = { ...this.defaults.watermark, ...newSettings.watermark };
    }
    if (newSettings.backgroundColor !== undefined) {
      this.defaults.backgroundColor = newSettings.backgroundColor;
    }
    return this.getSettings();
  }
}

module.exports = new Config();
