class PhotoLiveControl {
    constructor() {
        this.socket = null;
        this.images = [];
        this.settings = {
            interval: 5000,
            transition: 'none',
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
            transparentBackground: false,
            excludedImages: []
        };
        this.isPlaying = true;
        
        // Performance tracking
        this.loadingData = false;
        this.dataLoaded = false;
        this.settingUpdateInProgress = false;
        this.updateTimeout = null;
        this.lastUserInteraction = Date.now();
        
        // Grid performance optimizations
        this.isRenderingGrid = false;
        this.pendingGridUpdate = false;
        this.lastImageListHash = null;
        this.sortedImagesCache = null;
        
        this.init();
    }

    async init() {
        // Initialize i18n first
        await this.initializeI18n();
        
        this.setupElements();
        this.setupSocket();
        this.setupEventListeners();
        this.setupCollapsibleSections();
        this.loadInitialData();
        this.updateSlideshowUrl();
        this.initializeGridZoom();
        this.setupGridEventDelegation();
        
        // Request current slideshow state
        if (this.socket) {
            this.socket.emit('get-slideshow-state');
        }
    }

    async initializeI18n() {
        try {
            // Get saved language preference from settings or localStorage
            const savedLanguage = this.settings.language || localStorage.getItem('photolive-language');
            await window.i18n.init(savedLanguage);
            
            // Update language selector
            const languageSelect = document.getElementById('language-select');
            if (languageSelect) {
                languageSelect.value = window.i18n.getCurrentLanguage();
            }
            
            // Listen for language changes
            document.addEventListener('languageChanged', (event) => {
                this.onLanguageChanged(event.detail.language);
            });
            
        } catch (error) {
            console.error('Failed to initialize i18n:', error);
        }
    }

    onLanguageChanged(language) {
        // Update the settings to save language preference
        this.updateSetting('language', language);
        
        // Update dropdowns with translated values
        this.updateDropdownTranslations();
        
        // Update status text
        this.updateImagesCount();
    }

    updateDropdownTranslations() {
        // Update filter dropdown
        const filterSelect = document.getElementById('filter-select');
        if (filterSelect) {
            const currentValue = filterSelect.value;
            filterSelect.innerHTML = `
                <option value="none" data-i18n="filters.none">None</option>
                <option value="sepia" data-i18n="filters.sepia">Sepia</option>
                <option value="grayscale" data-i18n="filters.grayscale">B&W</option>
                <option value="blur" data-i18n="filters.blur">Blur</option>
                <option value="brightness" data-i18n="filters.brightness">Bright</option>
                <option value="contrast" data-i18n="filters.contrast">Contrast</option>
                <option value="vintage" data-i18n="filters.vintage">Vintage</option>
                <option value="cool" data-i18n="filters.cool">Cool</option>
                <option value="warm" data-i18n="filters.warm">Warm</option>
            `;
            filterSelect.value = currentValue;
            
            // Translate options
            filterSelect.querySelectorAll('[data-i18n]').forEach(option => {
                const key = option.getAttribute('data-i18n');
                option.textContent = window.i18n.t(key);
            });
        }

        // Update transition dropdown
        const transitionSelect = document.getElementById('transition-select');
        if (transitionSelect) {
            const currentValue = transitionSelect.value;
            transitionSelect.innerHTML = `
                <option value="none" data-i18n="transitions.none">None</option>
                <option value="fade" data-i18n="transitions.fade">Fade</option>
                <option value="slide" data-i18n="transitions.slide">Slide</option>
                <option value="zoom" data-i18n="transitions.zoom">Zoom</option>
            `;
            transitionSelect.value = currentValue;
            
            // Translate options
            transitionSelect.querySelectorAll('[data-i18n]').forEach(option => {
                const key = option.getAttribute('data-i18n');
                option.textContent = window.i18n.t(key);
            });
        }

        // Update watermark position dropdown
        const watermarkPosition = document.getElementById('watermark-position');
        if (watermarkPosition) {
            const currentValue = watermarkPosition.value;
            watermarkPosition.innerHTML = `
                <option value="top-left" data-i18n="watermark.positions.top-left">Top Left</option>
                <option value="top-right" data-i18n="watermark.positions.top-right">Top Right</option>
                <option value="bottom-left" data-i18n="watermark.positions.bottom-left">Bottom Left</option>
                <option value="bottom-right" data-i18n="watermark.positions.bottom-right">Bottom Right</option>
                <option value="center" data-i18n="watermark.positions.center">Center</option>
            `;
            watermarkPosition.value = currentValue;
            
            // Translate options
            watermarkPosition.querySelectorAll('[data-i18n]').forEach(option => {
                const key = option.getAttribute('data-i18n');
                option.textContent = window.i18n.t(key);
            });
        }

        // Update watermark size dropdown
        const watermarkSize = document.getElementById('watermark-size');
        if (watermarkSize) {
            const currentValue = watermarkSize.value;
            watermarkSize.innerHTML = `
                <option value="small" data-i18n="watermark.sizes.small">Small</option>
                <option value="medium" data-i18n="watermark.sizes.medium">Medium</option>
                <option value="large" data-i18n="watermark.sizes.large">Large</option>
                <option value="xlarge" data-i18n="watermark.sizes.xlarge">XL</option>
            `;
            watermarkSize.value = currentValue;
            
            // Translate options
            watermarkSize.querySelectorAll('[data-i18n]').forEach(option => {
                const key = option.getAttribute('data-i18n');
                option.textContent = window.i18n.t(key);
            });
        }

        // Update watermark type dropdown
        const watermarkType = document.getElementById('watermark-type');
        if (watermarkType) {
            const currentValue = watermarkType.value;
            watermarkType.innerHTML = `
                <option value="text" data-i18n="watermark.types.text">Text</option>
                <option value="image" data-i18n="watermark.types.image">Image</option>
            `;
            watermarkType.value = currentValue;
            
            // Translate options
            watermarkType.querySelectorAll('[data-i18n]').forEach(option => {
                const key = option.getAttribute('data-i18n');
                option.textContent = window.i18n.t(key);
            });
        }
    }

    // Generate a hash for the images array to detect changes
    generateImageListHash(images) {
        return images.map(img => {
            const isExcluded = this.settings.excludedImages && this.settings.excludedImages.includes(img.filename);
            return `${img.path}-${img.modified}-${isExcluded}`;
        }).join('|');
    }

    // Setup event delegation for grid clicks to improve performance
    setupGridEventDelegation() {
        this.imagesPreview.addEventListener('click', (e) => {
            const imageItem = e.target.closest('.image-item');
            if (imageItem && imageItem.dataset.index) {
                const originalIndex = parseInt(imageItem.dataset.index);
                this.socket.emit('jump-to-image', originalIndex);
            }
        });
    }

    setupElements() {
        // Status elements
        this.connectionStatus = document.getElementById('connection-status');
        this.imagesCount = document.getElementById('images-count');
        this.imagesGridCount = document.getElementById('images-grid-count');
        
        // Preview elements
        this.currentPreviewContainer = document.getElementById('current-preview-container');
        this.currentPreviewImage = document.getElementById('current-preview-image');
        this.previewPlaceholder = this.currentPreviewContainer.querySelector('.preview-placeholder');
        this.currentImageName = document.getElementById('current-image-name');
        this.currentImageIndexElement = document.getElementById('current-image-index');
        
        // Next preview elements
        this.nextPreviewContainer = document.getElementById('next-preview-container');
        this.nextPreviewImage = document.getElementById('next-preview-image');
        this.nextPreviewPlaceholder = this.nextPreviewContainer.querySelector('.preview-placeholder');
        this.nextImageName = document.getElementById('next-image-name');
        this.nextImageIndexElement = document.getElementById('next-image-index');
        
        // Control buttons
        this.prevBtn = document.getElementById('prev-btn');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.nextBtn = document.getElementById('next-btn');
        
        // Settings elements
        this.intervalSlider = document.getElementById('interval-slider');
        this.intervalValue = document.getElementById('interval-value');

        this.filterSelect = document.getElementById('filter-select');
        this.transitionSelect = document.getElementById('transition-select');
        
        // Watermark elements
        this.watermarkEnabled = document.getElementById('watermark-enabled');
        this.watermarkType = document.getElementById('watermark-type');
        this.watermarkText = document.getElementById('watermark-text');
        this.watermarkFile = document.getElementById('watermark-file');
        this.watermarkBrowseBtn = document.getElementById('watermark-browse-btn');
        this.watermarkFileName = document.getElementById('watermark-file-name');
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
        this.latestCountContainer = document.getElementById('latest-count-container');
        this.shuffleImages = document.getElementById('shuffle-images');
        this.transparentBackground = document.getElementById('transparent-background');
        
        // Grid zoom control buttons
        this.zoomButtons = document.querySelectorAll('.zoom-btn');
        
        // Folder selection elements
        this.photosPath = document.getElementById('photos-path');
        this.changeFolderBtn = document.getElementById('change-folder-btn');
        this.browseFolderBtn = document.getElementById('browse-folder-btn');
        
        // Images preview
        this.imagesPreview = document.getElementById('images-preview');
        
        // Slideshow URL
        this.slideshowUrl = document.getElementById('slideshow-url');
        
        // Current image tracking
        this.currentImageIndex = 0;
        this.currentImageData = null;
    }

    setupSocket() {
        this.socket = io({
            transports: ['websocket'], // Force WebSocket transport
            timeout: 5000,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
            this.requestInitialData();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.updateConnectionStatus(false);
        });

        this.socket.on('images-updated', (data) => {
            console.log('Images updated:', data.allImages ? data.allImages.length : data.images.length);
            // Use allImages for grid display, images for slideshow count
            this.handleImagesUpdate(data.allImages || data.images, data.settings);
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
        // Language selector
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.addEventListener('change', async (e) => {
                await window.i18n.setLanguage(e.target.value);
            });
        }

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



        // Filter select
        this.filterSelect.addEventListener('change', (e) => {
            this.updateSetting('filter', e.target.value);
        });

        // Transition select
        this.transitionSelect.addEventListener('change', (e) => {
            this.updateSetting('transition', e.target.value);
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

        // Watermark file input
        this.watermarkBrowseBtn.addEventListener('click', () => {
            this.watermarkFile.click();
        });

        this.watermarkFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleWatermarkFileSelection(e.target.files[0]);
            }
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
            this.toggleLatestCountContainer(e.target.checked);
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

        // Grid zoom control buttons
        this.zoomButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const zoomLevel = parseInt(e.target.dataset.zoom);
                this.updateGridZoom(zoomLevel);
            });
        });

        // Folder selection
        this.changeFolderBtn.addEventListener('click', () => {
            this.changePhotosFolder();
        });

        // Native folder browser (Electron)
        if (this.browseFolderBtn) {
            this.browseFolderBtn.addEventListener('click', () => {
                this.openNativeFolderDialog();
            });
        }

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
            // Prevent multiple simultaneous requests
            if (this.loadingData) {
                return;
            }
            this.loadingData = true;

            const response = await fetch('/api/images');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            this.handleImagesUpdate(data.allImages || data.images, data.settings);
        } catch (error) {
            console.error('Error during initial loading:', error);
            this.showNotification('Failed to load data from server', 'error');
        } finally {
            this.loadingData = false;
        }
    }

    // New method to request initial data from server
    requestInitialData() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('get-slideshow-state');
            // Only load if not already loaded or if connection was lost
            if (!this.dataLoaded) {
                this.loadInitialData();
                this.dataLoaded = true;
            }
        }
    }

    // Optimized method to handle images update with debouncing
    handleImagesUpdate(images, settings) {
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
            this.updateImages(images);
            if (settings) {
                this.updateSettings(settings);
            }
        }, 100); // Debounce updates
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
        this.updateImagesCount();
        this.renderImagesPreview();
    }

    updateImagesCount() {
        const count = this.images.length;
        const key = count === 1 ? 'status.images_count_singular' : 'status.images_count';
        const countText = window.i18n.t(key, { count: count });
        this.imagesCount.textContent = countText;
        if (this.imagesGridCount) {
            this.imagesGridCount.textContent = countText;
        }
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.updateUI();
        
        // If excludedImages changed, force a grid re-render
        if (settings.hasOwnProperty('excludedImages')) {
            this.renderImagesPreview();
        }
    }

    updateUI() {
        // Update interval
        this.intervalSlider.value = this.settings.interval / 1000;
        this.intervalValue.textContent = this.settings.interval / 1000 + 's';
        

        
        // Update filter
        this.filterSelect.value = this.settings.filter;
        
        // Update transition
        this.transitionSelect.value = this.settings.transition || 'none';
        
        // Update watermark
        this.watermarkEnabled.checked = this.settings.showWatermark;
        this.watermarkType.value = this.settings.watermarkType || 'text';
        this.watermarkText.value = this.settings.watermarkText;
        
        // Update watermark file display
        if (this.settings.watermarkImage) {
            // Extract filename from path for display
            const fileName = this.settings.watermarkImage.split('/').pop() || 'Selected file';
            this.watermarkFileName.textContent = fileName;
        } else {
            this.watermarkFileName.textContent = 'No file selected';
        }
        
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
        this.toggleLatestCountContainer(this.settings.repeatLatest);
        this.shuffleImages.checked = this.settings.shuffleImages;
        this.transparentBackground.checked = this.settings.transparentBackground;
        
        // Update photos path
        if (this.settings.photosPath) {
            this.photosPath.value = this.settings.photosPath;
            this.changeFolderBtn.disabled = false;
        }
    }

    updateSetting(key, value) {
        // Prevent multiple simultaneous requests
        if (this.settingUpdateInProgress) {
            return;
        }
        this.settingUpdateInProgress = true;

        const newSettings = { ...this.settings, [key]: value };
        
        // Send to server with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ [key]: value }),
            signal: controller.signal
        })
        .then(response => {
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Setting updated:', key, value);
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.error('Setting update timeout:', key);
                this.showNotification('Setting update timeout', 'error');
            } else {
                console.error('Error during update:', error);
                this.showNotification('Failed to update setting', 'error');
            }
        })
        .finally(() => {
            this.settingUpdateInProgress = false;
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

        // Update current preview image
        this.currentPreviewImage.src = currentImage.path;
        this.currentPreviewImage.style.display = 'block';
        this.previewPlaceholder.style.display = 'none';

        // Update current image info
        this.currentImageName.textContent = currentImage.filename || 'Unknown';
        this.currentImageIndexElement.textContent = `${currentIndex + 1} / ${totalImages}`;

        // Update next image preview
        this.updateNextImagePreview(currentIndex, totalImages);

        // Highlight current image in grid
        this.highlightCurrentImageInGrid(currentIndex);

        // Store current image data
        this.currentImageData = currentImage;
        this.currentImageIndex = currentIndex;
    }

    updateNextImagePreview(currentIndex, totalImages) {
        if (!this.images || this.images.length === 0) {
            this.showNextPreviewPlaceholder();
            return;
        }

        // Calculate next image index (wrapping around at the end)
        const nextIndex = (currentIndex + 1) % totalImages;
        const nextImage = this.images[nextIndex];

        if (nextImage) {
            // Update next preview image
            this.nextPreviewImage.src = nextImage.path;
            this.nextPreviewImage.style.display = 'block';
            this.nextPreviewPlaceholder.style.display = 'none';

            // Update next image info
            this.nextImageName.textContent = nextImage.filename || 'Unknown';
            this.nextImageIndexElement.textContent = `${nextIndex + 1} / ${totalImages}`;
        } else {
            this.showNextPreviewPlaceholder();
        }
    }

    showPreviewPlaceholder() {
        this.currentPreviewImage.style.display = 'none';
        this.previewPlaceholder.style.display = 'flex';
        this.currentImageName.textContent = '-';
        this.currentImageIndexElement.textContent = '0 / 0';
        
        // Also hide next preview
        this.showNextPreviewPlaceholder();
        
        // Remove highlighting from grid
        const items = this.imagesPreview.querySelectorAll('.image-item');
        items.forEach(item => item.classList.remove('current'));
    }

    showNextPreviewPlaceholder() {
        this.nextPreviewImage.style.display = 'none';
        this.nextPreviewPlaceholder.style.display = 'flex';
        this.nextImageName.textContent = '-';
        this.nextImageIndexElement.textContent = '0 / 0';
    }

    highlightCurrentImageInGrid(currentIndex) {
        // Use the optimized highlighting method
        this.currentImageIndex = currentIndex;
        this.updateCurrentImageHighlighting();
    }

    renderImagesPreview() {
        // Prevent concurrent renders and add throttling
        if (this.isRenderingGrid) {
            this.pendingGridUpdate = true;
            return;
        }
        
        this.isRenderingGrid = true;
        
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
            this.performGridRender();
            this.isRenderingGrid = false;
            
            // Process pending update if any
            if (this.pendingGridUpdate) {
                this.pendingGridUpdate = false;
                this.renderImagesPreview();
            }
        });
    }

    performGridRender() {
        if (this.images.length === 0) {
            this.imagesPreview.innerHTML = `
                <div class="empty-state">
                    <h3>No images found</h3>
                    <p>Add images (JPG, PNG, GIF, BMP, TIFF) to the "photos" folder to get started.</p>
                </div>
            `;
            this.lastImageListHash = null;
            this.sortedImagesCache = null;
            return;
        }

        // Check if images have actually changed
        const currentHash = this.generateImageListHash(this.images);
        if (currentHash === this.lastImageListHash && this.sortedImagesCache) {
            // Images haven't changed, just update highlighting if needed
            this.updateCurrentImageHighlighting();
            return;
        }

        // Cache the sorted images to avoid re-sorting on every render
        if (!this.sortedImagesCache || currentHash !== this.lastImageListHash) {
            this.sortedImagesCache = [...this.images].map((image, originalIndex) => ({
                ...image,
                originalIndex
            })).sort((a, b) => new Date(b.modified) - new Date(a.modified));
            this.lastImageListHash = currentHash;
        }

        // Use DocumentFragment for efficient DOM manipulation
        const fragment = document.createDocumentFragment();

        // Batch DOM creation
        this.sortedImagesCache.forEach((image, displayIndex) => {
            const imageItem = this.createImageItem(image, displayIndex);
            fragment.appendChild(imageItem);
        });

        // Single DOM update
        this.imagesPreview.innerHTML = '';
        this.imagesPreview.appendChild(fragment);
    }

    createImageItem(image, displayIndex) {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.index = image.originalIndex;
        imageItem.dataset.displayIndex = displayIndex;
        imageItem.dataset.filename = image.filename;
        
        // Check if image is excluded
        const isExcluded = this.settings.excludedImages && this.settings.excludedImages.includes(image.filename);
        if (isExcluded) {
            imageItem.classList.add('excluded');
        }
        
        const img = document.createElement('img');
        img.src = image.path;
        img.alt = image.filename;
        img.loading = 'lazy';
        img.decoding = 'async'; // Improve performance for large images
        
        // Optimized error handling
        img.onerror = () => {
            img.style.display = 'none';
            if (!imageItem.querySelector('.image-error')) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'image-error';
                errorDiv.textContent = '❌';
                imageItem.appendChild(errorDiv);
            }
        };
        
        // Create exclusion toggle button
        const excludeBtn = document.createElement('button');
        excludeBtn.className = 'exclude-btn';
        excludeBtn.title = isExcluded ? 'Include in slideshow' : 'Exclude from slideshow';
        excludeBtn.innerHTML = isExcluded ? '👁️' : '🚫';
        excludeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent image selection when clicking the button
            this.toggleImageExclusion(image.filename);
        });
        
        const info = document.createElement('div');
        info.className = 'image-info';
        info.innerHTML = `
            <div>${this.escapeHtml(image.filename)}</div>
            <div>
                ${this.formatFileSize(image.size)} • ${this.formatDate(image.modified)}
            </div>
        `;
        
        imageItem.appendChild(img);
        imageItem.appendChild(excludeBtn);
        imageItem.appendChild(info);
        
        return imageItem;
    }

    // Helper method to escape HTML and prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Update only the current image highlighting without full re-render
    updateCurrentImageHighlighting() {
        const items = this.imagesPreview.querySelectorAll('.image-item');
        const currentIndex = this.currentImageIndex;
        
        items.forEach((item) => {
            const originalIndex = parseInt(item.dataset.index);
            item.classList.toggle('current', originalIndex === currentIndex);
        });
    }

    toggleImageExclusion(filename) {
        if (!this.socket) {
            console.error('Socket not connected');
            return;
        }
        
        this.socket.emit('toggle-image-exclusion', filename);
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

    async openNativeFolderDialog() {
        // Check if we're running in Electron
        if (typeof window.electronAPI !== 'undefined') {
            try {
                const selectedPath = await window.electronAPI.selectFolder();
                if (selectedPath) {
                    this.photosPath.value = selectedPath;
                    this.changeFolderBtn.disabled = false;
                    // Auto-change folder if path is selected
                    await this.changePhotosFolder();
                }
            } catch (error) {
                console.error('Error opening folder dialog:', error);
                this.showNotification('Error opening folder dialog', 'error');
            }
        } else {
            // Fallback for web browser - try File System Access API
            try {
                if ('showDirectoryPicker' in window) {
                    const directoryHandle = await window.showDirectoryPicker();
                    if (directoryHandle) {
                        // Note: This gives us a handle, not a file path
                        // For web context, we'd need to work with the handle differently
                        this.showNotification('Folder selected (web mode)', 'info');
                        console.log('Directory handle:', directoryHandle);
                    }
                } else {
                    this.showNotification('Native folder selection not available in web browser. Please type the folder path manually.', 'warning');
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error with web folder picker:', error);
                    this.showNotification('Folder selection cancelled or not supported', 'warning');
                }
            }
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

    toggleLatestCountContainer(isEnabled) {
        if (isEnabled) {
            this.latestCountContainer.classList.remove('hidden');
        } else {
            this.latestCountContainer.classList.add('hidden');
        }
    }

    updateGridZoom(zoomLevel) {
        // Remove existing zoom classes
        this.imagesPreview.classList.remove('zoom-small', 'zoom-normal', 'zoom-large', 'zoom-xlarge');
        
        // Update button states
        this.zoomButtons.forEach(button => {
            const buttonZoom = parseInt(button.dataset.zoom);
            if (buttonZoom === zoomLevel) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Add new zoom class based on level
        const zoomClasses = {
            1: 'zoom-small',
            2: 'zoom-normal', 
            3: 'zoom-large',
            4: 'zoom-xlarge'
        };
        
        if (zoomClasses[zoomLevel]) {
            this.imagesPreview.classList.add(zoomClasses[zoomLevel]);
        }
        
        // Store zoom preference locally
        localStorage.setItem('photoLiveGridZoom', zoomLevel.toString());
    }

    initializeGridZoom() {
        // Load saved zoom level or default to normal (level 2)
        const savedZoom = localStorage.getItem('photoLiveGridZoom');
        const zoomLevel = savedZoom ? parseInt(savedZoom) : 2;
        
        // Apply zoom level (this will also update button states)
        this.updateGridZoom(zoomLevel);
    }

    async handleWatermarkFileSelection(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('File size too large. Please select a file smaller than 5MB', 'error');
            return;
        }

        try {
            // Show upload progress
            this.watermarkFileName.textContent = 'Uploading...';
            this.watermarkBrowseBtn.disabled = true;

            // Create FormData for file upload
            const formData = new FormData();
            formData.append('watermark', file);

            const response = await fetch('/api/watermark-upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                // Update the UI with the selected file
                this.watermarkFileName.textContent = file.name;
                
                // Update the setting with the uploaded file path
                this.updateSetting('watermarkImage', data.filePath);
                
                this.showNotification('Watermark uploaded successfully', 'success');
            } else {
                this.showNotification(data.error || 'Upload failed', 'error');
                this.watermarkFileName.textContent = 'No file selected';
            }
        } catch (error) {
            console.error('Error uploading watermark:', error);
            this.showNotification('Upload failed. Please try again.', 'error');
            this.watermarkFileName.textContent = 'No file selected';
        } finally {
            this.watermarkBrowseBtn.disabled = false;
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

// Optimized auto-refresh with connection check and exponential backoff
let refreshInterval = 60000; // Start with 60 seconds
let maxRefreshInterval = 300000; // Max 5 minutes
let refreshTimeoutId;

function scheduleRefresh() {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = setTimeout(() => {
        if (window.control && window.control.socket) {
            if (window.control.socket.connected) {
                // Connection is good, reset interval
                refreshInterval = 60000;
                
                // Only refresh if user is not actively interacting
                if (!document.hasFocus() || Date.now() - window.control.lastUserInteraction > 30000) {
                    window.control.loadInitialData();
                }
            } else {
                // Connection issues, increase interval
                refreshInterval = Math.min(refreshInterval * 1.5, maxRefreshInterval);
                console.log('Connection issues, increasing refresh interval to', refreshInterval / 1000, 'seconds');
            }
        }
        scheduleRefresh(); // Schedule next refresh
    }, refreshInterval);
}

// Start the optimized refresh cycle
scheduleRefresh();

// Track user interaction to avoid unnecessary refreshes
document.addEventListener('click', () => {
    if (window.control) {
        window.control.lastUserInteraction = Date.now();
    }
});

document.addEventListener('keydown', () => {
    if (window.control) {
        window.control.lastUserInteraction = Date.now();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    clearTimeout(refreshTimeoutId);
    if (window.control && window.control.socket) {
        window.control.socket.disconnect();
    }
});
