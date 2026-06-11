# Design - Option « Afficher dans le planning » par freelance

## Contexte

Le dashboard (`/`) affiche le planning mensuel avec une ligne par freelance actif.
Certains freelances actifs (missions ponctuelles, forfait uniquement…) encombrent
la grille alors qu'on ne les planifie pas au jour le jour.

## Objectif

Permettre de masquer un freelance du planning du dashboard sans l'archiver :
une option « Afficher dans le planning » à côté de chaque freelance.

## Modèle de données

Colonne ajoutée sur `freelances` :

- `afficher_planning` (`afficherPlanning`) : booléen, non nul, défaut `true`.

C'est une préférence d'affichage, pas un statut métier : elle ne touche ni les
missions, ni les affectations, ni les montants.

## Règles fonctionnelles

- Le planning du dashboard n'affiche une ligne que pour les freelances
  `actif = true` ET `afficherPlanning = true`.
- Tout le reste est inchangé pour un freelance masqué :
  - ses affectations existantes comptent toujours dans les indicateurs du mois
    et le « Détail du mois » (les chiffres restent complets) ;
  - il reste proposé dans les sélecteurs (création de mission, décaissement) ;
  - « Étendre au mois suivant » continue de copier ses affectations (opération
    sur les données, indépendante de l'affichage).
- Les freelances archivés restent exclus du planning comme aujourd'hui ;
  l'option n'est pas proposée dans la vue Archives.

## Interface

Page `/freelances`, vue Actifs : nouvelle colonne « Planning » avec un
interrupteur (switch) par ligne. Le clic sur l'interrupteur ne doit pas ouvrir
le drawer du freelance (la ligne reste cliquable par ailleurs).

Nouveau composant UI `switch.tsx` basé sur Base UI (`@base-ui/react/switch`),
stylé comme le reste de l'app.

## Server Action

`basculerAfficherPlanning(formData)` dans `src/app/freelances/actions.ts` :
garde de session d'abord (comme toutes les mutations), puis écrit la valeur
cible (`afficher` = `"true"`/`"false"`) et revalide `/freelances` et `/`.

## Migration

Migration Drizzle versionnée `0001` (appliquée en production par le workflow
`migrate-production-db.yml`) :

- `ALTER TABLE "freelances" ADD COLUMN IF NOT EXISTS "afficher_planning" boolean DEFAULT true NOT NULL;`

Défaut `true` : tous les freelances existants restent affichés, aucun changement
visible au déploiement.

## Tests

- `server-actions-auth.test.ts` : `basculerAfficherPlanning` rejette sans session
  et ne touche pas la base.
- `freelance-row.test.tsx` : la ligne ouvre le drawer au clic ; l'interrupteur
  est rendu avec l'état attendu en vue Actifs et absent en vue Archives ; la
  cellule de l'interrupteur stoppe la propagation du clic.

## Hors périmètre

- Réglage de la visibilité depuis le drawer du freelance ou la grille du planning.
- Filtrage du « Détail du mois », des indicateurs ou du prévisionnel.
- Préférence par utilisateur (le réglage est global, comme le reste des données).
