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
export DB_PORT="${DB_PORT:-5432}"
RAW_NAME="${CONDUCTOR_WORKSPACE_NAME:-suivi-marge}"
COMPOSE_PROJECT_NAME="$(printf '%s' "$RAW_NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9_-')"
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
