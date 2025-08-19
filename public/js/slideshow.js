class PhotoLiveSlideshow {
    constructor() {
        this.socket = null;
        this.images = [];
        this.shuffledImages = [];
        this.currentIndex = 0;
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
            transparentBackground: false
        };
        this.intervalId = null;
        this.isPlaying = true;
        this.isTransitioning = false;
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupSocket();
        this.setupEventListeners();
        this.loadInitialData();
    }

    setupElements() {
        this.currentImage = document.getElementById('current-image');
        this.nextImage = document.getElementById('next-image');
        this.watermark = document.getElementById('watermark');
        this.overlay = document.getElementById('overlay');
        this.loading = document.getElementById('loading');
        this.noImages = document.getElementById('no-images');
    }

    setupSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connecté au serveur');
            this.hideLoading();
        });

        this.socket.on('disconnect', () => {
            console.log('Déconnecté du serveur');
            this.showLoading();
        });

        this.socket.on('images-updated', (data) => {
            console.log('Images mises à jour:', data.images.length);
            this.updateImages(data.images, data.newImageAdded);
            this.updateSettings(data.settings);
        });

        this.socket.on('settings-updated', (settings) => {
            console.log('Paramètres mis à jour:', settings);
            this.updateSettings(settings);
        });

        this.socket.on('next-image', () => {
            this.nextSlide();
        });

        this.socket.on('prev-image', () => {
            this.prevSlide();
        });

        this.socket.on('pause-slideshow', () => {
            this.pauseSlideshow();
        });

        this.socket.on('resume-slideshow', () => {
            this.resumeSlideshow();
        });
    }

    setupEventListeners() {
        // Gestion des erreurs de chargement d'images
        this.currentImage.addEventListener('error', () => {
            console.error('Erreur de chargement de l\'image courante');
            this.nextSlide();
        });

        this.nextImage.addEventListener('error', () => {
            console.error('Erreur de chargement de l\'image suivante');
        });

        // Raccourcis clavier pour le debug
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowRight':
                case ' ':
                    e.preventDefault();
                    this.nextSlide();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.prevSlide();
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
            this.hideLoading();
            this.showNoImages();
        }
    }

    updateImages(images, newImageAdded = null) {
        this.images = images;
        
        if (this.images.length === 0) {
            this.hideLoading();
            this.showNoImages();
            this.stopSlideshow();
            return;
        }

        this.hideNoImages();
        this.hideLoading();
        
        // Créer la liste mélangée avec les informations du serveur
        this.createShuffledImagesList(newImageAdded);
        
        // Si une nouvelle image a été ajoutée et que le shuffle est activé, 
        // commencer par la nouvelle image
        if (newImageAdded && this.settings.shuffleImages) {
            const newImageIndex = this.shuffledImages.findIndex(img => img.filename === newImageAdded);
            if (newImageIndex !== -1) {
                this.currentIndex = newImageIndex;
                console.log(`🎯 Nouvelle image détectée: ${newImageAdded}, passage à l'index ${newImageIndex}`);
            }
        }
        
        // Si c'est le premier chargement d'images, commencer le diaporama
        if (this.currentIndex >= this.getImagesList().length) {
            this.currentIndex = 0;
        }

        this.showCurrentImage();
        this.startSlideshow();
    }

    createShuffledImagesList(newImageAdded = null) {
        if (!this.settings.shuffleImages) {
            // Mode normal : utiliser l'ordre par défaut (chronologique)
            this.shuffledImages = [...this.images];
            console.log('Mode normal: ordre chronologique');
            return;
        }

        // Séparer les nouvelles images des existantes basé sur le marquage serveur
        const newImages = this.images.filter(img => img.isNew);
        const existingImages = this.images.filter(img => !img.isNew);

        // Mélanger les images existantes
        const shuffledExisting = this.shuffleArray([...existingImages]);
        
        // Priorité : nouvelles images d'abord, puis les existantes mélangées
        this.shuffledImages = [...newImages, ...shuffledExisting];
        
        console.log(`🔀 Mode mélangé: ${newImages.length} nouvelles images en priorité, ${existingImages.length} existantes mélangées`);
        if (newImages.length > 0) {
            console.log('📸 Nouvelles images:', newImages.map(img => img.filename));
        }
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    getImagesList() {
        return this.settings.shuffleImages ? this.shuffledImages : this.images;
    }

    updateSettings(settings) {
        const previousShuffleState = this.settings.shuffleImages;
        this.settings = { ...this.settings, ...settings };
        
        // Si l'état du mélange a changé, recréer la liste
        if (previousShuffleState !== this.settings.shuffleImages) {
            this.createShuffledImagesList();
            
            // Réajuster l'index actuel si nécessaire
            if (this.currentIndex >= this.getImagesList().length) {
                this.currentIndex = 0;
            }
        }
        
        // Mettre à jour l'arrière-plan transparent
        this.updateBackground();
        
        // Mettre à jour le filigrane
        this.updateWatermark();
        
        // Mettre à jour l'overlay
        this.updateOverlay();
        
        // Redémarrer le diaporama avec le nouvel intervalle
        if (this.isPlaying) {
            this.startSlideshow();
        }
    }

    updateWatermark() {
        if (!this.settings.showWatermark) {
            this.watermark.classList.add('hidden');
            return;
        }

        // Reset watermark content
        this.watermark.innerHTML = '';
        
        // Apply opacity
        this.watermark.style.opacity = (this.settings.watermarkOpacity || 80) / 100;
        
        // Reset classes and add base classes
        this.watermark.className = 'watermark';
        this.watermark.classList.add(`position-${this.settings.watermarkPosition}`);
        
        if (this.settings.watermarkType === 'image' && this.settings.watermarkImage) {
            // Image watermark
            const img = document.createElement('img');
            img.src = this.settings.watermarkImage;
            img.alt = 'Filigrane';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.display = 'block';
            
            // Apply size based on setting
            const sizeScale = this.getSizeScale(this.settings.watermarkSize || 'medium');
            const baseSize = 150; // Base size in pixels
            const finalSize = baseSize * sizeScale;
            
            img.style.width = `${finalSize}px`;
            img.style.height = 'auto';
            
            this.watermark.appendChild(img);
            this.watermark.classList.add('watermark-image');
        } else {
            // Text watermark
            const textSpan = document.createElement('span');
            textSpan.textContent = this.settings.watermarkText || 'PhotoLive OBS';
            textSpan.id = 'watermark-text';
            this.watermark.appendChild(textSpan);
            this.watermark.classList.add('watermark-text');
        }
        
        this.watermark.classList.remove('hidden');
    }

    getSizeScale(size) {
        const sizeMap = {
            'small': 0.5,
            'medium': 1.0,
            'large': 1.5,
            'xlarge': 2.0
        };
        return sizeMap[size] || 1.0;
    }

    updateOverlay() {
        // Réinitialiser les classes d'overlay
        this.overlay.className = 'overlay';
        
        // Ajouter les effets selon les paramètres
        if (this.settings.vignette) {
            this.overlay.classList.add('vignette');
        }
    }

    updateBackground() {
        const body = document.body;
        const container = document.getElementById('slideshow-container');
        
        if (this.settings.transparentBackground) {
            body.classList.add('transparent');
            container.classList.add('transparent');
        } else {
            body.classList.remove('transparent');
            container.classList.remove('transparent');
        }
    }

    showCurrentImage() {
        if (this.images.length === 0) return;

        const currentImageData = this.getCurrentImageData();
        if (!currentImageData) return;

        // Précharger l'image
        const img = new Image();
        img.onload = () => {
            this.currentImage.src = currentImageData.path;
            this.currentImage.className = `slide-image visible filter-${this.settings.filter}`;
            
            // Preloader la prochaine image
            this.preloadNextImage();
        };
        img.onerror = () => {
            console.error('Impossible de charger l\'image:', currentImageData.path);
            this.nextSlide();
        };
        img.src = currentImageData.path;
    }

    preloadNextImage() {
        const nextIndex = this.getNextIndex();
        const nextImageData = this.images[nextIndex];
        
        if (nextImageData && nextImageData.path !== this.currentImage.src) {
            const img = new Image();
            img.src = nextImageData.path;
        }
    }

    getCurrentImageData() {
        const imagesList = this.getImagesList();
        
        if (this.settings.repeatLatest && imagesList.length > 0) {
            // Mode répétition des dernières images
            const latestImages = imagesList.slice(0, Math.min(this.settings.latestCount, imagesList.length));
            const index = this.currentIndex % latestImages.length;
            return latestImages[index];
        }
        
        return imagesList[this.currentIndex];
    }

    getNextIndex() {
        const imagesList = this.getImagesList();
        
        if (this.settings.repeatLatest && imagesList.length > 0) {
            const latestCount = Math.min(this.settings.latestCount, imagesList.length);
            return (this.currentIndex + 1) % latestCount;
        }
        
        return (this.currentIndex + 1) % imagesList.length;
    }

    getPrevIndex() {
        const imagesList = this.getImagesList();
        
        if (this.settings.repeatLatest && imagesList.length > 0) {
            const latestCount = Math.min(this.settings.latestCount, imagesList.length);
            return this.currentIndex === 0 ? latestCount - 1 : this.currentIndex - 1;
        }
        
        return this.currentIndex === 0 ? imagesList.length - 1 : this.currentIndex - 1;
    }

    nextSlide() {
        const imagesList = this.getImagesList();
        if (imagesList.length === 0 || this.isTransitioning) return;
        
        this.currentIndex = this.getNextIndex();
        this.transitionToImage();
    }

    prevSlide() {
        const imagesList = this.getImagesList();
        if (imagesList.length === 0 || this.isTransitioning) return;
        
        this.currentIndex = this.getPrevIndex();
        this.transitionToImage();
    }

    transitionToImage() {
        if (this.isTransitioning) return;
        
        this.isTransitioning = true;
        const nextImageData = this.getCurrentImageData();
        
        if (!nextImageData) {
            this.isTransitioning = false;
            return;
        }

        // Précharger la nouvelle image
        const img = new Image();
        img.onload = () => {
            this.performTransition(nextImageData.path);
        };
        img.onerror = () => {
            console.error('Erreur de chargement:', nextImageData.path);
            this.isTransitioning = false;
            this.nextSlide();
        };
        img.src = nextImageData.path;
    }

    performTransition(newImagePath) {
        switch (this.settings.transition) {
            case 'none':
                this.noneTransition(newImagePath);
                break;
            case 'fade':
                this.fadeTransition(newImagePath);
                break;
            case 'slide':
                this.slideTransition(newImagePath);
                break;
            case 'zoom':
                this.zoomTransition(newImagePath);
                break;
            default:
                this.fadeTransition(newImagePath);
        }
    }

    noneTransition(newImagePath) {
        // Changement immédiat sans effet de transition
        this.currentImage.src = newImagePath;
        this.currentImage.className = `slide-image transition-none filter-${this.settings.filter}`;
        this.currentImage.style.opacity = '1';
        
        this.isTransitioning = false;
        this.preloadNextImage();
    }

    fadeTransition(newImagePath) {
        this.nextImage.src = newImagePath;
        this.nextImage.className = `slide-image transition-fade filter-${this.settings.filter}`;
        this.nextImage.style.opacity = '0';
        this.nextImage.classList.remove('hidden');

        // Fade out current, fade in next
        setTimeout(() => {
            this.currentImage.style.opacity = '0';
            this.nextImage.style.opacity = '1';
        }, 50);

        setTimeout(() => {
            // Swap images
            const temp = this.currentImage;
            this.currentImage = this.nextImage;
            this.nextImage = temp;
            
            this.nextImage.classList.add('hidden');
            this.currentImage.style.opacity = '1';
            
            this.isTransitioning = false;
            this.preloadNextImage();
        }, 1050);
    }

    slideTransition(newImagePath) {
        this.nextImage.src = newImagePath;
        this.nextImage.className = `slide-image transition-slide filter-${this.settings.filter}`;
        this.nextImage.classList.remove('hidden');
        this.nextImage.classList.add('slide-in-right');

        setTimeout(() => {
            this.currentImage.classList.add('slide-out-left');
            this.nextImage.classList.remove('slide-in-right');
        }, 50);

        setTimeout(() => {
            // Swap images
            const temp = this.currentImage;
            this.currentImage = this.nextImage;
            this.nextImage = temp;
            
            this.nextImage.classList.add('hidden');
            this.currentImage.classList.remove('slide-out-left', 'slide-in-right');
            
            this.isTransitioning = false;
            this.preloadNextImage();
        }, 1050);
    }

    zoomTransition(newImagePath) {
        this.nextImage.src = newImagePath;
        this.nextImage.className = `slide-image transition-zoom filter-${this.settings.filter}`;
        this.nextImage.style.opacity = '0';
        this.nextImage.classList.remove('hidden');
        this.nextImage.classList.add('zoom-in');

        setTimeout(() => {
            this.currentImage.classList.add('zoom-out');
            this.currentImage.style.opacity = '0';
            this.nextImage.style.opacity = '1';
            this.nextImage.classList.remove('zoom-in');
        }, 50);

        setTimeout(() => {
            // Swap images
            const temp = this.currentImage;
            this.currentImage = this.nextImage;
            this.nextImage = temp;
            
            this.nextImage.classList.add('hidden');
            this.nextImage.classList.remove('zoom-out');
            this.currentImage.style.opacity = '1';
            
            this.isTransitioning = false;
            this.preloadNextImage();
        }, 1550);
    }

    startSlideshow() {
        this.stopSlideshow();
        
        const imagesList = this.getImagesList();
        if (imagesList.length > 1 && this.isPlaying) {
            this.intervalId = setInterval(() => {
                this.nextSlide();
            }, this.settings.interval);
        }
    }

    stopSlideshow() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    pauseSlideshow() {
        this.isPlaying = false;
        this.stopSlideshow();
    }

    resumeSlideshow() {
        this.isPlaying = true;
        this.startSlideshow();
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pauseSlideshow();
        } else {
            this.resumeSlideshow();
        }
    }

    showLoading() {
        this.loading.classList.remove('hidden');
    }

    hideLoading() {
        this.loading.classList.add('hidden');
    }

    showNoImages() {
        this.noImages.classList.remove('hidden');
    }

    hideNoImages() {
        this.noImages.classList.add('hidden');
    }
}

// Initialisation quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    window.slideshow = new PhotoLiveSlideshow();
});

// Gestion de la visibilité de la page
document.addEventListener('visibilitychange', () => {
    if (window.slideshow) {
        if (document.hidden) {
            window.slideshow.pauseSlideshow();
        } else {
            window.slideshow.resumeSlideshow();
        }
    }
});
