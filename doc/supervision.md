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
- **Mise en page :** Organisé en 2 colonnes égales (1/2 - 1/2) sur grand écran.
  - **Colonne Gauche (Informations) :** Affiche le titre, type, durée, descriptions logistiques, liens externes, documents joints et images d'illustrations. Un bouton « Modifier l'Événement » permet de naviguer vers le formulaire d'édition.
  - **Colonne Droite (Participants & Actions) :**
    - **Indicateurs de Performance (Cartes de Compteurs) :** Nombre consolidé pour chacun des 5 statuts (`inscrits`, `intéressés`, `en attente`, `pas intéressés`, `désinscrits`).
    - **Tableau des Participants :** Tableau listant le pseudo Discord, le Snowflake ID, son statut actuel, la date/heure de dernière interaction, et les actions d'administration (mise en attente / réintégration).
    - **Formulaire d'ajout rapide :** Permet d'ajouter manuellement un participant.

## Agrégation des Données (SQL)

Pour assurer un rafraîchissement performant et en temps réel :

- Le tableau de supervision lit directement la table `registrations`.
- Les compteurs sont agrégés côté serveur lors de la requête de la vue détaillée en filtrant sur `event_id` et en triant la liste par date de réponse décroissante (`ORDER BY updated_at DESC`).
