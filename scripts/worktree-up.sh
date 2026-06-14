#!/usr/bin/env bash
#
# worktree-up.sh : prépare l'environnement de CE workspace.
#   - dans Hecaton : utilise la base PostgreSQL isolée fournie au workspace
#   - hors Hecaton : démarre PostgreSQL (Docker) sur un port propre au workspace
#   - écrit l'adresse de la base dans .env
#   - installe les dépendances et applique le schéma (crée les tables)
#
# Utilisable seul (./scripts/worktree-up.sh) ou via Conductor (script "setup").

set -euo pipefail

# Se placer à la racine du projet, quel que soit l'endroit d'où on lance le script.
cd "$(dirname "$0")/.."

# --- Nom de projet Docker unique par workspace ---
# Évite que deux workspaces partagent le même conteneur/volume.
slugify_compose_name() {
  local raw="$1"
  local slug
  slug="$(printf '%s' "$raw" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9_-' | sed -E 's/^[^a-z0-9]+//; s/[^a-z0-9]+$//')"
  printf '%s\n' "${slug:-suivi-marge}"
}

worktree_hash() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$PWD" | shasum | awk '{ print substr($1, 1, 8) }'
  else
    printf '%s' "$PWD" | cksum | awk '{ print $1 }'
  fi
}

RAW_NAME="${CONDUCTOR_WORKSPACE_NAME:-$(basename "$PWD")}"
COMPOSE_PROJECT_NAME="$(slugify_compose_name "$RAW_NAME")-$(worktree_hash)"
export COMPOSE_PROJECT_NAME

# --- Ports ---
# Conductor réserve 10 ports par workspace, à partir de CONDUCTOR_PORT.
# On garde CONDUCTOR_PORT pour l'application et un des ports suivants pour la base.
# Hors Conductor (lancement manuel), on retombe sur les ports par défaut.
APP_PORT="${PORT:-${CONDUCTOR_PORT:-3000}}"

write_session_secret_if_needed() {
  if ! grep -q '^SESSION_SECRET=' .env 2>/dev/null; then
    SECRET="$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
    echo "SESSION_SECRET=\"${SECRET}\"" >> .env
    echo "→ .env : SESSION_SECRET généré"
  fi
}

if [ -n "${HECATON_DB:-}" ] && [ -n "${HECATON_DATABASE_URL:-}" ]; then
  HECATON_DB_URL="${HECATON_DATABASE_URL}"

  touch .env
  grep -v -E '^(DB_PORT|DATABASE_URL|DATABASE_URL_UNPOOLED)=' .env > .env.tmp 2>/dev/null || true
  echo "DATABASE_URL=\"${HECATON_DB_URL}\"" >> .env.tmp
  echo "DATABASE_URL_UNPOOLED=\"${HECATON_DB_URL}\"" >> .env.tmp
  mv .env.tmp .env
  echo "→ .env : DATABASE_URL pointe vers la base Hecaton ${HECATON_DB}"
  export DATABASE_URL="${HECATON_DB_URL}"
  export DATABASE_URL_UNPOOLED="${HECATON_DB_URL}"
  write_session_secret_if_needed

  echo "→ Installation des dépendances..."
  npm install --include=dev

  echo "→ Création de la base Hecaton si nécessaire..."
  node scripts/hecaton-db.mjs up

  echo "→ Création / mise à jour des tables..."
  npm run db:push

  echo "→ Chargement du jeu de données de preview..."
  npm run seed:simulation

  echo "✅ Environnement prêt. L'application tournera sur le port ${APP_PORT}."
  exit 0
fi

port_is_available_for_this_workspace() {
  local port="$1"
  local docker_names

  docker_names="$(docker ps --filter "publish=${port}" --format '{{.Names}}' 2>/dev/null || true)"
  if [ -n "$docker_names" ]; then
    while IFS= read -r container_name; do
      if [[ "$container_name" == "${COMPOSE_PROJECT_NAME}-"* ]]; then
        return 0
      fi
      if [[ "$container_name" == "${COMPOSE_PROJECT_NAME}_"* ]]; then
        return 0
      fi
    done <<< "$docker_names"
    return 1
  fi

  ! lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

select_db_port() {
  local first_port
  local last_port

  if [ -n "${CONDUCTOR_PORT:-}" ]; then
    first_port=$((CONDUCTOR_PORT + 1))
    last_port=$((CONDUCTOR_PORT + 9))
  else
    first_port="${DB_PORT:-5432}"
    last_port=$((first_port + 9))
  fi

  local candidate
  for candidate in $(seq "$first_port" "$last_port"); do
    if port_is_available_for_this_workspace "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
    echo "→ Port PostgreSQL ${candidate} déjà utilisé, essai du suivant..." >&2
  done

  echo "❌ Aucun port PostgreSQL libre entre ${first_port} et ${last_port}." >&2
  return 1
}

DB_PORT="$(select_db_port)"
export DB_PORT

# --- Écrit DATABASE_URL dans .env (en conservant les autres lignes éventuelles) ---
DB_URL="postgresql://postgres:postgres@localhost:${DB_PORT}/suivi_marge"
touch .env
grep -v -E '^(DB_PORT|DATABASE_URL|DATABASE_URL_UNPOOLED)=' .env > .env.tmp 2>/dev/null || true
echo "DB_PORT=\"${DB_PORT}\"" >> .env.tmp
echo "DATABASE_URL=\"${DB_URL}\"" >> .env.tmp
mv .env.tmp .env
echo "→ .env : DATABASE_URL pointe vers le port ${DB_PORT}"

# --- SESSION_SECRET : secret de signature des sessions (obligatoire) ---
# Chaque workspace a besoin de sa propre valeur, sinon l'application plante au
# démarrage de l'authentification. On la génère une seule fois puis on la
# conserve : la régénérer à chaque lancement invaliderait les sessions ouvertes.
write_session_secret_if_needed

# --- Démarrage de la base ---
echo "→ Démarrage de PostgreSQL (projet '${COMPOSE_PROJECT_NAME}', port ${DB_PORT})..."
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker est introuvable. Hors Hecaton, ce script a besoin de Docker pour lancer PostgreSQL." >&2
  echo "   Dans Hecaton, vérifiez que HECATON_DB et HECATON_DATABASE_URL sont injectées." >&2
  exit 127
fi
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
npm install --include=dev

echo "→ Création / mise à jour des tables..."
npm run db:push

# Compte admin de démonstration (admin@yvia.io / admin). Upsert idempotent :
# relancer le setup ne casse rien. Le seeder de simulation (seed:simulation)
# reste manuel, lui REMET À ZÉRO les données métier.
echo "→ Création du compte admin de démonstration..."
npm run seed

echo "✅ Environnement prêt. L'application tournera sur le port ${APP_PORT}."
