class PhotoLiveControl {
    constructor() {
        this.socketClient = null;
        this.imageGrid = null;
        this.slideshowControls = null;
        this.settingsManager = null;
        
        this.init();
    }

    async init() {
        // Initialize i18n first
        await this.initializeI18n();
        
        // Initialize modules
        this.initializeModules();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Setup collapsible sections
        this.setupCollapsibleSections();
        
        // Update slideshow URL
        this.updateSlideshowUrl();
        
        // Connect to server
        this.socketClient.connect();
    }

    async initializeI18n() {
        try {
            const savedLanguage = localStorage.getItem('photolive-language');
            await window.i18n.init(savedLanguage);
            
            const languageSelect = document.getElementById('language-select');
            if (languageSelect) {
                languageSelect.value = window.i18n.getCurrentLanguage();
            }
            
            document.addEventListener('languageChanged', (event) => {
                this.onLanguageChanged(event.detail.language);
            });
            
        } catch (error) {
            console.error('Failed to initialize i18n:', error);
        }
    }

    initializeModules() {
        // Initialize socket client
        this.socketClient = new SocketClient();
        
        // Initialize image grid
        this.imageGrid = new ImageGrid('images-preview', {
            zoomLevel: parseInt(localStorage.getItem('photoLiveGridZoom')) || 2,
            sortOrder: localStorage.getItem('photoLiveGridSort') || 'desc',
            onImageClick: (originalIndex, image) => {
                this.socketClient.send('jump-to-image', originalIndex);
            },
            onImageExclude: (filename) => {
                this.socketClient.send('toggle-image-exclusion', filename);
            }
        });
        
        // Apply initial zoom level
        this.imageGrid.setZoomLevel(this.imageGrid.options.zoomLevel);
        
        // Initialize slideshow controls
        this.slideshowControls = new SlideshowControls(this.socketClient, {
            onStateChange: (data) => {
                this.updateConnectionStatus(true);
                this.highlightCurrentImageInGrid(data);
            }
        });
        
        // Initialize settings manager
        this.settingsManager = new SettingsManager(this.socketClient, {
            onSettingsChange: (settings) => {
                this.onSettingsChanged(settings);
            }
        });
    }

    setupEventHandlers() {
        // Language selector
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.addEventListener('change', async (e) => {
                await window.i18n.setLanguage(e.target.value);
            });
        }

        // Socket events
        this.socketClient.on('connected', () => {
            this.updateConnectionStatus(true);
            this.requestInitialData();
        });

        this.socketClient.on('disconnected', () => {
            this.updateConnectionStatus(false);
        });

        this.socketClient.on('connectionError', (error) => {
            console.error('Connection error:', error);
            this.updateConnectionStatus(false);
        });

        this.socketClient.on('images-updated', (data) => {
            console.log('Images updated:', data.allImages ? data.allImages.length : data.images.length);
            this.handleImagesUpdate(data.allImages || data.images, data.settings);
        });

        this.socketClient.on('settings-updated', (settings) => {
            console.log('Settings updated:', settings);
            this.settingsManager.updateUI(settings);
        });

        this.socketClient.on('scan-progress', (data) => {
            this.handleScanProgress(data);
        });

        // Copy URL on click
        const slideshowUrl = document.getElementById('slideshow-url');
        if (slideshowUrl) {
            slideshowUrl.addEventListener('click', () => {
                this.copyToClipboard(slideshowUrl.textContent);
            });
        }

        // Keyboard shortcuts (handled by slideshowControls module)
    }

    onLanguageChanged(language) {
        // Update settings to save language preference
        this.settingsManager.updateSetting('language', language);
        
        // Update dropdowns with translated values
        this.updateDropdownTranslations();
        
        // Update status text
        this.updateImagesCount();
    }

    updateDropdownTranslations() {
        // This would be handled by the settings manager in a more complete implementation
        // For now, we'll keep the existing logic
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
            
            filterSelect.querySelectorAll('[data-i18n]').forEach(option => {
                const key = option.getAttribute('data-i18n');
                option.textContent = window.i18n.t(key);
            });
        }
    }

    requestInitialData() {
        this.loadInitialData();
    }

    async loadInitialData() {
        try {
            const response = await fetch('/api/images');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.handleImagesUpdate(data.allImages || data.images, data.settings);
        } catch (error) {
            console.error('Error during initial loading:', error);
            this.showNotification('Failed to load data from server', 'error');
        }
    }

    handleImagesUpdate(images, settings) {
        // Update image grid
        this.imageGrid.updateImages(images, settings);
        
        // Update settings UI
        if (settings) {
            this.settingsManager.updateUI(settings);
            
            // Update slideshow controls interval
            if (settings.interval && this.slideshowControls) {
                const intervalSeconds = Math.round(settings.interval / 1000);
                this.slideshowControls.setInterval(intervalSeconds);
            }
        }
        
        // Update images count
        this.updateImagesCount(images.length);
    }

    updateConnectionStatus(connected) {
        const connectionStatus = document.getElementById('connection-status');
        if (connectionStatus) {
            if (connected) {
                connectionStatus.textContent = 'Connected';
                connectionStatus.className = 'status-connected';
            } else {
                connectionStatus.textContent = 'Disconnected';
                connectionStatus.className = 'status-disconnected';
            }
        }
    }

    updateImagesCount(count = 0) {
        const imagesCount = document.getElementById('images-count');
        const imagesGridCount = document.getElementById('images-grid-count');
        
        const key = count === 1 ? 'status.images_count_singular' : 'status.images_count';
        const countText = window.i18n.t(key, { count: count });
        
        if (imagesCount) {
            imagesCount.textContent = countText;
        }
        if (imagesGridCount) {
            imagesGridCount.textContent = countText;
        }
    }

    highlightCurrentImageInGrid(data) {
        if (data && data.currentImage) {
            const currentIndex = this.imageGrid.getImageIndex(data.currentImage.filename);
            this.imageGrid.highlightCurrentImage(currentIndex);
        }
    }

    onSettingsChanged(settings) {
        // Handle any additional logic when settings change
        console.log('Settings changed:', settings);
        
        // Update slideshow controls interval if changed
        if (settings.interval && this.slideshowControls) {
            const intervalSeconds = Math.round(settings.interval / 1000);
            this.slideshowControls.setInterval(intervalSeconds);
        }
    }

    handleScanProgress(data) {
        const progressContainer = document.getElementById('scan-progress-container');
        const progressFill = document.getElementById('scan-progress-fill');
        const progressPercentage = document.getElementById('scan-progress-percentage');
        const progressCurrent = document.getElementById('scan-current');
        const progressTotal = document.getElementById('scan-total');
        const progressFile = document.getElementById('scan-progress-file');
        const progressTitle = document.querySelector('.scan-progress-title');

        if (!progressContainer) return;

        switch (data.status) {
            case 'started':
                progressContainer.style.display = 'block';
                progressContainer.className = 'scan-progress-header-container';
                if (progressTitle) progressTitle.textContent = window.i18n.t('scan.scanning') || 'Scanning images...';
                if (progressFill) progressFill.style.width = '0%';
                if (progressPercentage) progressPercentage.textContent = '0%';
                if (progressFile) progressFile.textContent = '';
                break;

            case 'scanning':
                const percentage = data.percentage || 0;
                if (progressFill) progressFill.style.width = percentage + '%';
                if (progressPercentage) progressPercentage.textContent = percentage + '%';
                if (progressCurrent) progressCurrent.textContent = data.current || 0;
                if (progressTotal) progressTotal.textContent = data.total || 0;
                
                if (data.currentFile && progressFile) {
                    const maxLength = 40;
                    let displayPath = data.currentFile;
                    if (displayPath.length > maxLength) {
                        displayPath = '...' + displayPath.slice(-(maxLength - 3));
                    }
                    progressFile.textContent = displayPath;
                }
                break;

            case 'completed':
                progressContainer.className = 'scan-progress-header-container success';
                if (progressFill) progressFill.style.width = '100%';
                if (progressPercentage) progressPercentage.textContent = '100%';
                if (progressTitle) progressTitle.textContent = window.i18n.t('scan.completed') || 'Scan completed';
                if (progressFile) progressFile.textContent = `${data.totalImages} images found`;
                
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 3000);
                break;

            case 'error':
                progressContainer.className = 'scan-progress-header-container error';
                if (progressTitle) progressTitle.textContent = window.i18n.t('scan.error') || 'Scan error';
                if (progressFile) progressFile.textContent = data.message || 'An error occurred during scanning';
                
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 4000);
                break;
        }
    }

    updateSlideshowUrl() {
        const slideshowUrl = document.getElementById('slideshow-url');
        if (slideshowUrl) {
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            const port = window.location.port;
            const url = `${protocol}//${hostname}${port ? ':' + port : ''}`;
            slideshowUrl.textContent = url;
        }
    }

    async copyToClipboard(text) {
        const slideshowUrl = document.getElementById('slideshow-url');
        if (!slideshowUrl) return;

        try {
            await navigator.clipboard.writeText(text);
            
            const originalText = slideshowUrl.textContent;
            slideshowUrl.textContent = 'Copied!';
            slideshowUrl.style.background = '#48bb78';
            slideshowUrl.style.color = 'white';
            
            setTimeout(() => {
                slideshowUrl.textContent = originalText;
                slideshowUrl.style.background = '#e2e8f0';
                slideshowUrl.style.color = '#5a67d8';
            }, 1000);
        } catch (err) {
            console.error('Error during copy:', err);
            
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                slideshowUrl.textContent = 'Copied!';
                setTimeout(() => {
                    this.updateSlideshowUrl();
                }, 1000);
            } catch (err) {
                console.error('Fallback copy failed:', err);
            }
            document.body.removeChild(textArea);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
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
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    setupCollapsibleSections() {
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.control && window.control.socketClient) {
        window.control.socketClient.disconnect();
    }
});