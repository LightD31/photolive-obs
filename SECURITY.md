# Configuration de Sécurité - PhotoLive OBS

## Variables d'environnement importantes

### ALLOWED_ORIGINS
Définit les origines autorisées pour les connexions CORS et WebSocket.
```bash
ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001,http://your-domain.com
```

### PORT
Port d'écoute du serveur (défaut: 3001)

## Recommandations de déploiement

### 1. Réseau
- **Utilisation locale uniquement**: Ne pas exposer directement sur Internet
- **Reverse proxy**: Utiliser nginx/Apache si exposition nécessaire
- **Firewall**: Restreindre l'accès au port uniquement aux IPs autorisées

### 2. Dossiers et fichiers
- **Permissions**: Dossier `photos/` en lecture seule pour l'utilisateur du serveur
- **Taille**: Surveiller la taille du dossier photos (limite recommandée: 10GB)
- **Types**: Seuls les formats d'images autorisés sont acceptés

### 3. Surveillance
- **Logs**: Surveiller les tentatives d'accès suspects dans les logs
- **Ressources**: Surveiller l'utilisation mémoire et CPU
- **Monitoring**: Mettre en place des alertes pour les erreurs répétées

### 4. Mise à jour
- **Dépendances**: Maintenir les dépendances à jour
- **Node.js**: Utiliser une version LTS récente
- **Sécurité**: Appliquer les correctifs de sécurité rapidement

## Limitations de sécurité actuelles

- **Authentification**: Aucune authentification sur l'interface de contrôle
- **Chiffrement**: Communications non chiffrées (HTTP/WebSocket)
- **Rate limiting**: Aucune limitation du taux de requêtes

## Pour un environnement de production

1. **HTTPS**: Configurer TLS/SSL
2. **Authentification**: Ajouter un système d'authentification
3. **Rate limiting**: Implémenter express-rate-limit
4. **Logging**: Utiliser winston ou équivalent
5. **Monitoring**: Configurer des outils de monitoring
6. **Backup**: Sauvegarder la configuration et les données

## Signalement de vulnérabilités

En cas de découverte de vulnérabilité, veuillez la signaler de manière responsable via les issues GitHub ou par email privé.
