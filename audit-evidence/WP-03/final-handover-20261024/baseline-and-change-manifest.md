# Work Package WP-03: Baseline and Change Manifest

**Target Commit Baseline:** `d4605327b523a11d362afc45620dd759c601a5bf` (branch `main`)  
*Notice: This Git commit hash identifies the upstream repository commit where the readiness audit began. Uncommitted working-tree modifications, remediations, and audit evidence are preserved locally in the working tree and have not been committed.*  
**Run ID:** `final-handover-20261024`  
**Execution Timestamp:** 2026-10-24T17:58:00+05:30  
**Host Environment:** Windows x64, Node.js `v24.22.1`, npm `12.2.1`  
**WP-03 Classification:** **`PARTIALLY COMPLETE`** (Local code, unit, and HTTP routing verified; live PostgreSQL row-level isolation & cloud credential rotation remain pending)  
**WP-02 Status:** **`BLOCKED`**  
**Cloud Credential Rotation:** **`PENDING AUTHORIZED OPERATOR ACTION`**  

---

## 1. Git State & Working Tree Audit

```text
git rev-parse HEAD:
d4605327b523a11d362afc45620dd759c601a5bf

git branch --show-current:
main

git status --short:
 M .dockerignore
 M .github/workflows/deploy-production.yml
 M .gitignore
 M client/.dockerignore
D  deploy.tar.gz
 M deploy/aws/deploy-remote.ps1
 M package.json
 M server/.dockerignore
 M server/check-role.cjs
 M server/check_unipile.mjs
 M server/get-accounts.ts
 M server/package-lock.json
 M server/package.json
 M server/src/controllers/dashboard.controller.ts
 M server/src/db/index.ts
 M server/src/scripts/assign-admin.ts
 M server/src/scripts/clear-all-users.ts
 M server/src/scripts/reset-admin.ts
 M server/src/services/crm/crm.service.ts
 M server/src/utils/error.util.ts
 M server/test-batch-dm.mts
?? audit-evidence/
?? scripts/scan-secrets.mjs
?? scripts/test-config-validation.mjs
?? scripts/test-secret-scanner.mjs
?? server/src/__tests__/
?? server/src/scripts/ast-route-inventory.ts
?? server/vitest.config.ts
```

---

## 2. Change Attribution Breakdown

### Staged Changes (1 file)
- `D deploy.tar.gz`: Staged deletion preserved from WP-01/WP-02. This archive contained plaintext production secrets and keys.

### Pre-Existing Unstaged Changes (16 files from WP-01 & WP-02)
- `.dockerignore`, `.gitignore`, `client/.dockerignore`, `server/.dockerignore`: Docker & git ignore hygiene.
- `.github/workflows/deploy-production.yml`: Deployment pipeline sanitization.
- `deploy/aws/deploy-remote.ps1`: Deployment script hardening.
- `package.json`: Security scan and test validation scripts.
- `server/check-role.cjs`, `server/check_unipile.mjs`, `server/get-accounts.ts`, `server/test-batch-dm.mts`: Standalone test script error and credential redaction.
- `server/src/db/index.ts`: Mandatory `DATABASE_URL` production check and loopback fallback.
- `server/src/scripts/assign-admin.ts`, `server/src/scripts/clear-all-users.ts`, `server/src/scripts/reset-admin.ts`: Admin migration scripts with sanitized logging and non-zero exit codes.

### WP-03 Application & Service Changes (4 files)
1. [`server/src/utils/error.util.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/utils/error.util.ts):
   - Added typed `NotFoundError` domain exception (`statusCode = 404`).
   - Added sensitive text redaction helper `redactSensitiveText` and sanitized `safeErrorMessage`.
2. [`server/src/services/crm/crm.service.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/crm/crm.service.ts):
   - In `updateContactStage`: Throws typed `NotFoundError` when target contact is not found or not owned by `userId`.
3. [`server/src/controllers/dashboard.controller.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/dashboard.controller.ts):
   - In `updateContactStage`: Catches `NotFoundError` and returns `HTTP 404 Not Found`.
   - Uses `isInternalDbError` to prevent database/driver errors (e.g. `relation contacts not found`) from masquerading as 404s, returning `HTTP 500` with sanitized messages instead.
4. [`server/package.json`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/package.json) & [`server/package-lock.json`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/package-lock.json):
   - Added `vitest@5.0.5`, `supertest@7.3.1`, `@types/supertest@7.2.1` to `devDependencies`.

### WP-03 Test Suite Additions (Untracked in `server/src/__tests__/`)
- [`server/vitest.config.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/vitest.config.ts): Vitest runner configuration for Node ESM.
- [`server/src/__tests__/setup.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts): Fail-closed network interceptor and database isolation guard.
- [`server/src/__tests__/unit/network-guard.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/network-guard.test.ts): 6 tests for HTTP/HTTPS outbound blocking.
- [`server/src/__tests__/unit/crm-stage-defect.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/crm-stage-defect.test.ts): 6 tests for defect remediation, typed `NotFoundError`, and DB error 500 handling.
- [`server/src/__tests__/unit/tenant-isolation.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/tenant-isolation.test.ts): 14-case tenant-isolation negative-test matrix across CRM, conversations, LinkedIn, worker, and AI BYOK.
- [`server/src/__tests__/unit/migrated-legacy.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/migrated-legacy.test.ts): 7 tests preserving legacy assertions for LangGraph memory and cryptography.
- [`server/src/__tests__/integration/http-routes.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/integration/http-routes.test.ts): 25 focused Supertest HTTP-level integration tests covering real Express routing, middleware, and controllers.
- [`server/src/__tests__/mocks/unipile.mock.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/mocks/unipile.mock.ts): In-memory deterministic mock for Unipile API client.
- [`server/src/__tests__/mocks/gemini.mock.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/mocks/gemini.mock.ts): In-memory deterministic mock for Gemini AI client.

---

## 3. Strict Invariant Guarantees
- Zero git commits or pushes were made.
- Zero git resets, stashes, cleans, or checkouts were executed.
- No production database connections were established.
- No external provider network requests were emitted.
