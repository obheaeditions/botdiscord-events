Pour répondre à tes exigences de simplicité, de légèreté et de facilité de déploiement, l'idéal est de partir sur une **architecture monolithique en Node.js**.

Un seul projet va faire tourner à la fois le **Bot Discord (`discord.js`)**, le serveur pour le **Backoffice (Express.js)**, et une base de données **SQLite** (un simple fichier local, donc zéro infrastructure lourde à gérer).

---

## 🛠️ La Stack Technique Recommandée

* **Langage :** JavaScript / Node.js (ESM).
* **Bot Discord :** `discord.js` (v14).
* **Framework Web (Backoffice) :** `express` avec un moteur de template ultra-léger comme `ejs` (ou simplement du HTML/Tailwind via CDN) pour éviter de s'embêter avec un build React/Vue.
* **Base de données :** `better-sqlite3` (performant, orienté fichier, parfait pour lier les événements aux inscrits).
* **Stockage des fichiers (Images/Docs) :** Stockage local dans un dossier `/uploads` servi par Express, ou simple saisie d'URLs dans le formulaire.

---

## 📅 Plan d'Action pas à pas

### Étape 1 : Configuration et Initialisation (Discord Portal)

1. Se rendre sur le [Discord Developer Portal](https://discord.com/developers/applications).
2. Créer une application, activer l'onglet **Bot**, et récupérer le **Token**.
3. Activer les **Privileged Gateway Intents** nécessaires : `Guilds`, `GuildMessages`, `MessageContent` (si besoin) et `GuildMembers`.
4. Générer l'URL d'invitation OAuth2 avec les permissions d'administrateur ou ciblées (Envoyer des messages, Épingler, Gérer les rôles) et inviter le bot sur ton serveur de test.

### Étape 2 : Structure du Projet & Base de Données

Initialiser le projet Node.js et mettre en place une structure simple :

```text
├── src/
│   ├── database/
│   │   └── db.js          # Initialisation de SQLite
│   ├── bot/
│   │   ├── index.js       # Client Discord et gestion des boutons
│   │   └── embedBuilder.js# Générateur de l'affichage de l'event
│   ├── server/
│   │   ├── index.js       # Serveur Express
│   │   ├── routes.js      # Routes du Backoffice
│   │   └── views/         # Fichiers HTML / EJS du Backoffice
│   └── index.js           # Point d'entrée unique (lance le bot + le serveur)
├── data/
│   └── database.sqlite    # La base de données (fichier unique)
├── public/uploads/        # Stockage des images/documents
├── .env                   # Variables d'environnement (Token, Password)
└── package.json

```

**Le modèle de données SQLite minimal :**

* **Table `events` :** `id`, `title`, `type`, `start_date`, `duration`, `description_short`, `description_org`, `channels` (JSON), `roles` (JSON), `images` (JSON), `documents` (JSON), `links` (JSON), `pinned`, `pinged`, `discord_message_ids` (JSON, pour mettre à jour le message partout s'il change).
* **Table `registrations` :** `id`, `event_id`, `user_id`, `username`, `status` (`inscrit`, `desinscrit`, `interesse`, `pas_interesse`), `updated_at`.

### Étape 3 : Le Backoffice Express (Le plus simple possible)

Pour éviter une usine à gaz, le backoffice est protégé par une **Basic Authentication** (un simple mot de passe stocké dans le `.env`).

1. **Formulaire de création :** Un formulaire HTML classique avec des champs de texte, des checkboxes pour le Pin/Ping, un select pour le type, et des inputs de type `file` (multiples) pour les images et documents.
2. **Gestion des fichiers :** Utiliser le middleware `multer` pour enregistrer directement les images et documents dans le dossier `public/uploads/` du serveur.
3. **Tableau de supervision :** Une page listant les événements créés. En cliquant sur un événement, on accède à la liste des utilisateurs Discord avec leur statut sous forme de tableau (Inscrit, Intéressé, etc.), exportable en CSV si nécessaire.

### Étape 4 : Logique du Bot Discord & Interaction

C'est ici que la magie opère. Lors de la validation du formulaire dans le backoffice :

1. L'événement est enregistré en base de données.
2. Le script du bot prend le relais : il construit un **Rich Embed** personnalisé contenant toutes les descriptions, liens, et la première image. Les documents sont ajoutés sous forme de liens de téléchargement pointant vers ton serveur Express.
3. Le bot génère des **Action Rows** avec des boutons Discord (`ButtonBuilder`) :

* 🟢 S'inscrire (style: `SUCCESS`)
* 🟡 Intéressé (style: `SECONDARY`)
* 🔴 Pas intéressé (style: `DANGER`)
* ⚪ Se désinscrire (style: `PRIMARY`)

1. Le bot boucle sur la liste des canaux sélectionnés pour y poster le message. Si l'option *Pin* est vraie, il épingle le message. Si *Ping* est vraie, il ajoute une mention `@everyone` ou `@Role` au-dessus de l'embed.
2. **Gestionnaire d'interactions (`interactionCreate`) :** Quand un utilisateur clique sur un bouton, le bot intercepte l'action, récupère son `user_id` et son `username`, met à jour (ou insère) son statut dans la table `registrations`, puis **met à jour dynamiquement l'embed** sur Discord pour afficher le compteur d'inscrits à jour.

### Étape 5 : Sécurisation & Bonnes Pratiques

* **Variables d'environnement :** Ne jamais push le token Discord ou le mot de passe du backoffice sur Git. Utiliser un fichier `.env`.
* **Droits d'accès :** Lors de l'envoi sur un canal, s'assurer que le bot possède bien les permissions d'écriture et d'épinglage sur celui-ci (géré nativement par `discord.js` via un bloc `try/catch`).
* **Validation des fichiers :** Limiter la taille des uploads (ex: max 5 Mo par image/document) pour éviter de saturer l'espace disque du serveur.

### Étape 6 : Déploiement Facile

Comme tout tient dans un seul processus Node.js et un fichier SQLite, le déploiement est trivial :

* **Option VPS simple :** Un clone du dépôt, un `npm install`, configuration du `.env`, et lancement en arrière-plan avec `pm2`.
* **Option PaaS (Railway / Render) :** Très simple d'utilisation, il faudra juste veiller à attacher un **Volume Persistant** au conteneur pour que le fichier `database.sqlite` et le dossier `/uploads` ne soient pas effacés à chaque redémarrage.

---

markdown_content = """# Spécifications Techniques & Plan d'Action — Bot Discord de Gestion d'Événements

Ce document définit les spécifications techniques détaillées et le plan d'action pour le développement d'un bot Discord couplé à un backoffice ultra-léger. Ce document est structuré pour être directement exploitable par des agents de développement IA ou des développeurs fullstack.

---

## 🛡️ RAPPELS DE SÉCURITÉ ET DIRECTIVES OPÉRATEUR

> ⚠️ **IMPORTANT POUR L'OPÉRATEUR :** > - **Variables d'environnement :** Ne stockez jamais le Token Discord, les identifiants du Backoffice ou la clé secrète de session dans le code source ou sur un dépôt Git public. Utilisez exclusivement un fichier `.env`.
>
> * **Permissions du Bot :** Le bot nécessite les *Privileged Gateway Intents* `Guilds`, `GuildMessages` et `GuildMembers` activés sur le Discord Developer Portal pour fonctionner correctement. Ne donnez pas les permissions d'Administrateur global en production ; limitez-les strictements aux canaux cibles (Voir Section Événements).
> * **Accès Backoffice :** L'accès est protégé par une authentification HTTP Basic. Modifiez impérativement le mot de passe par défaut avant le premier déploiement.

---

## 📅 PLAN D'ACTION DE DÉPLOIEMENT

### Étape 1 : Configuration initiale du portail Discord

1. Création de l'application sur le *Discord Developer Portal*.
2. Activation du menu "Bot", récupération du Token.
3. Activation des *Intents* requis (`Guilds`, `GuildMessages`, `MessageContent`, `GuildMembers`).
4. Génération du lien d'invitation OAuth2 avec les permissions : `Send Messages`, `Embed Links`, `Manage Messages`, `Read Message History`, `Add Reactions`.

### Étape 2 : Initialisation du Projet et Base de Données

1. Configuration d'un projet Node.js (ESM, `package.json` avec `"type": "module"`).
2. Installation des dépendances : `discord.js`, `express`, `better-sqlite3`, `multer`, `dotenv`.
3. Création du script d'initialisation de la base de données SQLite local (`data/database.sqlite`).

### Étape 3 : Développement du Backoffice Express

1. Mise en place du serveur Express sécurisé par `express-basic-auth`.
2. Création des routes pour le formulaire de création d'événement et le tableau de bord de supervision.
3. Intégration de `multer` pour la gestion des téléversements de fichiers en local.

### Étape 4 : Logique du Bot & Embeds

1. Initialisation du client Discord.js.
2. Développement du module de construction d'Embeds riches pour la publication.
3. Implémentation du gestionnaire d'interactions (`interactionCreate`) pour écouter les clics sur les boutons Discord (Inscriptions).

### Étape 5 : Recette et Déploiement

1. Tests locaux des flux (Création -> Publication -> Inscription -> Mise à jour de l'affichage).
2. Déploiement sur serveur (VPS avec `pm2`) ou plateforme PaaS (Railway/Render) avec volume persistant pour SQLite et les uploads.

---

## 🛠️ SPÉCIFICATIONS TECHNIQUES PAR FONCTIONNALITÉ

### 1. Stockage & Base de Données (SQLite)

Pour garantir la légèreté de l'infrastructure, une base de données relationnelle basée sur un fichier unique (`better-sqlite3`) est mise en place.

#### Schéma de la table `events`

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER (PK, AI) | Identifiant unique de l'événement |
| `title` | TEXT | Titre de l'événement |
| `type` | TEXT | Type parmi : Partie de JdR, Partie de Jeu, Présentation, Table ronde |
| `period` | TEXT | Période textuelle ou date de début (ex: "Du 12 au 14 Juillet") |
| `duration` | TEXT | Durée estimée (ex: "3 heures", "Tout le week-end") |
| `desc_short` | TEXT | Description courte pour l'accroche |
| `desc_org` | TEXT | Description de l'organisation et logistique |
| `channels` | TEXT (JSON) | Tableau des IDs de canaux Discord cibles (`["12345...", "67890..."]`) |
| `roles` | TEXT (JSON) | Tableau des IDs de rôles autorisés à voir/interagir |
| `images` | TEXT (JSON) | Liens locaux des images téléversées (`["/uploads/img1.png", ...]`) |
| `documents` | TEXT (JSON) | Liens locaux des documents (`["/uploads/doc1.pdf", ...]`) |
| `links` | TEXT (JSON) | Liens web externes saisis (`["https://...", ...]`) |
| `is_pinned` | INTEGER (0/1) | Statut d'épinglage du message sur Discord |
| `is_pinged` | INTEGER (0/1) | Statut de déclenchement d'une mention (@everyone ou @Role) |
| `discord_messages` | TEXT (JSON) | Mapping des messages envoyés par canal `{"channel_id": "message_id"}` |

#### Schéma de la table `registrations`

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER (PK, AI) | Identifiant de l'inscription |
| `event_id` | INTEGER (FK) | Référence vers `events.id` |
| `user_id` | TEXT | Identifiant Discord unique de l'utilisateur (`snowflake`) |
| `username` | TEXT | Pseudo Discord de l'utilisateur pour affichage rapide |
| `status` | TEXT | Statut : `inscrit`, `desinscrit`, `interesse`, `pas_interesse` |
| `updated_at` | DATETIME | Horodatage de la dernière modification |

---

### 2. Backoffice & Supervision (Express.js)

#### Sécurité d'accès

L'application Express.js intègre un middleware d'authentification basique.

```python
markdown_content = """# Spécifications Techniques & Plan d'Action — Bot Discord de Gestion d'Événements

Ce document définit les spécifications techniques détaillées et le plan d'action pour le développement d'un bot Discord couplé à un backoffice ultra-léger. Ce document est structuré pour être directement exploitable par des agents de développement IA ou des développeurs fullstack.

---

## 🛡️ RAPPELS DE SÉCURITÉ ET DIRECTIVES OPÉRATEUR

> ⚠️ **IMPORTANT POUR L'OPÉRATEUR :** > - **Variables d'environnement :** Ne stockez jamais le Token Discord, les identifiants du Backoffice ou la clé secrète de session dans le code source ou sur un dépôt Git public. Utilisez exclusivement un fichier `.env`.
> - **Permissions du Bot :** Le bot nécessite les *Privileged Gateway Intents* `Guilds`, `GuildMessages` et `GuildMembers` activés sur le Discord Developer Portal pour fonctionner correctement. Ne donnez pas les permissions d'Administrateur global en production ; limitez-les strictements aux canaux cibles (Voir Section Événements).
> - **Accès Backoffice :** L'accès est protégé par une authentification HTTP Basic. Modifiez impérativement le mot de passe par défaut avant le premier déploiement.

---

## 📅 PLAN D'ACTION DE DÉPLOIEMENT

### Étape 1 : Configuration initiale du portail Discord
1. Création de l'application sur le *Discord Developer Portal*.
2. Activation du menu "Bot", récupération du Token.
3. Activation des *Intents* requis (`Guilds`, `GuildMessages`, `MessageContent`, `GuildMembers`).
4. Génération du lien d'invitation OAuth2 avec les permissions : `Send Messages`, `Embed Links`, `Manage Messages`, `Read Message History`, `Add Reactions`.

### Étape 2 : Initialisation du Projet et Base de Données
1. Configuration d'un projet Node.js (ESM, `package.json` avec `"type": "module"`).
2. Installation des dépendances : `discord.js`, `express`, `better-sqlite3`, `multer`, `dotenv`.
3. Création du script d'initialisation de la base de données SQLite local (`data/database.sqlite`).

### Étape 3 : Développement du Backoffice Express
1. Mise en place du serveur Express sécurisé par `express-basic-auth`.
2. Création des routes pour le formulaire de création d'événement et le tableau de bord de supervision.
3. Intégration de `multer` pour la gestion des téléversements de fichiers en local.

### Étape 4 : Logique du Bot & Embeds
1. Initialisation du client Discord.js.
2. Développement du module de construction d'Embeds riches pour la publication.
3. Implémentation du gestionnaire d'interactions (`interactionCreate`) pour écouter les clics sur les boutons Discord (Inscriptions).

### Étape 5 : Recette et Déploiement
1. Tests locaux des flux (Création -> Publication -> Inscription -> Mise à jour de l'affichage).
2. Déploiement sur serveur (VPS avec `pm2`) ou plateforme PaaS (Railway/Render) avec volume persistant pour SQLite et les uploads.

---

## 🛠️ SPÉCIFICATIONS TECHNIQUES PAR FONCTIONNALITÉ

### 1. Stockage & Base de Données (SQLite)
Pour garantir la légèreté de l'infrastructure, une base de données relationnelle basée sur un fichier unique (`better-sqlite3`) est mise en place.

#### Schéma de la table `events`
| Champ | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER (PK, AI) | Identifiant unique de l'événement |
| `title` | TEXT | Titre de l'événement |
| `type` | TEXT | Type parmi : Partie de JdR, Partie de Jeu, Présentation, Table ronde |
| `period` | TEXT | Période textuelle ou date de début (ex: "Du 12 au 14 Juillet") |
| `duration` | TEXT | Durée estimée (ex: "3 heures", "Tout le week-end") |
| `desc_short` | TEXT | Description courte pour l'accroche |
| `desc_org` | TEXT | Description de l'organisation et logistique |
| `channels` | TEXT (JSON) | Tableau des IDs de canaux Discord cibles (`["12345...", "67890..."]`) |
| `roles` | TEXT (JSON) | Tableau des IDs de rôles autorisés à voir/interagir |
| `images` | TEXT (JSON) | Liens locaux des images téléversées (`["/uploads/img1.png", ...]`) |
| `documents` | TEXT (JSON) | Liens locaux des documents (`["/uploads/doc1.pdf", ...]`) |
| `links` | TEXT (JSON) | Liens web externes saisis (`["https://...", ...]`) |
| `is_pinned` | INTEGER (0/1) | Statut d'épinglage du message sur Discord |
| `is_pinged` | INTEGER (0/1) | Statut de déclenchement d'une mention (@everyone ou @Role) |
| `discord_messages` | TEXT (JSON) | Mapping des messages envoyés par canal `{"channel_id": "message_id"}` |

#### Schéma de la table `registrations`
| Champ | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER (PK, AI) | Identifiant de l'inscription |
| `event_id` | INTEGER (FK) | Référence vers `events.id` |
| `user_id` | TEXT | Identifiant Discord unique de l'utilisateur (`snowflake`) |
| `username` | TEXT | Pseudo Discord de l'utilisateur pour affichage rapide |
| `status` | TEXT | Statut : `inscrit`, `desinscrit`, `interesse`, `pas_interesse` |
| `updated_at` | DATETIME | Horodatage de la dernière modification |

---

### 2. Backoffice & Supervision (Express.js)

#### Sécurité d'accès
L'application Express.js intègre un middleware d'authentification basique.

```

```text
File generated successfully.

```javascript
import basicAuth from 'express-basic-auth';

app.use(basicAuth({
    users: { [process.env.ADMIN_USER]: process.env.ADMIN_PASSWORD },
    challenge: true,
    realm: 'Backoffice Bot Discord'
}));

```

#### Fonctionnalité : Création d'un Événement

* **Interface UI :** Formulaire HTML classique stylisé avec Tailwind CSS (chargé via CDN, aucun build requis).
* **Gestion des fichiers :** Utilisation de `multer` pour intercepter les fichiers. Les images (1 à 10) et les documents (PDF, DOC, TXT) sont renommés de manière unique et stockés dans le dossier public `public/uploads/`.
* **Validation :** Le serveur valide que le type sélectionné fait partie de la liste autorisée et que les tableaux de chaînes (liens, canaux, rôles) sont correctement formatés avant l'insertion en base de données.

#### Fonctionnalité : Liste & Supervision des Inscriptions

* Une page principale liste tous les événements actifs et passés.
* Au clic sur un événement, l'opérateur accède à la vue détaillée :
* **Statistiques globales :** Nombre total d'inscrits, d'intéressés, etc.
* **Tableau nominatif :** Liste détaillée reprenant le `Pseudo Discord`, le `Statut` et la `Date d'action`.

> 💡 **POUR L'OPÉRATEUR :**
> Le tableau de supervision se rafraîchit en lisant directement la table `registrations`. Aucune action manuelle n'est requise côté backoffice lorsqu'un utilisateur clique sur un bouton dans Discord : la base de données est mise à jour en temps réel par le bot.

---

### 3. Bot Discord & Interactions (`discord.js`)

#### Fonctionnalité : Publication de l'Événement

Dès la validation du formulaire dans le backoffice, une fonction interne appelle le client Discord pour effectuer les actions suivantes sur chaque canal configuré dans le champ `channels` :

1. **Génération de l'Embed :**

* **Header :** Couleur distincte selon le `Type` d'événement. Titre de l'événement.
* **Corps :** Insertion de la période, de la durée, de la description courte et de la description de l'organisation dans des champs (`fields`) dédiés.
* **Fichiers & Liens :** Les documents téléversés sont listés sous forme de liens URL pointant vers le serveur du backoffice (ex: `https://votre-site.com/uploads/document.pdf`). Les liens externes sont formatés en hypertexte Markdown.
* **Visuel :** La première image du tableau `images` est définie comme image principale de l'embed (`embed.setImage()`).

1. **Génération des Boutons (ActionRows) :**
Quatre boutons de type `ButtonBuilder` sont attachés au message avec des `customId` structurés comme suit : `event_<id>_<action>`.

* Bouton Vert : `event_42_inscrit` (Libellé : "S'inscrire")
* Bouton Bleu : `event_42_desinscrit` (Libellé : "Se désinscrire")
* Bouton Jaune : `event_42_interesse` (Libellé : "Intéressé")
* Bouton Rouge : `event_42_pas_interesse` (Libellé : "Pas intéressé")

1. **Envoi & Options supplémentaires :**

* **Ping :** Si `is_pinged` est vrai, le bot ajoute le texte de mention adéquat (`@everyone` ou le tag du rôle spécifié dans les droits de l'événement) en dehors et au-dessus de l'embed.
* **Pin :** Si `is_pinned` est vrai, le bot appelle `message.pin()` juste après l'envoi.
* **Historisation :** Les identifiants de messages générés sont stockés dans le champ `discord_messages` sous forme de JSON pour permettre de futures modifications ou suppressions synchronisées.

#### Fonctionnalité : Gestion des Inscriptions en Temps Réel

Le bot écoute globalement les interactions via l'événement `interactionCreate`.

```javascript
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const { customId, user } = interaction;
    if (!customId.startsWith('event_')) return;

    const [_, eventId, action] = customId.split('_');

    // 1. Mise à jour de la base de données SQLite
    db.prepare(`
        INSERT INTO registrations (event_id, user_id, username, status, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(event_id, user_id) DO UPDATE SET status = ?, updated_at = CURRENT_TIMESTAMP
    `).run(eventId, user.id, user.username, action, action);

    // 2. Recalcul des compteurs pour l'événement
    const counts = db.prepare(`
        SELECT status, COUNT(*) as count FROM registrations WHERE event_id = ? GROUP BY status
    `).all(eventId);

    // 3. Régénération de l'Embed mis à jour avec les compteurs d'inscrits
    const updatedEmbed = buildUpdatedEmbed(eventId, counts);

    // 4. Réponse à l'utilisateur et mise à jour dynamique du message Discord
    await interaction.update({ embeds: [updatedEmbed] });
});

```

> ⚠️ **IMPORTANT POUR L'OPÉRATEUR :**
>
> * L'utilisation de `interaction.update()` garantit une mise à jour fluide du message sans générer de spam ou de notifications superflues sur le canal.
> * Si l'événement a été publié sur plusieurs canaux en même temps, le clic sur un bouton mettra à jour le message du canal courant. Pour synchroniser instantanément les autres canaux, une boucle de mise à jour asynchrone utilisant les IDs stockés dans `discord_messages` doit être exécutée en tâche de fond.
>
>

---

## 🚀 STRATÉGIE DE DÉPLOIEMENT SIMPLE

### Prérequis à fournir à l'hébergement

* **Node.js** v18 ou supérieur.
* Un dossier persistant pour la base de données SQLite et les fichiers médias.

### Fichier d'environnement modèle (`.env`)

```env
PORT=3000
ADMIN_USER=operateur_admin
ADMIN_PASSWORD=UnMotDePasseTresSecurise123!
DISCORD_TOKEN=MTI3NDk0...VotreTokenDiscordIci...

```

"""

with open("specifications_techniques_bot_discord.md", "w", encoding="utf-8") as f:
f.write(markdown_content)

print("File generated successfully.")

```
Le plan d'action détaillé ainsi que l'ensemble des spécifications techniques découpées par fonctionnalités ont été rédigés et formalisés dans un fichier au format Markdown (`.md`), optimisé pour être directement interprété par des agents de développement ou des développeurs.

Votre fichier Markdown est prêt :
[file-tag: code-generated-file-0-1782832586940923684]

### Synthèse du contenu du document :
* **Rappels de sécurité & Directives Opérateur :** Tous les points critiques destinés à la configuration et à la gestion humaine (gestion du `.env`, activation des *Intents* Discord, authentification) sont mis en exergue à l'aide de blocs d'avertissement spécifiques (`> ⚠️` et `> 💡`).
* **Plan d'Action :** Intégration complète du plan chronologique étape par étape, de la création de l'application sur le portail Discord jusqu'au déploiement final.
* **Spécifications des Données :** Schémas complets et typages des tables SQLite (`events` et `registrations`) avec gestion des formats JSON pour les listes (canaux, rôles, images, docs, liens).
* **Spécifications du Backoffice (Express) :** Détails de l'authentification basique, de la capture de fichiers multiples (via `multer`) et de l'interface de supervision.
* **Logique de l'application & Interactions Discord :** Algorithme technique décrivant la construction de l'Embed riche, la génération dynamique des boutons d'interaction et le code de traitement de l'événement `interactionCreate` (avec mise à jour en temps réel via SQLite et `interaction.update()`).

Ce fichier peut être transmis directement en entrée à tes agents IA (comme un prompt système ou un document de contexte de projet) pour qu'ils commencent à coder la structure de l'application.

```
