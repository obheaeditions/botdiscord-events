# SF-7 : Administration des Événements (Suppression, Clôture et Republication)

Ce document décrit les mécanismes de gestion et d'administration des événements à partir du backoffice Web (EventBot Portal).

---

## 1. Clôture / Blocage des Inscriptions

### Côté Base de Données
Le champ `is_blocked` (de type `INTEGER`, par défaut `0`) dans la table `events` définit si les inscriptions sont ouvertes (`0`) ou fermées (`1`).

### Côté Discord (Bot)
- Lorsque l'état passe à bloqué :
  - L'embed Discord est automatiquement mis à jour avec le préfixe `🔒 [INSCRIPTIONS FERMÉES]` sur le titre de l'événement.
  - La couleur de l'embed bascule sur un gris neutre (`#7F8C8D`).
  - Tous les boutons d'interaction (`S'inscrire`, `Se désinscrire`, etc.) reçoivent l'attribut `.setDisabled(true)` pour griser l'interface sur Discord.
- Si un utilisateur clique sur un bouton existant d'un événement fermé, le gestionnaire `interactionCreate` lui renvoie une réponse éphémère d'erreur :
  > ❌ Les inscriptions pour cet événement sont fermées.

---

## 2. Suppression d'un Événement

Lorsqu'un administrateur clique sur "Supprimer" dans le backoffice :
1. Le serveur initie une suppression asynchrone des messages de l'événement sur Discord (`deleteEventFromDiscord`). Le bot parcourt la liste des salons cibles et supprime les messages Discord associés.
2. L'événement est supprimé de la table `events`. 
3. Grâce à la contrainte SQLite `ON DELETE CASCADE`, toutes les réponses d'inscription associées dans la table `registrations` sont automatiquement nettoyées.

---

## 3. Republication et Synchronisation

En cas de modification manuelle ou si un message d'événement est supprimé accidentellement sur Discord par un modérateur, l'administrateur peut forcer la synchronisation :
- Le serveur déclenche `publishEventToDiscord`.
- Pour chaque canal configuré, le bot tente de récupérer le message existant.
  - S'il existe, l'embed et ses boutons sont modifiés et mis à jour (`msg.edit`).
  - Si le message n'existe plus ou a été supprimé, un nouveau message est envoyé (`channel.send`) et le nouveau Message ID est écrit en base de données.
