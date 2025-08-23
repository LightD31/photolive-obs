class PhotoLiveControl {
    constructor() {
        this.socket = null;
        this.images = [];
        this.settings = {
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
            photosPath: '', // Photos path
            transparentBackground: false
        };
        this.isPlaying = true;
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupSocket();
        this.setupEventListeners();
        this.setupCollapsibleSections();
        this.loadInitialData();
        this.updateSlideshowUrl();
        
        // Request current slideshow state
        if (this.socket) {
            this.socket.emit('get-slideshow-state');
        }
    }

    setupElements() {
        // Status elements
        this.connectionStatus = document.getElementById('connection-status');
        this.imagesCount = document.getElementById('images-count');
        
        // Preview elements
        this.currentPreviewContainer = document.getElementById('current-preview-container');
        this.currentPreviewImage = document.getElementById('current-preview-image');
        this.previewPlaceholder = this.currentPreviewContainer.querySelector('.preview-placeholder');
        this.currentImageName = document.getElementById('current-image-name');
        this.currentImageIndex = document.getElementById('current-image-index');
        
        // Control buttons
        this.prevBtn = document.getElementById('prev-btn');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.nextBtn = document.getElementById('next-btn');
        
        // Settings elements
        this.intervalSlider = document.getElementById('interval-slider');
        this.intervalValue = document.getElementById('interval-value');
        this.transitionSelect = document.getElementById('transition-select');
        this.filterSelect = document.getElementById('filter-select');
        
        // Watermark elements
        this.watermarkEnabled = document.getElementById('watermark-enabled');
        this.watermarkType = document.getElementById('watermark-type');
        this.watermarkText = document.getElementById('watermark-text');
        this.watermarkImage = document.getElementById('watermark-image');
        this.watermarkPosition = document.getElementById('watermark-position');
        this.watermarkSize = document.getElementById('watermark-size');
        this.watermarkOpacity = document.getElementById('watermark-opacity');
        this.watermarkOpacityValue = document.getElementById('watermark-opacity-value');
        
        // Watermark groups
        this.watermarkTextGroup = document.getElementById('watermark-text-group');
        this.watermarkImageGroup = document.getElementById('watermark-image-group');
        this.watermarkSizeGroup = document.getElementById('watermark-size-group');
        
        // Advanced options
        this.repeatLatest = document.getElementById('repeat-latest');
        this.latestCount = document.getElementById('latest-count');
        this.latestCountValue = document.getElementById('latest-count-value');
        this.shuffleImages = document.getElementById('shuffle-images');
        this.transparentBackground = document.getElementById('transparent-background');
        
        // Folder selection elements
        this.photosPath = document.getElementById('photos-path');
        this.changeFolderBtn = document.getElementById('change-folder-btn');
        
        // Images preview
        this.imagesPreview = document.getElementById('images-preview');
        
        // Slideshow URL
        this.slideshowUrl = document.getElementById('slideshow-url');
        
        // Current image tracking
        this.currentImageIndex = 0;
        this.currentImageData = null;
    }

    setupSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('images-updated', (data) => {
            console.log('Images updated:', data.images.length);
            this.updateImages(data.images);
            this.updateSettings(data.settings);
        });

        this.socket.on('settings-updated', (settings) => {
            console.log('Settings updated:', settings);
            this.updateSettings(settings);
        });

        this.socket.on('image-changed', (data) => {
            console.log('Image changed:', data);
            this.updateCurrentImagePreview(data);
        });

        this.socket.on('slideshow-state', (data) => {
            console.log('Slideshow state:', data);
            this.updateCurrentImagePreview(data);
            this.isPlaying = data.isPlaying;
            this.updatePlayPauseButton();
        });
    }

    setupEventListeners() {
        // Control buttons
        this.prevBtn.addEventListener('click', () => {
            this.socket.emit('prev-image');
        });

        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });

        this.nextBtn.addEventListener('click', () => {
            this.socket.emit('next-image');
        });

        // Interval slider
        this.intervalSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.intervalValue.textContent = value + 's';
            this.updateSetting('interval', value * 1000);
        });

        // Transition select
        this.transitionSelect.addEventListener('change', (e) => {
            this.updateSetting('transition', e.target.value);
        });

        // Filter select
        this.filterSelect.addEventListener('change', (e) => {
            this.updateSetting('filter', e.target.value);
        });

        // Watermark settings
        this.watermarkEnabled.addEventListener('change', (e) => {
            this.updateSetting('showWatermark', e.target.checked);
        });

        this.watermarkType.addEventListener('change', (e) => {
            this.updateSetting('watermarkType', e.target.value);
            this.toggleWatermarkInputs(e.target.value);
        });

        this.watermarkText.addEventListener('input', (e) => {
            this.updateSetting('watermarkText', e.target.value);
        });

        this.watermarkImage.addEventListener('change', (e) => {
            this.updateSetting('watermarkImage', e.target.value);
        });

        this.watermarkPosition.addEventListener('change', (e) => {
            this.updateSetting('watermarkPosition', e.target.value);
        });

        this.watermarkSize.addEventListener('change', (e) => {
            this.updateSetting('watermarkSize', e.target.value);
        });

        this.watermarkOpacity.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.watermarkOpacityValue.textContent = value + '%';
            this.updateSetting('watermarkOpacity', value);
        });

        // Advanced options
        this.repeatLatest.addEventListener('change', (e) => {
            this.updateSetting('repeatLatest', e.target.checked);
        });

        this.latestCount.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.latestCountValue.textContent = value;
            this.updateSetting('latestCount', value);
        });

        this.shuffleImages.addEventListener('change', (e) => {
            this.updateSetting('shuffleImages', e.target.checked);
        });

        this.transparentBackground.addEventListener('change', (e) => {
            this.updateSetting('transparentBackground', e.target.checked);
        });

        // Folder selection
        this.changeFolderBtn.addEventListener('click', () => {
            this.changePhotosFolder();
        });

        // Manual path input
        this.photosPath.addEventListener('input', (e) => {
            this.changeFolderBtn.disabled = !e.target.value.trim();
        });

        // Copy URL on click
        this.slideshowUrl.addEventListener('click', () => {
            this.copyToClipboard(this.slideshowUrl.textContent);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                return; // Don't trigger shortcuts when typing
            }
            
            switch(e.key) {
                case 'ArrowRight':
                case ' ':
                    e.preventDefault();
                    this.socket.emit('next-image');
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.socket.emit('prev-image');
                    break;
                case 'p':
                case 'P':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
            }
        });
    }

    async loadInitialData() {
        try {
            const response = await fetch('/api/images');
            const data = await response.json();
            
            this.updateImages(data.images);
            this.updateSettings(data.settings);
            
            // Load watermark images
            await this.loadWatermarkImages();
        } catch (error) {
            console.error('Error during initial loading:', error);
        }
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.textContent = 'Connected';
            this.connectionStatus.className = 'status-connected';
        } else {
            this.connectionStatus.textContent = 'Disconnected';
            this.connectionStatus.className = 'status-disconnected';
        }
    }

    updateImages(images) {
        this.images = images;
        this.imagesCount.textContent = `${images.length} image${images.length > 1 ? 's' : ''}`;
        this.renderImagesPreview();
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.updateUI();
    }

    updateUI() {
        // Update interval
        this.intervalSlider.value = this.settings.interval / 1000;
        this.intervalValue.textContent = this.settings.interval / 1000 + 's';
        
        // Update transition
        this.transitionSelect.value = this.settings.transition;
        
        // Update filter
        this.filterSelect.value = this.settings.filter;
        
        // Update watermark
        this.watermarkEnabled.checked = this.settings.showWatermark;
        this.watermarkType.value = this.settings.watermarkType || 'text';
        this.watermarkText.value = this.settings.watermarkText;
        this.watermarkImage.value = this.settings.watermarkImage || '';
        this.watermarkPosition.value = this.settings.watermarkPosition;
        this.watermarkSize.value = this.settings.watermarkSize || 'medium';
        this.watermarkOpacity.value = this.settings.watermarkOpacity || 80;
        this.watermarkOpacityValue.textContent = (this.settings.watermarkOpacity || 80) + '%';
        
        // Toggle watermark inputs based on type
        this.toggleWatermarkInputs(this.settings.watermarkType || 'text');
        
        // Update advanced options
        this.repeatLatest.checked = this.settings.repeatLatest;
        this.latestCount.value = this.settings.latestCount;
        this.latestCountValue.textContent = this.settings.latestCount;
        this.shuffleImages.checked = this.settings.shuffleImages;
        this.transparentBackground.checked = this.settings.transparentBackground;
        
        // Update photos path
        if (this.settings.photosPath) {
            this.photosPath.value = this.settings.photosPath;
            this.changeFolderBtn.disabled = false;
        }
    }

    updateSetting(key, value) {
        const newSettings = { ...this.settings, [key]: value };
        
        // Send to server
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ [key]: value })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Setting updated:', key, value);
        })
        .catch(error => {
            console.error('Error during update:', error);
        });
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.socket.emit('pause-slideshow');
            this.playPauseBtn.innerHTML = '▶️';
            this.isPlaying = false;
        } else {
            this.socket.emit('resume-slideshow');
            this.playPauseBtn.innerHTML = '⏸️';
            this.isPlaying = true;
        }
    }

    updatePlayPauseButton() {
        if (this.isPlaying) {
            this.playPauseBtn.innerHTML = '⏸️';
        } else {
            this.playPauseBtn.innerHTML = '▶️';
        }
    }

    updateCurrentImagePreview(data) {
        if (!data || !data.currentImage) {
            this.showPreviewPlaceholder();
            return;
        }

        const currentImage = data.currentImage;
        const currentIndex = data.currentIndex !== undefined ? data.currentIndex : 0;
        const totalImages = this.images.length;

        // Update preview image
        this.currentPreviewImage.src = currentImage.path;
        this.currentPreviewImage.style.display = 'block';
        this.previewPlaceholder.style.display = 'none';

        // Update image info
        this.currentImageName.textContent = currentImage.filename || 'Unknown';
        this.currentImageIndex.textContent = `${currentIndex + 1} / ${totalImages}`;

        // Highlight current image in grid
        this.highlightCurrentImageInGrid(currentIndex);

        // Store current image data
        this.currentImageData = currentImage;
        this.currentImageIndex = currentIndex;
    }

    showPreviewPlaceholder() {
        this.currentPreviewImage.style.display = 'none';
        this.previewPlaceholder.style.display = 'flex';
        this.currentImageName.textContent = '-';
        this.currentImageIndex.textContent = '0 / 0';
        
        // Remove highlighting from grid
        const items = this.imagesPreview.querySelectorAll('.image-item');
        items.forEach(item => item.classList.remove('current'));
    }

    highlightCurrentImageInGrid(currentIndex) {
        const items = this.imagesPreview.querySelectorAll('.image-item');
        items.forEach((item, index) => {
            if (index === currentIndex) {
                item.classList.add('current');
            } else {
                item.classList.remove('current');
            }
        });
    }

    renderImagesPreview() {
        this.imagesPreview.innerHTML = '';
        
        if (this.images.length === 0) {
            this.imagesPreview.innerHTML = `
                <div class="empty-state">
                    <h3>No images found</h3>
                    <p>Add images (JPG, PNG, GIF, BMP, TIFF) to the "photos" folder to get started.</p>
                </div>
            `;
            return;
        }

        this.images.forEach((image, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.dataset.index = index;
            
            const img = document.createElement('img');
            img.src = image.path;
            img.alt = image.filename;
            img.loading = 'lazy';
            
            const info = document.createElement('div');
            info.className = 'image-info';
            info.innerHTML = `
                <div>${image.filename}</div>
                <div>
                    ${this.formatFileSize(image.size)} • ${this.formatDate(image.modified)}
                </div>
            `;
            
            // Add click listener to jump to this image
            imageItem.addEventListener('click', () => {
                this.socket.emit('jump-to-image', index);
            });
            
            imageItem.appendChild(img);
            imageItem.appendChild(info);
            this.imagesPreview.appendChild(imageItem);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    updateSlideshowUrl() {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;
        const url = `${protocol}//${hostname}${port ? ':' + port : ''}`;
        this.slideshowUrl.textContent = url;
    }

    async changePhotosFolder() {
        const newPath = this.photosPath.value.trim();
        
        if (!newPath) {
            this.showNotification('Please enter a folder path', 'error');
            return;
        }

        try {
            this.changeFolderBtn.disabled = true;
            this.changeFolderBtn.textContent = 'Changing...';
            
            const response = await fetch('/api/photos-path', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ photosPath: newPath })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification(`Folder changed to: ${data.photosPath}`, 'success');
                // Images will be automatically updated via WebSocket
            } else {
                this.showNotification(data.error || 'Error changing folder', 'error');
            }
        } catch (error) {
            console.error('Error changing folder:', error);
            this.showNotification('Server connection error', 'error');
        } finally {
            this.changeFolderBtn.disabled = false;
            this.changeFolderBtn.textContent = '✅ Change';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Inline styles for notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '16px 24px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            fontSize: '14px',
            zIndex: '9999',
            maxWidth: '400px',
            wordWrap: 'break-word',
            backgroundColor: type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#5a67d8',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out'
        });
        
        document.body.appendChild(notification);
        
        // Entry animation
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            
            // Show feedback
            const originalText = this.slideshowUrl.textContent;
            this.slideshowUrl.textContent = 'Copied!';
            this.slideshowUrl.style.background = '#48bb78';
            this.slideshowUrl.style.color = 'white';
            
            setTimeout(() => {
                this.slideshowUrl.textContent = originalText;
                this.slideshowUrl.style.background = '#e2e8f0';
                this.slideshowUrl.style.color = '#5a67d8';
            }, 1000);
        } catch (err) {
            console.error('Error during copy:', err);
            
            // Fallback method
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.slideshowUrl.textContent = 'Copied!';
                setTimeout(() => {
                    this.updateSlideshowUrl();
                }, 1000);
            } catch (err) {
                console.error('Fallback copy failed:', err);
            }
            document.body.removeChild(textArea);
        }
    }

    toggleWatermarkInputs(type) {
        if (type === 'text') {
            this.watermarkTextGroup.classList.remove('hidden');
            this.watermarkImageGroup.classList.add('hidden');
            this.watermarkSizeGroup.classList.add('hidden');
        } else if (type === 'image') {
            this.watermarkTextGroup.classList.add('hidden');
            this.watermarkImageGroup.classList.remove('hidden');
            this.watermarkSizeGroup.classList.remove('hidden');
        }
    }

    async loadWatermarkImages() {
        try {
            const response = await fetch('/api/watermarks');
            const watermarks = await response.json();
            
            // Clear existing options
            this.watermarkImage.innerHTML = '<option value="">Select an image...</option>';
            
            // Add watermark options
            watermarks.forEach(watermark => {
                const option = document.createElement('option');
                option.value = watermark.path;
                option.textContent = watermark.name;
                this.watermarkImage.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading watermarks:', error);
        }
    }

    setupCollapsibleSections() {
        // Find all collapsible sections
        const collapsibleSections = document.querySelectorAll('.collapsible');
        
        collapsibleSections.forEach(section => {
            const header = section.querySelector('.collapsible-header');
            const content = section.querySelector('.collapsible-content');
            const icon = header.querySelector('.collapse-icon');
            
            if (header && content) {
                header.addEventListener('click', () => {
                    const isCollapsed = section.classList.contains('collapsed');
                    
                    if (isCollapsed) {
                        section.classList.remove('collapsed');
                        content.style.maxHeight = content.scrollHeight + 'px';
                        if (icon) icon.textContent = '−';
                    } else {
                        section.classList.add('collapsed');
                        content.style.maxHeight = '0px';
                        if (icon) icon.textContent = '+';
                    }
                });
                
                // Set initial state
                if (section.classList.contains('collapsed')) {
                    content.style.maxHeight = '0px';
                    if (icon) icon.textContent = '+';
                } else {
                    content.style.maxHeight = content.scrollHeight + 'px';
                    if (icon) icon.textContent = '−';
                }
            }
        });
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    window.control = new PhotoLiveControl();
});

// Auto-refresh preview every 30 seconds
setInterval(() => {
    if (window.control && window.control.socket && window.control.socket.connected) {
        window.control.loadInitialData();
    }
}, 30000);
