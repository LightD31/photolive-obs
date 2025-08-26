#!/bin/bash

# PhotoLive OBS - Script de démarrage Linux/macOS
# Compatible avec bash et zsh

echo "📸 PhotoLive OBS - Démarrage..."
echo ""

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé ou n'est pas dans le PATH"
    echo ""
    echo "Veuillez installer Node.js depuis https://nodejs.org/"
    echo "Ou utilisez votre gestionnaire de paquets :"
    echo "  Ubuntu/Debian: sudo apt install nodejs npm"
    echo "  CentOS/RHEL: sudo yum install nodejs npm"
    echo "  macOS: brew install node"
    echo ""
    read -p "Appuyez sur Entrée pour continuer..."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js détecté: $NODE_VERSION"

# Vérifier si les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de l'installation des dépendances"
        read -p "Appuyez sur Entrée pour continuer..."
        exit 1
    fi
    echo "✅ Dépendances installées avec succès"
else
    echo "✅ Dépendances déjà installées"
fi

# Créer le dossier photos s'il n'existe pas
if [ ! -d "photos" ]; then
    mkdir -p photos
    echo "📁 Dossier photos créé"
else
    echo "📁 Dossier photos existant"
fi

echo ""
echo "🚀 Démarrage du serveur..."
echo ""
echo "Appuyez sur Ctrl+C pour arrêter le serveur"
echo ""

# Démarrer l'application
npm start

# Attendre une entrée utilisateur après la fin du serveur
echo ""
read -p "Appuyez sur Entrée pour continuer..."
