#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Nextcloud — Post-install configuration                         ║
# ║  Installs OIDC app, configures Authentik, enables Collabora.    ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${OFICINA_DIR}/.env"

COMPOSE="docker compose -f ${OFICINA_DIR}/docker-compose.yml"
OCC="$COMPOSE exec -T -u www-data nextcloud php occ"

log() { echo -e "\033[0;32m[NEXTCLOUD]\033[0m $1"; }

# ──────────────────────────────────────────────
# Wait for Nextcloud to be ready
# ──────────────────────────────────────────────
log "Waiting for Nextcloud..."
for i in $(seq 1 60); do
    if $OCC status --output=json 2>/dev/null | grep -q '"installed":true'; then
        break
    fi
    sleep 5
done

# ──────────────────────────────────────────────
# Install essential apps
# ──────────────────────────────────────────────
log "Installing apps..."
$OCC app:install user_oidc || log "user_oidc already installed"
$OCC app:install richdocuments || log "richdocuments already installed"
$OCC app:install calendar || log "calendar already installed"
$OCC app:install contacts || log "contacts already installed"
$OCC app:install mail || log "mail already installed"
$OCC app:install tasks || log "tasks already installed"
$OCC app:install deck || log "deck (kanban) already installed"
$OCC app:install groupfolders || log "groupfolders already installed"

# ──────────────────────────────────────────────
# Configure Authentik OIDC
# ──────────────────────────────────────────────
log "Configuring Authentik SSO..."

# Register the OIDC provider
$OCC user_oidc:provider authentik \
    --clientid="nextcloud-client" \
    --clientsecret="${NEXTCLOUD_OIDC_SECRET:-change-me-nextcloud}" \
    --discoveryuri="https://auth.${DOMAIN:-oficina.local}/application/o/nextcloud/.well-known/openid-configuration" \
    --unique-uid=0 \
    --check-bearer=1 \
    --send-id-token-hint=1 \
    --mapping-uid="preferred_username" \
    --mapping-display-name="name" \
    --mapping-email="email" \
    --mapping-groups="groups" \
    2>/dev/null || log "OIDC provider may already be configured"

# Allow OIDC login button on login page
$OCC config:app:set user_oidc allow_multiple_user_backends --value=0
$OCC config:app:set user_oidc type --value=oidc

# ──────────────────────────────────────────────
# Configure Collabora Online (LibreOffice in browser)
# ──────────────────────────────────────────────
log "Configuring Collabora Online..."
$OCC config:app:set richdocuments wopi_url --value="http://collabora:9980"
$OCC config:app:set richdocuments wopi_allowlist --value="0.0.0.0/0"
$OCC config:app:set richdocuments doc_format --value="ooxml"

# ──────────────────────────────────────────────
# Configure mail integration (Stalwart)
# ──────────────────────────────────────────────
log "Configuring mail integration..."
$OCC config:app:set mail imap_host --value="stalwart"
$OCC config:app:set mail imap_port --value="143"
$OCC config:app:set mail imap_ssl_mode --value="none"
$OCC config:app:set mail smtp_host --value="stalwart"
$OCC config:app:set mail smtp_port --value="587"
$OCC config:app:set mail smtp_ssl_mode --value="none"

# ──────────────────────────────────────────────
# Performance tuning
# ──────────────────────────────────────────────
log "Setting performance configs..."
$OCC config:system:set default_phone_region --value="PE"
$OCC config:system:set default_language --value="es_PE"
$OCC config:system:set default_locale --value="es_PE"
$OCC config:system:set skeletondirectory --value=""
$OCC config:system:set memcache.local --value="\OC\Memcache\APCu"
$OCC config:system:set memcache.distributed --value="\OC\Memcache\Redis"
$OCC config:system:set memcache.locking --value="\OC\Memcache\Redis"
$OCC config:system:set filelocking.enabled --value="true"

# Background jobs via cron
$OCC background:cron

# ──────────────────────────────────────────────
# Create default group folders for company
# ──────────────────────────────────────────────
log "Creating shared folders..."
$OCC groupfolders:create "Empresa" 2>/dev/null || log "Folder may already exist"
$OCC groupfolders:create "Compartido" 2>/dev/null || log "Folder may already exist"

log "Nextcloud configuration complete!"
log "Access at: https://files.${DOMAIN:-oficina.local}"
