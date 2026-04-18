#!/usr/bin/env bash
# Oficina Digital — Start services using profiles from .env

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${OFICINA_DIR}/.env"

profiles=""
IFS=',' read -ra PROF <<< "$ENABLED_PROFILES"
for p in "${PROF[@]}"; do
    profiles+=" --profile ${p}"
done

cd "$OFICINA_DIR"
exec docker compose $profiles up -d "$@"
