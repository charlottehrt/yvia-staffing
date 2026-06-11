# Suivi de marge freelances

Application interne de pilotage de la marge des freelances en mission.
Cahier des charges complet : voir [SPEC.md](./SPEC.md).

## Prérequis (à installer une seule fois)

- [Node.js](https://nodejs.org) (déjà installé)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour la base de données locale)

## Lancer le projet

```bash
# 1. Démarrer la base de données PostgreSQL (dans Docker)
docker compose up -d

# 2. Installer les briques de code (à faire une seule fois)
npm install

# 3. Créer / mettre à jour les tables dans la base
npm run db:push

# 4. Démarrer l'application
npm run dev
```

Puis ouvrir le navigateur sur **http://localhost:3000**

Pour arrêter : `Ctrl + C` dans le terminal. Pour arrêter la base : `docker compose down`.

## Déployer sur Vercel + Neon

### 1. Créer la base Neon

Dans Neon, créer un projet PostgreSQL puis récupérer deux URLs de connexion :

- l'URL **pooled** pour l'application Vercel. Elle contient `-pooler` dans l'hôte
  et `sslmode=require` dans les paramètres ;
- l'URL **directe** pour les opérations d'administration Drizzle
  (`npm run db:push`, création du premier utilisateur).

### 2. Configurer les variables Vercel

Dans le projet Vercel, ajouter ces variables pour `Production` et, si besoin,
`Preview` :

```text
DATABASE_URL=<URL Neon pooled>
SESSION_SECRET=<secret aleatoire long>
```

Générer le secret de session :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Optionnel mais recommandé pour les commandes d'administration :

```text
DATABASE_URL_UNPOOLED=<URL Neon directe>
```

Vercel détecte automatiquement Next.js pour ce repo. Les commandes par défaut
suffisent : installation `npm install`, build `npm run build`.

### 3. Créer les tables dans Neon

Depuis votre machine, sans écrire le secret dans Git :

```bash
export DATABASE_URL_UNPOOLED="<URL Neon directe>"
npm run db:push
```

Si vous n'avez que l'URL poolée, utilisez `DATABASE_URL` à la place. L'URL
directe reste préférable pour les opérations de schéma.

### 4. Créer le premier compte

```bash
export DATABASE_URL_UNPOOLED="<URL Neon directe>"
npm run creer-utilisateur -- associe@example.com "mot-de-passe-solide" "Nom"
```

Ne lancez `npm run seed` ou `npm run seed:simulation` en production que si vous
voulez volontairement charger des données de démonstration.

### 5. Déployer

Depuis l'interface Vercel, connecter le dépôt GitHub et déployer la branche
principale. En CLI, après connexion à Vercel :

```bash
npx vercel --prod
```

Après le déploiement, ouvrir `/login` sur l'URL Vercel et se connecter avec le
compte créé à l'étape précédente.

## Structure

- `src/app/` : les pages (les écrans que l'utilisateur voit) et le code serveur (API).
- `src/db/` : la base de données (schéma des tables et connexion via Drizzle).
- `docker-compose.yml` : décrit la base PostgreSQL locale.
- `drizzle.config.ts` : configuration de l'outil qui crée les tables.

## Stack technique

- Next.js (React) : front + back dans un seul projet
- shadcn/ui : composants d'interface
- Drizzle : ORM (traducteur entre le code et la base)
- PostgreSQL via Docker : base de données locale
- Vitest : tests automatisés (calculs de marge)

## Utilisation avec Conductor

Le fichier `conductor.json` branche deux scripts (dans `scripts/`) :

- `scripts/worktree-up.sh` (script Conductor « setup ») : démarre la base, écrit
  `.env`, installe les dépendances et crée les tables. Lancé à la création du workspace.
- `scripts/worktree-down.sh` (script Conductor « archive ») : arrête la base.
  Option `--purge` pour aussi effacer les données.

Pour permettre **plusieurs workspaces en parallèle**, chaque workspace utilise des
ports distincts fournis par Conductor : l'application sur `CONDUCTOR_PORT`, la base
sur `CONDUCTOR_PORT + 1`. Hors Conductor, les ports par défaut sont 3000 (app) et
5432 (base). C'est pourquoi `runScriptMode` est `concurrent`.

Vous pouvez aussi lancer ces scripts à la main :

```bash
./scripts/worktree-up.sh     # tout démarrer
./scripts/worktree-down.sh   # tout arrêter (données conservées)
```

## Commandes utiles

- `npm run dev` : démarrer en développement
- `npm run db:push` : appliquer le schéma à la base
- `npm run db:studio` : explorer la base dans le navigateur
- `npm test` : lancer les tests
