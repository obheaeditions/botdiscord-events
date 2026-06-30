# Spécification de la Gestion des Interactions Discord

Cette sous-fonctionnalité gère la réponse en temps réel du bot Discord lorsque des utilisateurs cliquent sur les boutons d'inscription associés aux messages d'événements.

## Gestionnaire d'Interactions (`interactionCreate`)

Le bot écoute de manière globale toutes les interactions sur le serveur.

- **Filtrage :** Seules les interactions de type bouton dont le `customId` commence par `event_` sont traitées.
- **Règles d'Accès (Contrôle des Rôles) :**
  - Si des rôles de restriction sont définis sur l'événement, le bot vérifie que le membre possède au moins un de ces rôles dans son cache (`member.roles.cache`).
  - Si le membre ne possède pas le rôle requis, le bot répond immédiatement avec un message d'erreur éphémère (`ephemeral: true`) invisible pour les autres membres.
  - Si l'événement est configuré avec une liste de rôles vide, l'accès est libre et l'interaction est validée immédiatement.

## Traitement de l'Inscription

1. **Mise à jour SQLite :** Le bot effectue une écriture `INSERT ... ON CONFLICT(event_id, user_id) DO UPDATE SET status = ?, updated_at = CURRENT_TIMESTAMP` pour insérer ou écraser le statut de réponse de l'utilisateur.
2. **Calcul des Statistiques :** Les réponses sont lues depuis la base de données SQLite pour l'événement sélectionné afin de recalculer dynamiquement la répartition des inscrits (`inscrits`, `intéressés`, etc.).
3. **Mise à Jour de l'Embed Principal :** L'embed riche du message sur lequel l'utilisateur a cliqué est mis à jour instantanément en invoquant `interaction.update()` avec le nouvel embed recalculé contenant les statistiques actualisées.
4. **Synchronisation Multicanale (Arrière-plan) :** Si l'événement a été publié sur plusieurs canaux cibles (indiqués dans la colonne `discord_messages`), une boucle asynchrone parcourt tous les autres messages et exécute `message.edit()` en arrière-plan pour synchroniser en temps réel les compteurs d'inscriptions sur tous les salons.
