<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# PhotoLive OBS - Instructions Copilot

Ce projet est une application Node.js/Express qui crée un diaporama photo en temps réel pour OBS Studio.

## Architecture du projet

- **Backend** : Node.js avec Express, Socket.IO pour temps réel, Chokidar pour surveillance fichiers
- **Frontend** : HTML/CSS/JavaScript vanilla avec WebSockets
- **Structure MVC** : Server.js comme contrôleur principal, fichiers statiques dans /public
- **Surveillance temps réel** : Chokidar surveille le dossier /photos, Socket.IO propage les changements
- **Application web pure** : Plus de dépendance Electron, interface 100% web

## Conventions de code

### Backend (Node.js)
- Utiliser async/await pour les opérations asynchrones
- Gestion d'erreurs avec try/catch
- Logs console.log pour debugging, console.error pour erreurs
- Validation des données entrantes dans les routes API
- Utiliser path.join() pour construction des chemins de fichiers

### Frontend (JavaScript)
- Classes ES6 pour organisation du code
- Event listeners pour interactions utilisateur  
- Fetch API pour requêtes HTTP
- Socket.io-client pour WebSockets
- DOM manipulation directe (pas de framework)

### CSS
- CSS Grid et Flexbox pour layouts
- Variables CSS pour thématique
- Animations CSS pour transitions
- Mobile-first responsive design
- Classes utilitaires (.hidden, .visible, etc.)

## Fonctionnalités clés

### Surveillance fichiers
- Chokidar surveille ./photos/ pour nouveaux fichiers
- Filtrage par extensions supportées
- Émission WebSocket lors de changements

### Interface diaporama (/slideshow.html)
- Affichage plein écran optimisé pour OBS
- Transitions fluides entre images
- Filtres CSS visuels
- Filigrane personnalisable
- Contrôle par WebSocket

### Interface contrôle (/control.html)  
- Panneau administration complet
- Contrôles lecture/pause/navigation
- Configuration transitions/filtres/filigrane
- Aperçu grille des images
- Statistiques temps réel

## Patterns techniques

### WebSocket Events
```javascript
// Serveur émet
io.emit('images-updated', { images, settings });
io.emit('settings-updated', settings);

// Client écoute  
socket.on('images-updated', handleImagesUpdate);
socket.on('settings-updated', handleSettingsUpdate);
```

### Gestion d'état
- État global dans classes JavaScript
- Synchronisation via WebSocket
- Persistance settings via API REST

### Performance
- Préchargement des images suivantes
- Limitation taille images (recommandé < 2MB)
- Throttling des événements de surveillance fichiers

## Bonnes pratiques

- Toujours valider paths et extensions de fichiers
- Gérer les erreurs de chargement d'images
- Responsive design pour interface contrôle
- Accessibilité (alt text, contrôles clavier)
- Documentation des API et événements WebSocket
- Tests de compatibilité OBS Studio
