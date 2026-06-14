# Seed de preview Hecaton

Le setup Hecaton charge automatiquement un jeu de données réaliste via :

```bash
npm run seed:simulation
```

Ce seed est volontairement destructif pour les données de preview : il remet à zéro
les tables métier et les invitations, puis recrée un scénario complet. Il conserve
les comptes existants hors comptes de démonstration, mais réinitialise les comptes
déclarés dans le seed.

Identifiants utiles :

- `admin@yvia.io` / `admin` : administrateur principal.
- `ops@yvia.io` / `preview` : utilisateur simple.
- `finance@yvia.io` / `preview` : administrateur secondaire.

## Données couvertes

Le seed doit contenir des lignes réalistes pour toutes les tables applicatives :

- `users` : comptes admin et utilisateur.
- `invitations` : invitation en attente, expirée et utilisée.
- `clients` : clients actifs et archivé, avec fiabilité par défaut.
- `freelances` : actifs, inactif, et au moins un freelance masqué du planning.
- `missions` : actives et inactives, avec TJM achat/vente variés.
- `affectations` : planning régie du mois courant vers plusieurs mois futurs.
- `projets` : projets actifs, terminés et perdus, avec tous les statuts commerciaux.
- `encaissements` : réalisé et prévu, avec fiabilités variées.
- `decaissements` : réalisé et prévu, rattachés à plusieurs freelances.
- `jalons` : événements projet sans impact financier.

## Fichiers à maintenir

- `scripts/seed-simulation-data.mjs` : données sources, dates relatives, scénarios.
- `scripts/seed-simulation.mjs` : insertion SQL et remise à zéro.
- `scripts/seed-simulation-data.test.mjs` : garanties de couverture.
- `docs/preview-seed.md` : cette documentation.

## Checklist quand une fonctionnalité ajoute une table ou un champ

1. Ajouter des données réalistes dans `seed-simulation-data.mjs`.
2. Insérer ces données dans `seed-simulation.mjs`.
3. Ajouter au moins une assertion de couverture dans `seed-simulation-data.test.mjs`.
4. Mettre à jour la liste “Données couvertes” ci-dessus.
5. Vérifier `npm test -- --run scripts/seed-simulation-data.test.mjs`.

Le but n'est pas de créer un dataset exhaustif de production, mais de rendre chaque
écran de preview immédiatement testable après un setup.
