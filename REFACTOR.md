# PhotoLive OBS - Architecture Refactorisée

## Vue d'ensemble

Ce projet a été refactorisé pour adopter une architecture modulaire et maintenable. Le monolithe de plus de 2000 lignes dans `server.js` a été décomposé en modules spécialisés.

## Architecture

```
src/
├── app.js                    # Application principale
├── config/
│   └── index.js             # Configuration centralisée
├── controllers/
│   ├── apiController.js     # Contrôleur API REST
│   └── uploadController.js  # Contrôleur upload de fichiers
├── middleware/
│   ├── cors.js              # Configuration CORS
│   ├── errorHandler.js      # Gestion d'erreurs centralisée
│   └── requestLogger.js     # Logger des requêtes
├── services/
│   ├── imageService.js      # Service de gestion des images
│   ├── watermarkService.js  # Service de gestion des filigranes
│   ├── fileWatcherService.js # Service de surveillance des fichiers
│   └── socketService.js     # Service WebSocket
└── utils/
    ├── logger.js            # Système de logging amélioré
    ├── exifHelper.js        # Utilitaires EXIF
    └── fileHelper.js        # Utilitaires fichiers
```

## Améliorations apportées

### 1. **Séparation des responsabilités**
- **Controllers** : Gestion des requêtes HTTP et validation
- **Services** : Logique métier et gestion d'état
- **Middleware** : Traitement transversal des requêtes
- **Utils** : Fonctions utilitaires réutilisables

### 2. **Configuration centralisée**
- Chargement et gestion de la configuration dans un module dédié
- Support des variables d'environnement
- Validation et valeurs par défaut

### 3. **Gestion d'erreurs améliorée**
- Middleware d'erreur global
- Gestion des erreurs asynchrones
- Logging structuré des erreurs
- Arrêt gracieux du serveur

### 4. **Services spécialisés**
- **ImageService** : Gestion des images, tri, filtrage
- **WatermarkService** : Gestion des filigranes
- **FileWatcherService** : Surveillance des fichiers avec events
- **SocketService** : Communication WebSocket centralisée

### 5. **Utilitaires modulaires**
- **Logger** : Système de logs avec niveaux
- **ExifHelper** : Extraction et traitement EXIF
- **FileHelper** : Opérations fichiers sécurisées

### 6. **Sécurité améliorée**
- Validation des chemins (prévention directory traversal)
- Gestion sécurisée des uploads
- Validation des types de fichiers
- Limites de taille de fichiers

## Utilisation

### Serveur refactorisé
```bash
node server-new.js
```

### Serveur original (pour comparaison)
```bash
node server.js
```

## Tâches VS Code

Deux tâches sont disponibles :
- **Start PhotoLive OBS Server (Original)** : Lance l'ancien serveur
- **Start PhotoLive OBS Server (Refactored)** : Lance le nouveau serveur

## API REST

### Endpoints principaux

#### Slideshow
- `GET /api/slideshow/state` - État du diaporama
- `POST /api/slideshow/next` - Image suivante
- `POST /api/slideshow/previous` - Image précédente
- `POST /api/slideshow/pause` - Pause
- `POST /api/slideshow/resume` - Reprise
- `POST /api/slideshow/jump/:index` - Aller à l'image

#### Images
- `GET /api/images` - Liste des images
- `POST /api/images/reload` - Recharger les images
- `POST /api/images/:filename/exclude` - Exclure une image
- `POST /api/images/:filename/priority` - Prioriser une image
- `POST /api/images/:filename/seen` - Marquer comme vue

#### Configuration
- `GET /api/settings` - Obtenir les paramètres
- `POST /api/settings` - Mettre à jour les paramètres
- `POST /api/photos/path` - Changer le dossier photos

#### Filigranes
- `GET /api/watermarks` - Liste des filigranes
- `POST /api/upload/watermark` - Upload filigrane
- `DELETE /api/watermarks/:filename` - Supprimer filigrane

#### Système
- `GET /api/status` - État du serveur

## WebSocket Events

### Émis par le serveur
- `images-updated` - Images mises à jour
- `slideshow-state` - État du diaporama
- `settings-updated` - Paramètres mis à jour
- `image-changed` - Image changée

### Reçus du client
- `next-image` - Image suivante
- `prev-image` - Image précédente
- `jump-to-image` - Aller à l'image
- `pause-slideshow` - Pause
- `resume-slideshow` - Reprise
- `toggle-image-exclusion` - Basculer exclusion
- `toggle-image-priority` - Basculer priorité
- `mark-image-seen` - Marquer comme vue
- `update-settings` - Mettre à jour paramètres

## Avantages de la refactorisation

1. **Maintenabilité** : Code modulaire plus facile à comprendre et modifier
2. **Testabilité** : Modules isolés testables individuellement
3. **Extensibilité** : Ajout de nouvelles fonctionnalités simplifié
4. **Réutilisabilité** : Services et utilitaires réutilisables
5. **Robustesse** : Gestion d'erreurs améliorée
6. **Performance** : Meilleure gestion des ressources
7. **Sécurité** : Validation et sécurisation renforcées

## Migration

Le serveur refactorisé est compatible avec l'interface existante. Aucune modification n'est nécessaire côté client.

Pour migrer définitivement :
1. Tester le nouveau serveur avec `node server-new.js`
2. Vérifier le bon fonctionnement
3. Remplacer `server.js` par le nouveau code
4. Supprimer `server-new.js`

## Structure des données

### Image Object
```javascript
{
  filename: string,
  path: string,
  size: number,
  createdAt: Date,
  modifiedAt: Date,
  photoDate: Date,
  thumbnail: string|null,
  isNew: boolean,
  isPriority: boolean,
  isExcluded: boolean
}
```

### Settings Object
```javascript
{
  interval: number,
  shuffle: boolean,
  filter: string,
  watermark: {
    enabled: boolean,
    type: string,
    text: string,
    position: string,
    opacity: number,
    size: string,
    image: string|null
  },
  backgroundColor: string,
  filters: Array,
  watermarkPositions: Array,
  watermarkTypes: Array,
  watermarkSizes: Array
}
```

## Logs

Les logs sont améliorés avec :
- Horodatage automatique
- Niveaux de log (ERROR, WARN, INFO, DEBUG)
- Formatage structuré
- Configuration par variable d'environnement `LOG_LEVEL`

## Variables d'environnement

- `PORT` - Port du serveur (défaut: 3001)
- `LOG_LEVEL` - Niveau de log (défaut: INFO)
- `ALLOWED_ORIGINS` - Origines CORS autorisées
- `NODE_ENV` - Environnement (development/production)
