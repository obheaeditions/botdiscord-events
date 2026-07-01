# Spécification de la Publication d'Événements Discord

Cette sous-fonctionnalité gère l'intégration du bot Discord pour construire des embeds riches, générer les lignes de boutons d'interaction, les envoyer sur les salons et optionnellement les épingler ou tagger des rôles.

## Embeds Riches (Rich Embeds)

L'affichage de l'événement n'utilise pas un embed unique mais un ensemble ordonné de **plusieurs embeds** (`EmbedBuilder` de `discord.js`), construits par `buildEmbeds()` (`src/bot/embedBuilder.js`) afin de mettre l'image principale bien en évidence en tête de carte et de proposer une galerie cliquable pour les images additionnelles.

1. **Carte Titre (Header) :** Contient uniquement le titre de l'événement, l'accroche courte (`desc_short`) et la première image téléversée en visuel principal, positionnée tout en haut de la publication. Aucun champ n'y est ajouté afin que l'image reste au plus près du titre.
2. **Carte Détails :** Regroupe l'ensemble des informations structurées : Date/Période, Durée, Type, Organisation, Liens utiles, Documents joints, ainsi que les statistiques d'inscription. Un horodatage (`setTimestamp()`) y est ajouté.
3. **Galerie d'Images (optionnelle) :** Les images téléversées au-delà de la première (jusqu'à 8 supplémentaires, `MAX_GALLERY_IMAGES`) sont ajoutées sous forme d'embeds contenant uniquement une image. Ces embeds partagent volontairement la même URL (`setURL`, celle de la première image) : Discord regroupe alors automatiquement les embeds partageant une URL identique en une **grille de vignettes cliquables** sous la carte principale, sans dupliquer le titre ni la description.

Ce découpage respecte la limite de **10 embeds maximum par message Discord** (2 réservés aux cartes Titre/Détails + jusqu'à 8 vignettes de galerie).

- **Couleurs :** Une couleur distinctive est appliquée sur chaque carte en fonction du type d'événement pour structurer visuellement le serveur (Rouge pour JdR, Vert pour Jeu, Bleu pour Présentation, Violet pour Table ronde).
- **Pièces Jointes & Liens :** Les documents sont formatés sous forme d'hyperliens pointant vers le serveur d'uploads du Backoffice. Les liens externes sont formatés en hypertexte Markdown.
- **Réponses :** La carte Détails affiche les statistiques consolidées en temps réel des inscrits.

> **Note technique :** la largeur des embeds est fixée par le client Discord lui-même (elle ne s'adapte pas à la largeur de la fenêtre) ; ce n'est pas un paramètre configurable via l'API.

## Ligne d'Actions (Boutons)

Quatre boutons de type `ButtonBuilder` sont associés au message avec les identifiants personnalisés `event_<id>_<action>` :
- **S'inscrire :** Couleur verte (`SUCCESS`), customId `event_<id>_inscrit`
- **Se désinscrire :** Couleur bleue (`PRIMARY`), customId `event_<id>_desinscrit`
- **Intéressé :** Couleur jaune (`SECONDARY`), customId `event_<id>_interesse`
- **Pas intéressé :** Couleur rouge (`DANGER`), customId `event_<id>_pas_interesse`

## Options d'Envoi

- **Pin :** Si l'indicateur d'épinglage est activé, le bot exécute `message.pin()` après l'envoi.
- **Ping :** Si la notification est activée, le bot ajoute au-dessus de l'embed la mention `@everyone` (si aucun rôle restrictif n'est configuré) ou la liste des tags des rôles autorisés (`<@&role_id>`).
- **Cartographie :** Les Snowflake IDs des messages envoyés par salon sont sauvegardés en format JSON dans la colonne `discord_messages` pour permettre la synchronisation multicanale future.
