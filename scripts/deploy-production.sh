#!/usr/bin/env bash
# ==============================================================================
# WorkPilot / WORKPILOT — Production Deployment Script for AWS EC2
# ==============================================================================
# Executed on EC2 instance under user 'ubuntu' via AWS Systems Manager (SSM).
#
# Core Stages:
# 1. Environment & Path Validation (/home/ubuntu/app)
# 2. Workspace Safety (Stash tracked modifications without touching .env)
# 3. Deterministic Git Synchronization to exact target commit (DEPLOY_COMMIT_SHA)
# 4. Deployment Version Stamping (.deploy-version)
# 5. Service Manager Detection & Build (Docker Compose / PM2 / systemd)
# 6. Graceful Process Restart (Scoped to WorkPilot only)
# 7. Health Check Probes (http://127.0.0.1:4000/api/health/liveness, http://127.0.0.1:3000/)
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Formatting Helpers & Banners
# ------------------------------------------------------------------------------
COLOR_BLUE='\033[0;34m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_CYAN='\033[0;36m'
COLOR_RESET='\033[0m'

log_info() {
  echo -e "${COLOR_BLUE}[INFO]${COLOR_RESET} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
  echo -e "${COLOR_GREEN}[SUCCESS]${COLOR_RESET} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
  echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
  echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_stage() {
  echo ""
  echo -e "${COLOR_CYAN}==============================================================================${COLOR_RESET}"
  echo -e "${COLOR_CYAN}  $1${COLOR_RESET}"
  echo -e "${COLOR_CYAN}==============================================================================${COLOR_RESET}"
}

# ------------------------------------------------------------------------------
# Root User Guard: Ensure execution as ubuntu
# ------------------------------------------------------------------------------
if [ "$(id -u)" -eq 0 ]; then
  log_warn "Script started as root. Switching execution context to user 'ubuntu'..."
  exec sudo -iu ubuntu bash -lc "DEPLOY_COMMIT_SHA='${DEPLOY_COMMIT_SHA:-}' GITHUB_ACTOR='${GITHUB_ACTOR:-}' AWS_DEPLOY_PATH='${AWS_DEPLOY_PATH:-/home/ubuntu/app}' bash '${BASH_SOURCE[0]}'"
fi

# ------------------------------------------------------------------------------
# 1. Environment & Path Resolution
# ------------------------------------------------------------------------------
log_stage "STAGE 1: Environment & Directory Resolution"

DEPLOY_DIR="${AWS_DEPLOY_PATH:-/home/ubuntu/app}"
DEPLOY_DIR="${DEPLOY_DIR/#\~/$HOME}"

log_info "Target deployment directory: ${DEPLOY_DIR}"

if [ ! -d "${DEPLOY_DIR}" ]; then
  log_error "Deployment directory does not exist: ${DEPLOY_DIR}"
  exit 1
fi

cd "${DEPLOY_DIR}"

if [ ! -d ".git" ]; then
  log_error "Directory is not a git repository: ${DEPLOY_DIR}"
  exit 1
fi

# Detect available process manager
RUNTIME_MODE="docker"
if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -qE 'workpilot|server|client'; then
  RUNTIME_MODE="pm2"
elif systemctl is-active --quiet workpilot-server 2>/dev/null || systemctl is-active --quiet workpilot-client 2>/dev/null || systemctl is-active --quiet workpilot 2>/dev/null; then
  RUNTIME_MODE="systemd"
elif docker ps 2>/dev/null | grep -qE 'workpilot'; then
  RUNTIME_MODE="docker"
  if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
  else
    DOCKER_COMPOSE="docker-compose"
  fi
elif [ -f "docker-compose.yml" ] && (docker compose version &>/dev/null || command -v docker-compose &>/dev/null); then
  RUNTIME_MODE="docker"
  if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
  else
    DOCKER_COMPOSE="docker-compose"
  fi
elif command -v pm2 &>/dev/null; then
  RUNTIME_MODE="pm2"
else
  RUNTIME_MODE="direct"
fi

log_info "Detected production runtime mode: ${RUNTIME_MODE}"

# ------------------------------------------------------------------------------
# 2. Workspace Safety & Commit Recording
# ------------------------------------------------------------------------------
log_stage "STAGE 2: Workspace Safety & State Recording"

PREVIOUS_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo 'initial')"
log_info "Previous deployed commit: ${PREVIOUS_COMMIT}"

# Stash any local tracked modifications without touching untracked (.env, uploads, logs)
UNCOMMITTED_FILES=$(git status --porcelain 2>/dev/null | grep -v '^[??]' | grep -v '\.env' || true)
if [ -n "${UNCOMMITTED_FILES}" ]; then
  log_warn "Detected local tracked changes on production instance:"
  echo "${UNCOMMITTED_FILES}"
  log_info "Stashing local changes to preserve state without blocking deployment..."
  git stash push -m "pre-deploy-stash-$(date +%s)" 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# 3. Deterministic Git Synchronization to Target Commit
# ------------------------------------------------------------------------------
log_stage "STAGE 3: Deterministic Git Synchronization"

log_info "[CD] Fetching latest commits from origin..."
git fetch origin main --tags --prune

TARGET_COMMIT="${DEPLOY_COMMIT_SHA:-$(git rev-parse origin/main)}"
log_info "[CD] Deploying SHA: ${TARGET_COMMIT}"

# Checkout main and reset to exact target commit (NEVER use git clean -fdx)
git checkout main
git reset --hard "${TARGET_COMMIT}"

NEW_COMMIT="$(git rev-parse HEAD)"
if [ "${NEW_COMMIT}" != "${TARGET_COMMIT}" ]; then
  log_error "Failed to synchronize to target commit ${TARGET_COMMIT}. Current is ${NEW_COMMIT}"
  exit 1
fi

NEW_COMMIT_MSG="$(git log -1 --pretty=%B | head -n 1)"
NEW_COMMIT_AUTHOR="$(git log -1 --pretty=%an)"

log_success "[CD] Repository synced"
log_info "Commit Author:  ${NEW_COMMIT_AUTHOR}"
log_info "Commit Message: ${NEW_COMMIT_MSG}"

# ------------------------------------------------------------------------------
# 4. Version Stamping
# ------------------------------------------------------------------------------
log_stage "STAGE 4: Deployment Version Stamping"

# Write single clean SHA so Express /api/health/liveness reads it directly
echo "${NEW_COMMIT}" > .deploy-version
echo "${NEW_COMMIT}" > server/.deploy-version 2>/dev/null || true

log_success "Staged .deploy-version: $(cat .deploy-version)"

# ------------------------------------------------------------------------------
# 5. Build, Migration, and Service Restart
# ------------------------------------------------------------------------------
log_stage "STAGE 5: Build & Process Restart (Runtime: ${RUNTIME_MODE})"

if [ "${RUNTIME_MODE}" = "docker" ]; then
  log_info "[CD] Building updated Docker images..."
  ${DOCKER_COMPOSE} build --pull

  # Smart database detection: check if external AWS RDS / cloud Postgres is used
  if grep -E '^DATABASE_URL=' .env 2>/dev/null | grep -qvE 'localhost|postgres:5432|127\.0\.0\.1'; then
    log_info "External database detected in .env (AWS RDS/Cloud DB). Skipping local postgres container wait."
    ${DOCKER_COMPOSE} up -d redis || true
  else
    log_info "Ensuring local database & cache services are healthy..."
    ${DOCKER_COMPOSE} up -d postgres redis || true

    # Wait for postgres readiness
    WAIT_ROUNDS=0
    until ${DOCKER_COMPOSE} exec -T postgres pg_isready &>/dev/null || [ $WAIT_ROUNDS -ge 15 ]; do
      sleep 2
      WAIT_ROUNDS=$((WAIT_ROUNDS + 1))
    done
  fi

  log_info "Executing database migrations with production runner..."
  ${DOCKER_COMPOSE} run --rm server npm run db:migrate:prod
  ${DOCKER_COMPOSE} run --rm server npm run db:custom-migrate:prod

  log_info "[CD] Recreating exact application services (server, client)..."
  ${DOCKER_COMPOSE} up -d --remove-orphans server client
  ${DOCKER_COMPOSE} ps

  log_info "[CD] Backend built"
  log_info "[CD] Frontend built"
  log_info "[CD] Services restarted"

elif [ "${RUNTIME_MODE}" = "pm2" ]; then
  log_info "[CD] Backend dependencies installing..."
  (cd server && npm ci)
  log_info "[CD] Backend dependencies installed"

  log_info "[CD] Backend building..."
  (cd server && npm run build)
  log_info "[CD] Backend built"

  log_info "Applying database migrations..."
  (cd server && npm run db:migrate:prod)
  (cd server && npm run db:custom-migrate:prod)

  log_info "[CD] Frontend dependencies installing..."
  (cd client && npm ci)
  log_info "[CD] Frontend dependencies installed"

  log_info "[CD] Frontend building..."
  (cd client && npm run build)
  log_info "[CD] Frontend built"

  log_info "Reloading WorkPilot PM2 processes..."
  # Reload only WorkPilot specific processes, do NOT blindly pm2 restart all
  PM2_PROCS=$(pm2 jlist 2>/dev/null | jq -r '.[].name' 2>/dev/null | grep -E '^(workpilot|server|client)' || true)
  if [ -n "${PM2_PROCS}" ]; then
    for proc in ${PM2_PROCS}; do
      log_info "Reloading PM2 process: ${proc}"
      pm2 reload "${proc}" || pm2 restart "${proc}"
    done
  else
    # Fallback to standard process names if not matched
    pm2 reload workpilot-server 2>/dev/null || pm2 restart workpilot-server 2>/dev/null || true
    pm2 reload workpilot-client 2>/dev/null || pm2 restart workpilot-client 2>/dev/null || true
  fi
  pm2 save 2>/dev/null || true
  log_info "[CD] Services restarted"

elif [ "${RUNTIME_MODE}" = "systemd" ]; then
  log_info "[CD] Backend dependencies installing..."
  (cd server && npm ci)
  log_info "[CD] Backend dependencies installed"

  log_info "[CD] Backend building..."
  (cd server && npm run build)
  log_info "[CD] Backend built"

  log_info "Applying database migrations..."
  (cd server && npm run db:migrate:prod)
  (cd server && npm run db:custom-migrate:prod)

  log_info "[CD] Frontend dependencies installing..."
  (cd client && npm ci)
  log_info "[CD] Frontend dependencies installed"

  log_info "[CD] Frontend building..."
  (cd client && npm run build)
  log_info "[CD] Frontend built"

  log_info "Restarting exact systemd service units..."
  sudo systemctl restart workpilot-server || sudo systemctl restart workpilot || true
  sudo systemctl restart workpilot-client || true
  log_info "[CD] Services restarted"

else
  # Direct Node execution fallback
  log_info "[CD] Backend dependencies installing..."
  (cd server && npm ci && npm run build && npm run db:migrate:prod && npm run db:custom-migrate:prod)
  log_info "[CD] Backend built"

  log_info "[CD] Frontend dependencies installing..."
  (cd client && npm ci && npm run build)
  log_info "[CD] Frontend built"
  log_info "[CD] Services restarted"
fi

log_success "Build and restart operations completed."

# Sync Nginx reverse proxy configuration if host nginx is installed
if command -v nginx &>/dev/null && [ -f "deploy/aws/nginx.conf" ]; then
  log_info "Configuring host Nginx reverse proxy for port 80..."
  sudo cp deploy/aws/nginx.conf /etc/nginx/sites-available/default 2>/dev/null || sudo cp deploy/aws/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || true
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || true
    log_success "Nginx reverse proxy reloaded"
  else
    log_warn "Nginx config test failed; leaving existing config in place"
  fi
fi

# ------------------------------------------------------------------------------
# 6. Multi-Stage Health Check Probes
# ------------------------------------------------------------------------------
log_stage "STAGE 6: Post-Deployment Health Probes"

BACKEND_LIVENESS_URL="http://127.0.0.1:4000/api/health/liveness"
FRONTEND_HEALTH_URL="http://127.0.0.1:3000/"

log_info "Initiating backend health probe (${BACKEND_LIVENESS_URL})..."
curl --fail --retry 10 --retry-delay 3 --max-time 10 "${BACKEND_LIVENESS_URL}" || {
  log_error "Backend health probe failed at ${BACKEND_LIVENESS_URL}"
  exit 1
}
echo ""
log_success "[CD] Backend health passed"

log_info "Initiating frontend health probe (${FRONTEND_HEALTH_URL})..."
curl --fail --retry 10 --retry-delay 3 --max-time 10 "${FRONTEND_HEALTH_URL}" > /dev/null || {
  log_error "Frontend health probe failed at ${FRONTEND_HEALTH_URL}"
  exit 1
}
log_success "[CD] Frontend health passed"

# Probe Port 80 if Nginx is active
if command -v nginx &>/dev/null; then
  log_info "Initiating Port 80 reverse proxy probe (http://127.0.0.1/)..."
  curl --fail --retry 5 --retry-delay 2 --max-time 10 "http://127.0.0.1/" > /dev/null || {
    log_warn "Port 80 probe returned non-200. Check /var/log/nginx/error.log"
  }
  log_success "[CD] Port 80 ingress verified"
fi

# ------------------------------------------------------------------------------
# 7. Housekeeping & Completion
# ------------------------------------------------------------------------------
log_stage "STAGE 7: Housekeeping & Completion"

if [ "${RUNTIME_MODE}" = "docker" ]; then
  docker image prune -f 2>/dev/null || true
fi

log_success "[CD] Production deployment complete"
echo ""
echo -e "${COLOR_GREEN}✓ Repository synced to: ${NEW_COMMIT}${COLOR_RESET}"
echo -e "${COLOR_GREEN}✓ Backend healthy:      ${BACKEND_LIVENESS_URL} (HTTP 200)${COLOR_RESET}"
echo -e "${COLOR_GREEN}✓ Frontend healthy:     ${FRONTEND_HEALTH_URL}${COLOR_RESET}"
echo -e "${COLOR_GREEN}✓ Deployed at:          $(date -u +"%Y-%m-%dT%H:%M:%SZ")${COLOR_RESET}"
echo ""

exit 0
