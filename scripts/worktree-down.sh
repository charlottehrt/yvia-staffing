#!/usr/bin/env bash
#
# worktree-down.sh : arrête l'environnement de CE workspace.
#   - arrête et retire les conteneurs + le réseau Docker du workspace
#   - conserve les données (le volume) par défaut
#
# Option : --purge pour TOUT supprimer, y compris les données.
#
# Utilisable seul (./scripts/worktree-down.sh) ou via Conductor, qui archive
# avec --purge : le worktree disparaissant définitivement, garder le volume
# ne ferait qu'accumuler des données orphelines.

set -euo pipefail

cd "$(dirname "$0")/.."

# Mêmes valeurs que worktree-up.sh pour viser le bon projet Docker.
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

DB_PORT_FROM_ENV=""
if [ -f .env ]; then
  DB_PORT_FROM_ENV="$(grep -E '^DB_PORT=' .env 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d "'\"")"
fi
export DB_PORT="${DB_PORT:-${DB_PORT_FROM_ENV:-5432}}"
RAW_NAME="${CONDUCTOR_WORKSPACE_NAME:-$(basename "$PWD")}"
COMPOSE_PROJECT_NAME="$(slugify_compose_name "$RAW_NAME")-$(worktree_hash)"
export COMPOSE_PROJECT_NAME

if [ "${1:-}" = "--purge" ]; then
  echo "→ Arrêt et suppression complète (données incluses) du projet '${COMPOSE_PROJECT_NAME}'..."
  docker compose down -v
  echo "✅ Environnement arrêté et données supprimées."
else
  echo "→ Arrêt du projet '${COMPOSE_PROJECT_NAME}' (les données sont conservées)..."
  docker compose down
  echo "✅ Environnement arrêté. Données conservées (relancez avec scripts/worktree-up.sh)."
fi
