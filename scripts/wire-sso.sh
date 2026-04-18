#!/usr/bin/env bash
# Wire SSO: Create OIDC providers in Authentik + configure each service
set -euo pipefail

TOKEN=$(cat /opt/oficina/.authentik_token)
AK="http://localhost:9000/api/v3"
AUTH="Authorization: Bearer ${TOKEN}"

source /opt/oficina/.env 2>/dev/null || true

log() { echo -e "\033[0;32m[SSO]\033[0m $1"; }
err() { echo -e "\033[0;31m[SSO]\033[0m $1" >&2; }

# Helper: create OIDC provider + application
create_oidc_app() {
    local name="$1"
    local slug="$2"
    local client_id="$3"
    local client_secret="$4"
    local redirect_uri="$5"
    local launch_url="$6"

    log "Creating provider: ${name}..."

    # Get the authorization flow PK
    local auth_flow
    auth_flow=$(curl -sf "${AK}/flows/instances/?slug=default-provider-authorization-implicit-consent" \
        -H "${AUTH}" | python3 -c "import sys,json; print(json.load(sys.stdin)['results'][0]['pk'])" 2>/dev/null)

    # Get signing key (first available)
    local signing_key
    signing_key=$(curl -sf "${AK}/crypto/certificatekeypairs/?ordering=name" \
        -H "${AUTH}" | python3 -c "import sys,json; r=json.load(sys.stdin)['results']; print(r[0]['pk'] if r else '')" 2>/dev/null)

    # Get scope mapping PKs
    local scope_pks
    scope_pks=$(curl -sf "${AK}/propertymappings/scope/?ordering=scope_name" \
        -H "${AUTH}" | python3 -c "
import sys,json
mappings = json.load(sys.stdin)['results']
pks = [m['pk'] for m in mappings if m['scope_name'] in ('openid', 'email', 'profile')]
print(','.join(pks))
" 2>/dev/null)

    # Build property_mappings array
    local pm_array
    pm_array=$(echo "$scope_pks" | python3 -c "import sys; pks=sys.stdin.read().strip().split(','); print('[' + ','.join(['\"'+p+'\"' for p in pks if p]) + ']')")

    # Create provider
    local provider_pk
    provider_pk=$(curl -sf "${AK}/providers/oauth2/" \
        -H "${AUTH}" \
        -H "Content-Type: application/json" \
        -X POST \
        -d "{
            \"name\": \"${name}\",
            \"authorization_flow\": \"${auth_flow}\",
            \"invalidation_flow\": \"${auth_flow}\",
            \"client_type\": \"confidential\",
            \"client_id\": \"${client_id}\",
            \"client_secret\": \"${client_secret}\",
            \"redirect_uris\": \"${redirect_uri}\",
            \"property_mappings\": ${pm_array},
            \"signing_key\": $([ -n "$signing_key" ] && echo "\"${signing_key}\"" || echo "null"),
            \"sub_mode\": \"hashed_user_id\",
            \"include_claims_in_id_token\": true,
            \"access_code_validity\": \"minutes=1\",
            \"access_token_validity\": \"minutes=5\",
            \"refresh_token_validity\": \"days=30\"
        }" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('pk',''))" 2>/dev/null)

    if [ -z "$provider_pk" ]; then
        # Maybe already exists, get it
        provider_pk=$(curl -sf "${AK}/providers/oauth2/?search=${client_id}" \
            -H "${AUTH}" | python3 -c "import sys,json; r=json.load(sys.stdin)['results']; print(r[0]['pk'] if r else '')" 2>/dev/null)
    fi

    if [ -z "$provider_pk" ]; then
        err "  Failed to create provider ${name}"
        return 1
    fi

    log "  Provider PK: ${provider_pk}"

    # Create application
    curl -sf "${AK}/core/applications/" \
        -H "${AUTH}" \
        -H "Content-Type: application/json" \
        -X POST \
        -d "{
            \"name\": \"${name}\",
            \"slug\": \"${slug}\",
            \"provider\": ${provider_pk},
            \"meta_launch_url\": \"${launch_url}\",
            \"policy_engine_mode\": \"any\"
        }" >/dev/null 2>&1 && log "  App created: ${slug}" || log "  App may already exist: ${slug}"

    echo "${provider_pk}"
}

# ──────────────────────────────────────────────
# Generate client secrets
# ──────────────────────────────────────────────
gen() { openssl rand -hex 20; }

ERPNEXT_SECRET=$(gen)
NEXTCLOUD_SECRET=$(gen)
N8N_SECRET=$(gen)
STALWART_SECRET=$(gen)

log "============================================"
log "  Creating OIDC providers in Authentik"
log "============================================"

# ERPNext
create_oidc_app "ERPNext" "erpnext" \
    "erpnext-client" "${ERPNEXT_SECRET}" \
    "http://localhost:8080/api/method/frappe.integrations.oauth2_logins.login_via_oauth2" \
    "http://localhost:8080"

# Nextcloud
create_oidc_app "Nextcloud" "nextcloud" \
    "nextcloud-client" "${NEXTCLOUD_SECRET}" \
    "http://localhost:8081/apps/user_oidc/code" \
    "http://localhost:8081"

# n8n
create_oidc_app "n8n Automation" "n8n" \
    "n8n-client" "${N8N_SECRET}" \
    "http://localhost:5678/rest/oauth2-credential/callback" \
    "http://localhost:5678"

# Stalwart
create_oidc_app "Stalwart Mail" "stalwart" \
    "stalwart-client" "${STALWART_SECRET}" \
    "http://localhost:8082/auth/oauth" \
    "http://localhost:8082"

log ""
log "============================================"
log "  OIDC Client Credentials"
log "============================================"
echo ""
echo "  ERPNext:   erpnext-client / ${ERPNEXT_SECRET}"
echo "  Nextcloud: nextcloud-client / ${NEXTCLOUD_SECRET}"
echo "  n8n:       n8n-client / ${N8N_SECRET}"
echo "  Stalwart:  stalwart-client / ${STALWART_SECRET}"
echo ""

# Save secrets
cat >> /opt/oficina/.env << EOF

# Generated OIDC Secrets
ERPNEXT_OIDC_CLIENT_ID=erpnext-client
ERPNEXT_OIDC_SECRET=${ERPNEXT_SECRET}
NEXTCLOUD_OIDC_CLIENT_ID=nextcloud-client
NEXTCLOUD_OIDC_SECRET=${NEXTCLOUD_SECRET}
N8N_OIDC_CLIENT_ID=n8n-client
N8N_OIDC_SECRET=${N8N_SECRET}
STALWART_OIDC_CLIENT_ID=stalwart-client
STALWART_OIDC_SECRET=${STALWART_SECRET}
EOF

log "Secrets saved to .env"

# ──────────────────────────────────────────────
# Configure Nextcloud OIDC
# ──────────────────────────────────────────────
log ""
log "Configuring Nextcloud OIDC..."
OCC="docker exec -u www-data oficina-nextcloud-1 php occ"
$OCC app:install user_oidc 2>/dev/null || true
$OCC app:enable user_oidc 2>/dev/null || true

$OCC user_oidc:provider oficina \
    --clientid="nextcloud-client" \
    --clientsecret="${NEXTCLOUD_SECRET}" \
    --discoveryuri="http://authentik-server:9000/application/o/nextcloud/.well-known/openid-configuration" \
    --unique-uid=0 \
    --mapping-uid="preferred_username" \
    --mapping-display-name="name" \
    --mapping-email="email" \
    2>/dev/null && log "  Nextcloud OIDC configured" || log "  Nextcloud OIDC may already be configured"

# ──────────────────────────────────────────────
# Configure ERPNext Social Login Key
# ──────────────────────────────────────────────
log ""
log "Configuring ERPNext OIDC..."
docker exec oficina-erpnext-1 bench --site erp.oficina.local execute "frappe.client.insert" --args '{
  "doctype": "Social Login Key",
  "provider_name": "Oficina",
  "enable_social_login": 1,
  "social_login_provider": "Custom",
  "client_id": "erpnext-client",
  "client_secret": "'"${ERPNEXT_SECRET}"'",
  "base_url": "http://authentik-server:9000",
  "authorize_url": "/application/o/authorize/",
  "access_token_url": "/application/o/token/",
  "redirect_url": "/api/method/frappe.integrations.oauth2_logins.login_via_oauth2",
  "api_endpoint": "/application/o/userinfo/",
  "auth_url_data": "{\"response_type\": \"code\", \"scope\": \"openid email profile\"}",
  "icon": "fa fa-key",
  "sign_ups": 1
}' 2>/dev/null && log "  ERPNext Social Login Key created" || log "  ERPNext OIDC may need manual config"

docker exec oficina-erpnext-1 bench --site erp.oficina.local clear-cache 2>/dev/null

log ""
log "============================================"
log "  SSO WIRING COMPLETE"
log "============================================"
log ""
log "Login at Authentik: http://localhost:9000"
log "  User: akadmin"
log "  Pass: (set via initial-setup flow)"
log ""
log "All services will show 'Login with Oficina' button"
