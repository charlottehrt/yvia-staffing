# Design - CRM simple sur les projets

## Contexte

L'application pilote deja les projets forfait, leurs echeances, leurs couts et le previsionnel. Le besoin CRM retenu est volontairement limite : ne pas creer une table d'opportunites, mais enrichir les projets existants avec une information commerciale simple.

## Objectif

Permettre de suivre les sujets commerciaux probables directement dans les projets avec :

- un statut commercial ;
- un montant envisage.

Les projets perdus ou termines doivent sortir des flux actifs pour ne pas polluer les autres pages, drawers et popups.

## Modele de donnees

La table `projets` reste l'unique table metier pour ce besoin.

Champs ajoutes :

- `statutCommercial` : statut du sujet commercial ;
- `montantEnvisage` : montant potentiel estime en euros HT, optionnel.

Statuts commerciaux possibles :

- `a_qualifier` : A qualifier ;
- `en_discussion` : En discussion ;
- `proposition_envoyee` : Proposition envoyee ;
- `gagne` : Gagne ;
- `perdu` : Perdu.

Le champ existant `actif` est conserve techniquement. Cote interface, son sens pour les projets devient :

- `actif=true` : projet en cours ou sujet commercial actif ;
- `actif=false` : projet termine.

## Regles fonctionnelles

Les projets affiches comme actifs sont ceux qui respectent les deux conditions :

- `actif=true` ;
- `statutCommercial != perdu`.

Les projets affiches dans la vue `Termines` sont :

- les projets avec `actif=false` ;
- les projets avec `statutCommercial=perdu`.

L'ancien libelle `Archives` devient `Termines` dans l'interface projet.

Les projets perdus ne doivent pas apparaitre dans les autres surfaces metier actives :

- fiches/drawers client ;
- planning ;
- previsionnel ;
- statistiques ;
- popups ou selecteurs qui proposent un projet actif ;
- toute vue de travail qui liste les projets encore a suivre.

Ils restent accessibles depuis `/projets` dans l'onglet `Termines`.

## Interface

La page `/projets` ajoute les colonnes :

- Statut ;
- Montant envisage.

Le formulaire de creation/modification de projet permet de renseigner :

- le statut commercial ;
- le montant envisage.

Valeurs par defaut a la creation :

- statut commercial : `a_qualifier` ;
- montant envisage : vide.

Pour les projets deja existants, la migration applique `gagne` par defaut afin qu'ils restent visibles et compatibles avec le fonctionnement actuel.

Le bouton d'action projet est renomme :

- `Terminer` au lieu de `Archiver` ;
- `Reouvrir` au lieu de `Reactiver` pour un projet termine.

## Previsionnel et calculs

Le `budget` reste le montant contractuel utilise pour les calculs existants.

Le `montantEnvisage` est une information commerciale. Il n'entre pas dans les calculs de marge, d'encaissement ou de previsionnel tant qu'aucune regle explicite ne le demande.

Un projet perdu est exclu des vues actives et donc des agregations de travail qui ne doivent porter que sur les projets suivis.

## Migration Neon

La migration doit etre compatible avec la production Neon.

Contraintes retenues :

- ne pas utiliser une nouvelle table ;
- ajouter uniquement des colonnes sur `projets` ;
- garantir que les lignes existantes gardent un statut explicite ;
- utiliser une migration Drizzle versionnee, pas seulement un `db:push` local ;
- appliquer en production avec `DATABASE_URL_UNPOOLED`, c'est-a-dire l'URL directe Neon, pas l'URL pooler.

Migration cible :

- ajouter `statut_commercial` sur `projets` ;
- renseigner les projets existants avec `gagne` ;
- configurer la valeur par defaut finale des nouveaux projets a `a_qualifier` ;
- ajouter `montant_envisage` nullable sur `projets`.

Deploiement recommande :

1. Generer et versionner la migration Drizzle.
2. Appliquer la migration sur Neon avec `DATABASE_URL_UNPOOLED`.
3. Deployer l'application.
4. Verifier que `/projets` affiche les projets existants dans la vue active.

## Tests

Tests attendus :

- verifier la classification active/terminee des projets selon `actif` et `statutCommercial` ;
- verifier que les projets existants avec statut `gagne` restent actifs ;
- verifier qu'un projet `perdu` est absent des listes actives et present dans `Termines`.

## Hors perimetre

- table `opportunites` ;
- contacts CRM ;
- historique d'activite commerciale ;
- pipeline kanban ;
- ponderation du previsionnel par `montantEnvisage`.
