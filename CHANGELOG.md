# PhotoLive OBS - Changelog

## [1.0.0] - 2025-07-31

### Nettoyage et optimisation

- ✅ Suppression de la dépendance inutile `path` (module natif Node.js)
- ✅ Suppression des références à `standalone.js` inexistant
- ✅ Suppression de la configuration `pkg` non utilisée
- ✅ **Suppression complète d'Electron et de ses dépendances**
- ✅ **Suppression des fichiers Electron (`main.js`, `preload.js`, dossier `build/`)**
- ✅ Synchronisation des ports entre config (3001) et server.js
- ✅ Ajout de `.gitignore` pour exclure les fichiers temporaires
- ✅ Ajout de scripts `clean` et `reinstall` dans package.json
- ✅ Nettoyage des références aux fichiers de documentation inexistants

### Améliorations

- 📁 Structure du projet clarifiée
- 🔧 Configuration unifiée
- 🚀 Scripts de développement optimisés

### Fonctionnalités

- 📸 Diaporama photo en temps réel pour OBS Studio
- 🔄 Surveillance automatique du dossier photos avec Chokidar
- 🌐 Interface web de contrôle
- 🎛️ Paramètres configurables (transitions, filtres, filigrane)
- ⚡ Communication temps réel via WebSocket
- 🖥️ Application web pure (Node.js/Express)

### Configuration

- Port par défaut : 3001
- Interface de contrôle : <http://localhost:3001/control>
- Diaporama OBS : <http://localhost:3001/>
- Dossier photos : `./photos/`
