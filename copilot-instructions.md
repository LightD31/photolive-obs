# PhotoLive OBS - Instructions pour Copilot 🤖

## Vue d'ensemble du projet

PhotoLive OBS est une application Node.js de diaporama photo en temps réel conçue pour l'intégration avec OBS Studio. L'application surveille automatiquement un dossier de photos et affiche les images dans un diaporama personnalisable qui peut être intégré directement dans OBS comme source de navigateur.

## Architecture du projet

### Structure des fichiers
```
photolive-obs/
├── server.js                 # Serveur principal Express + Socket.IO
├── package.json              # Dépendances et scripts npm
├── config/
│   └── default.json          # Configuration par défaut
├── public/                   # Interface web client
│   ├── control.html          # Interface de contrôle
│   ├── slideshow.html        # Page de diaporama pour OBS
│   ├── css/
│   │   ├── control.css       # Styles de l'interface de contrôle
│   │   └── slideshow.css     # Styles du diaporama
│   └── js/
│       ├── control.js        # Logique de l'interface de contrôle
│       └── slideshow.js      # Logique du diaporama
├── photos/                   # Dossier par défaut des images
└── uploads/
    └── watermarks/           # Images de filigrane uploadées
```

### Technologies utilisées
- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: HTML, CSS, JavaScript vanilla
- **Surveillance fichiers**: Chokidar
- **Upload fichiers**: Multer
- **Communication temps réel**: WebSockets via Socket.IO

## Composants principaux

### 1. Serveur (server.js)
- **Express server** avec middleware CORS
- **Socket.IO** pour la communication temps réel
- **Chokidar watcher** pour surveiller le dossier photos
- **Multer** pour l'upload de filigranes
- **API REST** pour les paramètres et la gestion des dossiers

### 2. Interface de contrôle (control.html/js)
- Panneau de contrôle complet avec prévisualisation
- Gestion des paramètres en temps réel
- Grille d'images avec système d'exclusion
- Upload et gestion des filigranes
- Contrôles de lecture/pause/navigation

### 3. Diaporama (slideshow.html/js)
- Page optimisée pour OBS Studio
- Transitions fluides entre images
- Application des filtres et filigranes
- Fond transparent optionnel
- Clavier shortcuts pour contrôle

## Fonctionnalités clés

### Gestion des images
- **Formats supportés**: JPG, PNG, GIF, BMP, TIFF, WebP
- **Surveillance automatique** du dossier avec Chokidar
- **Système d'exclusion** pour masquer certaines images
- **Tri par date** de modification (plus récent en premier)
- **Mode aléatoire** et **répétition des dernières images**

### Personnalisation visuelle
- **9 filtres**: Aucun, Sépia, N&B, Flou, Luminosité, Contraste, Vintage, Froid, Chaud
- **4 transitions**: Aucune, Fondu, Glissement, Zoom
- **Filigranes**: Texte personnalisé ou image PNG
- **Positions**: 5 positions prédéfinies
- **Tailles**: 4 tailles (Petit à Très grand)
- **Opacité** ajustable

### Communication temps réel
- **WebSocket events**:
  - `images-updated`: Mise à jour de la liste d'images
  - `settings-updated`: Mise à jour des paramètres
  - `image-changed`: Changement d'image courante
  - `slideshow-state`: État du diaporama
  - `toggle-image-exclusion`: Exclusion/inclusion d'image

## Conventions de code

### JavaScript
- **ES6+** avec classes et arrow functions
- **Async/await** pour les opérations asynchrones
- **Error handling** avec try/catch
- **Performance optimizations**: Debouncing, requestAnimationFrame, DocumentFragment
- **Event delegation** pour la grille d'images

### CSS
- **CSS Grid** et **Flexbox** pour les layouts
- **CSS Custom Properties** pour la théming
- **Responsive design** avec media queries
- **Transitions CSS** pour les animations

### Structure des données
```javascript
// Image object
{
  filename: string,
  path: string,
  size: number,
  modified: Date,
  originalIndex: number
}

// Settings object
{
  interval: number,
  transition: string,
  filter: string,
  showWatermark: boolean,
  watermarkText: string,
  watermarkType: 'text' | 'image',
  watermarkImage: string,
  watermarkPosition: string,
  watermarkSize: string,
  watermarkOpacity: number,
  shuffleImages: boolean,
  repeatLatest: boolean,
  latestCount: number,
  photosPath: string,
  transparentBackground: boolean,
  excludedImages: string[]
}
```

## Bonnes pratiques pour le développement

### Performance
- **Debouncing** pour les mises à jour fréquentes
- **Virtual DOM** avec DocumentFragment pour les manipulations de grille
- **Lazy loading** pour les images
- **Throttling** pour le rendu de la grille
- **Cache invalidation** basé sur hash des images

### Sécurité
- **Validation des entrées** côté serveur
- **Échappement HTML** pour prévenir XSS
- **Limitation des formats de fichiers**
- **Validation des chemins** pour éviter path traversal

### Maintenabilité
- **Classes modulaires** avec responsabilités claires
- **Configuration centralisée** dans default.json
- **Logging structuré** avec console.log/error
- **Gestion d'erreurs** granulaire
- **Documentation inline** pour les méthodes complexes

## Tests et débogage

### Logs utiles
- **Client**: Événements WebSocket, mises à jour d'état, erreurs de rendu
- **Serveur**: Événements de fichiers, requêtes API, erreurs de traitement

### Points de débogage courants
- **Synchronisation** entre client et serveur
- **Performance** de la grille d'images
- **Gestion de cache** et invalidation
- **Upload** et traitement des filigranes
- **Navigation** et état du diaporama

### Génération d'images d'exemple
Si vous avez besoin de créer des images d'exemple pour tester l'application, vous pouvez utiliser **Pillow** (PIL) :

```bash
# Installation de Pillow
pip install Pillow
```

```python
# Exemple de script pour générer des images de test
from PIL import Image, ImageDraw, ImageFont
import os
import random

def create_sample_images():
    """Génère des images d'exemple variées pour tester PhotoLive OBS"""
    photos_dir = "./photos"
    os.makedirs(photos_dir, exist_ok=True)
    
    # Différents formats et tailles
    formats = [
        {"name": "HD", "size": (1920, 1080), "ratio": "16:9"},
        {"name": "4K", "size": (3840, 2160), "ratio": "16:9"},
        {"name": "Square", "size": (1080, 1080), "ratio": "1:1"},
        {"name": "Portrait", "size": (1080, 1920), "ratio": "9:16"},
        {"name": "Ultrawide", "size": (2560, 1080), "ratio": "21:9"},
        {"name": "Classic", "size": (1600, 1200), "ratio": "4:3"},
        {"name": "Small", "size": (800, 600), "ratio": "4:3"},
        {"name": "Large", "size": (2560, 1440), "ratio": "16:9"}
    ]
    
    # Différents styles et contenus
    styles = [
        {
            "colors": [("#FF6B6B", "#FF8E8E"), ("#E74C3C", "#C0392B")],
            "theme": "Sunset",
            "text": ["Beautiful Sunset", "Golden Hour", "Nature's Beauty"]
        },
        {
            "colors": [("#4ECDC4", "#26D0CE"), ("#1ABC9C", "#16A085")],
            "theme": "Ocean",
            "text": ["Deep Blue Sea", "Ocean Waves", "Peaceful Waters"]
        },
        {
            "colors": [("#45B7D1", "#74C0FC"), ("#3498DB", "#2980B9")],
            "theme": "Sky",
            "text": ["Clear Sky", "Blue Horizon", "Endless Dreams"]
        },
        {
            "colors": [("#96CEB4", "#FFEAA7"), ("#2ECC71", "#F1C40F")],
            "theme": "Forest",
            "text": ["Green Forest", "Spring Time", "Natural Wonder"]
        },
        {
            "colors": [("#FFEAA7", "#FDCB6E"), ("#F39C12", "#E67E22")],
            "theme": "Autumn",
            "text": ["Golden Autumn", "Warm Colors", "Fall Season"]
        },
        {
            "colors": [("#DDA0DD", "#B19CD9"), ("#9B59B6", "#8E44AD")],
            "theme": "Lavender",
            "text": ["Purple Dreams", "Lavender Fields", "Mystic Vibes"]
        },
        {
            "colors": [("#98D8C8", "#A8E6CF"), ("#52C41A", "#389E0D")],
            "theme": "Mint",
            "text": ["Fresh Mint", "Cool Breeze", "Calm Nature"]
        },
        {
            "colors": [("#F7DC6F", "#F4D03F"), ("#F1C40F", "#D4AC0D")],
            "theme": "Sunshine",
            "text": ["Bright Sun", "Happy Day", "Golden Light"]
        }
    ]
    
    image_count = 0
    
    for format_info in formats:
        for style in styles:
            image_count += 1
            
            # Créer un dégradé ou couleur unie
            width, height = format_info["size"]
            img = Image.new('RGB', (width, height))
            draw = ImageDraw.Draw(img)
            
            # Créer un dégradé vertical
            color1 = style["colors"][0][0] if isinstance(style["colors"][0], tuple) else style["colors"][0]
            color2 = style["colors"][1][0] if isinstance(style["colors"][1], tuple) else style["colors"][1]
            
            # Convertir hex en RGB
            def hex_to_rgb(hex_color):
                return tuple(int(hex_color[i:i+2], 16) for i in (1, 3, 5))
            
            rgb1 = hex_to_rgb(color1)
            rgb2 = hex_to_rgb(color2)
            
            # Créer le dégradé
            for y in range(height):
                ratio = y / height
                r = int(rgb1[0] * (1 - ratio) + rgb2[0] * ratio)
                g = int(rgb1[1] * (1 - ratio) + rgb2[1] * ratio)
                b = int(rgb1[2] * (1 - ratio) + rgb2[2] * ratio)
                draw.line([(0, y), (width, y)], fill=(r, g, b))
            
            # Ajouter du texte avec différentes tailles selon la résolution
            try:
                base_font_size = max(width, height) // 25
                title_font = ImageFont.truetype("arial.ttf", base_font_size)
                subtitle_font = ImageFont.truetype("arial.ttf", base_font_size // 2)
                info_font = ImageFont.truetype("arial.ttf", base_font_size // 3)
            except:
                base_font_size = 48
                title_font = ImageFont.load_default()
                subtitle_font = ImageFont.load_default()
                info_font = ImageFont.load_default()
            
            # Texte principal
            main_text = random.choice(style["text"])
            bbox = draw.textbbox((0, 0), main_text, font=title_font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            # Position centrée pour le titre
            title_x = (width - text_width) // 2
            title_y = height // 3
            
            # Ajouter une ombre au texte
            shadow_offset = max(2, base_font_size // 20)
            draw.text((title_x + shadow_offset, title_y + shadow_offset), main_text, 
                     fill=(0, 0, 0, 128), font=title_font)
            draw.text((title_x, title_y), main_text, fill="white", font=title_font)
            
            # Sous-titre avec informations techniques
            subtitle = f"{format_info['name']} • {format_info['ratio']} • {style['theme']}"
            subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
            subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
            subtitle_x = (width - subtitle_width) // 2
            subtitle_y = title_y + text_height + 20
            
            draw.text((subtitle_x + 1, subtitle_y + 1), subtitle, fill=(0, 0, 0, 100), font=subtitle_font)
            draw.text((subtitle_x, subtitle_y), subtitle, fill="white", font=subtitle_font)
            
            # Informations en bas
            info_text = f"Image #{image_count:02d} • {width}×{height}px • Test PhotoLive OBS"
            info_bbox = draw.textbbox((0, 0), info_text, font=info_font)
            info_width = info_bbox[2] - info_bbox[0]
            info_x = (width - info_width) // 2
            info_y = height - 60
            
            draw.text((info_x + 1, info_y + 1), info_text, fill=(0, 0, 0, 80), font=info_font)
            draw.text((info_x, info_y), info_text, fill="white", font=info_font)
            
            # Ajouter des éléments décoratifs
            if random.choice([True, False]):
                # Cercles décoratifs
                for _ in range(random.randint(3, 8)):
                    circle_x = random.randint(0, width)
                    circle_y = random.randint(0, height)
                    circle_size = random.randint(20, 100)
                    circle_alpha = random.randint(20, 60)
                    
                    # Créer une image temporaire pour l'alpha
                    overlay = Image.new('RGBA', (width, height), (255, 255, 255, 0))
                    overlay_draw = ImageDraw.Draw(overlay)
                    overlay_draw.ellipse([circle_x - circle_size, circle_y - circle_size,
                                        circle_x + circle_size, circle_y + circle_size],
                                       fill=(255, 255, 255, circle_alpha))
                    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
            
            # Nom de fichier descriptif
            safe_theme = style["theme"].lower().replace(" ", "_")
            safe_format = format_info["name"].lower()
            filename = f"sample_{image_count:02d}_{safe_format}_{safe_theme}_{format_info['ratio'].replace(':', 'x')}.jpg"
            
            # Sauvegarder avec qualité adaptée à la taille
            quality = 95 if width * height > 2000000 else 85
            img.save(os.path.join(photos_dir, filename), "JPEG", quality=quality, optimize=True)
            print(f"✓ Créé: {filename} ({width}×{height})")

if __name__ == "__main__":
    create_sample_images()
    print(f"\n🎉 {len(formats) * len(styles)} images d'exemple créées avec succès!")
    print("📁 Dossier: ./photos/")
    print("🎯 Prêt pour tester PhotoLive OBS!")
```

Cette approche permet de :
- **Tester rapidement** l'application sans avoir besoin d'images réelles
- **Valider les fonctionnalités** de filtres, transitions et filigranes
- **Déboguer** les problèmes de performance avec différentes tailles d'images
- **Simuler** différents scénarios d'utilisation

## Notes importantes

⚠️ **Sécurité**: Cette application a été développée rapidement ("vibe coded") et peut contenir des vulnérabilités. Elle est destinée uniquement au développement local et aux tests.

🎯 **Focus OBS**: L'interface de diaporama est spécifiquement optimisée pour l'intégration OBS Studio comme source de navigateur.

📱 **Responsive**: L'interface de contrôle s'adapte à tous les types d'écrans et d'appareils.

⚡ **Temps réel**: Toutes les modifications sont synchronisées instantanément via WebSocket entre tous les clients connectés.
