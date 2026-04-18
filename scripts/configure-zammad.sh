#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Zammad — Post-install SSO & integration config                 ║
# ║  Configures OIDC via Zammad REST API + creates API token.       ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${OFICINA_DIR}/.env"

ZAMMAD_URL="http://localhost:3200"

log() { echo -e "\033[0;32m[ZAMMAD]\033[0m $1"; }

# ──────────────────────────────────────────────
# Wait for Zammad
# ──────────────────────────────────────────────
log "Waiting for Zammad..."
for i in $(seq 1 90); do
    if curl -sf "${ZAMMAD_URL}/api/v1/monitoring/health_check" >/dev/null 2>&1; then
        break
    fi
    sleep 5
done

# ──────────────────────────────────────────────
# Get admin token (first user created is admin)
# ──────────────────────────────────────────────
log "Creating admin user..."
ADMIN_RESULT=$(curl -sf "${ZAMMAD_URL}/api/v1/users" \
    -H "Content-Type: application/json" \
    -d "{
        \"firstname\": \"Admin\",
        \"lastname\": \"Oficina\",
        \"email\": \"${ADMIN_EMAIL:-admin@oficina.local}\",
        \"password\": \"${ZAMMAD_ADMIN_PASSWORD:-$(openssl rand -base64 16)}\",
        \"roles\": [\"Admin\"],
        \"active\": true
    }" 2>/dev/null || echo "")

# Login to get token
log "Authenticating..."
TOKEN_RESULT=$(curl -sf "${ZAMMAD_URL}/api/v1/user_access_token" \
    -H "Content-Type: application/json" \
    -u "${ADMIN_EMAIL:-admin@oficina.local}:${ZAMMAD_ADMIN_PASSWORD:-admin}" \
    -d '{
        "label": "Oficina AI Agent",
        "permission": ["admin", "ticket.agent", "ticket.customer"]
    }' 2>/dev/null || echo "")

# ──────────────────────────────────────────────
# Configure OIDC (Third Party Authentication)
# ──────────────────────────────────────────────
log "Configuring Authentik SSO..."

AUTHENTIK_URL="https://auth.${DOMAIN:-oficina.local}"

# Zammad settings via API
for setting in \
    "auth_third_party::true" \
    "auth_openid_connect::true" \
    "auth_openid_connect_config::{
        \"name\": \"authentik\",
        \"display_name\": \"Oficina Digital\",
        \"icon\": \"key\",
        \"issuer\": \"${AUTHENTIK_URL}/application/o/zammad/\",
        \"client_id\": \"zammad-client\",
        \"client_secret\": \"${ZAMMAD_OIDC_SECRET:-change-me-zammad}\",
        \"end_session_endpoint\": \"${AUTHENTIK_URL}/application/o/zammad/end-session/\",
        \"scope\": \"openid email profile\"
    }"
do
    key="${setting%%::*}"
    value="${setting#*::}"
    curl -sf "${ZAMMAD_URL}/api/v1/settings/${key}" \
        -H "Content-Type: application/json" \
        -u "${ADMIN_EMAIL:-admin@oficina.local}:${ZAMMAD_ADMIN_PASSWORD:-admin}" \
        -X PUT \
        -d "{\"value\": ${value}}" >/dev/null 2>&1 || true
done

# ──────────────────────────────────────────────
# Configure email integration (Stalwart)
# ──────────────────────────────────────────────
log "Configuring email channel..."
curl -sf "${ZAMMAD_URL}/api/v1/channels_email" \
    -H "Content-Type: application/json" \
    -u "${ADMIN_EMAIL:-admin@oficina.local}:${ZAMMAD_ADMIN_PASSWORD:-admin}" \
    -d "{
        \"inbound\": {
            \"adapter\": \"imap\",
            \"options\": {
                \"host\": \"stalwart\",
                \"port\": 143,
                \"ssl\": false,
                \"user\": \"soporte@${DOMAIN:-oficina.local}\",
                \"password\": \"${STALWART_ADMIN_PASSWORD}\",
                \"folder\": \"INBOX\"
            }
        },
        \"outbound\": {
            \"adapter\": \"smtp\",
            \"options\": {
                \"host\": \"stalwart\",
                \"port\": 587,
                \"ssl\": false,
                \"user\": \"soporte@${DOMAIN:-oficina.local}\",
                \"password\": \"${STALWART_ADMIN_PASSWORD}\"
            }
        },
        \"group_id\": 1
    }" >/dev/null 2>&1 || log "Email channel may need manual config"

# ──────────────────────────────────────────────
# Set language and branding
# ──────────────────────────────────────────────
log "Setting language and branding..."
for setting in \
    "locale_default::\"es-pe\"" \
    "timezone_default::\"${TIMEZONE:-America/Lima}\"" \
    "product_name::\"${COMPANY_NAME:-Mi Empresa} - Soporte\""
do
    key="${setting%%::*}"
    value="${setting#*::}"
    curl -sf "${ZAMMAD_URL}/api/v1/settings/${key}" \
        -H "Content-Type: application/json" \
        -u "${ADMIN_EMAIL:-admin@oficina.local}:${ZAMMAD_ADMIN_PASSWORD:-admin}" \
        -X PUT \
        -d "{\"value\": ${value}}" >/dev/null 2>&1 || true
done

log "Zammad configuration complete!"
log "Access at: https://help.${DOMAIN:-oficina.local}"
