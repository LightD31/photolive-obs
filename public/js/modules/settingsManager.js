class SettingsManager {
  constructor(socketClient, options = {}) {
    this.socket = socketClient;
    this.options = {
      onSettingsChange: null,
      ...options
    };
    
    this.currentSettings = {};
    this.setupElements();
    this.setupEventHandlers();
  }

  setupElements() {
    // Filter and transition controls
    this.filterSelect = document.getElementById('filter-select');
    this.transitionSelect = document.getElementById('transition-select');
    this.transitionDurationSlider = document.getElementById('transition-duration-slider');
    this.transitionDurationValue = document.getElementById('transition-duration-value');
    
    // Checkbox controls
    this.shuffleImagesCheckbox = document.getElementById('shuffle-images');
    this.transparentBackgroundCheckbox = document.getElementById('transparent-background');
    this.recursiveSearchCheckbox = document.getElementById('recursive-search');
    this.repeatLatestCheckbox = document.getElementById('repeat-latest');
    
    // Slider controls
    this.latestCountSlider = document.getElementById('latest-count');
    this.latestCountValue = document.getElementById('latest-count-value');
    this.latestCountContainer = document.getElementById('latest-count-container');
    
    // Watermark controls
    this.watermarkEnabledCheckbox = document.getElementById('watermark-enabled');
    this.watermarkTypeSelect = document.getElementById('watermark-type');
    this.watermarkTextInput = document.getElementById('watermark-text');
    this.watermarkPositionSelect = document.getElementById('watermark-position');
    this.watermarkSizeSelect = document.getElementById('watermark-size');
    this.watermarkOpacitySlider = document.getElementById('watermark-opacity');
    this.watermarkOpacityValue = document.getElementById('watermark-opacity-value');
    
    // Watermark file upload
    this.watermarkFileInput = document.getElementById('watermark-file');
    this.watermarkBrowseBtn = document.getElementById('watermark-browse-btn');
    this.watermarkFileName = document.getElementById('watermark-file-name');
    this.watermarkTextGroup = document.getElementById('watermark-text-group');
    this.watermarkImageGroup = document.getElementById('watermark-image-group');
    
    // Folder controls
    this.photosPathInput = document.getElementById('photos-path');
    this.changeFolderBtn = document.getElementById('change-folder-btn');
    this.rescanFolderBtn = document.getElementById('rescan-folder-btn');

    // FTP controls
    this.ftpEnabledCheckbox = document.getElementById('ftp-enabled');
    this.ftpPortInput = document.getElementById('ftp-port');
    this.ftpUsernameInput = document.getElementById('ftp-username');
    this.ftpPasswordInput = document.getElementById('ftp-password');
    this.ftpStatusBadge = document.getElementById('ftp-status-badge');
    this.ftpDetails = document.getElementById('ftp-details');
    this.ftpConnectionInfo = document.getElementById('ftp-connection-info');
    this.ftpAddress = document.getElementById('ftp-address');
    this.ftpConnections = document.getElementById('ftp-connections');
    this.ftpTotalUploads = document.getElementById('ftp-total-uploads');
  }

  setupEventHandlers() {
    // Filter and transition
    if (this.filterSelect) {
      this.filterSelect.addEventListener('change', (e) => {
        this.updateSetting('filter', e.target.value);
      });
    }

    if (this.transitionSelect) {
      this.transitionSelect.addEventListener('change', (e) => {
        this.updateSetting('transition', e.target.value);
      });
    }

    // Transition duration slider
    if (this.transitionDurationSlider) {
      this.transitionDurationSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (this.transitionDurationValue) {
          this.transitionDurationValue.textContent = (value / 1000).toFixed(1) + 's';
        }
        this.updateSetting('transitionDuration', value);
      });
    }

    // Checkboxes
    if (this.shuffleImagesCheckbox) {
      this.shuffleImagesCheckbox.addEventListener('change', (e) => {
        this.updateSetting('shuffleImages', e.target.checked);
      });
    }

    if (this.transparentBackgroundCheckbox) {
      this.transparentBackgroundCheckbox.addEventListener('change', (e) => {
        this.updateSetting('transparentBackground', e.target.checked);
      });
    }

    if (this.recursiveSearchCheckbox) {
      this.recursiveSearchCheckbox.addEventListener('change', (e) => {
        this.updateSetting('recursiveSearch', e.target.checked);
      });
    }

    if (this.repeatLatestCheckbox) {
      this.repeatLatestCheckbox.addEventListener('change', (e) => {
        this.updateSetting('repeatLatest', e.target.checked);
        this.updateLatestCountVisibility(e.target.checked);
      });
    }

    // Latest count slider
    if (this.latestCountSlider) {
      this.latestCountSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (this.latestCountValue) {
          this.latestCountValue.textContent = value;
        }
        this.updateSetting('latestCount', value);
      });
    }

    // Watermark controls
    if (this.watermarkEnabledCheckbox) {
      this.watermarkEnabledCheckbox.addEventListener('change', (e) => {
        this.updateSetting('showWatermark', e.target.checked);
      });
    }

    if (this.watermarkTypeSelect) {
      this.watermarkTypeSelect.addEventListener('change', (e) => {
        this.updateSetting('watermarkType', e.target.value);
        this.updateWatermarkTypeVisibility(e.target.value);
      });
    }

    if (this.watermarkTextInput) {
      this.watermarkTextInput.addEventListener('input', (e) => {
        this.updateSetting('watermarkText', e.target.value);
      });
    }

    if (this.watermarkPositionSelect) {
      this.watermarkPositionSelect.addEventListener('change', (e) => {
        this.updateSetting('watermarkPosition', e.target.value);
      });
    }

    if (this.watermarkSizeSelect) {
      this.watermarkSizeSelect.addEventListener('change', (e) => {
        this.updateSetting('watermarkSize', e.target.value);
      });
    }

    if (this.watermarkOpacitySlider) {
      this.watermarkOpacitySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (this.watermarkOpacityValue) {
          this.watermarkOpacityValue.textContent = `${value}%`;
        }
        this.updateSetting('watermarkOpacity', value);
      });
    }

    // Watermark file upload
    if (this.watermarkBrowseBtn && this.watermarkFileInput) {
      this.watermarkBrowseBtn.addEventListener('click', () => {
        this.watermarkFileInput.click();
      });

      this.watermarkFileInput.addEventListener('change', (e) => {
        this.handleWatermarkFileUpload(e.target.files[0]);
      });
    }

    // Folder controls
    if (this.changeFolderBtn) {
      this.changeFolderBtn.addEventListener('click', () => {
        this.changePhotosFolder();
      });
    }

    if (this.rescanFolderBtn) {
      this.rescanFolderBtn.addEventListener('click', () => {
        this.rescanFolder();
      });
    }

    // Socket events
    this.socket.on('settings-updated', (settings) => {
      this.updateUI(settings);
    });

    // FTP status events
    this.socket.on('ftp-status', (status) => {
      this.updateFtpStatusUI(status);
    });

    // FTP controls
    if (this.ftpEnabledCheckbox) {
      this.ftpEnabledCheckbox.addEventListener('change', (e) => {
        this.updateFtpSetting({ enabled: e.target.checked });
      });
    }

    if (this.ftpPortInput) {
      this.ftpPortInput.addEventListener('change', (e) => {
        const port = parseInt(e.target.value);
        if (port >= 1 && port <= 65535) {
          this.updateFtpSetting({ port });
        }
      });
    }

    if (this.ftpUsernameInput) {
      this.ftpUsernameInput.addEventListener('change', (e) => {
        const username = e.target.value.trim();
        if (username) {
          this.updateFtpSetting({ username });
        }
      });
    }

    if (this.ftpPasswordInput) {
      this.ftpPasswordInput.addEventListener('change', (e) => {
        const password = e.target.value.trim();
        if (password) {
          this.updateFtpSetting({ password });
        }
      });
    }
  }

  updateSetting(key, value) {
    const settings = { [key]: value };
    
    fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(data => {
      this.currentSettings = data;
      if (this.options.onSettingsChange) {
        this.options.onSettingsChange(data);
      }
    })
    .catch(error => {
      console.error('Error updating setting:', error);
    });
  }

  updateUI(settings) {
    this.currentSettings = settings;

    // Update filter select
    if (this.filterSelect && settings.filter) {
      this.filterSelect.value = settings.filter;
    }

    // Update transition select
    if (this.transitionSelect && settings.transition) {
      this.transitionSelect.value = settings.transition;
    }

    // Update transition duration slider
    if (this.transitionDurationSlider && settings.transitionDuration !== undefined) {
      this.transitionDurationSlider.value = settings.transitionDuration;
      if (this.transitionDurationValue) {
        this.transitionDurationValue.textContent = (settings.transitionDuration / 1000).toFixed(1) + 's';
      }
    }

    // Update checkboxes
    if (this.shuffleImagesCheckbox) {
      this.shuffleImagesCheckbox.checked = settings.shuffleImages || false;
    }

    if (this.transparentBackgroundCheckbox) {
      this.transparentBackgroundCheckbox.checked = settings.transparentBackground || false;
    }

    if (this.recursiveSearchCheckbox) {
      this.recursiveSearchCheckbox.checked = settings.recursiveSearch || false;
    }

    if (this.repeatLatestCheckbox) {
      this.repeatLatestCheckbox.checked = settings.repeatLatest || false;
      this.updateLatestCountVisibility(settings.repeatLatest || false);
    }

    // Update latest count slider
    if (this.latestCountSlider && settings.latestCount) {
      this.latestCountSlider.value = settings.latestCount;
      if (this.latestCountValue) {
        this.latestCountValue.textContent = settings.latestCount;
      }
    }

    // Update watermark controls
    if (this.watermarkEnabledCheckbox) {
      this.watermarkEnabledCheckbox.checked = settings.showWatermark || false;
    }

    if (this.watermarkTypeSelect && settings.watermarkType) {
      this.watermarkTypeSelect.value = settings.watermarkType;
      this.updateWatermarkTypeVisibility(settings.watermarkType);
    }

    if (this.watermarkTextInput && settings.watermarkText) {
      this.watermarkTextInput.value = settings.watermarkText;
    }

    if (this.watermarkPositionSelect && settings.watermarkPosition) {
      this.watermarkPositionSelect.value = settings.watermarkPosition;
    }

    if (this.watermarkSizeSelect && settings.watermarkSize) {
      this.watermarkSizeSelect.value = settings.watermarkSize;
    }

    if (this.watermarkOpacitySlider && settings.watermarkOpacity) {
      this.watermarkOpacitySlider.value = settings.watermarkOpacity;
      if (this.watermarkOpacityValue) {
        this.watermarkOpacityValue.textContent = `${settings.watermarkOpacity}%`;
      }
    }

    // Update photos path
    if (this.photosPathInput && settings.photosPath) {
      this.photosPathInput.value = settings.photosPath;
    }
  }

  updateLatestCountVisibility(show) {
    if (this.latestCountContainer) {
      this.latestCountContainer.style.display = show ? 'flex' : 'none';
    }
  }

  updateWatermarkTypeVisibility(type) {
    if (this.watermarkTextGroup) {
      this.watermarkTextGroup.style.display = type === 'text' ? 'flex' : 'none';
    }
    if (this.watermarkImageGroup) {
      this.watermarkImageGroup.classList.toggle('hidden', type !== 'image');
    }
  }

  async handleWatermarkFileUpload(file) {
    if (!file) return;

    const formData = new FormData();
    formData.append('watermark', file);

    try {
      const response = await fetch('/api/watermark-upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        if (this.watermarkFileName) {
          this.watermarkFileName.textContent = result.originalName;
        }
        
        // Update watermark image setting
        this.updateSetting('watermarkImage', result.filePath);
        
        console.log('Watermark uploaded successfully:', result.filePath);
      } else {
        console.error('Watermark upload failed:', result.error);
        alert('Failed to upload watermark: ' + result.error);
      }
    } catch (error) {
      console.error('Error uploading watermark:', error);
      alert('Error uploading watermark');
    }
  }

  changePhotosFolder() {
    const newPath = this.photosPathInput?.value?.trim();
    if (!newPath) {
      alert('Please enter a folder path');
      return;
    }

    fetch('/api/photos-path', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ photosPath: newPath })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('Photos folder changed successfully');
      } else {
        alert('Error changing folder: ' + data.error);
      }
    })
    .catch(error => {
      console.error('Error changing folder:', error);
      alert('Error changing folder');
    });
  }

  rescanFolder() {
    this.socket.send('rescan-images');
  }

  // ==================== FTP Settings ====================

  updateFtpSetting(settings) {
    fetch('/api/ftp/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('FTP settings updated');
        // Refresh status
        this.fetchFtpStatus();
      } else {
        console.error('FTP settings update failed:', data.error);
      }
    })
    .catch(error => {
      console.error('Error updating FTP settings:', error);
    });
  }

  fetchFtpStatus() {
    fetch('/api/ftp/status')
      .then(response => response.json())
      .then(status => {
        this.updateFtpStatusUI(status);
      })
      .catch(error => {
        console.error('Error fetching FTP status:', error);
      });
  }

  fetchFtpSettings() {
    fetch('/api/ftp/settings')
      .then(response => response.json())
      .then(settings => {
        this.updateFtpSettingsUI(settings);
      })
      .catch(error => {
        console.error('Error fetching FTP settings:', error);
      });
  }

  updateFtpSettingsUI(settings) {
    if (this.ftpEnabledCheckbox) {
      this.ftpEnabledCheckbox.checked = settings.enabled || false;
    }
    if (this.ftpPortInput && settings.port) {
      this.ftpPortInput.value = settings.port;
    }
    if (this.ftpUsernameInput && settings.username) {
      this.ftpUsernameInput.value = settings.username;
    }
    if (this.ftpPasswordInput && settings.password) {
      this.ftpPasswordInput.value = settings.password;
    }
  }

  updateFtpStatusUI(status) {
    if (this.ftpStatusBadge) {
      if (status.running) {
        this.ftpStatusBadge.className = 'status-badge status-running';
        this.ftpStatusBadge.setAttribute('data-i18n', 'ftp.status_running');
        this.ftpStatusBadge.textContent = window.i18n?.t('ftp.status_running') || 'Running';
      } else {
        this.ftpStatusBadge.className = 'status-badge status-stopped';
        this.ftpStatusBadge.setAttribute('data-i18n', 'ftp.status_stopped');
        this.ftpStatusBadge.textContent = window.i18n?.t('ftp.status_stopped') || 'Stopped';
      }
    }

    if (this.ftpEnabledCheckbox) {
      this.ftpEnabledCheckbox.checked = status.enabled || false;
    }

    if (this.ftpConnectionInfo) {
      this.ftpConnectionInfo.style.display = status.running ? 'block' : 'none';
    }

    if (this.ftpAddress && status.port) {
      this.ftpAddress.textContent = `ftp://localhost:${status.port}`;
    }

    if (this.ftpConnections) {
      this.ftpConnections.textContent = status.connections || 0;
    }

    if (this.ftpTotalUploads) {
      this.ftpTotalUploads.textContent = status.totalUploads || 0;
    }
  }

  initializeFtp() {
    this.fetchFtpSettings();
    this.fetchFtpStatus();
  }

  getSettings() {
    return this.currentSettings;
  }

  getSetting(key) {
    return this.currentSettings[key];
  }
}

// Export for use in other modules
window.SettingsManager = SettingsManager;