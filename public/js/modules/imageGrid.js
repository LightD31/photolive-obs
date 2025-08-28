class ImageGrid {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      zoomLevel: 2,
      sortOrder: 'desc',
      onImageClick: null,
      onImageExclude: null,
      ...options
    };
    
    this.images = [];
    this.filteredImages = [];
    this.currentSettings = {};
    
    // Delay event handler setup to ensure DOM is ready
    setTimeout(() => this.setupEventHandlers(), 0);
  }

  setupEventHandlers() {
    // Zoom controls
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const zoomLevel = parseInt(e.target.dataset.zoom);
        this.setZoomLevel(zoomLevel);
      });
    });

    // Sort controls
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sortOrder = e.target.dataset.sort;
        this.setSortOrder(sortOrder);
      });
    });
  }

  setZoomLevel(level) {
    this.options.zoomLevel = level;
    
    // Update active button
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.zoom) === level);
    });
    
    // Remove existing zoom classes
    this.container.classList.remove('zoom-small', 'zoom-normal', 'zoom-large', 'zoom-xlarge');
    
    // Add new zoom class based on level
    const zoomClasses = {
      1: 'zoom-small',
      2: 'zoom-normal', 
      3: 'zoom-large',
      4: 'zoom-xlarge'
    };
    
    if (zoomClasses[level]) {
      this.container.classList.add(zoomClasses[level]);
    }
    
    // Store zoom preference
    localStorage.setItem('photoLiveGridZoom', level.toString());
  }

  setSortOrder(order) {
    this.options.sortOrder = order;
    
    // Update active button
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === order);
    });
    
    this.sortImages();
    this.render();
  }

  updateImages(images, settings = {}) {
    this.images = images || [];
    this.currentSettings = settings;
    this.sortImages();
    this.render();
    this.updateImageCount();
  }

  sortImages() {
    this.filteredImages = [...this.images];
    
    this.filteredImages.sort((a, b) => {
      const dateA = new Date(a.photoDate || a.created);
      const dateB = new Date(b.photoDate || b.created);
      
      return this.options.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = '';

    if (this.filteredImages.length === 0) {
      this.container.innerHTML = `
        <div class="no-images">
          <span class="no-images-icon">📷</span>
          <p data-i18n="grid.no_images">No images found</p>
        </div>
      `;
      return;
    }

    this.filteredImages.forEach((image, index) => {
      const imageElement = this.createImageElement(image, index);
      this.container.appendChild(imageElement);
    });
  }

  createImageElement(image, index) {
    const div = document.createElement('div');
    div.className = 'image-item';
    
    const isExcluded = this.currentSettings.excludedImages?.includes(image.filename);
    if (isExcluded) {
      div.classList.add('excluded');
    }
    
    if (image.isNew) {
      div.classList.add('new-image');
    }

    // Create thumbnail image
    let thumbnailSrc = image.path;
    if (image.thumbnail) {
      thumbnailSrc = image.thumbnail;
    }

    div.innerHTML = `
      <div class="image-preview">
        <img src="${thumbnailSrc}" alt="${image.filename}" loading="lazy">
        <div class="image-overlay">
          <div class="image-actions">
            <button class="btn-icon exclude-btn ${isExcluded ? 'excluded' : ''}" 
                    title="${isExcluded ? 'Include in slideshow' : 'Exclude from slideshow'}" 
                    data-filename="${image.filename}">
              <span>${isExcluded ? '👁️' : '🚫'}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="image-info">
        <div class="image-name" title="${image.filename}">${this.truncateFilename(image.filename)}</div>
        <div class="image-meta">
          <span class="image-date">${this.formatDate(image.photoDate || image.created)}</span>
          <span class="image-size">${this.formatFileSize(image.size)}</span>
        </div>
      </div>
    `;

    // Add event listeners
    const excludeBtn = div.querySelector('.exclude-btn');
    const img = div.querySelector('img');

    excludeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onImageExclude) {
        this.options.onImageExclude(image.filename);
      }
    });

    div.addEventListener('click', () => {
      if (this.options.onImageClick) {
        // Find original index in unsorted array
        const originalIndex = this.images.findIndex(img => img.filename === image.filename);
        this.options.onImageClick(originalIndex, image);
      }
    });

    // Error handling for images
    img.addEventListener('error', () => {
      img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
      img.alt = 'Image not found';
    });

    return div;
  }

  updateImageCount() {
    const countElement = document.getElementById('images-grid-count');
    if (countElement) {
      const count = this.filteredImages.length;
      countElement.textContent = `${count} image${count !== 1 ? 's' : ''}`;
    }
  }

  truncateFilename(filename, maxLength = 20) {
    if (filename.length <= maxLength) return filename;
    
    const ext = filename.substring(filename.lastIndexOf('.'));
    const name = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = name.substring(0, maxLength - ext.length - 3) + '...';
    
    return truncatedName + ext;
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Unknown date';
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  highlightCurrentImage(currentIndex, scrollToImage = false) {
    // Remove previous highlights
    this.container.querySelectorAll('.image-item.current').forEach(item => {
      item.classList.remove('current');
    });

    // Highlight current image
    if (currentIndex >= 0 && currentIndex < this.filteredImages.length) {
      const currentItem = this.container.children[currentIndex];
      if (currentItem) {
        currentItem.classList.add('current');
        
        // Only scroll if explicitly requested
        if (scrollToImage) {
          currentItem.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest',
            inline: 'nearest'
          });
        }
      }
    }
  }

  getImageByFilename(filename) {
    return this.filteredImages.find(img => img.filename === filename);
  }

  getImageIndex(filename) {
    return this.filteredImages.findIndex(img => img.filename === filename);
  }
}

// Export for use in other modules
window.ImageGrid = ImageGrid;