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

## Commandes utiles

- `npm run dev` : démarrer en développement
- `npm run db:push` : appliquer le schéma à la base
- `npm run db:studio` : explorer la base dans le navigateur
- `npm test` : lancer les tests
