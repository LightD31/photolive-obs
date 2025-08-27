class PhotoLiveSlideshow {
    constructor() {
        this.socket = null;
        this.images = [];
        this.currentIndex = 0;
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
            transparentBackground: false,
            imageCornerRadius: 0
        };
        this.isPlaying = true;
        
        // Données d'images fournies par le serveur
        this.serverCurrentImage = null;
        
        this.init();
    }

    async init() {
        // Initialize i18n first
        await this.initializeI18n();
        
        this.setupElements();
        this.setupSocket();
        this.setupEventListeners();
        this.loadInitialData();
    }

    async initializeI18n() {
        try {
            // Use saved language preference from localStorage
            const savedLanguage = localStorage.getItem('photolive-language');
            await window.i18n.init(savedLanguage);
        } catch (error) {
            console.error('Failed to initialize i18n:', error);
        }
    }

    setupElements() {
        this.currentImageElement = document.getElementById('current-image');
        this.nextImageElement = document.getElementById('next-image');
        this.currentImageWrapper = document.getElementById('current-image-wrapper');
        this.nextImageWrapper = document.getElementById('next-image-wrapper');
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

    getVisibleImageElement() {
        // Return the image element that is currently visible
        if (!this.currentImageElement.classList.contains('hidden') && 
            this.currentImageElement.style.visibility !== 'hidden' &&
            this.currentImageElement.src) {
            return this.currentImageElement;
        }
        if (!this.nextImageElement.classList.contains('hidden') && 
            this.nextImageElement.style.visibility !== 'hidden' &&
            this.nextImageElement.src) {
            return this.nextImageElement;
        }
        // Default to current-image element if neither is clearly visible
        return this.currentImageElement;
    }

    getHiddenImageElement() {
        // Return the image element that is currently hidden
        const visible = this.getVisibleImageElement();
        return visible === this.currentImageElement ? this.nextImageElement : this.currentImageElement;
    }

    getVisibleImageWrapper() {
        // Return the wrapper of the currently visible image element
        const visibleImage = this.getVisibleImageElement();
        return visibleImage === this.currentImageElement ? this.currentImageWrapper : this.nextImageWrapper;
    }

    getHiddenImageWrapper() {
        // Return the wrapper of the currently hidden image element
        const hiddenImage = this.getHiddenImageElement();
        return hiddenImage === this.currentImageElement ? this.currentImageWrapper : this.nextImageWrapper;
    }

    setupEventListeners() {
        // Gestion des erreurs de chargement d'images
        this.currentImageElement.addEventListener('error', () => {
            console.error('Error loading current image');
            this.nextSlide();
        });

        // Handle window resize to recalculate wrapper dimensions
        this.resizeHandler = () => {
            // Recalculate corner radius sizing when window is resized
            if (this.settings.imageCornerRadius > 0) {
                this.updateImageCornerRadius();
            }
        };
        window.addEventListener('resize', this.resizeHandler);

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
            console.error('Error during initial loading:', error);
            this.hideLoading();
            this.showNoImages();
        }
    }

    handleImageChange(data) {
        // Gérer un changement d'image avec transition
        if (!data || !data.currentImage) {
            console.warn('Image change event with invalid data:', data);
            return;
        }

        console.log('Changement d\'image avec transition:', data.currentImage.filename, 'index:', data.currentIndex);

        // Stocker les données d'image fournies par le serveur - TOUJOURS synchroniser avec le serveur
        this.serverCurrentImage = data.currentImage;
        this.currentIndex = data.currentIndex;
        this.isPlaying = data.isPlaying !== undefined ? data.isPlaying : this.isPlaying;

        // Toujours faire une transition pour les changements d'image
        this.transitionToServerImage(data.currentImage.path, data.direction || 1);
    }

    handleStateSync(data) {
        // Gérer une synchronisation d'état (première connexion, etc.)
        if (!data || !data.currentImage) {
            console.log('State sync without current image, waiting...');
            return;
        }

        console.log('Synchronisation d\'état:', data.currentImage.filename, 'index:', data.currentIndex);

        // Stocker les données d'image fournies par le serveur - TOUJOURS synchroniser avec le serveur
        this.serverCurrentImage = data.currentImage;
        this.currentIndex = data.currentIndex;
        this.isPlaying = data.isPlaying !== undefined ? data.isPlaying : this.isPlaying;

        // Vérifier si l'image affichée est différente
        const visibleElement = this.getVisibleImageElement();
        const currentPath = visibleElement ? visibleElement.src : '';
        const newPath = data.currentImage.path;
        
        if (!currentPath || currentPath === '') {
            // Première image, affichage direct
            console.log('Première image, affichage direct');
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
        console.log('Transitioning to image:', imagePath, 'with transition:', this.settings.transition);
        
        // If no transition, display directly
        if (this.settings.transition === 'none') {
            this.displayImageDirectly(imagePath);
            return;
        }
        
        // Check if we're transitioning to the same image
        const visibleElement = this.getVisibleImageElement();
        const currentUrl = visibleElement.src ? new URL(visibleElement.src, window.location.origin).pathname : '';
        const newUrl = imagePath;
        
        if (currentUrl === newUrl) {
            console.log('Same image, skipping transition');
            return;
        }
        
        // Implement transition based on settings
        switch (this.settings.transition) {
            case 'fade':
                this.fadeTransition(imagePath);
                break;
            case 'slide':
                this.slideTransition(imagePath, direction);
                break;
            case 'zoom':
                this.zoomTransition(imagePath);
                break;
            default:
                this.displayImageDirectly(imagePath);
        }
    }

    fadeTransition(imagePath) {
        // Get the currently visible and hidden elements
        const currentElement = this.getVisibleImageElement();
        const nextElement = this.getHiddenImageElement();
        
        // Preload the new image
        const img = new Image();
        img.onload = () => {
            // Set up proper z-index: current element on top during fade
            currentElement.classList.add('z-front');
            nextElement.classList.remove('z-front');
            nextElement.classList.add('z-back');
            
            // Set up the next image for fade in (behind current image, start invisible)
            nextElement.src = imagePath;
            nextElement.className = `slide-image filter-${this.settings.filter} z-back`;
            nextElement.style.opacity = '0'; // Start invisible to prevent flash
            nextElement.style.transform = '';
            nextElement.style.visibility = 'visible';
            
            // Start the crossfade transition
            currentElement.className = `slide-image filter-${this.settings.filter} transition-fade z-front`;
            nextElement.className = `slide-image filter-${this.settings.filter} transition-fade z-back`;
            
            // Trigger the fade animation
            requestAnimationFrame(() => {
                currentElement.style.opacity = '0';
                nextElement.style.opacity = '1'; // Fade in the next image
            });
            
            // After transition completes, finalize the switch
            setTimeout(() => {
                this.completeTransition(currentElement, nextElement);
            }, 1000);
        };
        img.onerror = () => {
            console.error('Error loading image for fade transition:', imagePath);
            this.displayImageDirectly(imagePath);
        };
        img.src = imagePath;
    }

    slideTransition(imagePath, direction) {
        // Get the currently visible and hidden elements
        const currentElement = this.getVisibleImageElement();
        const nextElement = this.getHiddenImageElement();
        
        // Preload the new image
        const img = new Image();
        img.onload = () => {
            // Set up proper z-index: current element on top during slide
            currentElement.classList.add('z-front');
            nextElement.classList.remove('z-front');
            nextElement.classList.add('z-back');
            
            // Set up the next image completely hidden first to prevent flash
            nextElement.src = imagePath;
            nextElement.className = `slide-image filter-${this.settings.filter} z-back`;
            nextElement.style.opacity = '0'; // Start hidden to prevent flash
            nextElement.style.visibility = 'visible';
            nextElement.style.transform = direction > 0 ? 'translateX(120%)' : 'translateX(-120%)';
            
            // Add transition classes to both images
            currentElement.className = `slide-image filter-${this.settings.filter} transition-slide z-front`;
            nextElement.className = `slide-image filter-${this.settings.filter} transition-slide z-back`;
            
            // Start the slide animation
            requestAnimationFrame(() => {
                nextElement.style.opacity = '1'; // Make visible now that it's positioned off-screen
                currentElement.style.transform = direction > 0 ? 'translateX(-120%)' : 'translateX(120%)';
                nextElement.style.transform = 'translateX(0)';
            });
            
            // After transition completes, finalize the switch
            setTimeout(() => {
                this.completeTransition(currentElement, nextElement);
            }, 1000);
        };
        img.onerror = () => {
            console.error('Error loading image for slide transition:', imagePath);
            this.displayImageDirectly(imagePath);
        };
        img.src = imagePath;
    }

    zoomTransition(imagePath) {
        // Get the currently visible and hidden elements
        const currentElement = this.getVisibleImageElement();
        const nextElement = this.getHiddenImageElement();
        
        // Preload the new image
        const img = new Image();
        img.onload = () => {
            // Set up proper z-index: next element on top (will zoom in over current)
            nextElement.classList.add('z-front');
            currentElement.classList.remove('z-front');
            currentElement.classList.add('z-back');
            
            // Set up the next image for zoom in (start small and hidden)
            nextElement.src = imagePath;
            nextElement.className = `slide-image filter-${this.settings.filter} z-front`;
            nextElement.style.transform = 'scale(0.1)';
            nextElement.style.opacity = '0';
            nextElement.style.visibility = 'visible';
            
            // Start zoom in animation for next image
            requestAnimationFrame(() => {
                nextElement.className = `slide-image filter-${this.settings.filter} transition-zoom-in z-front`;
                nextElement.style.transform = 'scale(1)';
                nextElement.style.opacity = '1';
            });
            
            // After zoom in completes, remove the current image
            setTimeout(() => {
                this.completeTransition(currentElement, nextElement);
            }, 1500); // Full duration for zoom in animation
        };
        img.onerror = () => {
            console.error('Error loading image for zoom transition:', imagePath);
            this.displayImageDirectly(imagePath);
        };
        img.src = imagePath;
    }

    completeTransition(oldElement, newElement) {
        // Hide the old image element
        oldElement.className = 'slide-image hidden';
        oldElement.style.opacity = '';
        oldElement.style.transform = '';
        oldElement.style.visibility = 'hidden';
        oldElement.classList.remove('z-front', 'z-back');
        
        // Ensure new image is properly styled as visible with correct z-index
        newElement.className = `slide-image visible filter-${this.settings.filter} z-front`;
        newElement.style.opacity = '1';
        newElement.style.transform = '';
        newElement.style.visibility = 'visible';
        
        // Update corner radius now that the transition is complete
        this.updateImageCornerRadius();
        
        console.log('Transition complete, old element hidden, new element visible with proper z-index');
    }

    displayImageDirectly(imagePath) {
        // Display image directly without transitions
        const currentElement = this.getVisibleImageElement();
        
        if (!currentElement) {
            console.error('No image element found');
            return;
        }

        const img = new Image();
        img.onload = () => {
            // Set the image in the currently visible element
            currentElement.src = imagePath;
            currentElement.className = `slide-image visible filter-${this.settings.filter} z-front`;
            currentElement.style.opacity = '1';
            currentElement.style.transform = '';
            currentElement.style.visibility = 'visible';
            
            // Ensure the other image element is hidden with proper z-index
            const otherElement = this.getHiddenImageElement();
            if (otherElement) {
                otherElement.className = 'slide-image hidden';
                otherElement.style.opacity = '';
                otherElement.style.transform = '';
                otherElement.style.visibility = 'hidden';
                otherElement.classList.remove('z-front', 'z-back');
            }
            
            // Update corner radius now that image is loaded and has natural dimensions
            this.updateImageCornerRadius();
            
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
        
        // Les images sont déjà dans le bon ordre (mélangé ou chronologique) depuis le serveur
        console.log(`📋 Images reçues du serveur: ${this.images.length} images dans l'ordre ${this.settings.shuffleImages ? 'mélangé' : 'chronologique'}`);
        
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
            const visibleElement = this.getVisibleImageElement();
            if (currentImageData && (!visibleElement.src || visibleElement.src === '')) {
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

    getImagesList() {
        // The server now sends images in the correct order, so we always use this.images
        return this.images;
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        
        // Note: Shuffle logic is now handled server-side, no need to recreate lists
        
        // Mettre à jour l'arrière-plan transparent
        this.updateBackground();
        
        // Mettre à jour le filigrane
        this.updateWatermark();
        
        // Mettre à jour l'overlay
        this.updateOverlay();
        
        // Mettre à jour le rayon des coins des images
        this.updateImageCornerRadius();
        
        // Le timer est maintenant géré côté serveur
        console.log('Paramètres mis à jour, shuffle géré par le serveur');
    }

    updateImageCornerRadius() {
        const radius = this.settings.imageCornerRadius || 0;
        
        if (radius > 0) {
            // Apply border-radius and size wrappers to actual image content
            this.applyCornerRadiusToImageContent(radius);
        } else {
            // Reset wrappers to full size when no corner radius
            this.resetWrapperSizing();
        }
        
        console.log('Corner radius updated:', radius > 0 ? `${radius}px` : 'none');
    }

    calculateImageDisplayDimensions(img) {
        // Get the container dimensions (viewport)
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;
        
        // Get the image natural dimensions
        const imageAspectRatio = img.naturalWidth / img.naturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        let displayWidth, displayHeight;
        
        if (imageAspectRatio > containerAspectRatio) {
            // Image is wider than container - fit by width
            displayWidth = containerWidth;
            displayHeight = containerWidth / imageAspectRatio;
        } else {
            // Image is taller than container - fit by height
            displayHeight = containerHeight;
            displayWidth = containerHeight * imageAspectRatio;
        }
        
        return {
            width: displayWidth,
            height: displayHeight,
            left: (containerWidth - displayWidth) / 2,
            top: (containerHeight - displayHeight) / 2
        };
    }

    applyWrapperSizing(wrapper, dimensions, radius) {
        if (!wrapper) return;
        
        wrapper.style.width = `${dimensions.width}px`;
        wrapper.style.height = `${dimensions.height}px`;
        wrapper.style.left = `${dimensions.left}px`;
        wrapper.style.top = `${dimensions.top}px`;
        wrapper.style.borderRadius = `${radius}px`;
        wrapper.style.overflow = 'hidden';
    }

    resetWrapperSizing() {
        // Reset both wrappers to full viewport size
        [this.currentImageWrapper, this.nextImageWrapper].forEach(wrapper => {
            if (wrapper) {
                wrapper.style.width = '100%';
                wrapper.style.height = '100%';
                wrapper.style.left = '0';
                wrapper.style.top = '0';
                wrapper.style.borderRadius = '0px';
                wrapper.style.overflow = 'hidden';
            }
        });
    }

    applyCornerRadiusToImageContent(radius) {
        // Apply sizing to both image elements based on their content
        const currentImg = this.currentImageElement;
        const nextImg = this.nextImageElement;
        
        if (currentImg && currentImg.naturalWidth && currentImg.naturalHeight && currentImg.src) {
            const dimensions = this.calculateImageDisplayDimensions(currentImg);
            this.applyWrapperSizing(this.currentImageWrapper, dimensions, radius);
        }
        
        if (nextImg && nextImg.naturalWidth && nextImg.naturalHeight && nextImg.src) {
            const dimensions = this.calculateImageDisplayDimensions(nextImg);
            this.applyWrapperSizing(this.nextImageWrapper, dimensions, radius);
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
        window.removeEventListener('resize', this.resizeHandler);
    }
}

// Initialisation quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    window.slideshow = new PhotoLiveSlideshow();
});
