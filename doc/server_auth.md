# Spécifications du Serveur Express & Authentification

Cette sous-fonctionnalité gère le serveur Web du Backoffice ainsi que sa sécurisation par authentification basique.

## Configuration du Serveur

Le serveur Express est instancié avec les configurations de sécurité et les routes d'administration.

### Middleware de Sécurité

Pour empêcher les vulnérabilités de type Clickjacking, Cross-Site Scripting (XSS) et injection de type MIME, des en-têtes HTTP de sécurité sont systématiquement positionnés sur toutes les réponses :

- `X-Content-Type-Options: nosniff` (Empêche l'analyse de type MIME)
- `X-Frame-Options: SAMEORIGIN` (Protection contre le clickjacking en interdisant l'intégration dans des iframes externes)
- `Content-Security-Policy: default-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; frame-ancestors 'self'` (Restreint les ressources chargeables à l'origine locale et au CDN officiel pour Tailwind CSS).

### Protection des Téléversements

Le dossier `/uploads` est configuré comme statique (`express.static`) et n'autorise pas l'exécution de code côté serveur (non-executable directory). Un en-tête `Content-Disposition: inline` (ou `attachment`) est défini sur ce point d'accès.

## Authentification Basique (Basic Auth)

L'accès complet à l'interface d'administration et aux endpoints de création ou de visualisation d'événements est protégé par le middleware `express-basic-auth`.

### Paramètres d'Environnement

Les identifiants d'accès sont définis dans le fichier de configuration `.env` via les variables suivantes :

- `ADMIN_USER` : Nom d'utilisateur de l'administrateur (ex: `operateur_admin`)
- `ADMIN_PASSWORD` : Mot de passe de l'administrateur

En l'absence de ces variables, des valeurs de secours sont configurées pour le développement local (`admin` / `password`), mais en production, des secrets forts doivent impérativement être configurés.
L'authentification HTTP provoque le déclenchement d'un défi (challenge) d'accès natif dans le navigateur.
