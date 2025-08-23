class PhotoLiveSlideshow {
    constructor() {
        this.socket = null;
        this.images = [];
        this.shuffledImages = [];
        this.currentIndex = 0;
        this.settings = {
            interval: 5000,
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
        
        // Données d'images fournies par le serveur
        this.serverCurrentImage = null;
        
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
        // Display the image directly without transitions
        console.log('Displaying image:', imagePath);
        this.displayImageDirectly(imagePath);
    }

    displayImageDirectly(imagePath) {
        // Display image directly without transitions
        if (!this.currentImage) {
            console.error('currentImage element not found');
            return;
        }

        const img = new Image();
        img.onload = () => {
            // Set the image and apply filter
            this.currentImage.src = imagePath;
            this.currentImage.className = `slide-image visible filter-${this.settings.filter}`;
            this.currentImage.style.opacity = '1';
            this.currentImage.style.transform = '';
            
            console.log('Image displayed:', imagePath);
        };
        img.onerror = () => {
            console.error('Error loading image:', imagePath);
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
        // Clean up events when destroying
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
