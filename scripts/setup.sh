#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Oficina Digital — First-Boot Setup Script                      ║
# ║  Generates secrets, initializes databases, starts services.     ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

OFICINA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${OFICINA_DIR}/.env"
TEMPLATE_FILE="${OFICINA_DIR}/.env.template"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[SETUP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# ──────────────────────────────────────────────
# Generate a random password/secret
# ──────────────────────────────────────────────
gen_secret() {
    local length="${1:-32}"
    openssl rand -base64 "$length" | tr -d '/+=' | head -c "$length"
}

# ──────────────────────────────────────────────
# Check prerequisites
# ──────────────────────────────────────────────
check_prereqs() {
    log "Checking prerequisites..."

    local missing=()
    for cmd in docker openssl curl; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        err "Missing required commands: ${missing[*]}"
        exit 1
    fi

    # Check Docker Compose v2
    if ! docker compose version &>/dev/null; then
        err "Docker Compose v2 is required. Install: https://docs.docker.com/compose/install/"
        exit 1
    fi

    # Check NVIDIA GPU (optional but recommended)
    if command -v nvidia-smi &>/dev/null; then
        local gpu_info
        gpu_info=$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || true)
        if [ -n "$gpu_info" ]; then
            log "GPU detected: $gpu_info"
        fi
    else
        warn "No NVIDIA GPU detected. AI inference will be slow or unavailable."
        warn "Install NVIDIA Container Toolkit for GPU acceleration."
    fi

    # Check available RAM
    local total_ram_gb
    total_ram_gb=$(awk '/MemTotal/ {printf "%.0f", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo "0")
    log "Available RAM: ${total_ram_gb}GB"
    if [ "$total_ram_gb" -lt 32 ]; then
        warn "Minimum 64GB RAM recommended. Some services may not start with ${total_ram_gb}GB."
    fi

    log "Prerequisites OK"
}

# ──────────────────────────────────────────────
# Generate .env from template with random secrets
# ──────────────────────────────────────────────
generate_env() {
    if [ -f "$ENV_FILE" ]; then
        warn ".env already exists. Skipping secret generation."
        warn "Delete .env and re-run to regenerate secrets."
        return
    fi

    log "Generating secrets..."

    cp "$TEMPLATE_FILE" "$ENV_FILE"

    # Replace all CHANGE_ME_ placeholders with random secrets
    local secrets=(
        "CHANGE_ME_postgres:$(gen_secret 24)"
        "CHANGE_ME_mariadb:$(gen_secret 24)"
        "CHANGE_ME_redis:$(gen_secret 24)"
        "CHANGE_ME_mongo:$(gen_secret 24)"
        "CHANGE_ME_elastic:$(gen_secret 24)"
        "CHANGE_ME_authentik_secret:$(gen_secret 50)"
        "CHANGE_ME_nextcloud:$(gen_secret 24)"
        "CHANGE_ME_collabora:$(gen_secret 16)"
        "CHANGE_ME_stalwart:$(gen_secret 24)"
        "CHANGE_ME_wordpress:$(gen_secret 24)"
        "CHANGE_ME_superset_secret:$(gen_secret 42)"
        "CHANGE_ME_superset:$(gen_secret 24)"
        "CHANGE_ME_n8n_encryption:$(gen_secret 32)"
        "CHANGE_ME_oidc_client_id:$(gen_secret 20)"
        "CHANGE_ME_oidc_client_secret:$(gen_secret 40)"
    )

    for pair in "${secrets[@]}"; do
        local placeholder="${pair%%:*}"
        local secret="${pair#*:}"
        sed -i "s|${placeholder}|${secret}|g" "$ENV_FILE"
    done

    log "Secrets generated and written to .env"
    log "IMPORTANT: Back up .env — losing it means losing access to all services."
}

# ──────────────────────────────────────────────
# Prompt for configuration
# ──────────────────────────────────────────────
configure() {
    log "Configuration"
    echo ""

    # Domain
    read -rp "$(echo -e "${BLUE}Domain${NC} [oficina.local]: ")" domain
    domain="${domain:-oficina.local}"
    sed -i "s|^DOMAIN=.*|DOMAIN=${domain}|" "$ENV_FILE"

    # Company name
    read -rp "$(echo -e "${BLUE}Company name${NC} [Mi Empresa]: ")" company
    company="${company:-Mi Empresa}"
    sed -i "s|^COMPANY_NAME=.*|COMPANY_NAME=${company}|" "$ENV_FILE"

    # Admin email
    read -rp "$(echo -e "${BLUE}Admin email${NC} [admin@${domain}]: ")" email
    email="${email:-admin@${domain}}"
    sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${email}|" "$ENV_FILE"

    # Timezone
    read -rp "$(echo -e "${BLUE}Timezone${NC} [America/Lima]: ")" tz
    tz="${tz:-America/Lima}"
    sed -i "s|^TIMEZONE=.*|TIMEZONE=${tz}|" "$ENV_FILE"

    # AI model
    echo ""
    log "AI Model Selection"
    echo "  1) Qwen2.5-14B (needs 16GB VRAM — Entry tier)"
    echo "  2) Qwen2.5-32B (needs 24GB VRAM — Pro tier) [default]"
    echo "  3) Qwen2.5-72B (needs 48GB VRAM — Enterprise tier)"
    echo "  4) Custom model"
    read -rp "$(echo -e "${BLUE}Select model${NC} [2]: ")" model_choice
    model_choice="${model_choice:-2}"

    case "$model_choice" in
        1)
            sed -i "s|^VLLM_MODEL=.*|VLLM_MODEL=Qwen/Qwen2.5-14B-Instruct-AWQ|" "$ENV_FILE"
            sed -i "s|^VLLM_MAX_MODEL_LEN=.*|VLLM_MAX_MODEL_LEN=16384|" "$ENV_FILE"
            ;;
        2)
            sed -i "s|^VLLM_MODEL=.*|VLLM_MODEL=Qwen/Qwen2.5-32B-Instruct-AWQ|" "$ENV_FILE"
            ;;
        3)
            sed -i "s|^VLLM_MODEL=.*|VLLM_MODEL=Qwen/Qwen2.5-72B-Instruct-AWQ|" "$ENV_FILE"
            sed -i "s|^VLLM_MAX_MODEL_LEN=.*|VLLM_MAX_MODEL_LEN=4096|" "$ENV_FILE"
            ;;
        4)
            read -rp "Model name (HuggingFace): " custom_model
            sed -i "s|^VLLM_MODEL=.*|VLLM_MODEL=${custom_model}|" "$ENV_FILE"
            ;;
    esac

    # Which profiles to enable
    echo ""
    log "Service Selection"
    echo "  Profiles: erp, nextcloud, mail, chat, wordpress, analytics, helpdesk, automation, ai, rag, agent, management"
    echo "  (foundation, identity, proxy are always enabled)"
    read -rp "$(echo -e "${BLUE}Enable all services?${NC} [Y/n]: ")" enable_all
    if [[ "${enable_all,,}" != "n" ]]; then
        sed -i "s|^ENABLED_PROFILES=.*|ENABLED_PROFILES=foundation,identity,proxy,erp,nextcloud,mail,chat,wordpress,analytics,helpdesk,automation,ai,rag,agent,management|" "$ENV_FILE"
    else
        read -rp "Enter profiles (comma-separated): " profiles
        sed -i "s|^ENABLED_PROFILES=.*|ENABLED_PROFILES=foundation,identity,proxy,${profiles}|" "$ENV_FILE"
    fi

    log "Configuration saved to .env"
}

# ──────────────────────────────────────────────
# Start services
# ──────────────────────────────────────────────
start_services() {
    log "Starting Oficina Digital..."

    cd "$OFICINA_DIR"

    # Read enabled profiles from .env
    source "$ENV_FILE"
    local profiles=""
    IFS=',' read -ra PROF <<< "$ENABLED_PROFILES"
    for p in "${PROF[@]}"; do
        profiles+=" --profile ${p}"
    done

    # Phase 1: Foundation (databases)
    log "Phase 1/4: Starting databases..."
    docker compose --profile foundation up -d
    log "Waiting for databases to be healthy..."
    docker compose --profile foundation exec -T postgres pg_isready -U "${POSTGRES_USER}" --timeout=60 || true
    sleep 10

    # Phase 2: Identity + Proxy
    log "Phase 2/4: Starting identity and proxy..."
    docker compose --profile identity --profile proxy up -d
    sleep 15

    # Phase 3: Business apps
    log "Phase 3/4: Starting business applications..."
    docker compose $profiles up -d

    # Phase 4: Health check
    log "Phase 4/4: Running health checks..."
    sleep 30
    docker compose $profiles ps

    echo ""
    log "════════════════════════════════════════════════"
    log "  Oficina Digital is starting up!"
    log "═════════════════════════════════════════���══════"
    echo ""
    log "Services will be available at:"
    echo "  Portal:     https://${DOMAIN}"
    echo "  ERP:        https://erp.${DOMAIN}"
    echo "  Files:      https://files.${DOMAIN}"
    echo "  Chat:       https://chat.${DOMAIN}"
    echo "  Email:      https://mail.${DOMAIN}"
    echo "  Shop:       https://shop.${DOMAIN}"
    echo "  Analytics:  https://analytics.${DOMAIN}"
    echo "  Helpdesk:   https://help.${DOMAIN}"
    echo "  Website:    https://www.${DOMAIN}"
    echo "  Automation: https://auto.${DOMAIN}"
    echo "  Documents:  https://docs.${DOMAIN}"
    echo "  Auth:       https://auth.${DOMAIN}"
    echo "  Admin:      https://admin.${DOMAIN}"
    echo ""
    log "First login: Visit https://auth.${DOMAIN} to create your admin account."
    log "Note: Some services take 2-5 minutes to fully initialize."
}

# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║           Oficina Digital — First-Boot Setup                ║"
    echo "║        FOSS Office in a Box — All your tools, your data    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    check_prereqs
    generate_env
    configure
    start_services
}

main "$@"
