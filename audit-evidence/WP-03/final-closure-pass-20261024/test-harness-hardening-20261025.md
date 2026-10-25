# WP-03 Test-Harness Hardening: validateTestDatabaseUrl Fixes & Regressions

**Date:** 2026-10-25  
**Task:** WP-03 Test-Harness Hardening (Offline & Non-Destructive)  
**Status:** COMPLETE — VERIFIED  
**Repository State:** `main` @ `d4605327b523a11d362afc45620dd759c601a5bf`  
**Working Tree Status:** Preserved (Staged deletion of `deploy.tar.gz` intact; uncommitted working-tree changes retained)

---

## 1. Scope & Objective

Harden `validateTestDatabaseUrl` in `server/src/__tests__/setup.ts` and expand regression tests in `server/src/__tests__/unit/database-safety.test.ts` to address known edge-case vulnerabilities identified in previous design review reports (`design-review-followup-20261025.md`):
1. **Missing/Empty Input:** Reject missing, null, undefined, or empty/whitespace URL strings when validation is explicitly invoked.
2. **Protocol Whitelist:** Permit only `postgres:` and `postgresql:` schemes; reject all non-PostgreSQL protocols (`http:`, `https:`, `redis:`, `mysql:`, `file:`).
3. **IPv6 Loopback:** Correctly handle standard WHATWG bracketed IPv6 loopback (`[::1]`) without false-positive rejection.
4. **Spoofing & Malformed URLs:** Reject malformed URLs and hostnames spoofing localhost (`localhost.attacker.com`, `attacker.localhost.com`, `notlocalhost`, `127.0.0.1.nip.io`, and userinfo confusion `localhost@attacker.com`).
5. **Focused Offline Testing:** Execute only the focused test suite without database connections, network calls, cloud credentials, or destructive actions.

---

## 2. Files Changed

### 2.1 `server/src/__tests__/setup.ts`
- **Updated `validateTestDatabaseUrl` implementation:**
  - Added truthiness check: `if (!url || typeof url !== "string" || !url.trim()) throw new Error("[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL is missing or empty...")`.
  - Added protocol whitelist check: `if (protocol !== "postgresql:" && protocol !== "postgres:") throw new Error("[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL has invalid protocol...")`.
  - Added IPv6 bracket normalization: `cleanHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host`.
  - Enforced strict loopback whitelist: `cleanHost === "localhost" || cleanHost === "127.0.0.1" || cleanHost === "::1"`.
  - Wrapped setup startup check in `if (process.env.TEST_DATABASE_URL)` so offline tests without a local DB start cleanly while still protecting the runner if `TEST_DATABASE_URL` is set.

### 2.2 `server/src/__tests__/unit/database-safety.test.ts`
- Added 4 new regression test suites:
  1. `validateTestDatabaseUrl rejects missing, null, undefined, or empty URL strings when validation is invoked` (asserts `undefined`, `null`, `""`, `"   "` throw hazard errors).
  2. `validateTestDatabaseUrl enforces protocol whitelist (postgres: and postgresql: only)` (asserts `postgres:` allowed; `http:`, `https:`, `redis:`, `mysql:`, `file:` rejected).
  3. `validateTestDatabaseUrl correctly allows IPv6 bracketed loopback [::1]` (asserts `postgresql://...@[::1]:5432/...` and `postgres://...@[::1]:5432/...` allowed).
  4. `validateTestDatabaseUrl rejects malformed URLs and spoofed localhost hostnames` (asserts `not-a-valid-url`, `postgresql://`, `localhost.attacker.com`, `notlocalhost`, `attacker.localhost.com`, `127.0.0.1.nip.io`, `localhost@attacker.com` rejected).

---

## 3. Test Execution & Verification

### 3.1 Focused Test Execution
- **Command:** `npx vitest run src/__tests__/unit/database-safety.test.ts`
- **Working Directory:** `c:\Users\Admin\OneDrive\Desktop\unipile\server`
- **Environment:** Node.js, offline sandbox (`globalThis.fetch` and `http(s).request` blocked for non-loopback hosts; zero database connections).
- **Result:**
  ```
   ✓ src/__tests__/unit/database-safety.test.ts (12 tests) 16ms
   Test Files  1 passed (1)
        Tests  12 passed (12)
     Duration  1.06s
  ```
- **Exit Code:** `0`

### 3.2 TypeScript Typecheck
- **Command:** `npm run typecheck` (`tsc --noEmit`)
- **Working Directory:** `c:\Users\Admin\OneDrive\Desktop\unipile\server`
- **Result:** 0 errors
- **Exit Code:** `0`

### 3.3 Tests Not Run in This Pass
In strict compliance with the prompt directive to run **only** focused tests:
- `src/__tests__/integration/http-routes.test.ts` (14 tests) — *Not run in this pass*
- `src/__tests__/unit/crm-stage-defect.test.ts` (6 tests) — *Not run in this pass*
- `src/__tests__/unit/error-sanitization.test.ts` (12 tests) — *Not run in this pass*
- `src/__tests__/unit/migrated-legacy.test.ts` (15 tests) — *Not run in this pass*
- `src/__tests__/unit/network-guard.test.ts` (10 tests) — *Not run in this pass*
- `src/__tests__/unit/tenant-isolation.test.ts` (18 tests) — *Not run in this pass*
- `src/__tests__/unit/webhook-auth.test.ts` (10 tests) — *Not run in this pass*
*(Note: All 85 tests above previously passed with 0 failures in the preceding Phase 1 pass).*

---

## 4. Fresh Git Status & Safety Confirmation

```
On branch main
Changes to be committed:
	deleted:    deploy.tar.gz

Changes not staged for commit:
	modified:   .dockerignore
	modified:   .github/workflows/deploy-production.yml
	modified:   .gitignore
	modified:   client/.dockerignore
	modified:   deploy/aws/deploy-remote.ps1
	modified:   package.json
	modified:   server/.dockerignore
	modified:   server/check-role.cjs
	modified:   server/check_unipile.mjs
	modified:   server/get-accounts.ts
	modified:   server/package-lock.json
	modified:   server/package.json
	modified:   server/src/controllers/agent.controller.ts
	modified:   server/src/controllers/dashboard.controller.ts
	modified:   server/src/db/index.ts
	modified:   server/src/scripts/assign-admin.ts
	modified:   server/src/scripts/clear-all-users.ts
	modified:   server/src/scripts/reset-admin.ts
	modified:   server/src/services/crm/crm.service.ts
	modified:   server/src/services/queue/queue.service.ts
	modified:   server/src/services/safety/safety.service.ts
	modified:   server/src/services/webhook/webhook-auth.service.ts
	modified:   server/src/utils/error.util.ts
	modified:   server/test-batch-dm.mts

Untracked files:
	audit-evidence/
	scripts/scan-secrets.mjs
	scripts/test-config-validation.mjs
	scripts/test-secret-scanner.mjs
	server/src/__tests__/
	server/src/scripts/ast-route-inventory.ts
	server/vitest.config.ts
```

- **Staged Deletion:** `deploy.tar.gz` staged deletion preserved intact.
- **Untracked Evidence:** All audit-evidence files and new tests preserved intact.
- **Destructive Actions Avoided:** Zero commits, zero pushes, zero resets, zero network egress, zero database connections.
- **Gating Status:** WP-04 is **NOT** started. Work remains gated pending operator review of `BLK-01` and `BLK-02`.
