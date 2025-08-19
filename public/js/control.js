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
            watermarkPosition: 'bottom-right',
            shuffleImages: false,
            repeatLatest: false,
            latestCount: 5,
            photosPath: '', // Chemin des photos
            transparentBackground: false
        };
        this.isPlaying = true;
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupSocket();
        this.setupEventListeners();
        this.loadInitialData();
        this.updateSlideshowUrl();
    }

    setupElements() {
        // Status elements
        this.connectionStatus = document.getElementById('connection-status');
        this.imagesCount = document.getElementById('images-count');
        
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
        this.watermarkText = document.getElementById('watermark-text');
        this.watermarkPosition = document.getElementById('watermark-position');
        
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
    }

    setupSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connecté au serveur');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Déconnecté du serveur');
            this.updateConnectionStatus(false);
        });

        this.socket.on('images-updated', (data) => {
            console.log('Images mises à jour:', data.images.length);
            this.updateImages(data.images);
            this.updateSettings(data.settings);
        });

        this.socket.on('settings-updated', (settings) => {
            console.log('Paramètres mis à jour:', settings);
            this.updateSettings(settings);
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
            this.intervalValue.textContent = value;
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

        this.watermarkText.addEventListener('input', (e) => {
            this.updateSetting('watermarkText', e.target.value);
        });

        this.watermarkPosition.addEventListener('change', (e) => {
            this.updateSetting('watermarkPosition', e.target.value);
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
        } catch (error) {
            console.error('Erreur lors du chargement initial:', error);
        }
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.textContent = 'Connecté';
            this.connectionStatus.className = 'status-connected';
        } else {
            this.connectionStatus.textContent = 'Déconnecté';
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
        this.intervalValue.textContent = this.settings.interval / 1000;
        
        // Update transition
        this.transitionSelect.value = this.settings.transition;
        
        // Update filter
        this.filterSelect.value = this.settings.filter;
        
        // Update watermark
        this.watermarkEnabled.checked = this.settings.showWatermark;
        this.watermarkText.value = this.settings.watermarkText;
        this.watermarkPosition.value = this.settings.watermarkPosition;
        
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
            console.log('Paramètre mis à jour:', key, value);
        })
        .catch(error => {
            console.error('Erreur lors de la mise à jour:', error);
        });
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.socket.emit('pause-slideshow');
            this.playPauseBtn.innerHTML = '▶️ Lecture';
            this.isPlaying = false;
        } else {
            this.socket.emit('resume-slideshow');
            this.playPauseBtn.innerHTML = '⏸️ Pause';
            this.isPlaying = true;
        }
    }

    renderImagesPreview() {
        this.imagesPreview.innerHTML = '';
        
        if (this.images.length === 0) {
            this.imagesPreview.innerHTML = `
                <div class="empty-state">
                    <h3>Aucune image trouvée</h3>
                    <p>Ajoutez des images (JPG, PNG, GIF, BMP, TIFF) dans le dossier "photos" pour commencer.</p>
                </div>
            `;
            return;
        }

        this.images.forEach((image, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            
            const img = document.createElement('img');
            img.src = image.path;
            img.alt = image.filename;
            img.loading = 'lazy';
            
            const info = document.createElement('div');
            info.className = 'image-info';
            info.innerHTML = `
                <div>${image.filename}</div>
                <div style="font-size: 0.7rem; opacity: 0.8;">
                    ${this.formatFileSize(image.size)} • ${this.formatDate(image.modified)}
                </div>
            `;
            
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
            this.showNotification('Veuillez entrer un chemin de dossier', 'error');
            return;
        }

        try {
            this.changeFolderBtn.disabled = true;
            this.changeFolderBtn.textContent = 'Changement...';
            
            const response = await fetch('/api/photos-path', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ photosPath: newPath })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification(`Dossier changé vers: ${data.photosPath}`, 'success');
                // Les images seront automatiquement mises à jour via WebSocket
            } else {
                this.showNotification(data.error || 'Erreur lors du changement de dossier', 'error');
            }
        } catch (error) {
            console.error('Erreur lors du changement de dossier:', error);
            this.showNotification('Erreur de connexion au serveur', 'error');
        } finally {
            this.changeFolderBtn.disabled = false;
            this.changeFolderBtn.textContent = '✅ Changer';
        }
    }

    showNotification(message, type = 'info') {
        // Créer l'élément de notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Styles inline pour la notification
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
        
        // Animation d'entrée
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Supprimer après 5 secondes
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
            this.slideshowUrl.textContent = 'Copié!';
            this.slideshowUrl.style.background = '#48bb78';
            this.slideshowUrl.style.color = 'white';
            
            setTimeout(() => {
                this.slideshowUrl.textContent = originalText;
                this.slideshowUrl.style.background = '#e2e8f0';
                this.slideshowUrl.style.color = '#5a67d8';
            }, 1000);
        } catch (err) {
            console.error('Erreur lors de la copie:', err);
            
            // Fallback method
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.slideshowUrl.textContent = 'Copié!';
                setTimeout(() => {
                    this.updateSlideshowUrl();
                }, 1000);
            } catch (err) {
                console.error('Fallback copy failed:', err);
            }
            document.body.removeChild(textArea);
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    window.control = new PhotoLiveControl();
});

// Auto-refresh preview every 30 seconds
setInterval(() => {
    if (window.control && window.control.socket && window.control.socket.connected) {
        window.control.loadInitialData();
    }
}, 30000);
