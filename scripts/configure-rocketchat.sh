#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Rocket.Chat — Post-install SSO configuration                   ║
# ║  Configures Custom OAuth with Authentik via REST API.           ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${OFICINA_DIR}/.env"

RC_URL="http://localhost:3100"

log() { echo -e "\033[0;32m[ROCKETCHAT]\033[0m $1"; }
err() { echo -e "\033[0;31m[ROCKETCHAT ERROR]\033[0m $1" >&2; }

# ──────────────────────────────────────────────
# Wait for Rocket.Chat to be ready
# ──────────────────────────────────────────────
log "Waiting for Rocket.Chat..."
for i in $(seq 1 90); do
    if curl -sf "${RC_URL}/api/v1/info" >/dev/null 2>&1; then
        break
    fi
    sleep 5
done

# ──────────────────────────────────────────────
# Login as admin to get auth token
# ──────────────────────────────────────────────
log "Authenticating as admin..."

# First boot — admin account may need setup via environment
# Rocket.Chat respects ADMIN_USERNAME, ADMIN_PASS, ADMIN_EMAIL env vars
LOGIN_RESULT=$(curl -sf "${RC_URL}/api/v1/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"user\": \"${ROCKETCHAT_ADMIN_USER:-admin}\",
        \"password\": \"${ROCKETCHAT_ADMIN_PASSWORD:-admin}\"
    }" 2>/dev/null || echo "")

if [ -z "$LOGIN_RESULT" ]; then
    err "Failed to login. Rocket.Chat may need initial setup via web UI."
    exit 1
fi

AUTH_TOKEN=$(echo "$LOGIN_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['authToken'])" 2>/dev/null || echo "")
USER_ID=$(echo "$LOGIN_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['userId'])" 2>/dev/null || echo "")

if [ -z "$AUTH_TOKEN" ] || [ -z "$USER_ID" ]; then
    err "Failed to extract auth token. Check admin credentials."
    exit 1
fi

# Helper to set a Rocket.Chat setting
rc_set() {
    local key="$1"
    local value="$2"
    curl -sf "${RC_URL}/api/v1/settings/${key}" \
        -H "X-Auth-Token: ${AUTH_TOKEN}" \
        -H "X-User-Id: ${USER_ID}" \
        -H "Content-Type: application/json" \
        -d "{\"value\": ${value}}" >/dev/null 2>&1
}

# ──────────────────────────────────────────────
# Configure Custom OAuth (Authentik)
# ──────────────────────────────────────────────
log "Configuring Authentik SSO..."

AUTHENTIK_URL="https://auth.${DOMAIN:-oficina.local}"

# Enable Custom OAuth
rc_set "Accounts_OAuth_Custom-Authentik" "true"
rc_set "Accounts_OAuth_Custom-Authentik-url" "\"${AUTHENTIK_URL}/application/o/authorize/\""
rc_set "Accounts_OAuth_Custom-Authentik-token_path" "\"${AUTHENTIK_URL}/application/o/token/\""
rc_set "Accounts_OAuth_Custom-Authentik-identity_path" "\"${AUTHENTIK_URL}/application/o/userinfo/\""
rc_set "Accounts_OAuth_Custom-Authentik-id" "\"rocketchat-client\""
rc_set "Accounts_OAuth_Custom-Authentik-secret" "\"${ROCKETCHAT_OIDC_SECRET:-change-me-rocketchat}\""
rc_set "Accounts_OAuth_Custom-Authentik-login_style" "\"redirect\""
rc_set "Accounts_OAuth_Custom-Authentik-token_sent_via" "\"header\""
rc_set "Accounts_OAuth_Custom-Authentik-identity_token_sent_via" "\"header\""
rc_set "Accounts_OAuth_Custom-Authentik-scope" "\"openid email profile\""
rc_set "Accounts_OAuth_Custom-Authentik-username_field" "\"preferred_username\""
rc_set "Accounts_OAuth_Custom-Authentik-email_field" "\"email\""
rc_set "Accounts_OAuth_Custom-Authentik-name_field" "\"name\""
rc_set "Accounts_OAuth_Custom-Authentik-roles_claim" "\"groups\""
rc_set "Accounts_OAuth_Custom-Authentik-merge_users" "true"
rc_set "Accounts_OAuth_Custom-Authentik-button_label_text" "\"Iniciar sesión con Oficina\""
rc_set "Accounts_OAuth_Custom-Authentik-button_label_color" "\"#ffffff\""
rc_set "Accounts_OAuth_Custom-Authentik-button_color" "\"#1a1a2e\""

# ──────────────────────────────────────────────
# General settings
# ──────────────────────────────────────────────
log "Setting general configuration..."

rc_set "Site_Name" "\"${COMPANY_NAME:-Mi Empresa} - Chat\""
rc_set "Site_Url" "\"https://chat.${DOMAIN:-oficina.local}\""
rc_set "Language" "\"es\""
rc_set "Show_Setup_Wizard" "\"completed\""

# Disable cloud features for air-gapped
rc_set "Cloud_Workspace_Registration_State" "\"disabled\""
rc_set "Statistics_reporting" "false"
rc_set "Apps_Framework_enabled" "false"

# Create default channels
log "Creating default channels..."
for channel in general anuncios soporte ventas; do
    curl -sf "${RC_URL}/api/v1/channels.create" \
        -H "X-Auth-Token: ${AUTH_TOKEN}" \
        -H "X-User-Id: ${USER_ID}" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"${channel}\"}" >/dev/null 2>&1 || true
done

# ──────────────────────────────────────────────
# Save auth token for agente-ceo integration
# ──────────────────────────────────────────────
log "Saving API credentials for AI agent..."
echo ""
echo "  Add to .env:"
echo "  ROCKETCHAT_AUTH_TOKEN=${AUTH_TOKEN}"
echo "  ROCKETCHAT_USER_ID=${USER_ID}"
echo ""

log "Rocket.Chat configuration complete!"
log "Access at: https://chat.${DOMAIN:-oficina.local}"
