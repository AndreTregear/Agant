#!/usr/bin/env bash
# Oficina Digital — Stop all services

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${OFICINA_DIR}/.env"

profiles=""
IFS=',' read -ra PROF <<< "$ENABLED_PROFILES"
for p in "${PROF[@]}"; do
    profiles+=" --profile ${p}"
done

cd "$OFICINA_DIR"
exec docker compose $profiles down "$@"
