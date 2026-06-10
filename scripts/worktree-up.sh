#!/usr/bin/env bash
#
# worktree-up.sh : prépare et démarre l'environnement de CE workspace.
#   - démarre la base PostgreSQL (Docker) sur un port propre au workspace
#   - écrit l'adresse de la base dans .env
#   - installe les dépendances et applique le schéma (crée les tables)
#
# Utilisable seul (./scripts/worktree-up.sh) ou via Conductor (script "setup").

set -euo pipefail

# Se placer à la racine du projet, quel que soit l'endroit d'où on lance le script.
cd "$(dirname "$0")/.."

# --- Ports ---
# Conductor réserve 10 ports par workspace, à partir de CONDUCTOR_PORT.
# On garde CONDUCTOR_PORT pour l'application et CONDUCTOR_PORT+1 pour la base.
# Hors Conductor (lancement manuel), on retombe sur les ports par défaut.
APP_PORT="${CONDUCTOR_PORT:-3000}"
if [ -n "${CONDUCTOR_PORT:-}" ]; then
  DB_PORT=$((CONDUCTOR_PORT + 1))
else
  DB_PORT=5432
fi
export DB_PORT

# --- Nom de projet Docker unique par workspace ---
# Évite que deux workspaces partagent le même conteneur/volume.
RAW_NAME="${CONDUCTOR_WORKSPACE_NAME:-suivi-marge}"
# On nettoie le nom (minuscules, caractères autorisés uniquement).
COMPOSE_PROJECT_NAME="$(printf '%s' "$RAW_NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9_-')"
export COMPOSE_PROJECT_NAME

# --- Écrit DATABASE_URL dans .env (en conservant les autres lignes éventuelles) ---
DB_URL="postgresql://postgres:postgres@localhost:${DB_PORT}/suivi_marge"
touch .env
grep -v '^DATABASE_URL=' .env > .env.tmp 2>/dev/null || true
echo "DATABASE_URL=\"${DB_URL}\"" >> .env.tmp
mv .env.tmp .env
echo "→ .env : DATABASE_URL pointe vers le port ${DB_PORT}"

# --- SESSION_SECRET : secret de signature des sessions (obligatoire) ---
# Chaque workspace a besoin de sa propre valeur, sinon l'application plante au
# démarrage de l'authentification. On la génère une seule fois puis on la
# conserve : la régénérer à chaque lancement invaliderait les sessions ouvertes.
if ! grep -q '^SESSION_SECRET=' .env 2>/dev/null; then
  SECRET="$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  echo "SESSION_SECRET=\"${SECRET}\"" >> .env
  echo "→ .env : SESSION_SECRET généré"
fi

# --- Démarrage de la base ---
echo "→ Démarrage de PostgreSQL (projet '${COMPOSE_PROJECT_NAME}', port ${DB_PORT})..."
docker compose up -d

# --- Attente que la base accepte les connexions ---
echo "→ Attente que la base soit prête..."
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    echo "  base prête."
    break
  fi
  sleep 1
done

# --- Dépendances + schéma ---
echo "→ Installation des dépendances..."
npm install

echo "→ Création / mise à jour des tables..."
npm run db:push

# Compte admin de démonstration (admin@yvia.io / admin). Upsert idempotent :
# relancer le setup ne casse rien. Le seeder de simulation (seed:simulation)
# reste manuel, lui REMET À ZÉRO les données métier.
echo "→ Création du compte admin de démonstration..."
npm run seed

echo "✅ Environnement prêt. L'application tournera sur le port ${APP_PORT}."
