const path = require('path');
const fs = require('fs');

class ConfigManager {
  constructor() {
    this.config = null;
    this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '..', '..', 'config', 'default.json');
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      this.config = {
        port: process.env.PORT || configData.server.port,
        logLevel: process.env.LOG_LEVEL || configData.server.logLevel || 'INFO',
        photosPath: path.resolve(__dirname, '..', '..', configData.server.photosPath),
        publicPath: path.join(__dirname, '..', '..', 'public'),
        slideInterval: configData.slideshow.interval,
        supportedFormats: configData.slideshow.supportedFormats,
        filters: configData.features.filters,
        transitions: configData.features.transitions,
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
      console.warn('Unable to load config/default.json, using fallback configuration:', error.message);
      this.config = this.getFallbackConfig();
    }
  }

  getFallbackConfig() {
    return {
      port: process.env.PORT || 3001,
      logLevel: process.env.LOG_LEVEL || 'INFO',
      photosPath: path.join(__dirname, '..', '..', 'photos'),
      publicPath: path.join(__dirname, '..', '..', 'public'),
      slideInterval: 5000,
      supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'],
      filters: [
        { id: 'none', name: 'None' },
        { id: 'sepia', name: 'Sepia' },
        { id: 'grayscale', name: 'Black & White' }
      ],
      transitions: [
        { id: 'none', name: 'None', duration: 0 },
        { id: 'fade', name: 'Fade', duration: 1000 }
      ],
      watermarkPositions: [
        { id: 'bottom-right', name: 'Bottom Right' }
      ],
      watermarkTypes: [
        { id: 'text', name: 'Text' }
      ],
      watermarkSizes: [
        { id: 'medium', name: 'Medium', scale: 1.0 }
      ],
      defaults: {
        interval: 5000,
        filter: 'none',
        transition: 'none',
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
        excludedImages: [],
        language: 'en',
        recursiveSearch: false
      }
    };
  }

  get(key) {
    return key ? this.config[key] : this.config;
  }

  getDefaults() {
    return this.config.defaults;
  }

  reload() {
    this.loadConfig();
  }
}

module.exports = new ConfigManager();