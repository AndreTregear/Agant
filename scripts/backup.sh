#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Oficina Digital — Backup Script                                ║
# ║  Dumps all databases and critical data volumes.                 ║
# ║  Run via cron: 0 */4 * * * /opt/oficina/scripts/backup.sh      ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${OFICINA_DIR}/.env"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${OFICINA_DIR}/data/backups/snapshots/${TIMESTAMP}"
DAILY_DIR="${OFICINA_DIR}/data/backups/daily"
RETENTION_DAYS_SNAPSHOTS=7
RETENTION_DAYS_DAILY=30

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log()  { echo -e "${GREEN}[BACKUP ${TIMESTAMP}]${NC} $1"; }
err()  { echo -e "${RED}[BACKUP ERROR]${NC} $1" >&2; }

mkdir -p "$BACKUP_DIR" "$DAILY_DIR"

# ──────────────────────────────────────────────
# PostgreSQL databases
# ──────────────────────────────────────────────
backup_postgres() {
    log "Dumping PostgreSQL databases..."
    for db in authentik nextcloud superset n8n zammad agente_ceo; do
        docker compose -f "${OFICINA_DIR}/docker-compose.yml" \
            exec -T postgres pg_dump -U "${POSTGRES_USER}" "$db" \
            | gzip > "${BACKUP_DIR}/pg_${db}.sql.gz" 2>/dev/null && \
            log "  ✓ PostgreSQL: $db" || \
            err "  ✗ PostgreSQL: $db"
    done
}

# ──────────────────────────────────────────────
# MariaDB databases
# ──────────────────────────────────────────────
backup_mariadb() {
    log "Dumping MariaDB databases..."
    docker compose -f "${OFICINA_DIR}/docker-compose.yml" \
        exec -T mariadb mariadb-dump -u root -p"${MARIADB_ROOT_PASSWORD}" \
        --all-databases --single-transaction \
        | gzip > "${BACKUP_DIR}/mariadb_all.sql.gz" 2>/dev/null && \
        log "  ✓ MariaDB: all databases" || \
        err "  ✗ MariaDB dump failed"
}

# ──────────────────────────────────────────────
# MongoDB (Rocket.Chat)
# ──────────────────────────────────────────────
backup_mongodb() {
    log "Dumping MongoDB..."
    docker compose -f "${OFICINA_DIR}/docker-compose.yml" \
        exec -T mongodb mongodump \
        -u "${MONGO_USER}" -p "${MONGO_PASSWORD}" \
        --authenticationDatabase admin \
        --archive --gzip \
        > "${BACKUP_DIR}/mongodb_all.archive.gz" 2>/dev/null && \
        log "  ✓ MongoDB: all databases" || \
        err "  ✗ MongoDB dump failed"
}

# ──────────────────────────────────────────────
# Create checksum file
# ──────────────────────────────────────────────
create_checksums() {
    log "Creating checksums..."
    cd "$BACKUP_DIR"
    sha256sum *.gz *.archive.gz 2>/dev/null > checksums.sha256 || true
    cd - > /dev/null
}

# ──────────────────────────────────────────────
# Create daily tarball (only if run at midnight)
# ──────────────────────────────────────────────
maybe_daily_backup() {
    local hour
    hour=$(date +%H)
    if [ "$hour" = "02" ] || [ "${FORCE_DAILY:-}" = "1" ]; then
        log "Creating daily backup tarball..."
        tar czf "${DAILY_DIR}/oficina_daily_${TIMESTAMP}.tar.gz" \
            -C "${OFICINA_DIR}/data/backups/snapshots" "${TIMESTAMP}" && \
            log "  ✓ Daily tarball created" || \
            err "  ✗ Daily tarball failed"
    fi
}

# ──────────────────────────────────────────────
# Clean old backups
# ──────────────────────────────────────────────
cleanup_old() {
    log "Cleaning old backups..."
    # Snapshots: keep last N days
    find "${OFICINA_DIR}/data/backups/snapshots" -maxdepth 1 -type d \
        -mtime "+${RETENTION_DAYS_SNAPSHOTS}" -exec rm -rf {} + 2>/dev/null || true
    # Daily: keep last N days
    find "${DAILY_DIR}" -maxdepth 1 -name "*.tar.gz" \
        -mtime "+${RETENTION_DAYS_DAILY}" -delete 2>/dev/null || true
    log "Cleanup complete"
}

# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
main() {
    log "Starting backup..."
    backup_postgres
    backup_mariadb
    backup_mongodb
    create_checksums
    maybe_daily_backup
    cleanup_old
    log "Backup complete: ${BACKUP_DIR}"

    # Calculate total size
    local size
    size=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "Backup size: ${size}"
}

main "$@"
