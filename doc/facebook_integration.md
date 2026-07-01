# Spécification de la Publication Facebook & de l'Inscription Publique

Cette sous-fonctionnalité étend la diffusion des événements au-delà de Discord : publication automatique sur une Page Facebook, et inscription possible depuis un lien public, avec remontée des inscriptions dans le même système de comptage que Discord.

## Activation par Événement (Opt-in)

La publication Discord reste systématique et non désactivable. La publication Facebook, elle, est **optionnelle et se décide événement par événement** via une case à cocher « Publier sur Facebook » dans les formulaires de création et d'édition, reflétée en base par la colonne `events.publish_facebook` (`0` par défaut).

- La case n'est affichée que si `FACEBOOK_PAGE_ID`/`FACEBOOK_PAGE_ACCESS_TOKEN` sont configurés côté serveur (sinon la fonctionnalité n'existe pas pour l'opérateur).
- **À la création :** si la case est cochée, la publication Facebook est déclenchée immédiatement (en parallèle de Discord).
- **À l'édition :** si la case passe de décochée à cochée pour un événement jamais encore publié sur Facebook (`facebook_post_id` vide), la première publication est déclenchée automatiquement. Si elle est décochée, l'événement n'est plus republiable (bouton masqué) mais le post déjà existant sur Facebook n'est pas supprimé automatiquement.
- Le bouton manuel « Republier sur Facebook » et la route `POST /events/:id/republish-facebook` ne sont disponibles que pour un événement dont `publish_facebook = 1`.

## Publication sur la Page Facebook

- **Déclenchement :** À la création d'un événement (`POST /events/create`), si `publish_facebook` est coché, en parallèle de la publication Discord, `publishEventToFacebook(eventId)` (`src/social/facebookPublisher.js`) est appelée de manière asynchrone et non bloquante.
- **Contenu du post :** Une publication de type photo (`POST /{page-id}/photos` de l'API Meta Graph) contenant :
  - La première image de l'événement.
  - Une légende composée du titre, de l'accroche courte (`desc_short`), de la date, et d'un lien vers la page d'inscription publique (`{BACKEND_URL}/register/{eventId}`).
- **Si aucune image n'est disponible**, la publication Facebook est ignorée (l'endpoint utilisé nécessite une photo).
- **Republication manuelle :** Un bouton « Republier sur Facebook » dans la vue de détail d'un événement (visible uniquement si `FACEBOOK_PAGE_ID`/`FACEBOOK_PAGE_ACCESS_TOKEN` sont configurés) permet de mettre à jour la légende du post existant (`POST /{post-id}`). **L'image du post n'est pas automatiquement resynchronisée** à chaque modification de l'événement : ce n'est possible que via l'API pour la légende, pas pour la photo elle-même.
- **Configuration requise :** Variables d'environnement `FACEBOOK_PAGE_ID` et `FACEBOOK_PAGE_ACCESS_TOKEN` (voir `.env.example`). Si absentes, la publication est simplement ignorée avec un avertissement en log — aucune erreur bloquante.

## Page d'Inscription Publique

- **Route :** `GET /register/:eventId` (accès public, sans authentification — montée avant le middleware d'authentification dans `src/server/index.js`, comme `/uploads`).
- **Formulaire :** Pseudo Discord (obligatoire) et email (optionnel), avec un bouton « S'inscrire ».
- **Traitement (`POST /register/:eventId`) :**
  1. Si l'événement est bloqué (`is_blocked = 1`), un message d'inscriptions fermées est affiché sans écriture en base.
  2. Le pseudo saisi est confronté aux membres du serveur Discord via `resolveGuildMemberByUsername()` (`src/bot/index.js`), qui recherche une correspondance **exacte** (insensible à la casse) parmi les membres du serveur (`guild.members.search`, nécessite l'intent `GuildMembers`, déjà activé).
     - **Pseudo trouvé :** l'inscription est enregistrée avec le véritable `user_id` Discord — elle compte alors comme n'importe quelle inscription faite depuis Discord.
     - **Pseudo non trouvé :** l'inscription est tout de même enregistrée, avec un identifiant synthétique (`fb_<aléatoire>`) et le pseudo tel que saisi. Elle est identifiable dans le backoffice par un badge « Facebook · non lié », à vérifier manuellement par l'organisateur.
  3. Dans les deux cas, l'inscription est écrite dans la table `registrations` avec `source = 'facebook'` et le statut `inscrit`, puis les compteurs Discord sont resynchronisés immédiatement (`syncEventToDiscord`, réutilisé de `src/bot/publisher.js`) pour donner une **vision globale** unifiée sur l'embed Discord et dans le backoffice, quel que soit le canal d'inscription.

## Modifications du Schéma de Base de Données

| Table | Champ | Description |
| :--- | :--- | :--- |
| `events` | `publish_facebook` | Active (`1`) ou non (`0`, défaut) la publication Facebook pour cet événement |
| `events` | `facebook_post_id` | Identifiant du post photo Facebook publié (`NULL` tant que non publié) |
| `registrations` | `source` | Origine de l'inscription : `discord` (par défaut) ou `facebook` |
| `registrations` | `email` | Contact optionnel saisi sur la page d'inscription publique |

## Obtenir les identifiants Meta (Page Facebook)

1. Disposer d'une Page Facebook (pas un profil personnel) dont vous êtes administrateur.
2. Créer une application sur [developers.facebook.com](https://developers.facebook.com) (type Entreprise). Tant que seules vos propres Pages sont utilisées, l'app peut rester en mode Développement (pas de revue Meta nécessaire).
3. Via l'outil [Graph API Explorer](https://developers.facebook.com/tools/explorer), générer un token utilisateur avec les permissions `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, puis appeler `GET /me/accounts` pour récupérer l'`id` de la Page (`FACEBOOK_PAGE_ID`) et son `access_token`.
4. Échanger ce token contre un token longue durée (`GET /oauth/access_token?grant_type=fb_exchange_token&...`), puis refaire `GET /me/accounts` avec ce token longue durée pour obtenir un Page Access Token stable (`FACEBOOK_PAGE_ACCESS_TOKEN`).
5. Renseigner les deux variables dans le `.env` de production et redémarrer le conteneur.
