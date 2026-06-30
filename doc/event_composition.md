# SF-8 : Gestion et Publication des Compositions (Thread & Liste d'attente)

Ce document décrit le fonctionnement technique de la gestion de la composition finale d'un événement (ajout manuel, mise en liste d'attente et publication dans un fil Discord).

---

## 1. Gestion des Participants en Backoffice

L'administrateur peut modifier directement la composition de l'événement depuis sa page de détails.

### Ajout Manuel de Participants

- Un formulaire en bas de la liste permet de saisir directement un **ID Discord (Snowflake)** et un **Pseudo**.
- À la soumission (`POST /events/:id/registrations/add`) :
  - Le serveur enregistre la ligne en base de données avec le statut `inscrit`.
  - Le serveur met automatiquement à jour l'embed Discord associé à l'événement pour synchroniser les compteurs en temps réel.

### Mise en Attente (Waitlist)

- À côté de chaque participant ayant le statut `inscrit` ou `interesse`, un bouton **Mettre en attente** est affiché.
- Au clic (`POST /events/:id/registrations/:userId/waitlist`) :
  - Le serveur passe le statut de l'utilisateur à `en_attente`.
  - Le compteur "En attente" sur le tableau de bord et dans l'embed Discord est incrémenté.
  - L'embed est synchronisé de manière asynchrone sur Discord.

---

## 2. Publication de la Composition sur Discord (Threads)

Un bouton **Publier la Composition** permet de diffuser la composition sous forme de message textuel structuré dans un fil de discussion Discord.

### Fonctionnement Technique

1. **Recherche / Création de Fil (Thread) :**
   - Le bot Discord récupère le message principal de l'événement dans le canal cible.
   - S'il n'existe pas de fil de discussion associé à ce message, le bot en crée un nouveau nommé : `"Composition - [Titre de l'événement]"`.
   - Si le fil existe déjà, le bot le réutilise.
2. **Construction du Message de Composition :**
   - Le bot formule un message listant :
     - Les **Participants inscrits** (statut `inscrit`).
     - Les **Participants en attente** (statut `en_attente`).
3. **Envoi :**
   - Le message récapitulatif est posté à l'intérieur du fil de discussion.
