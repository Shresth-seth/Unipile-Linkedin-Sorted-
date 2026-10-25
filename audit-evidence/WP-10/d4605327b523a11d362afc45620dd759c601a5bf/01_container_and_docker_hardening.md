# WP-10: Container & Docker Hardening Audit

**Work Package:** WP-10 ("Harden Builds and AWS Deployment", Handover Pages 24–25)  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Date:** 2026-10-25  
**Harness Tests:** `server/src/__tests__/unit/build-and-deployment.test.ts`

---

## 1. Multi-Stage Dockerfile Review

### Backend Container (`server/Dockerfile`)
- **Base Image:** `node:20-alpine` (Minimal attack surface, zero extraneous tools).
- **Builder Stage:** Compiles TypeScript source (`npm run build`) in an isolated intermediate container.
- **Runner Stage:**
  - `ENV NODE_ENV=production`
  - Non-root user creation: `addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 expressjs`.
  - Artifact copy with ownership: `COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist`.
  - Drops root privileges: `USER expressjs`.
  - Liveness probe: `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --quiet --tries=1 --spider http://localhost:4000/api/health/liveness || exit 1`.

### Frontend Container (`client/Dockerfile`)
- **Base Image:** `node:20-alpine` (with `libc6-compat`).
- **Stages:** `deps` ➔ `builder` ➔ `runner` (Next.js Standalone tracing).
- **Optimization:** Output standalone trace reduces final image size by >80%.
- **Non-root user:** `nextjs:nodejs` (UID/GID 1001).
- **Liveness probe:** `HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1`.

---

## 2. Docker Ignore & Secret Isolation

All build contexts are strictly guarded by `.dockerignore` files to prevent credentials, secrets, tarballs, or local state from leaking into images:
- **Excluded Patterns:**
  - `.env*` (Except examples)
  - `*.pem`, `*.key`, `*.pkcs12`, `*.pfx`, `*.id_rsa*`, `*.id_ed25519*`
  - `keys/`, `deploy/keys/`, `secrets/`
  - `deploy.tar.gz`, `*.tgz`, `*.tar.gz`
  - `node_modules/`, `.git/`, `.next/`, `dist/`

---

## 3. Orchestration & Resource Bounds (`docker-compose.yml`)

1. **Secret Enforcement:** Removed hardcoded fallback for `JWT_SECRET`; requires explicit environment variable or halts startup.
2. **Memory Hardening:**
   - Server Node.js heap limit: `--max-old-space-size=384`
   - Client Node.js heap limit: `--max-old-space-size=400`
   - Redis memory cap: `128mb` with `allkeys-lru` eviction
   - PostgreSQL buffers: `shared_buffers=128MB`, `max_connections=50`
3. **Log Rotation:** All containers configured with `json-file` driver, `max-size: 10m`, and `max-file: 3` to prevent disk exhaustion.
