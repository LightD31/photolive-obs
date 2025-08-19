@echo off
echo 📸 PhotoLive OBS - Demarrage...
echo.

REM Vérifier si Node.js est installé
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js n'est pas installé ou n'est pas dans le PATH
    echo.
    echo Veuillez installer Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)

REM Vérifier si les dépendances sont installées
if not exist "node_modules" (
    echo 📦 Installation des dépendances...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Erreur lors de l'installation des dépendances
        pause
        exit /b 1
    )
)

REM Créer le dossier photos s'il n'existe pas
if not exist "photos" (
    mkdir photos
    echo 📁 Dossier photos créé
)

echo ✅ Demarrage du serveur...
echo.
echo 🌐 Interface de contrôle : http://localhost:3001/control
echo 📺 Page diaporama OBS : http://localhost:3001/slideshow
echo.
echo Appuyez sur Ctrl+C pour arrêter le serveur
echo.

REM Démarrer l'application
npm start

pause
