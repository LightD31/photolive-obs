# PhotoLive OBS 📸

Une application de diaporama photo en temps réel spécialement conçue pour OBS Studio. Cette application surveille automatiquement un dossier d'images et les affiche dans une page web que vous pouvez intégrer directement dans OBS comme source navigateur.

## ✨ Fonctionnalités principales

- 🔄 **Surveillance en temps réel** - Détecte automatiquement les nouvelles images ajoutées au dossier
- 🌐 **Interface web pour OBS** - Page web optimisée pour l'intégration dans OBS Studio  
- 🎛️ **Interface de contrôle** - Contrôlez le diaporama via une interface web dédiée
- 🎬 **Transitions fluides** - Fondu, glissement, zoom avec animations CSS
- 🎨 **Filtres visuels** - Sépia, noir & blanc, flou, luminosité, contraste, vintage, etc.
- 🏷️ **Filigrane personnalisable** - Ajoutez votre texte ou logo avec positionnement libre
- ⚡ **Mises à jour en temps réel** - WebSocket pour une synchronisation instantanée
- 📱 **Interface responsive** - Compatible avec tous les appareils
- ⌨️ **Raccourcis clavier** - Contrôle rapide du diaporama
- 🔧 **Configuration avancée** - Répétition des dernières images, mélange, etc.

## 🚀 Installation et démarrage

### Prérequis
- Node.js (version 14 ou supérieure)
- npm ou yarn

### Installation

1. **Clonez ou téléchargez le projet**
```bash
git clone <repo-url>
cd photolive-obs
```

2. **Installez les dépendances**
```bash
npm install
```

3. **Démarrez l'application**
```bash
npm start
```

L'application sera accessible sur : `http://localhost:3000`

## 📋 Utilisation

### Configuration dans OBS Studio

1. **Ajoutez une source "Navigateur"** dans votre scène OBS
2. **Configurez l'URL** : `http://localhost:3000`
3. **Définissez les dimensions** selon vos besoins (ex: 1920x1080)
4. **Activez "Actualiser le navigateur quand la scène devient active"** (optionnel)

### Gestion des photos

1. **Ajoutez vos images** dans le dossier `photos/` du projet
2. **Formats supportés** : JPG, JPEG, PNG, GIF, BMP, TIFF, WebP
3. **Surveillance automatique** - Les nouvelles images apparaîtront automatiquement

### Interface de contrôle

Accédez à l'interface de contrôle sur : `http://localhost:3000/control`

#### Contrôles disponibles :
- ▶️ **Lecture/Pause** du diaporama
- ⏭️ **Navigation** manuelle (précédent/suivant)
- ⏱️ **Intervalle** de changement d'image (1-30 secondes)
- 🎬 **Transitions** : Fondu, Glissement, Zoom
- 🎨 **Filtres** : Aucun, Sépia, N&B, Flou, Luminosité, Contraste, Vintage, Froid, Chaud
- 🏷️ **Filigrane** : Texte personnalisé avec positionnement
- 🔧 **Options avancées** : Répétition des dernières images, mélange

### Raccourcis clavier

Sur la page du diaporama (`http://localhost:3000`) :
- `→` ou `Espace` : Image suivante
- `←` : Image précédente  
- `P` : Pause/Lecture

Sur l'interface de contrôle :
- Mêmes raccourcis disponibles (sauf si vous tapez dans un champ)

## 🛠️ Configuration

### Structure des dossiers
```
photolive-obs/
├── server.js              # Serveur principal
├── package.json           # Configuration npm
├── config/
│   └── default.json       # Configuration par défaut
├── photos/                # Dossier des images (à créer)
└── public/                # Fichiers web statiques
    ├── slideshow.html     # Page diaporama pour OBS
    ├── control.html       # Interface de contrôle
    ├── css/
    │   ├── slideshow.css
    │   └── control.css
    └── js/
        ├── slideshow.js
        └── control.js
```

### Configuration serveur

Le fichier `config/default.json` contient les paramètres par défaut :

```json
{
  "server": {
    "port": 3000,
    "photosPath": "./photos"
  },
  "slideshow": {
    "defaultInterval": 5000,
    "supportedFormats": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"]
  }
}
```

## 🔧 Développement

### Scripts disponibles

- `npm start` : Démarre le serveur de production
- `npm run dev` : Démarre le serveur de développement (identique pour l'instant)

### API REST

L'application expose une API REST simple :

- `GET /api/images` : Liste des images avec métadonnées
- `GET /api/settings` : Paramètres actuels du diaporama
- `POST /api/settings` : Mise à jour des paramètres

### WebSocket Events

Events émis par le serveur :
- `images-updated` : Nouvelle liste d'images détectées
- `settings-updated` : Paramètres mis à jour

Events reçus du client :
- `next-image` : Afficher l'image suivante
- `prev-image` : Afficher l'image précédente
- `pause-slideshow` : Mettre en pause
- `resume-slideshow` : Reprendre la lecture

## 🎯 Cas d'usage

### Événements en direct
- Mariages, concerts, conférences
- Affichage des photos prises en temps réel pendant l'événement

### Streaming
- Intégration dans des streams Twitch/YouTube
- Diaporama pendant les pauses ou intermissions

### Présentations
- Affichage automatique de contenus visuels
- Support de présentation avec images dynamiques

### Photographie
- Portfolio en temps réel pour photographes
- Vitrine de travaux récents

## 🔍 Dépannage

### L'application ne démarre pas
- Vérifiez que Node.js est installé : `node --version`
- Vérifiez que les dépendances sont installées : `npm install`
- Vérifiez que le port 3000 n'est pas utilisé

### Les images n'apparaissent pas
- Vérifiez que le dossier `photos/` existe
- Vérifiez les formats d'images supportés
- Consultez la console de l'interface de contrôle pour les erreurs

### OBS ne charge pas la page
- Vérifiez l'URL : `http://localhost:3000`
- Testez d'abord dans un navigateur web
- Vérifiez les paramètres de la source navigateur dans OBS

### Problèmes de performance
- Réduisez la taille des images (recommandé : < 2MB par image)
- Limitez le nombre d'images dans le dossier (< 1000 recommandé)
- Augmentez l'intervalle entre les images

## 📝 Licence

MIT License - Vous êtes libre d'utiliser, modifier et distribuer cette application.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer de nouvelles fonctionnalités  
- Améliorer la documentation
- Soumettre des pull requests

## 📞 Support

Pour toute question ou problème :
1. Consultez d'abord cette documentation
2. Vérifiez les issues existantes
3. Créez une nouvelle issue si nécessaire

---

**PhotoLive OBS** - Transformez vos photos en diaporama professionnel pour OBS Studio ! 🎬✨
