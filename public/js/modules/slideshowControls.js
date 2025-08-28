class SlideshowControls {
  constructor(socketClient, options = {}) {
    this.socket = socketClient;
    this.options = {
      onStateChange: null,
      ...options
    };
    
    this.isPlaying = true;
    this.currentImage = null;
    this.nextImage = null;
    this.currentIndex = 0;
    this.totalImages = 0;
    
    this.setupElements();
    this.setupEventHandlers();
    this.setupKeyboardShortcuts();
  }

  setupElements() {
    this.playPauseBtn = document.getElementById('play-pause-btn');
    this.prevBtn = document.getElementById('prev-btn');
    this.nextBtn = document.getElementById('next-btn');
    this.intervalSlider = document.getElementById('interval-slider');
    this.intervalValue = document.getElementById('interval-value');
    
    // Preview elements
    this.currentPreviewImage = document.getElementById('current-preview-image');
    this.currentPreviewContainer = document.getElementById('current-preview-container');
    this.currentImageName = document.getElementById('current-image-name');
    this.currentImageIndex = document.getElementById('current-image-index');
    
    this.nextPreviewImage = document.getElementById('next-preview-image');
    this.nextPreviewContainer = document.getElementById('next-preview-container');
    this.nextImageName = document.getElementById('next-image-name');
    this.nextImageIndex = document.getElementById('next-image-index');
  }

  setupEventHandlers() {
    // Control buttons
    if (this.playPauseBtn) {
      this.playPauseBtn.addEventListener('click', () => {
        this.togglePlayPause();
      });
    }

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        this.previousImage();
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        this.goToNextImage();
      });
    }

    // Interval slider
    if (this.intervalSlider) {
      this.intervalSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        this.updateInterval(value);
      });
    }

    // Socket events
    this.socket.on('slideshow-state', (data) => {
      this.updateState(data);
    });

    this.socket.on('image-changed', (data) => {
      this.updateState(data);
    });

    this.socket.on('pause-slideshow', () => {
      this.isPlaying = false;
      this.updatePlayPauseButton();
    });

    this.socket.on('resume-slideshow', () => {
      this.isPlaying = true;
      this.updatePlayPauseButton();
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          this.goToNextImage();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.previousImage();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          this.togglePlayPause();
          break;
      }
    });
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  pause() {
    this.isPlaying = false;
    this.updatePlayPauseButton();
    this.socket.send('pause-slideshow');
  }

  resume() {
    this.isPlaying = true;
    this.updatePlayPauseButton();
    this.socket.send('resume-slideshow');
  }

  goToNextImage() {
    this.socket.send('next-image');
  }

  previousImage() {
    this.socket.send('prev-image');
  }

  jumpToImage(index) {
    this.socket.send('jump-to-image', index);
  }

  updateInterval(seconds) {
    const milliseconds = seconds * 1000;
    
    if (this.intervalValue) {
      this.intervalValue.textContent = `${seconds}s`;
    }
    
    // Send to server
    fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ interval: milliseconds })
    }).catch(error => {
      console.error('Error updating interval:', error);
    });
  }

  updateState(data) {
    this.isPlaying = data.isPlaying;
    this.currentImage = data.currentImage;
    this.nextImage = data.nextImage;
    this.currentIndex = data.currentIndex;
    this.totalImages = data.totalImages;
    this.originalIndex = data.originalIndex;
    this.nextOriginalIndex = data.nextOriginalIndex;
    this.totalOriginalImages = data.totalOriginalImages;
    
    this.updatePlayPauseButton();
    this.updatePreviews();
    this.updateImageInfo();
    
    if (this.options.onStateChange) {
      this.options.onStateChange(data);
    }
  }

  updatePlayPauseButton() {
    if (this.playPauseBtn) {
      this.playPauseBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
      this.playPauseBtn.title = this.isPlaying ? 'Pause slideshow' : 'Resume slideshow';
    }
  }

  updatePreviews() {
    // Update current image preview
    if (this.currentImage) {
      if (this.currentPreviewImage) {
        this.currentPreviewImage.src = this.currentImage.path;
        this.currentPreviewImage.style.display = 'block';
      }
      if (this.currentPreviewContainer) {
        this.currentPreviewContainer.querySelector('.preview-placeholder').style.display = 'none';
      }
    } else {
      if (this.currentPreviewImage) {
        this.currentPreviewImage.style.display = 'none';
      }
      if (this.currentPreviewContainer) {
        this.currentPreviewContainer.querySelector('.preview-placeholder').style.display = 'flex';
      }
    }

    // Update next image preview
    if (this.nextImage) {
      if (this.nextPreviewImage) {
        this.nextPreviewImage.src = this.nextImage.path;
        this.nextPreviewImage.style.display = 'block';
      }
      if (this.nextPreviewContainer) {
        this.nextPreviewContainer.querySelector('.preview-placeholder').style.display = 'none';
      }
    } else {
      if (this.nextPreviewImage) {
        this.nextPreviewImage.style.display = 'none';
      }
      if (this.nextPreviewContainer) {
        this.nextPreviewContainer.querySelector('.preview-placeholder').style.display = 'flex';
      }
    }
  }

  updateImageInfo() {
    // Current image info
    if (this.currentImageName) {
      this.currentImageName.textContent = this.currentImage ? 
        this.truncateFilename(this.currentImage.filename, 25) : '-';
    }
    
    if (this.currentImageIndex) {
      // Use original index (chronological order) instead of shuffled index
      const currentOriginalIndex = this.originalIndex !== undefined && this.originalIndex >= 0 ? 
        this.originalIndex + 1 : 0;
      const totalOriginal = this.totalOriginalImages || this.totalImages;
      this.currentImageIndex.textContent = totalOriginal > 0 ? 
        `${currentOriginalIndex} / ${totalOriginal}` : '0 / 0';
    }

    // Next image info
    if (this.nextImageName) {
      this.nextImageName.textContent = this.nextImage ? 
        this.truncateFilename(this.nextImage.filename, 25) : '-';
    }
    
    if (this.nextImageIndex) {
      // Use next original index (chronological order) instead of shuffled index
      const nextOriginalIndex = this.nextOriginalIndex !== undefined && this.nextOriginalIndex >= 0 ? 
        this.nextOriginalIndex + 1 : 0;
      const totalOriginal = this.totalOriginalImages || this.totalImages;
      this.nextImageIndex.textContent = totalOriginal > 0 ? 
        `${nextOriginalIndex} / ${totalOriginal}` : '0 / 0';
    }
  }

  truncateFilename(filename, maxLength = 20) {
    if (filename.length <= maxLength) return filename;
    
    const ext = filename.substring(filename.lastIndexOf('.'));
    const name = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = name.substring(0, maxLength - ext.length - 3) + '...';
    
    return truncatedName + ext;
  }

  setInterval(seconds) {
    if (this.intervalSlider) {
      this.intervalSlider.value = seconds;
    }
    if (this.intervalValue) {
      this.intervalValue.textContent = `${seconds}s`;
    }
  }

  getCurrentImage() {
    return this.currentImage;
  }

  getNextImage() {
    return this.nextImage;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  getTotalImages() {
    return this.totalImages;
  }

  isCurrentlyPlaying() {
    return this.isPlaying;
  }
}

// Export for use in other modules
window.SlideshowControls = SlideshowControls;