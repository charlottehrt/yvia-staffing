# SPEC - Application de suivi de marge freelances

> Version validée le 2026-06-06. Document de référence du projet.

## 1. Contexte et objectif

Application interne de pilotage pour une société de conseil qui place des freelances en mission chez des clients. Objectif : savoir à tout moment combien coûte et rapporte chaque freelance, et estimer la marge prévisionnelle du mois en cours et du mois suivant.

Utilisateurs : 3 associés. Volume cible : 15 freelances, ~20 missions actives maximum.

## 2. Entités (modèle de données)

### Freelance
- prénom, nom
- email
- statut : actif / inactif
- notes (texte libre, optionnel)

### Client
- nom de la société
- contact (nom + email, optionnel)
- notes (optionnel)

### Mission
- freelance (référence)
- client (référence)
- date de début
- date de fin (optionnelle : vide = mission en cours sans terme défini)
- jours par semaine (défaut 5, décimales autorisées de 0,5 à 7 : temps partiels, demi-journées, travail le week-end)
- statut : calculé automatiquement (à venir / en cours / terminée) selon les dates, jamais saisi à la main
- tarifs : liste de périodes de tarification (voir ci-dessous). Une mission a toujours au moins une période.

#### Période de tarification (rattachée à une mission)
- mois d'effet (ex : juillet 2026) : le tarif s'applique à partir de ce mois, jusqu'au mois précédant la période suivante (ou jusqu'à la fin de la mission s'il n'y a pas de période suivante)
- TJM achat (ce que le freelance facture, en € HT)
- TJM vente (ce que je facture au client, en € HT)

Règles sur les tarifs :
- Le TJM peut évoluer en cours de mission. Un changement de tarif prend effet **au début d'un mois** (jamais en milieu de mois : pour du prévisionnel, ça n'a pas de sens et ça éviterait de découper les mois).
- L'historique est conservé : un mois passé garde le tarif qui s'appliquait à l'époque. Exemple : 600 € de TJM vente jusqu'à juin 2026, puis 650 € à partir de juillet 2026. Juin reste calculé à 600, juillet à 650.
- Le tarif applicable pour un mois M est celui de la période la plus récente dont le mois d'effet est ≤ M.

Règles sur les missions :
- Un freelance peut avoir plusieurs missions simultanées (temps partagé entre clients). Le champ « jours par semaine » de chaque mission définit la répartition (ex : 3 j/semaine chez le client A, 2 j/semaine chez le client B).
- Pas de plafond sur la somme des jours/semaine d'un freelance : le travail le week-end et les demi-journées sont possibles.

### Absence
- mission (référence) : l'absence est rattachée à une mission précise, pas au freelance globalement
- mois concerné (ex : juillet 2026)
- nombre de jours d'absence prévus ce mois-là (demi-journées autorisées : 0,5)
- motif (optionnel : congés, maladie, autre)

Note : une absence pendant un intercontrat ne se saisit pas (aucun impact sur la marge). Si un freelance multi-missions s'absente, l'absence est répartie manuellement entre ses missions à la saisie.

## 3. Règles de calcul (logique métier)

### Jours ouvrés
- Jours ouvrés = lundi à vendredi, hors jours fériés français (France métropolitaine).
- Les jours fériés sont calculés automatiquement par l'application (y compris pour les mois futurs), pas saisis à la main.

### Jours facturables d'une mission pour un mois M
```
jours_facturables = jours_ouvrés du mois M
                    ∩ période de la mission (entre date début et date fin)
                    × (jours_par_semaine / 5)
                    − jours d'absence rattachés à cette mission sur le mois M
```
- Le résultat ne peut pas être négatif (minimum 0).
- Si la mission commence ou se termine en cours de mois, seuls les jours ouvrés dans la période comptent (prorata réel, pas approximé).
- Les absences sont décomptées directement sur la mission à laquelle elles sont rattachées.
- Au-delà de 5 j/semaine, le calcul reste proportionnel (jours ouvrés × j_semaine/5) : les week-ends travaillés sont approximés, ce qui est acceptable pour du prévisionnel.

### Marge
- Pour un mois M, on utilise le tarif (TJM achat / TJM vente) de la période en vigueur ce mois-là.
- Marge par jour = TJM vente − TJM achat
- Pour un mois M et une mission :
  - CA prévisionnel = jours_facturables × TJM vente
  - Coût prévisionnel = jours_facturables × TJM achat
  - Marge prévisionnelle = jours_facturables × (TJM vente − TJM achat)
- Taux de marge = marge / CA (en %)
- Totaux agrégés par freelance, par client et pour toute la société.

## 4. Écrans

### Écran 1 : Dashboard (page d'accueil)
- Sélecteur de mois (défaut : mois courant, navigation mois précédent/suivant).
- 4 indicateurs en haut : CA prévisionnel, coût total, marge totale, taux de marge du mois sélectionné.
- Carte de synthèse « Mois suivant » toujours visible à côté des indicateurs : CA et marge prévisionnels du mois M+1, cliquable pour basculer le dashboard sur ce mois.
- Tableau par freelance : nom, client actuel, TJM achat, TJM vente, marge/jour, jours facturables du mois, marge du mois. Un freelance en multi-mission apparaît sur une ligne par mission. Les TJM affichés sont ceux en vigueur le mois sélectionné.
- Ligne de total en bas du tableau.

### Écran 2 : Missions
- Liste de toutes les missions (filtre : en cours / à venir / terminées).
- Colonnes : freelance, client, TJM achat, TJM vente (tarif courant), marge/jour, dates, statut.
- Création, modification, suppression d'une mission (formulaire).
- Gestion des tarifs : à la création, une première période de tarification est saisie. Ensuite, un bouton « changer le tarif à partir de tel mois » ajoute une nouvelle période sans écraser les anciennes. L'historique des tarifs est consultable.

### Écran 3 : Freelances
- Liste des freelances avec leur mission en cours (ou « intercontrat » si aucune).
- Fiche freelance : infos + historique de ses missions + saisie de ses absences par mois.
- Création, modification, désactivation d'un freelance.

### Écran 4 : Clients
- Liste des clients avec le nombre de missions actives chez chacun.
- Création, modification, suppression.

## 5. Authentification
- Connexion par email + mot de passe (mots de passe stockés de façon sécurisée, hachés).
- 3 comptes créés manuellement (un par associé, pas d'inscription publique).
- Pas de gestion de rôles : les trois utilisateurs voient et font la même chose.

## 6. Hors périmètre v1 (explicitement exclus)
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
