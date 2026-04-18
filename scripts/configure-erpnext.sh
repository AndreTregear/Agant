#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ERPNext — Post-install configuration                           ║
# ║  Creates site, installs apps, configures Authentik SSO.         ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${OFICINA_DIR}/.env"

SITE_NAME="erp.${DOMAIN:-oficina.local}"
COMPOSE="docker compose -f ${OFICINA_DIR}/docker-compose.yml"
BENCH="$COMPOSE exec -T erpnext-backend bench"

log() { echo -e "\033[0;32m[ERPNEXT]\033[0m $1"; }
err() { echo -e "\033[0;31m[ERPNEXT ERROR]\033[0m $1" >&2; }

# ──────────────────────────────────────────────
# Wait for backend to be ready
# ──────────────────────────────────────────────
log "Waiting for ERPNext backend..."
for i in $(seq 1 60); do
    if $COMPOSE exec -T erpnext-backend curl -sf http://localhost:8000 >/dev/null 2>&1; then
        break
    fi
    sleep 5
done

# ──────────────────────────────────────────────
# Create site
# ──────────────────────────────────────────────
log "Creating ERPNext site: ${SITE_NAME}..."
$BENCH new-site "${SITE_NAME}" \
    --db-host mariadb \
    --db-port 3306 \
    --db-root-password "${MARIADB_ROOT_PASSWORD}" \
    --admin-password "${ERPNEXT_ADMIN_PASSWORD:-admin}" \
    --no-mariadb-socket \
    --install-app erpnext || log "Site may already exist, continuing..."

# ──────────────────────────────────────────────
# Install Frappe HR (HRMS)
# ──────────────────────────────────────────────
log "Installing Frappe HR..."
$BENCH --site "${SITE_NAME}" install-app hrms || log "HRMS may already be installed"

# ──────────────────────────────────────────────
# Set as default site
# ──────────────────────────────────────────────
$BENCH use "${SITE_NAME}"

# ──────────────────────────────────────────────
# Configure Authentik OIDC (Social Login Key)
# ──────────────────────────────────────────────
log "Configuring Authentik SSO..."

# ERPNext uses "Social Login Key" doctype for OIDC
$BENCH --site "${SITE_NAME}" execute "frappe.client.insert" --args '{
  "doctype": "Social Login Key",
  "provider_name": "Authentik",
  "enable_social_login": 1,
  "social_login_provider": "Custom",
  "client_id": "erpnext-client",
  "client_secret": "'"${ERPNEXT_OIDC_SECRET:-change-me-erpnext}"'",
  "base_url": "https://auth.'"${DOMAIN:-oficina.local}"'",
  "authorize_url": "/application/o/authorize/",
  "access_token_url": "/application/o/token/",
  "redirect_url": "/api/method/frappe.integrations.oauth2_logins.login_via_oauth2",
  "api_endpoint": "/application/o/userinfo/",
  "api_endpoint_args": null,
  "auth_url_data": "{\"response_type\": \"code\", \"scope\": \"openid email profile\"}",
  "icon": "fa fa-key",
  "sign_ups": 1
}' 2>/dev/null || log "Social Login Key may already exist"

# ──────────────────────────────────────────────
# Set site config
# ──────────────────────────────────────────────
log "Setting site configuration..."
$BENCH --site "${SITE_NAME}" set-config host_name "https://${SITE_NAME}"
$BENCH --site "${SITE_NAME}" set-config serve_default_site true
$BENCH --site "${SITE_NAME}" set-config allow_cors "*"

# Set default language and timezone
$BENCH --site "${SITE_NAME}" execute "frappe.client.set_value" \
    --args '["System Settings", "System Settings", "language", "es"]' 2>/dev/null || true
$BENCH --site "${SITE_NAME}" execute "frappe.client.set_value" \
    --args '["System Settings", "System Settings", "time_zone", "'"${TIMEZONE:-America/Lima}"'"]' 2>/dev/null || true

# ──────────────────────────────────────────────
# Generate API key for agente-ceo integration
# ──────────────────────────────────────────────
log "Generating API key for AI agent..."
API_RESULT=$($BENCH --site "${SITE_NAME}" execute "frappe.core.doctype.user.user.generate_keys" \
    --args '["Administrator"]' 2>/dev/null || echo "")

if [ -n "$API_RESULT" ]; then
    log "API key generated. Update ERPNEXT_API_KEY and ERPNEXT_API_SECRET in .env"
    echo "$API_RESULT"
fi

# ──────────────────────────────────────────────
# Run migrations and clear cache
# ──────────────────────────────────────────────
log "Running migrations..."
$BENCH --site "${SITE_NAME}" migrate
$BENCH --site "${SITE_NAME}" clear-cache

log "ERPNext configuration complete!"
log "Access at: https://${SITE_NAME}"
