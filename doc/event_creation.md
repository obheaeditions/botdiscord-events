# Spécification de la Création d'Événements & Validation

Cette sous-fonctionnalité permet à l'opérateur de créer un événement à l'aide d'un formulaire multipart (contenant du texte, des cases à cocher, des listes, ainsi que des fichiers d'images et de documents joints).

## Traitement Multipart (Multer)

Pour gérer la réception simultanée de données de formulaire textuelles et de fichiers volumineux, le middleware `multer` est configuré sur la route `POST /events/create`.

### Règles de Sécurité des Fichiers

- **Taille Limite :** Les fichiers téléversés sont limités à un maximum de 10 Mo par fichier.
- **Extensions Autorisées (Allow-list) :**
  - **Images :** `.png`, `.jpg`, `.jpeg` uniquement.
  - **Documents :** `.pdf`, `.docx`, `.txt` uniquement.
- **Renommage Aléatoire :** Chaque fichier est renommé en utilisant 16 octets générés de manière cryptographiquement forte (`crypto.randomBytes(16)`), suivis de son extension d'origine, garantissant l'absence de collision et empêchant les attaques par traversée de répertoires (Path Traversal) sur les noms de fichiers.
- **Non-Exécutable :** Les fichiers sont enregistrés dans le dossier `public/uploads/` servi de manière statique mais non-exécutable.

## Sélection des Canaux et des Rôles (Checklists)

Plutôt que de saisir des identifiants (IDs) textuels manuellement, l'opérateur sélectionne les canaux et les rôles via des listes d'options dynamiques dotées de cases à cocher :

- **Récupération Dynamique :** Lors du chargement du formulaire (`GET /events/create`), le serveur interroge l'API Discord pour récupérer les salons textuels et les rôles créés par les utilisateurs (les rôles gérés par les intégrations et le rôle `@everyone` sont exclus).
- **Normalisation des Tableaux :** Comme les formulaires HTML transmettent les cases à cocher sous forme de chaîne de caractères unique (si une seule case est cochée) ou de tableau (si plusieurs sont cochées), le backend normalise systématiquement les données reçues (`channels` et `roles`) en tableaux de chaînes via un helper de normalisation.
- **Accès Libre (Null) :** Si aucune case de rôle n'est cochée, l'événement est enregistré avec un tableau vide `[]`, ce qui autorise l'accès à tous les membres du serveur Discord.

## Validation de la Cohérence Rôles/Canaux

Avant l'insertion en base de données et la publication, le serveur vérifie la cohérence des autorisations Discord.

- **Flux de Contrôle :**
  1. Si aucun rôle n'est spécifié (tableau de rôles vide), l'événement est considéré comme public et aucune validation de rôle n'est requise.
  2. Si des rôles sont spécifiés, le backend appelle le helper Discord `validateRolePermissionsForChannels` pour chaque canal sélectionné.
  3. Il vérifie que chaque rôle existe sur le serveur Discord cible.
  4. Il vérifie que chaque rôle possède les permissions `ViewChannel` (lire le salon) et `SendMessages` (écrire des messages) sur chaque canal configuré.
  5. En cas d'incohérence, le serveur intercepte l'erreur, supprime immédiatement tous les fichiers temporaires déjà écrits sur le disque par `multer` (pour éviter les fichiers orphelins), et renvoie le formulaire avec un code d'erreur HTTP 400 et le message d'erreur d'incohérence.
