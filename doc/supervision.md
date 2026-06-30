# Spécification de la Supervision & Tableau de Bord

Cette sous-fonctionnalité permet de suivre en temps réel l'engagement des membres sur les événements créés.

## Vues d'Administration

L'administration s'organise autour de deux vues principales.

### 1. Tableau de Bord (Dashboard)

- **Route :** `GET /`
- **Objectif :** Lister l'ensemble des événements par ordre ante-chronologique.
- **Rendu Visuel :** Affiche sous forme de cartes élégantes le titre, le type, la période, la description courte et le lien d'accès à la supervision détaillée de chaque événement.

### 2. Vue de Supervision Détaillée (Event Details)

- **Route :** `GET /events/:id`
- **Objectif :** Présenter les statistiques d'inscription consolidées ainsi que la liste nominative des inscrits.
- **Éléments Affichés :**
  - **Détails de l'Événement :** Type, durée, descriptions logistiques, liens externes, documents et images téléversées.
  - **Indicateurs de Performance (Cartes de Compteurs) :** Nombre consolidé pour chacun des quatre statuts (`inscrits`, `intéressés`, `pas intéressés`, `désinscrits`).
  - **Tableau des Participants :** Tableau listant le pseudo Discord, le Snowflake ID de l'utilisateur, son statut actuel et la date/heure de sa dernière interaction.

## Agrégation des Données (SQL)

Pour assurer un rafraîchissement performant et en temps réel :
- Le tableau de supervision lit directement la table `registrations`.
- Les compteurs sont agrégés côté serveur lors de la requête de la vue détaillée en filtrant sur `event_id` et en triant la liste par date de réponse décroissante (`ORDER BY updated_at DESC`).
