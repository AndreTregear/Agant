#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Oficina Digital — Post-Install Configuration                   ║
# ║  Run AFTER all Docker services are healthy.                     ║
# ║  Configures SSO, creates sites, imports workflows.              ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${OFICINA_DIR}/.env"

SCRIPTS="${OFICINA_DIR}/scripts"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[POST-INSTALL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1" >&2; }
step() { echo -e "\n${BLUE}════════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}════════════════════════════════════════${NC}\n"; }

# ──────────────────────────────────────────────
# Check that services are healthy
# ──────────────────────────────────────────────
wait_for_service() {
    local name="$1"
    local url="$2"
    local max_wait="${3:-120}"

    log "Waiting for ${name}..."
    for i in $(seq 1 $((max_wait / 5))); do
        if curl -sf "$url" >/dev/null 2>&1; then
            log "  ✓ ${name} is ready"
            return 0
        fi
        sleep 5
    done
    err "  ✗ ${name} did not become ready within ${max_wait}s"
    return 1
}

# ──────────────────────────────────────────────
# Generate OIDC secrets for all services
# ──────────────────────────────────────────────
generate_oidc_secrets() {
    step "Generating OIDC secrets"

    local env_file="${OFICINA_DIR}/.env"
    local secrets=(
        "ERPNEXT_OIDC_SECRET"
        "NEXTCLOUD_OIDC_SECRET"
        "ROCKETCHAT_OIDC_SECRET"
        "STALWART_OIDC_SECRET"
        "WORDPRESS_OIDC_SECRET"
        "SUPERSET_OIDC_SECRET"
        "ZAMMAD_OIDC_SECRET"
        "N8N_OIDC_SECRET"
        "PORTAINER_OIDC_SECRET"
    )

    for secret_name in "${secrets[@]}"; do
        local existing
        existing=$(grep "^${secret_name}=" "$env_file" 2>/dev/null | head -1 | cut -d= -f2-)
        # Treat empty values and CHANGE_ME_* placeholders as unset.
        if [ -z "$existing" ] || [[ "$existing" == CHANGE_ME_* ]]; then
            # 48 base64 chars after stripping /+= ≈ 288 bits of entropy.
            local secret_value
            secret_value=$(openssl rand -base64 64 | tr -d '/+=' | head -c 48)
            if grep -q "^${secret_name}=" "$env_file" 2>/dev/null; then
                sed -i "s|^${secret_name}=.*|${secret_name}=${secret_value}|" "$env_file"
            else
                echo "${secret_name}=${secret_value}" >> "$env_file"
            fi
            log "  Generated ${secret_name}"
        else
            log "  ${secret_name} already exists"
        fi
    done

    # Reload env
    source "$env_file"
}

# Stalwart now reads its OIDC client-id/secret, hostname, and issuer URL
# directly from env vars (see compose/mail.yml + config/stalwart/stalwart.toml).
# No in-place sed required.

# ──────────────────────────────────────────────
# Import n8n workflows
# ──────────────────────────────────────────────
import_n8n_workflows() {
    step "Importing n8n Workflows"

    local n8n_url="http://localhost:5678"
    wait_for_service "n8n" "${n8n_url}/healthz" 120 || return 1

    local workflow_dir="${OFICINA_DIR}/config/n8n/workflows"
    for workflow_file in "${workflow_dir}"/*.json; do
        local name
        name=$(basename "$workflow_file" .json)
        log "  Importing workflow: ${name}"
        curl -sf "${n8n_url}/api/v1/workflows" \
            -H "Content-Type: application/json" \
            -H "X-N8N-API-KEY: ${N8N_API_KEY:-}" \
            -d @"$workflow_file" >/dev/null 2>&1 && \
            log "    ✓ ${name}" || \
            warn "    ⚠ ${name} (may need manual import)"
    done
}

# ──────────────────────────────────────────────
# Add Oficina databases as Superset data sources
# ──────────────────────────────────────────────
configure_superset_databases() {
    step "Configuring Superset Data Sources"

    local superset_url="http://localhost:8088"
    wait_for_service "Superset" "${superset_url}/health" 180 || return 1

    # Login to get CSRF token and session
    local login_resp
    login_resp=$(curl -sf -c /tmp/superset_cookies "${superset_url}/api/v1/security/login" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"${SUPERSET_ADMIN_USER:-admin}\",
            \"password\": \"${SUPERSET_ADMIN_PASSWORD}\",
            \"provider\": \"db\"
        }" 2>/dev/null || echo "")

    local access_token
    access_token=$(echo "$login_resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")

    if [ -z "$access_token" ]; then
        warn "Could not authenticate with Superset. Configure data sources manually."
        return 1
    fi

    # Connect Superset to MariaDB through the SELECT-only superset_read
    # user provisioned by init-users.sh. Root credentials never leave the
    # DB container.
    if [ -z "${SUPERSET_READ_PASSWORD:-}" ]; then
        warn "SUPERSET_READ_PASSWORD not set; skipping MariaDB data sources"
    else
        log "  Adding ERPNext (MariaDB) data source..."
        curl -sf "${superset_url}/api/v1/database/" \
            -H "Authorization: Bearer ${access_token}" \
            -H "Content-Type: application/json" \
            -d "{
                \"database_name\": \"ERPNext\",
                \"sqlalchemy_uri\": \"mysql://superset_read:${SUPERSET_READ_PASSWORD}@mariadb:3306/erpnext\",
                \"expose_in_sqllab\": true,
                \"allow_run_async\": true
            }" >/dev/null 2>&1 && log "    ✓ ERPNext" || warn "    ⚠ ERPNext"

        log "  Adding WooCommerce (MariaDB) data source..."
        curl -sf "${superset_url}/api/v1/database/" \
            -H "Authorization: Bearer ${access_token}" \
            -H "Content-Type: application/json" \
            -d "{
                \"database_name\": \"WooCommerce\",
                \"sqlalchemy_uri\": \"mysql://superset_read:${SUPERSET_READ_PASSWORD}@mariadb:3306/wordpress\",
                \"expose_in_sqllab\": true,
                \"allow_run_async\": true
            }" >/dev/null 2>&1 && log "    ✓ WooCommerce" || warn "    ⚠ WooCommerce"
    fi

    # Add agente-ceo PostgreSQL
    log "  Adding agente-ceo (PostgreSQL) data source..."
    curl -sf "${superset_url}/api/v1/database/" \
        -H "Authorization: Bearer ${access_token}" \
        -H "Content-Type: application/json" \
        -d "{
            \"database_name\": \"Agente CEO\",
            \"sqlalchemy_uri\": \"postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/agente_ceo\",
            \"expose_in_sqllab\": true,
            \"allow_run_async\": true
        }" >/dev/null 2>&1 && log "    ✓ Agente CEO" || warn "    ⚠ Agente CEO"
}

# ──────────────────────────────────────────────
# Main orchestration
# ──────────────────────────────────────────────
main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║       Oficina Digital — Post-Install Configuration          ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    # Step 0: Generate OIDC secrets
    generate_oidc_secrets

    # Step 1: Wait for foundation services
    step "Checking Foundation Services"
    wait_for_service "PostgreSQL" "http://localhost:5432" 60 || true  # TCP, not HTTP
    wait_for_service "Authentik" "http://localhost:9000/-/health/ready/" 120

    # Step 2: Configure core business apps
    IFS=',' read -ra PROF <<< "${ENABLED_PROFILES}"

    if [[ " ${PROF[*]} " =~ " erp " ]]; then
        step "Configuring ERPNext"
        bash "${SCRIPTS}/configure-erpnext.sh" || err "ERPNext configuration had errors"
    fi

    if [[ " ${PROF[*]} " =~ " nextcloud " ]]; then
        step "Configuring Nextcloud"
        bash "${SCRIPTS}/configure-nextcloud.sh" || err "Nextcloud configuration had errors"
    fi

    if [[ " ${PROF[*]} " =~ " chat " ]]; then
        step "Configuring Rocket.Chat"
        bash "${SCRIPTS}/configure-rocketchat.sh" || err "Rocket.Chat configuration had errors"
    fi

    # Step 3: Configure extended apps
    if [[ " ${PROF[*]} " =~ " wordpress " ]]; then
        step "Configuring WordPress + WooCommerce"
        bash "${SCRIPTS}/configure-wordpress.sh" || err "WordPress configuration had errors"
    fi

    if [[ " ${PROF[*]} " =~ " helpdesk " ]]; then
        step "Configuring Zammad"
        bash "${SCRIPTS}/configure-zammad.sh" || err "Zammad configuration had errors"
    fi

    if [[ " ${PROF[*]} " =~ " analytics " ]]; then
        configure_superset_databases || err "Superset configuration had errors"
    fi

    if [[ " ${PROF[*]} " =~ " automation " ]]; then
        import_n8n_workflows || err "n8n workflow import had errors"
    fi

    # Step 4: Final summary
    step "Post-Install Complete!"
    echo ""
    log "All configured services:"
    echo ""
    echo "  🤖 AI Portal:     https://${DOMAIN:-oficina.local}"
    echo "  📊 ERP/CRM:       https://erp.${DOMAIN:-oficina.local}"
    echo "  📁 Files:         https://files.${DOMAIN:-oficina.local}"
    echo "  💬 Chat:          https://chat.${DOMAIN:-oficina.local}"
    echo "  📧 Email:         https://mail.${DOMAIN:-oficina.local}"
    echo "  🛒 Shop:          https://shop.${DOMAIN:-oficina.local}"
    echo "  📈 Analytics:     https://analytics.${DOMAIN:-oficina.local}"
    echo "  🎫 Helpdesk:      https://help.${DOMAIN:-oficina.local}"
    echo "  🌐 Website:       https://www.${DOMAIN:-oficina.local}"
    echo "  ⚡ Automation:    https://auto.${DOMAIN:-oficina.local}"
    echo "  🔍 Documents AI:  https://docs.${DOMAIN:-oficina.local}"
    echo "  🔐 Auth:          https://auth.${DOMAIN:-oficina.local}"
    echo "  ⚙️  Admin:         https://admin.${DOMAIN:-oficina.local}"
    echo ""
    log "SSO: Log in once at auth.${DOMAIN:-oficina.local} → access everything."
    log "AI Agent: Ask anything at ${DOMAIN:-oficina.local} — it can reach all services."
    echo ""
}

main "$@"
