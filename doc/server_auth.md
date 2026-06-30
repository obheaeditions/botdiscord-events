# Spécifications du Serveur Express & Authentification

Cette sous-fonctionnalité gère le serveur Web du Backoffice ainsi que sa sécurisation par authentification.

## Configuration du Serveur

Le serveur Express est instancié avec les configurations de sécurité et les routes d'administration.

### Middleware de Sécurité

Pour empêcher les vulnérabilités de type Clickjacking, Cross-Site Scripting (XSS) et injection de type MIME, des en-têtes HTTP de sécurité sont systématiquement positionnés sur toutes les réponses :

- `X-Content-Type-Options: nosniff` (Empêche l'analyse de type MIME)
- `X-Frame-Options: SAMEORIGIN` (Protection contre le clickjacking en interdisant l'intégration dans des iframes externes)
- `Content-Security-Policy: default-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'self'` (Restreint les ressources chargeables à l'origine locale et aux CDNs autorisés).

### Protection des Téléversements

Le dossier `/uploads` est configuré comme statique (`express.static`) et n'autorise pas l'exécution de code côté serveur (non-executable directory). Un en-tête `Content-Disposition: inline` (ou `attachment`) est défini sur ce point d'accès.

## Authentification par Session (Cookie de Session)

L'accès à l'interface d'administration est protégé par une authentification par session basée sur un cookie.

### Fonctionnement

- **Formulaire de Connexion :** Les utilisateurs non authentifiés accédant à une page protégée sont automatiquement redirigés vers le point d'accès `/login` qui présente une page de connexion web.
- **Vérification des Identifiants :** Sur soumission du formulaire, le serveur vérifie la correspondance avec les variables d'environnement `ADMIN_USER` et `ADMIN_PASSWORD`.
- **Génération de Jeton :** Si les identifiants sont corrects, un jeton cryptographique aléatoire de 32 octets est généré et stocké en mémoire dans un registre de sessions.
- **Cookie de Session :** Le jeton est renvoyé au navigateur via un cookie nommé `session` avec les attributs de sécurité `HttpOnly` et `SameSite=Lax`. Le cookie est transmis de manière sécurisée en HTTPS en production.
- **Déconnexion :** L'endpoint `/logout` permet de supprimer le jeton du registre mémoire et d'effacer le cookie du navigateur.

### Compatibilité API (Fallback Basic Auth)

Pour garantir la compatibilité avec les tests d'intégration automatisés et les requêtes programmatiques, le middleware d'authentification effectue une double vérification :

1. Si le cookie `session` est valide, l'accès est immédiatement autorisé.
2. Si le cookie n'est pas valide ou absent, mais que l'en-tête HTTP `Authorization` est présent, le système valide les informations selon le protocole **Basic Auth** classique.
3. Si aucun moyen d'authentification valide n'est fourni, l'utilisateur est redirigé vers la page `/login`.

### Paramètres d'Environnement

Les identifiants d'accès sont définis dans le fichier `.env` :

- `ADMIN_USER` : Identifiant de l'administrateur
- `ADMIN_PASSWORD` : Mot de passe de l'administrateur (requis fort en production)
