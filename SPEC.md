# SPEC - Application de suivi de marge freelances

> Version initiale validée le 2026-06-06. Mise à jour le 2026-06-07 : modèle simplifié (un seul TJM courant par mission, planning jour par jour, suppression de l'historique des tarifs et de la gestion des absences).

## 1. Contexte et objectif

Application interne de pilotage pour une société de conseil qui place des freelances en mission chez des clients. Objectif : savoir à tout moment combien coûte et rapporte chaque freelance, et estimer la marge prévisionnelle du mois en cours et des mois suivants.

Utilisateurs : 3 associés. Volume cible : 15 freelances, ~20 missions actives maximum.

## 2. Entités (modèle de données)

### Freelance
- prénom, nom
- statut : actif / inactif

### Client
- nom de la société
- statut : actif / archivé

### Mission
- freelance (référence)
- client (référence)
- nom (libellé de la mission)
- TJM achat (ce qu'on paie au freelance, en € HT)
- TJM vente (ce qu'on facture au client, en € HT)
- statut : actif / inactif (bouton manuel « Désactiver », jamais calculé). Une mission inactive n'est plus proposée dans le planning.

Règles sur les missions :
- Un freelance peut avoir plusieurs missions simultanées (chez des clients différents).
- Le TJM est un tarif unique courant : il n'y a pas d'historique de tarification. On peut le modifier à tout moment sur la mission. Cette modification ne touche que les jours posés ensuite (voir Affectation).

### Affectation (planning jour par jour)
- freelance (référence) + mission (référence) + date
- TJM achat et TJM vente : recopiés depuis la mission au moment où le jour est posé dans le planning, puis figés.
- Contrainte : un freelance ne peut être affecté qu'à une seule mission par jour.

Règle sur le TJM figé : modifier le TJM d'une mission ne change pas les jours déjà posés (le passé n'est jamais réécrit). Pour appliquer un nouveau TJM à des jours déjà posés, il faut les reposer dans le planning.

## 3. Règles de calcul (logique métier)

### Jours ouvrés et fériés (repères visuels)
- Le calendrier du planning distingue les week-ends et les jours fériés français (France métropolitaine), calculés automatiquement (y compris pour les mois futurs).
- Ce ne sont que des repères d'affichage : l'affectation des jours reste manuelle (on peut affecter un week-end si besoin).

### Jours facturés d'une mission pour un mois M
- = nombre de jours affectés à cette mission dans le planning sur le mois M.
- Il n'y a plus de calcul automatique à partir de dates de mission, de « jours par semaine » ou d'absences : la saisie se fait directement dans le planning, jour par jour.

### Marge
- Chaque jour affecté porte son propre TJM (figé à la pose).
- Pour un mois M et une mission :
  - CA prévisionnel = somme des TJM vente des jours affectés
  - Coût prévisionnel = somme des TJM achat des jours affectés
  - Marge prévisionnelle = CA − coût
- Marge par jour (indicative) = TJM vente − TJM achat
- Taux de marge = marge / CA (0 si le CA est nul, pour éviter une division par zéro)
- Totaux agrégés sur le mois, toutes missions confondues.

## 4. Écrans

### Écran 1 : Planning (page d'accueil)
- Sélecteur de mois (navigation mois précédent / suivant).
- 4 indicateurs en haut : CA prévisionnel, coût total, marge totale, taux de marge du mois affiché.
- Grille de planning : une ligne par freelance actif, une colonne par jour du mois (week-ends et jours fériés signalés). On clique-glisse pour sélectionner des jours, puis on choisit la mission à affecter ; on peut aussi libérer des jours.
- Un freelance ne peut avoir qu'une seule mission par jour.
- Tableau « Détail du mois » : par mission, le freelance, le client, le TJM achat, le TJM vente, le nombre de jours et la marge du mois. Ligne de total en bas.

### Écran 2 : Missions
- Liste filtrable : Actives / Inactives (Actives par défaut).
- Colonnes : nom, freelance, client, TJM achat, TJM vente, marge/jour, statut.
- Création et modification d'une mission (nom, freelance, client, TJM achat, TJM vente).
- Activation / désactivation (pas de suppression, pour garder l'historique). Une mission inactive n'apparaît plus dans le planning.

### Écran 3 : Freelances
- Liste filtrable : Actifs / Archives.
- Fiche freelance : ses clients et missions.
- Création, modification, activation / désactivation (pas de suppression).

### Écran 4 : Clients
- Liste filtrable : Actifs / Archives.
- Fiche client : les freelances placés.
- Création, modification, archivage / désarchivage (pas de suppression).

## 5. Authentification
- Connexion par email + mot de passe (mots de passe stockés de façon sécurisée, hachés).
- 3 comptes créés manuellement (un par associé, pas d'inscription publique).
- Pas de gestion de rôles : les trois utilisateurs voient et font la même chose.

## 6. Hors périmètre v1 (explicitement exclus)
- Historique des tarifs (un seul TJM courant par mission)
- Gestion des absences
- Facturation / génération de factures
- CRA détaillé jour par jour
- Suivi du réel (réalisé vs prévisionnel) : la v1 est 100 % prévisionnelle
- Multi-devises (tout est en € HT)
- Notifications / emails automatiques
- Multi-société (mono-tenant)
- Export PDF/Excel (pourra venir en v1.1)
- Application mobile (interface web responsive suffit)

## 7. Contraintes techniques
- Stack : Next.js (React, front + back dans un seul projet) + shadcn/ui, Drizzle (ORM), PostgreSQL en local via Docker.
- Tests automatisés obligatoires sur les règles de calcul de la section 3 (Vitest).
- Interface en français.
- Montants affichés en € avec séparateur de milliers (ex : 1 250 €).
