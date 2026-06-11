# Creation d'entites depuis les popups

## Contexte

Plusieurs popups contiennent un select vers une entite metier existante. Quand la valeur attendue n'existe pas, l'utilisateur doit aujourd'hui quitter son flux, creer l'entite ailleurs, puis revenir a son formulaire.

Le changement vise a garder l'utilisateur dans la popup en cours.

## Perimetre

Le bouton `Creer` est ajoute uniquement pour les selects ou choix portant sur une entite metier creable :

- client dans la popup de creation/modification de projet ;
- client et freelance dans la popup de creation/modification de mission ;
- freelance dans les formulaires d'ajout de cout projet, depuis le detail projet et depuis le planning ;
- mission dans la popup de selection planning quand aucune mission n'est disponible pour le freelance selectionne.

Les selects de statut, fiabilite, regroupement statistique ou autres listes fermees restent inchanges.

## Experience utilisateur

Chaque champ concerne affiche le select et un bouton `Creer` adjacent. Le bouton ouvre la popup de creation de l'entite manquante au-dessus de la popup courante. La popup courante reste montee, avec ses champs preserves.

Quand la creation reussit :

- la popup enfant se ferme ;
- la liste locale du select parent est enrichie avec la nouvelle entite ;
- la nouvelle entite est selectionnee automatiquement dans le champ parent quand ce champ existe ;
- un toast confirme l'enregistrement ;
- les pages concernees restent revalidees cote serveur pour conserver les donnees coherentes apres navigation ou refresh.

Si la creation echoue, la popup enfant reste ouverte et affiche le toast d'erreur existant.

## Architecture

Les actions serveur de creation renvoient l'entite creee en plus de `ok: true`, par exemple `{ ok: true, client }`, `{ ok: true, freelance }` ou `{ ok: true, mission }`. Les actions de modification peuvent garder leur contrat actuel si elles ne sont pas utilisees pour selectionner une nouvelle valeur.

Les formulaires de creation existants (`ClientFormDialog`, `FreelanceFormDialog`, `MissionFormDialog`) acceptent un callback optionnel `onCreated`. Quand il est fourni et que l'action renvoie une entite creee, le callback met a jour le parent avant la fermeture de la popup enfant.

Les popups parentes controlent les valeurs des selects concernes avec `value` et `onValueChange`, afin de pouvoir selectionner l'entite creee sans remonter tout le formulaire.

## Flux De Donnees

1. L'utilisateur clique sur `Creer` a cote d'un select.
2. La popup enfant appelle l'action serveur de creation existante.
3. L'action insere la ligne, revalide les routes utiles et renvoie l'entite creee.
4. Le formulaire enfant appelle `onCreated`.
5. Le parent ajoute l'option si elle n'existe pas deja et met la valeur du select sur le nouvel id.

Pour le planning, la creation d'une mission depuis la popup de selection ajoute la mission au groupe du freelance courant et peut l'affecter ensuite via le flux existant. Si la mission est creee depuis l'etat "aucune mission disponible", elle devient immediatement disponible dans la liste.

## Gestion Des Erreurs

Les validations serveur existantes restent la source de verite. Les erreurs continuent d'etre affichees via `toast.error`.

Le parent ignore les doublons locaux par id pour eviter deux options identiques si une revalidation arrive pendant que la popup reste ouverte.

## Tests

Ajouter des tests unitaires sur les petites fonctions de mise a jour locale des options :

- insertion d'une entite creee sans doublon ;
- selection automatique du nouvel id ;
- ajout d'une mission creee au bon freelance dans la structure planning.

Verifier ensuite avec `npm test` et `npm run lint`.
