# PhotoLive OBS - Script de démarrage PowerShell
# Nécessite PowerShell 7+ pour un affichage optimal des émojis

# Changer vers le répertoire du script
Set-Location -Path $PSScriptRoot

Write-Host "📸 PhotoLive OBS - Démarrage..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si Node.js est installé
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js non trouvé"
    }
    Write-Host "✅ Node.js détecté: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Node.js n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Veuillez installer Node.js depuis https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour continuer"
    exit 1
}

# Vérifier si les dépendances sont installées
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de l'installation des dépendances" -ForegroundColor Red
        Read-Host "Appuyez sur Entrée pour continuer"
        exit 1
    }
    Write-Host "✅ Dépendances installées avec succès" -ForegroundColor Green
} else {
    Write-Host "✅ Dépendances déjà installées" -ForegroundColor Green
}

# Créer le dossier photos s'il n'existe pas
if (!(Test-Path "photos")) {
    New-Item -ItemType Directory -Path "photos" | Out-Null
    Write-Host "📁 Dossier photos créé" -ForegroundColor Green
} else {
    Write-Host "📁 Dossier photos existant" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Démarrage du serveur..." -ForegroundColor Magenta
Write-Host ""
Write-Host "Appuyez sur Ctrl+C pour arrêter le serveur" -ForegroundColor Gray
Write-Host ""

# Démarrer l'application
try {
    npm start
}
catch {
    Write-Host ""
    Write-Host "❌ Erreur lors du démarrage du serveur" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour continuer"
    exit 1
}

Read-Host "Appuyez sur Entrée pour continuer"
