# Spécifications de la Base de Données (SQLite)

Cette sous-fonctionnalité gère le stockage local des données pour les événements et les inscriptions des utilisateurs Discord. L'accès à la base de données est implémenté avec `better-sqlite3`.

## Schéma Relationnel

La base de données est constituée de deux tables principales : `events` et `registrations`.

### Table `events`

Stocke les détails de chaque événement créé depuis l'interface d'administration.

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Clé primaire auto-incrémentée |
| `title` | TEXT | Titre de l'événement (Requis) |
| `type` | TEXT | Type de l'événement (Partie de JdR, Partie de Jeu, Présentation, Table ronde) |
| `start_date` | TEXT | Date de début de l'événement (au format YYYY-MM-DD, ex: "2026-07-12") |
| `end_date` | TEXT | Date de fin de l'événement (optionnel, au format YYYY-MM-DD, ex: "2026-07-14") |
| `start_time` | TEXT | Heure de début de l'événement (au format HH:MM, ex: "18:00") |
| `end_time` | TEXT | Heure de fin de l'événement (optionnel, au format HH:MM, ex: "20:00") |
| `duration` | TEXT | Durée estimée de l'événement au format HH:MM (ex: "02:30") |
| `desc_short` | TEXT | Description courte accrocheuse pour l'embed |
| `desc_org` | TEXT | Description de l'organisation et de la logistique |
| `channels` | TEXT (JSON) | Tableau des identifiants des canaux Discord de publication (ex: `["123...", "456..."]`) |
| `roles` | TEXT (JSON) | Tableau des identifiants des rôles Discord autorisés à s'inscrire. Un tableau vide `[]` signifie un accès libre pour tous. |
| `images` | TEXT (JSON) | Tableau contenant les chemins relatifs des images téléversées. |
| `documents` | TEXT (JSON) | Tableau contenant les chemins relatifs des documents téléversés. |
| `links` | TEXT (JSON) | Tableau contenant les liens web externes saisis dans le formulaire. |
| `is_pinned` | INTEGER | Indicateur d'épinglage du message sur Discord (0: non, 1: oui) |
| `is_pinged` | INTEGER | Indicateur d'envoi de mention Discord (0: non, 1: oui) |
| `is_blocked` | INTEGER | Indicateur de blocage des inscriptions (0: ouvert, 1: bloqué/fermé) |
| `discord_messages` | TEXT (JSON) | Objet de mapping associant l'ID de chaque canal au message ID publié (ex: `{"123": "456", "789": "101"}`) pour la mise à jour asynchrone multicanale. |

### Table `registrations`

Stocke le statut de réponse en temps réel de chaque utilisateur Discord par rapport à un événement.

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Clé primaire auto-incrémentée |
| `event_id` | INTEGER | Clé étrangère référençant `events.id` (avec suppression en cascade `ON DELETE CASCADE`) |
| `user_id` | TEXT | Identifiant Discord unique de l'utilisateur (`snowflake`) |
| `username` | TEXT | Nom d'utilisateur Discord pour affichage |
| `status` | TEXT | Statut de réponse (`inscrit`, `desinscrit`, `interesse`, `pas_interesse`) |
| `updated_at` | TEXT | Horodatage de l'action utilisateur (par défaut `CURRENT_TIMESTAMP`) |

**Contraintes & Index :**

- Une contrainte d'unicité `UNIQUE(event_id, user_id)` est en place pour garantir qu'un utilisateur ne possède qu'un seul statut par événement et permettre la mise à jour via `ON CONFLICT`.
- Un index sur `event_id` est ajouté pour accélérer l'agrégation des statistiques et le rendu de la supervision.
