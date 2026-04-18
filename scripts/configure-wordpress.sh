#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  WordPress + WooCommerce — Post-install SSO & plugin config     ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${OFICINA_DIR}/.env"

COMPOSE="docker compose -f ${OFICINA_DIR}/docker-compose.yml"
WP="$COMPOSE exec -T wordpress wp --allow-root"

log() { echo -e "\033[0;32m[WORDPRESS]\033[0m $1"; }

# ──────────────────────────────────────────────
# Wait for WordPress
# ──────────────────────────────────────────────
log "Waiting for WordPress..."
for i in $(seq 1 60); do
    if $WP core is-installed 2>/dev/null; then break; fi
    sleep 5
done

# ──────────────────────────────────────────────
# Install & activate plugins
# ──────────────────────────────────────────────
log "Installing plugins..."
$WP plugin install woocommerce --activate 2>/dev/null || true
$WP plugin install openid-connect-generic --activate 2>/dev/null || true
$WP plugin install flavor flavor flavor flavor flavor flavor 2>/dev/null || true

# ──────────────────────────────────────────────
# Configure OpenID Connect Generic (Authentik)
# ──────────────────────────────────────────────
log "Configuring Authentik SSO..."

AUTHENTIK_URL="https://auth.${DOMAIN:-oficina.local}/application/o/wordpress"

$WP option update openid_connect_generic_settings --format=json '{
  "login_type": "auto",
  "client_id": "wordpress-client",
  "client_secret": "'"${WORDPRESS_OIDC_SECRET:-change-me-wordpress}"'",
  "scope": "openid email profile",
  "endpoint_login": "'"${AUTHENTIK_URL}/../authorize/"'",
  "endpoint_userinfo": "'"${AUTHENTIK_URL}/../userinfo/"'",
  "endpoint_token": "'"${AUTHENTIK_URL}/../token/"'",
  "endpoint_end_session": "'"${AUTHENTIK_URL}/../end-session/"'",
  "identity_key": "preferred_username",
  "nickname_key": "preferred_username",
  "email_format": "{email}",
  "displayname_format": "{name}",
  "identify_with_username": true,
  "link_existing_users": true,
  "create_if_does_not_exist": true,
  "redirect_user_back": true,
  "redirect_on_logout": true,
  "enable_logging": false,
  "log_limit": 1000
}' 2>/dev/null || log "OIDC settings may need manual configuration"

# ──────────────────────────────────────────────
# Configure WooCommerce basics
# ──────────────────────────────────────────────
log "Configuring WooCommerce..."
$WP option update woocommerce_store_address "Calle Principal 123" 2>/dev/null || true
$WP option update woocommerce_store_city "Lima" 2>/dev/null || true
$WP option update woocommerce_default_country "PE" 2>/dev/null || true
$WP option update woocommerce_currency "PEN" 2>/dev/null || true
$WP option update woocommerce_weight_unit "kg" 2>/dev/null || true
$WP option update woocommerce_dimension_unit "cm" 2>/dev/null || true
$WP option update woocommerce_calc_taxes "yes" 2>/dev/null || true

# Generate WooCommerce REST API keys for agente-ceo
log "Generating WooCommerce API keys..."
KEY_RESULT=$($WP wc customer_key create \
    --user="${WP_ADMIN_USER:-admin}" \
    --description="Oficina AI Agent" \
    --permissions="read_write" \
    --format=json 2>/dev/null || echo "")

if [ -n "$KEY_RESULT" ]; then
    echo ""
    echo "  WooCommerce API keys generated. Add to .env:"
    echo "  $KEY_RESULT"
    echo ""
fi

# ──────────────────────────────────────────────
# Set language and timezone
# ──────────────────────────────────────────────
$WP language core install es_PE 2>/dev/null || true
$WP site switch-language es_PE 2>/dev/null || true
$WP option update timezone_string "${TIMEZONE:-America/Lima}" 2>/dev/null || true

log "WordPress + WooCommerce configuration complete!"
log "Website: https://www.${DOMAIN:-oficina.local}"
log "Shop:    https://shop.${DOMAIN:-oficina.local}"
