# Fusion statistiques et prévisionnel

## Objectif

Remplacer les deux pages séparées `Statistiques` et `Prévisionnel` par une seule lecture de pilotage financier. L'utilisateur doit voir, sur une même page, ce qui est déjà réalisé et ce qui reste prévu, avec le mois courant visible des deux côtés.

## Comportement attendu

La page affiche une chronologie mensuelle en deux blocs successifs, sans onglets internes :

- `Réalisé` : mois passés et mois courant.
- `Prévisionnel` : mois courant et mois futurs.

Le mois courant apparaît donc deux fois, avec deux sens différents :

- côté réalisé, il contient uniquement ce qui est déjà encaissé ou décaissé ;
- côté prévisionnel, il contient ce qui reste prévu, ainsi que les jours freelance posés au planning.

Une séparation visuelle claire doit rendre la bascule lisible, par exemple avec une bande `Mois courant partagé` ou une séparation `Réalisé / Prévisionnel`.

## Règles métier

Le réalisé est piloté par les statuts existants :

- une recette `encaisse` compte dans le réalisé ;
- une recette `prevu` compte dans le prévisionnel ;
- un coût projet `decaisse` compte dans le réalisé ;
- un coût projet `prevu` compte dans le prévisionnel.

Les recettes peuvent déjà être saisies comme encaissées, ou marquées encaissées depuis le détail projet avec l'action existante `✓ payé`.

Les freelances en régie restent dans le prévisionnel. Les jours de planning ne basculent pas automatiquement dans le réalisé, même si leur date est passée, car il n'existe pas aujourd'hui de statut explicite de réalisation pour ces lignes.

## Interface

La sidebar conserve une seule entrée pour ce sujet, nommée `Pilotage`, pointant vers `/statistiques`. L'entrée `Prévisionnel` disparaît de la navigation. L'ancienne route `/previsionnel` doit rediriger vers `/statistiques` pour éviter un lien cassé.

La page conserve les filtres existants :

- fenêtre temporelle `30 j`, `90 j`, `180 j`, `365 j`, `Personnaliser` ;
- client ;
- freelance ;
- mission.

Pour une fenêtre prédéfinie de `N` jours, le bloc réalisé couvre les mois entre `aujourd'hui - N + 1` et le mois courant, et le bloc prévisionnel couvre les mois entre le mois courant et `aujourd'hui + N`. La valeur par défaut est `365 j` pour donner une lecture annuelle passée et future. Pour une plage personnalisée, le réalisé utilise la plage sélectionnée et le prévisionnel démarre au mois courant puis va jusqu'à la date de fin sélectionnée.

Le filtre s'applique aux deux blocs, avec les règles actuelles de rattachement :

- les encaissements de projet ne sont pas attribuables à un freelance ;
- les décaissements de projet sont attribuables à un freelance ;
- les projets forfaitaires sont exclus quand un filtre mission est actif.

## Tableaux

Les colonnes ne sont pas identiques, donc la page doit utiliser deux tableaux alignés dans un même bloc visuel plutôt qu'un seul tableau HTML.

Tableau `Réalisé` :

- Mois ;
- CA encaissé ;
- Coûts décaissés ;
- Marge réalisée ;
- Taux de marge.

Tableau `Prévisionnel` :

- Mois ;
- CA maximum ;
- CA probable ;
- Charges prévues ;
- Marge maximum ;
- Marge probable ;
- Cumul probable.

Les montants négatifs restent signalés visuellement comme aujourd'hui. Les mois sans données peuvent être omis, sauf si leur présence est nécessaire pour maintenir la continuité entre le mois courant et le dernier mois futur avec données.

## Données et calculs

Les calculs existants des deux pages servent de base :

- les agrégations réalisées viennent de la page `statistiques` ;
- les agrégations prévisionnelles viennent de la page `previsionnel` ;
- la pondération par fiabilité conserve la logique `fractionFiabilite`.

Le mois courant doit être inclus dans les deux requêtes. Pour éviter les doubles comptes, la séparation se fait par statut, pas seulement par date.

## Tests et vérification

Ajouter des tests de calcul si la logique d'agrégation est extraite dans un helper pur. Vérifier au minimum :

- un encaissement du mois courant en statut `encaisse` apparaît côté réalisé ;
- un encaissement du mois courant en statut `prevu` apparaît côté prévisionnel ;
- les jours freelance du mois courant apparaissent côté prévisionnel ;
- `/previsionnel` redirige vers la page fusionnée ;
- la sidebar ne présente plus deux entrées séparées.
