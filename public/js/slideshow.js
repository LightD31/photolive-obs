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
        this.isPlaying = true;
        this.isTransitioning = false;
        this.transitionTimer = null;
        
        // Données d'images fournies par le serveur
        this.serverCurrentImage = null;
        this.serverNextImage = null;
        
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

        this.socket.on('image-changed', (data) => {
            console.log('Image changed from server:', data);
            this.handleImageChange(data);
        });

        this.socket.on('slideshow-state', (data) => {
            console.log('Slideshow state from server:', data);
            this.handleStateSync(data);
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

        // Raccourcis clavier pour le debug - garder une référence pour pouvoir les supprimer
        this.keydownHandler = (e) => {
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
        };
        
        document.addEventListener('keydown', this.keydownHandler);
    }

    async loadInitialData() {
        try {
            const response = await fetch('/api/images');
            const data = await response.json();
            
            this.updateImages(data.images);
            this.updateSettings(data.settings);
            
            // Demander l'état actuel du slideshow au serveur pour se synchroniser
            if (this.socket) {
                this.socket.emit('get-slideshow-state');
            }
        } catch (error) {
            console.error('Erreur lors du chargement initial:', error);
            this.hideLoading();
            this.showNoImages();
        }
    }

    handleImageChange(data) {
        // Gérer un changement d'image avec transition
        if (!data || !data.currentImage) {
            return;
        }

        console.log('Changement d\'image avec transition:', data.currentImage.filename);

        // Stocker les données d'image fournies par le serveur
        this.serverCurrentImage = data.currentImage;
        this.serverNextImage = data.nextImage;
        this.currentIndex = data.currentIndex;
        this.isPlaying = data.isPlaying !== undefined ? data.isPlaying : this.isPlaying;

        // Toujours faire une transition pour les changements d'image
        this.transitionToServerImage(data.currentImage.path, data.direction);
    }

    handleStateSync(data) {
        // Gérer une synchronisation d'état (première connexion, etc.)
        if (!data || !data.currentImage) {
            return;
        }

        console.log('Synchronisation d\'état:', data.currentImage.filename);

        // Stocker les données d'image fournies par le serveur
        this.serverCurrentImage = data.currentImage;
        this.serverNextImage = data.nextImage;
        this.currentIndex = data.currentIndex;
        this.isPlaying = data.isPlaying !== undefined ? data.isPlaying : this.isPlaying;

        // Vérifier si l'image affichée est différente
        const currentPath = this.currentImage.src;
        const newPath = data.currentImage.path;
        
        if (!currentPath || currentPath === '') {
            // Première image, affichage direct
            this.displayImageDirectly(data.currentImage.path);
        } else {
            // Construire l'URL complète pour la comparaison
            const currentUrl = new URL(currentPath, window.location.origin).pathname;
            const newUrl = newPath;
            
            if (currentUrl !== newUrl) {
                // L'image a changé, affichage direct pour la synchro
                console.log(`Synchronisation: changement d'image de ${currentUrl} vers ${newUrl}`);
                this.displayImageDirectly(data.currentImage.path);
            }
        }
    }

    transitionToServerImage(imagePath, direction = 1) {
        // Transition vers l'image demandée par le serveur
        console.log('transitionToServerImage appelée:', imagePath, 'direction:', direction, 'isTransitioning:', this.isTransitioning);
        
        if (this.isTransitioning) {
            // Si une transition est en cours, l'interrompre proprement et afficher directement
            console.log('Transition en cours, nettoyage et affichage direct');
            this.cleanupTransition();
            this.displayImageDirectly(imagePath);
            return;
        }

        this.isTransitioning = true;
        
        // Démarrer la transition directement - le préchargement est géré dans performTransition
        this.performTransition(imagePath);
    }

    displayImageDirectly(imagePath) {
        // Affichage direct sans transition pour la synchronisation
        if (!this.currentImage) {
            console.error('currentImage element not found');
            return;
        }

        // Arrêter toute transition en cours
        this.isTransitioning = false;

        const img = new Image();
        img.onload = () => {
            // Nettoyer les classes de transition et remettre l'image principale visible
            this.currentImage.src = imagePath;
            this.currentImage.className = `slide-image visible filter-${this.settings.filter}`;
            this.currentImage.style.opacity = '1';
            this.currentImage.style.transform = '';
            
            // S'assurer que l'image suivante est cachée et nettoyée
            if (this.nextImage) {
                this.nextImage.classList.add('hidden');
                this.nextImage.style.opacity = '0';
                this.nextImage.style.transform = '';
                this.nextImage.className = 'slide-image hidden';
            }
            
            this.preloadNextImage();
            console.log('Image affichée directement:', imagePath);
        };
        img.onerror = () => {
            console.error('Erreur de chargement lors de l\'affichage direct:', imagePath);
        };
        img.src = imagePath;
    }

    updateImages(images, newImageAdded = null) {
        this.images = images;
        
        if (this.images.length === 0) {
            this.hideLoading();
            this.showNoImages();
            return;
        }

        this.hideNoImages();
        this.hideLoading();
        
        // Créer la liste mélangée avec les informations du serveur
        this.createShuffledImagesList(newImageAdded);
        
        // Si une nouvelle image a été ajoutée et que le shuffle est activé, 
        // l'index sera géré par le serveur
        if (newImageAdded && this.settings.shuffleImages) {
            console.log(`🎯 Nouvelle image détectée: ${newImageAdded}, le serveur gère la synchronisation`);
        }
        
        // Si c'est le premier chargement d'images, attendre les instructions du serveur
        if (this.currentIndex >= this.getImagesList().length) {
            this.currentIndex = 0;
        }

        // Ne pas démarrer automatiquement - attendre les instructions du serveur
        console.log('Images mises à jour, en attente des instructions du serveur');
        
        // Si on a déjà une image à afficher, la montrer
        if (this.getImagesList().length > 0 && this.currentIndex < this.getImagesList().length) {
            const currentImageData = this.getCurrentImageData();
            if (currentImageData && (!this.currentImage.src || this.currentImage.src === '')) {
                this.displayImageDirectly(currentImageData.path);
            }
        }
    }

    showCurrentImage() {
        if (this.images.length === 0) return;

        const currentImageData = this.getCurrentImageData();
        if (!currentImageData) return;

        // Afficher l'image directement (sans transition pour l'initialisation)
        this.displayImageDirectly(currentImageData.path);
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
        
        // Le timer est maintenant géré côté serveur
        console.log('Paramètres mis à jour, timer géré par le serveur');
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
        // Utiliser les données d'image fournies par le serveur
        if (!this.serverCurrentImage) {
            console.log('Aucune donnée d\'image du serveur disponible');
            return;
        }

        // Précharger l'image
        const img = new Image();
        img.onload = () => {
            this.currentImage.src = this.serverCurrentImage.path;
            this.currentImage.className = `slide-image visible filter-${this.settings.filter}`;
            
            // Précharger la prochaine image
            this.preloadNextImage();
        };
        img.onerror = () => {
            console.error('Impossible de charger l\'image:', this.serverCurrentImage.path);
            // Ne plus appeler nextSlide() localement, laisser le serveur gérer
        };
        img.src = this.serverCurrentImage.path;
    }

    preloadNextImage() {
        // Utiliser l'image suivante fournie par le serveur si disponible
        if (this.serverNextImage && this.serverNextImage.path !== this.currentImage.src) {
            const img = new Image();
            img.src = this.serverNextImage.path;
            console.log('Préchargement de l\'image suivante:', this.serverNextImage.filename);
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
        // Les changements d'image sont maintenant gérés uniquement par le serveur
        // Cette méthode ne sert plus que pour les raccourcis clavier locaux
        console.log('Demande de passage à l\'image suivante envoyée au serveur');
        if (this.socket) {
            this.socket.emit('next-image');
        }
    }

    prevSlide() {
        // Les changements d'image sont maintenant gérés uniquement par le serveur
        // Cette méthode ne sert plus que pour les raccourcis clavier locaux
        console.log('Demande de passage à l\'image précédente envoyée au serveur');
        if (this.socket) {
            this.socket.emit('prev-image');
        }
    }

    performTransition(newImagePath) {
        console.log('performTransition appelée avec:', newImagePath, 'transition:', this.settings.transition);
        
        // Nettoyer toute transition en cours
        this.cleanupTransition();
        
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
                console.log('Transition par défaut: fade');
                this.fadeTransition(newImagePath);
        }
    }

    cleanupTransition() {
        // Nettoyer les timers de transition en cours
        if (this.transitionTimer) {
            clearTimeout(this.transitionTimer);
            this.transitionTimer = null;
        }
        
        // Réinitialiser les styles et classes
        if (this.currentImage) {
            this.currentImage.style.transform = '';
            this.currentImage.style.opacity = '1';
            this.currentImage.className = `slide-image visible filter-${this.settings.filter}`;
        }
        
        if (this.nextImage) {
            this.nextImage.style.transform = '';
            this.nextImage.style.opacity = '0';
            this.nextImage.className = 'slide-image hidden';
            this.nextImage.classList.add('hidden');
        }
    }

    noneTransition(newImagePath) {
        console.log('Transition none vers:', newImagePath);
        
        // Précharger l'image avant de l'afficher
        const img = new Image();
        img.onload = () => {
            this.currentImage.src = newImagePath;
            this.currentImage.className = `slide-image visible filter-${this.settings.filter}`;
            this.currentImage.style.opacity = '1';
            this.currentImage.style.transform = '';
            
            this.isTransitioning = false;
            this.preloadNextImage();
            console.log('Transition none terminée');
        };
        img.onerror = () => {
            console.error('Erreur de chargement lors de la transition none:', newImagePath);
            this.isTransitioning = false;
        };
        img.src = newImagePath;
    }

    fadeTransition(newImagePath) {
        if (!this.nextImage) {
            console.error('nextImage element not found, falling back to direct display');
            this.displayImageDirectly(newImagePath);
            return;
        }

        console.log('Démarrage transition fade vers:', newImagePath);
        
        // Précharger l'image avant de commencer la transition
        const img = new Image();
        img.onload = () => {
            this.startFadeTransition(newImagePath);
        };
        img.onerror = () => {
            console.error('Erreur de chargement lors de la transition fade:', newImagePath);
            this.isTransitioning = false;
        };
        img.src = newImagePath;
    }

    startFadeTransition(newImagePath) {
        // Préparer l'image suivante
        this.nextImage.src = newImagePath;
        this.nextImage.className = `slide-image transition-fade filter-${this.settings.filter}`;
        this.nextImage.style.opacity = '0';
        this.nextImage.style.transform = '';
        this.nextImage.classList.remove('hidden');

        // Utiliser requestAnimationFrame pour des transitions plus fluides
        requestAnimationFrame(() => {
            // Fade out current, fade in next
            if (this.currentImage) {
                this.currentImage.style.opacity = '0';
            }
            this.nextImage.style.opacity = '1';
            
            // Utiliser un seul timer pour finir la transition
            this.transitionTimer = setTimeout(() => {
                this.finishTransition();
                console.log('Transition fade terminée');
            }, 1000); // Correspond à la durée CSS
        });
    }

    slideTransition(newImagePath) {
        if (!this.nextImage) {
            console.error('nextImage element not found, falling back to direct display');
            this.displayImageDirectly(newImagePath);
            return;
        }

        console.log('Démarrage transition slide vers:', newImagePath);
        
        // Précharger l'image avant de commencer la transition
        const img = new Image();
        img.onload = () => {
            this.startSlideTransition(newImagePath);
        };
        img.onerror = () => {
            console.error('Erreur de chargement lors de la transition slide:', newImagePath);
            this.isTransitioning = false;
        };
        img.src = newImagePath;
    }

    startSlideTransition(newImagePath) {
        // Préparer l'image suivante
        this.nextImage.src = newImagePath;
        this.nextImage.className = `slide-image transition-slide filter-${this.settings.filter}`;
        this.nextImage.style.opacity = '1';
        this.nextImage.style.transform = 'translateX(100%)';
        this.nextImage.classList.remove('hidden');

        requestAnimationFrame(() => {
            // Démarrer les animations
            if (this.currentImage) {
                this.currentImage.style.transform = 'translateX(-100%)';
            }
            this.nextImage.style.transform = 'translateX(0)';
            
            this.transitionTimer = setTimeout(() => {
                this.finishTransition();
                console.log('Transition slide terminée');
            }, 1000); // Correspond à la durée CSS
        });
    }

    zoomTransition(newImagePath) {
        if (!this.nextImage) {
            console.error('nextImage element not found, falling back to direct display');
            this.displayImageDirectly(newImagePath);
            return;
        }

        console.log('Démarrage transition zoom vers:', newImagePath);
        
        // Précharger l'image avant de commencer la transition
        const img = new Image();
        img.onload = () => {
            this.startZoomTransition(newImagePath);
        };
        img.onerror = () => {
            console.error('Erreur de chargement lors de la transition zoom:', newImagePath);
            this.isTransitioning = false;
        };
        img.src = newImagePath;
    }

    startZoomTransition(newImagePath) {
        // Préparer l'image suivante
        this.nextImage.src = newImagePath;
        this.nextImage.className = `slide-image transition-zoom filter-${this.settings.filter}`;
        this.nextImage.style.opacity = '0';
        this.nextImage.style.transform = 'scale(1.1)';
        this.nextImage.classList.remove('hidden');

        requestAnimationFrame(() => {
            // Démarrer les animations
            if (this.currentImage) {
                this.currentImage.style.opacity = '0';
                this.currentImage.style.transform = 'scale(0.9)';
            }
            this.nextImage.style.opacity = '1';
            this.nextImage.style.transform = 'scale(1)';
            
            this.transitionTimer = setTimeout(() => {
                this.finishTransition();
                console.log('Transition zoom terminée');
            }, 1500); // Durée plus longue pour le zoom
        });
    }

    finishTransition() {
        // Nettoyer le timer
        if (this.transitionTimer) {
            clearTimeout(this.transitionTimer);
            this.transitionTimer = null;
        }

        // Échanger les éléments de manière propre
        if (this.nextImage && this.currentImage) {
            // L'image suivante devient l'image courante
            this.nextImage.className = `slide-image visible filter-${this.settings.filter}`;
            this.nextImage.style.opacity = '1';
            this.nextImage.style.transform = '';
            
            // L'ancienne image courante devient cachée
            this.currentImage.className = 'slide-image hidden';
            this.currentImage.style.opacity = '0';
            this.currentImage.style.transform = '';
            this.currentImage.classList.add('hidden');
            
            // Échanger les références
            const temp = this.currentImage;
            this.currentImage = this.nextImage;
            this.nextImage = temp;
        }
        
        this.isTransitioning = false;
        this.preloadNextImage();
    }

    startSlideshow() {
        // Le timer est maintenant géré côté serveur
        // Cette méthode ne fait que mettre à jour l'état local
        this.isPlaying = true;
        console.log('Slideshow démarré (géré par le serveur)');
    }

    stopSlideshow() {
        // Le timer est maintenant géré côté serveur
        // Cette méthode ne fait que mettre à jour l'état local
        this.isPlaying = false;
        console.log('Slideshow arrêté (géré par le serveur)');
    }

    pauseSlideshow() {
        this.isPlaying = false;
        // Plus besoin d'arrêter un timer local
        console.log('Slideshow mis en pause (synchronisé avec le serveur)');
    }

    resumeSlideshow() {
        this.isPlaying = true;
        // Plus besoin de démarrer un timer local
        console.log('Slideshow repris (synchronisé avec le serveur)');
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

    destroy() {
        // Nettoyer les timers et événements lors de la destruction
        this.cleanupTransition();
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        // Nettoyer les event listeners
        document.removeEventListener('keydown', this.keydownHandler);
    }
}

// Initialisation quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    window.slideshow = new PhotoLiveSlideshow();
});
