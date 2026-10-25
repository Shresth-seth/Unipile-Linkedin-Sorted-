# WP-10: AWS Deployment & CI/CD Pipeline Verification

**Work Package:** WP-10 ("Harden Builds and AWS Deployment", Handover Pages 24–25)  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Date:** 2026-10-25  
**Harness Tests:** `server/src/__tests__/unit/build-and-deployment.test.ts`

---

## 1. Remote Execution Hardening (`scripts/deploy-production.sh`)

1. **Root User Guard:**
   ```bash
   if [ "$(id -u)" -eq 0 ]; then
     log_warn "Script started as root. Switching execution context to user 'ubuntu'..."
     exec sudo -iu ubuntu bash -lc "..."
   fi
   ```
   Ensures application processes and git checkouts never run as root.
2. **Fail-Closed Execution:** Configured with `set -euo pipefail` so any command failure or unset variable immediately terminates execution.
3. **Deterministic Git Sync:**
   - Targets exact commit `DEPLOY_COMMIT_SHA`.
   - Never deletes untracked runtime artifacts (`.env`, logs).
   - Stamps `.deploy-version` with exact commit SHA.
4. **Smart Multi-Stage Runtime:** Automatically adapts to Docker Compose, PM2, or systemd based on host inspection.
5. **Post-Deployment Health Checks:**
   - Probes `http://127.0.0.1:4000/api/health/liveness` (up to 10 retries).
   - Probes `http://127.0.0.1:3000/` (frontend root).
   - Verifies Nginx port 80 reverse proxy ingress.

---

## 2. GitHub Actions CI/CD Pipeline (`.github/workflows/deploy-production.yml`)

1. **Concurrency Protection:**
   ```yaml
   concurrency:
     group: production-deployment
     cancel-in-progress: false
   ```
   Prevents overlapping deployments that could corrupt git state or cause split-brain executions.
2. **Pre-Deployment Gate:**
   - Full repository secret scan (`scripts/scan-secrets.mjs`).
   - Secret scanner regression suite (`scripts/test-secret-scanner.mjs`).
   - Sensitive error redaction & config tests (`scripts/test-config-validation.mjs`).
   - Backend typecheck and production build (`npm run build`).
   - Frontend lint, typecheck, and production build.
3. **Passwordless AWS OIDC Authentication:**
   - Uses `aws-actions/configure-aws-credentials@v5` with audience `sts.amazonaws.com`.
   - Eliminates long-lived AWS IAM access keys from repository secrets.
4. **AWS Systems Manager (SSM) Remote Execution:**
   - Dispatches deployment via `AWS-RunShellScript` under user `ubuntu`.
   - Polls invocation status with timeout enforcement.
   - Verifies public health probes before completing workflow.
