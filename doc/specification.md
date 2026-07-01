# Spécifications Techniques — Bot Discord & Backoffice de Gestion d'Événements

Ce document présente les spécifications techniques de référence du projet monolithique **EventBot Portal**, regroupant le bot Discord (`discord.js`), le serveur Web d'administration et de supervision (Express.js), et la base de données locale (SQLite).

---

## 🛡️ Consignes de Sécurité et Environnement

- **Variables d'environnement :** Toutes les données sensibles (tokens Discord, identifiants d'accès, configuration réseau) sont stockées dans le fichier `.env` sur l'hôte, chargé au démarrage via `dotenv`. Aucun secret n'est commité sur Git.
- **Permissions Discord minimales :** Le bot utilise des permissions restreintes aux salons ciblés : `Send Messages`, `Embed Links`, `Manage Messages`, et `Read Message History`.
- **Intents Privilégiés :** Le bot requiert l'activation des *Gateway Intents* suivants : `Guilds`, `GuildMessages` et `GuildMembers`.

---

## 📂 Architecture Logicielle

Le projet est structuré sous forme de monolithe Node.js léger en ES Modules (ESM) :

```text
├── src/
│   ├── database/
│   │   └── db.js            # Initialisation SQLite (better-sqlite3)
│   ├── bot/
│   │   ├── index.js         # Client Discord & écoute d'interactions
│   │   ├── embedBuilder.js  # Générateur d'Embeds riches pour les salons
│   │   └── publisher.js     # Gestion de publication et suppression de messages
│   ├── social/
│   │   └── facebookPublisher.js # Publication et republication sur une Page Facebook (Meta Graph API)
│   ├── shared/
│   │   └── images.js        # Résolution des chemins d'images en URLs publiques absolues
│   ├── server/
│   │   ├── index.js         # Initialisation d'Express & Middlewares
│   │   ├── routes.js        # Routeur et contrôleurs (login, create, details, etc.)
│   │   ├── publicRoutes.js  # Routes publiques sans authentification (inscription via lien Facebook)
│   │   └── sessionStore.js  # Gestionnaire de sessions mémoire
│   │   └── views/           # Vues EJS stylisées (dashboard, create_event, etc.)
│   └── index.js             # Point d'entrée principal (lance le bot + Express)
├── Dockerfile               # Fichier de build du conteneur
├── docker-compose.yml       # Déploiement multi-services et volumes persistants
└── doc/                     # Documentations par fonctionnalité
```

---

## 💾 Schéma de Base de Données (SQLite)

La base de données est gérée de manière synchrone par `better-sqlite3`.

### Table `events`

Stocke les détails de chaque événement créé depuis l'interface d'administration.

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER (PK, AI) | Identifiant unique de l'événement |
| `title` | TEXT | Titre de l'événement |
| `type` | TEXT | Type d'événement (ex: Partie de JdR, Partie de Jeu, Présentation, Table ronde) |
| `start_date` | TEXT | Date de début de l'événement (format YYYY-MM-DD) |
| `end_date` | TEXT | Date de fin de l'événement (optionnel, format YYYY-MM-DD) |
| `start_time` | TEXT | Heure de début de l'événement (format HH:MM) |
| `end_time` | TEXT | Heure de fin de l'événement (optionnel, format HH:MM) |
| `duration` | TEXT | Durée estimée au format HH:MM (ex: "02:30") |
| `desc_short` | TEXT | Description courte d'accroche pour l'embed |
| `desc_org` | TEXT | Logistique et consignes d'organisation |
| `channels` | TEXT (JSON) | Tableau des identifiants des canaux Discord cibles (ex: `["111...", "222..."]`) |
| `roles` | TEXT (JSON) | Tableau des rôles autorisés. Un tableau vide `[]` signifie accès ouvert à tous |
| `images` | TEXT (JSON) | Tableau des chemins d'accès des images téléversées |
| `documents` | TEXT (JSON) | Tableau des chemins d'accès des PDF ou documents joints |
| `links` | TEXT (JSON) | Liens web externes utiles saisis par l'opérateur |
| `is_pinned` | INTEGER (0/1) | Si 1, le bot épingle automatiquement le message envoyé sur Discord |
| `is_pinged` | INTEGER (0/1) | Si 1, mentionne les rôles cibles (ou `@everyone` si public) lors du premier envoi |
| `is_blocked` | INTEGER (0/1) | Si 1, ferme les inscriptions (les boutons Discord deviennent inactifs) |
| `discord_messages` | TEXT (JSON) | Mapping des identifiants de messages par canal (ex: `{"channel_id": "message_id"}`) |
| `publish_facebook` | INTEGER (0/1) | Active la publication Facebook pour cet événement (`0` par défaut — Discord reste toujours actif) |
| `facebook_post_id` | TEXT | Identifiant du post photo publié sur la Page Facebook (`NULL` tant que non publié) |

### Table `registrations`

Stocke les statuts d'inscription mis à jour en temps réel par les clics sur les boutons Discord.

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER (PK, AI) | Identifiant de la réponse |
| `event_id` | INTEGER (FK) | ID de l'événement associé (liaison avec contrainte `ON DELETE CASCADE`) |
| `user_id` | TEXT | Identifiant Discord unique de l'utilisateur |
| `username` | TEXT | Nom d'utilisateur Discord pour affichage |
| `status` | TEXT | Statut de réponse (`inscrit`, `desinscrit`, `interesse`, `pas_interesse`) |
| `source` | TEXT | Origine de l'inscription : `discord` (défaut) ou `facebook` (page d'inscription publique) |
| `email` | TEXT | Contact optionnel saisi sur la page d'inscription publique (`NULL` sinon) |
| `updated_at` | DATETIME | Horodatage de l'action utilisateur (par défaut `CURRENT_TIMESTAMP`) |

*Contrainte d'unicité :* `UNIQUE(event_id, user_id)` assure qu'un membre n'a qu'un unique statut par événement.

---

## 🛡️ Sécurisation & Sessions du Backoffice

- **Authentification par Session (Cookie) :**
  L'accès aux interfaces d'administration est restreint par un cookie de session HttpOnly nommé `session`. Les utilisateurs non connectés sont redirigés vers `/login`.
- **Identifiants :** Le nom d'utilisateur et le mot de passe sont comparés avec les variables `ADMIN_USER` et `ADMIN_PASSWORD` définies dans le `.env`.
- **Compatibilité tests d'intégration (Fallback) :** Si l'en-tête HTTP `Authorization` est présent, le middleware utilise une vérification **Basic Auth** classique. Cela permet de faire fonctionner les scripts de tests automatisés sans gestion de cookies.
- **En-têtes HTTP de sécurité :**
  - `X-Content-Type-Options: nosniff` (Désactive le MIME-sniffing).
  - `X-Frame-Options: SAMEORIGIN` (Protège du Clickjacking).
  - `Content-Security-Policy` : Restreint le chargement de scripts et styles aux fichiers locaux et aux CDNs officiels (Tailwind CSS, Flatpickr et Google Fonts).

---

## 📝 Création d'Événements & Validation de Cohérence

### Checklists Dynamiques

- Au chargement du formulaire de création (`GET /events/create`), le bot interroge en temps réel le serveur Discord configuré pour lister les salons de discussion textuels et les rôles utilisateur (excluant `@everyone` et les rôles système).
- L'opérateur coche simplement les options. Les valeurs cochées sont normalisées côté serveur en tableaux de chaînes avant validation.

### Validation de Cohérence Rôle / Canal

Lors de la soumission (`POST /events/create`) :

1. Si des rôles sont sélectionnés, le bot vérifie pour chaque canal sélectionné que les rôles disposent des permissions de lecture (`ViewChannel`) et d'écriture (`SendMessages`).
2. Si un rôle n'a pas accès à un salon de destination, le serveur rejette la création, supprime automatiquement les fichiers téléchargés (via `multer`) pour éviter l'encombrement du disque, et renvoie une alerte détaillée à l'opérateur.

---

## ⚙️ Administration Avancée des Événements

- **Modifier un événement :** Permet de modifier tous les aspects de l'événement (Titre, Type, Dates, Heures, Durée, Accroche, Logistique, Salons cibles, Rôles requis, Liens, Épinglage, Pings). Permet d'ajouter de nouveaux fichiers (images/documents) ou de cocher les fichiers existants pour les supprimer du serveur et de la base de données. Si des salons de publication sont retirés, les messages correspondants y sont automatiquement effacés sur Discord.
- **Supprimer un événement :** Envoie des requêtes asynchrones à Discord pour supprimer les messages correspondants de tous les salons cibles via le mapping `discord_messages`, puis retire l'événement de la base SQLite.
- **Bloquer les inscriptions :** Modifie l'état `is_blocked = 1`. L'embed Discord associé est mis à jour avec le préfixe `🔒 [INSCRIPTIONS FERMÉES]` sur fond gris neutre, et les boutons deviennent désactivés (`disabled`). Les clics de boutons existants sont interceptés et renvoient une erreur éphémère.
- **Republication / Synchronisation :** Permet de réémettre le message sur Discord. Si un message a été supprimé sur un salon, le bot recrée automatiquement le message et met à jour l'identifiant en base de données.
- **Gestion des Participants :** Permet d'ajouter manuellement un participant avec son pseudo et son identifiant Discord (User ID Snowflake) directement dans l'interface, ce qui synchronise instantanément les compteurs de l'embed Discord.
- **Mise en Attente :** Les administrateurs peuvent basculer un inscrit ou un intéressé en statut `"en_attente"`. Ce statut dispose d'un compteur dédié `Orange` affiché dans le backoffice et sur l'embed Discord. L'action fonctionne comme une bascule (toggle) : le choix initial de l'utilisateur (`inscrit` ou `interesse`) est préservé en base de données dans la colonne `previous_status` pour lui permettre d'être réintégré. À chaque changement de statut (mise en attente ou réintégration), le bot envoie automatiquement un message privé (DM) à l'utilisateur pour l'en informer.
- **Publication sur Fil Discord (Thread) :** Permet de créer un fil de discussion public sous le message de l'événement nommé `"Composition - [Titre Event]"`, et d'y publier automatiquement un message récapitulant les joueurs inscrits et les remplaçants en attente.

---

## 📣 Diffusion Multicanale (Facebook)

En complément de Discord (toujours actif), un événement peut être publié automatiquement sur une Page Facebook (image + texte + lien vers une page d'inscription publique) — **activable événement par événement** via la case « Publier sur Facebook » (colonne `publish_facebook`). Les inscriptions effectuées depuis ce lien sont enregistrées dans la même table `registrations` (colonne `source = 'facebook'`) et synchronisées immédiatement sur l'embed Discord, pour une vision consolidée tous canaux confondus. Détails complets dans [`doc/facebook_integration.md`](./facebook_integration.md).

---

## 🚀 Déploiement

Le déploiement recommandé repose sur **Docker Compose** pour isoler l'environnement d'exécution et garantir la persistance des données.

- **Dockerfile :** Construit l'image à partir de `node:20-alpine`, en installant les outils C++ requis pour compiler `better-sqlite3`.
- **docker-compose.yml :** Configure le service, mappe le port externe de l'hôte (ex: `3010`) et monte deux volumes persistants (`./events/data` pour SQLite et `./events/public/uploads` pour les fichiers).
- **Reverse Proxy HTTPS (Nginx Proxy Manager) :** NPM gère les connexions SSL (Let's Encrypt), applique le HTTPS forcée, et redirige le domaine public (ex: `botdiscord-events.m-wd.fr`) vers le port `3010` du VPS.
