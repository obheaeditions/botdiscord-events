# Spécification de la Publication d'Événements Discord

Cette sous-fonctionnalité gère l'intégration du bot Discord pour construire des embeds riches, générer les lignes de boutons d'interaction, les envoyer sur les salons et optionnellement les épingler ou tagger des rôles.

## Embed Riche (Rich Embed)

L'affichage de l'événement est normalisé grâce à la classe `EmbedBuilder` de `discord.js`.

- **Couleurs :** Une couleur distinctive est appliquée en fonction du type d'événement pour structurer visuellement le serveur (Rouge pour JdR, Vert pour Jeu, Bleu pour Présentation, Violet pour Table ronde).
- **Médias :** La première image téléversée est affichée comme visuel principal dans le corps de l'embed.
- **Pièces Jointes & Liens :** Les documents sont formatés sous forme d'hyperliens pointant vers le serveur d'uploads du Backoffice. Les liens externes sont formatés en hypertexte Markdown.
- **Réponses :** L'embed affiche les statistiques consolidées en temps réel des inscrits.

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
