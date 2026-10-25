# WP-03 Test-Harness Hardening & Database Guard Review

**Date:** 2026-10-25  
**Review Type:** Security & Architectural Follow-Up Review (Read-Only)  
**Status:** COMPLETE — FINDINGS DOCUMENTED  
**Repository State:** `main` @ `d4605327b523a11d362afc45620dd759c601a5bf`  
**Working Tree Status:** Preserved (Staged deletion of `deploy.tar.gz` intact; uncommitted working-tree changes retained)

---

## 1. Executive Summary

This review verifies the implementation of the `validateTestDatabaseUrl` hardening in `server/src/__tests__/setup.ts` and its accompanying regression tests in `server/src/__tests__/unit/database-safety.test.ts`.

Key Findings:
1. **Input Coverage:** The 6 required edge-case input classes (missing, empty, malformed, unsupported-protocol, spoofed-hostname, and IPv6-loopback) are completely covered with explicit negative and positive unit test assertions.
2. **Harness Verification:** The full test suite was proven offline and safe, and executed with **97/97 tests passing across 8 files (Exit Code 0)**.
3. **Database Guard Hazard Identified:** The conditional startup guard (`if (process.env.TEST_DATABASE_URL)`) allows offline unit tests with mocked database calls to run cleanly. However, if an unmocked database query were executed while `TEST_DATABASE_URL` is unset, `server/src/db/index.ts` defaults to `"postgresql://postgres:postgres@localhost:5432/workpilot"`. Because `postgres-js` connects via raw Node.js TCP sockets (`net.Socket`), it is **not intercepted** by the HTTP/HTTPS network killswitch in `setup.ts`, posing a risk of silent fallback to a developer's local database.
4. **Architectural Gating Preserved:** Neither Option A nor Option B has been selected. The architectural decision and its trade-offs remain open for human review.

---

## 2. Verification of Actual Diffs in `setup.ts` and `database-safety.test.ts`

### 2.1 `server/src/__tests__/setup.ts` (Lines 32–86)
The implementation of `validateTestDatabaseUrl` was audited against the design requirements:
```typescript
export function validateTestDatabaseUrl(url?: string | null): void {
  // 1. Missing / Empty Check
  if (!url || typeof url !== "string" || !url.trim()) {
    throw new Error(
      "[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL is missing or empty. When validation is invoked, a valid database URL must be provided."
    );
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // 2. Cloud Provider Keywords Check
  if (
    lower.includes("neon.tech") ||
    lower.includes("aws") ||
    lower.includes("supabase") ||
    lower.includes("rds.amazonaws.com")
  ) {
    throw new Error(
      `[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL points to a remote/cloud database target '${trimmed}'. Live tests must use a strictly local disposable database.`
    );
  }

  // 3. Protocol & Host Validation
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();

    if (protocol !== "postgresql:" && protocol !== "postgres:") {
      throw new Error(
        `[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL has invalid protocol '${protocol}'. Only 'postgresql:' and 'postgres:' are permitted.`
      );
    }

    const host = parsed.hostname.toLowerCase();
    const cleanHost = host.startsWith("[") && host.endsWith("]")
      ? host.slice(1, -1)
      : host;

    if (!cleanHost || (cleanHost !== "localhost" && cleanHost !== "127.0.0.1" && cleanHost !== "::1")) {
      throw new Error(
        `[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL points to non-loopback host '${host}'. Offline testing forbids remote databases.`
      );
    }
  } catch (err: any) {
    if (err.message.includes("[DATABASE HAZARD BLOCKED]")) throw err;
    throw new Error(`[DATABASE HAZARD BLOCKED] Invalid TEST_DATABASE_URL: ${err.message}`);
  }
}

// Startup Check (Guarded)
if (process.env.TEST_DATABASE_URL) {
  validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
}
```

### 2.2 Input Coverage Audit in `server/src/__tests__/unit/database-safety.test.ts`

| Input Class | Test Case / Value | Expected Observable Behavior | Audit Verdict |
|---|---|---|:---:|
| **Missing** | `validateTestDatabaseUrl(undefined)`<br>`validateTestDatabaseUrl(null)` | Throws `[DATABASE HAZARD BLOCKED] ... missing or empty` | **VERIFIED** (L90, L94) |
| **Empty** | `validateTestDatabaseUrl("")`<br>`validateTestDatabaseUrl("   ")` | Throws `[DATABASE HAZARD BLOCKED] ... missing or empty` | **VERIFIED** (L98, L102) |
| **Malformed** | `validateTestDatabaseUrl("not-a-valid-url")`<br>`validateTestDatabaseUrl("postgresql://")` | Throws `[DATABASE HAZARD BLOCKED] Invalid TEST_DATABASE_URL...` | **VERIFIED** (L147, L151) |
| **Unsupported Protocol** | `http://localhost:5432/db`<br>`https://localhost:5432/db`<br>`redis://127.0.0.1:6379`<br>`mysql://root:pass@localhost:3306/db`<br>`file:///etc/passwd` | Throws `[DATABASE HAZARD BLOCKED] ... invalid protocol '<scheme>'` | **VERIFIED** (L114–130) |
| **Permitted Protocol** | `postgres://postgres:postgres@localhost:5432/workpilot_test`<br>`postgresql://postgres:postgres@localhost:5432/workpilot_test` | Does not throw; passes validation | **VERIFIED** (L80, L109) |
| **IPv6 Loopback** | `postgresql://postgres:postgres@[::1]:5432/workpilot_test`<br>`postgres://postgres:postgres@[::1]:5432/workpilot_test` | Strips brackets `[::1]` -> `::1`; passes validation | **VERIFIED** (L136, L140) |
| **Spoofed Hostname (Subdomain)** | `postgresql://user:pass@localhost.attacker.com:5432/db` | Throws `non-loopback host 'localhost.attacker.com'` | **VERIFIED** (L156) |
| **Spoofed Hostname (Substring)** | `postgresql://user:pass@notlocalhost:5432/db` | Throws `non-loopback host 'notlocalhost'` | **VERIFIED** (L160) |
| **Spoofed Hostname (Prefix)** | `postgresql://user:pass@attacker.localhost.com:5432/db` | Throws `non-loopback host 'attacker.localhost.com'` | **VERIFIED** (L164) |
| **Spoofed Hostname (DNS Alias)** | `postgresql://user:pass@127.0.0.1.nip.io:5432/db` | Throws `non-loopback host '127.0.0.1.nip.io'` | **VERIFIED** (L168) |
| **Spoofed Hostname (Userinfo Confusion)** | `postgresql://localhost@attacker.com:5432/db` | Host parsed as `attacker.com`; throws `non-loopback host 'attacker.com'` | **VERIFIED** (L173) |

---

## 3. Analysis: Can Database-Dependent Tests Silently Run Without `TEST_DATABASE_URL`?

### 3.1 Tracing Data Flow and Network Boundaries
1. **Startup Guard Behavior:**
   - At runner launch, `setup.ts` deletes `process.env.DATABASE_URL`.
   - `if (process.env.TEST_DATABASE_URL)` runs `validateTestDatabaseUrl(...)` only if `TEST_DATABASE_URL` is set.
   - If `TEST_DATABASE_URL` is unset, the runner does not abort.
2. **Application Database Instantiation (`server/src/db/index.ts:13-16`):**
   ```typescript
   export const client = postgres(
     connectionString || "postgresql://postgres:postgres@localhost:5432/workpilot",
     { prepare: false }
   );
   export const db = drizzle(client, { schema });
   ```
   - When `DATABASE_URL` is undefined, `postgres(...)` is instantiated with the default fallback: `"postgresql://postgres:postgres@localhost:5432/workpilot"`.
   - `postgres-js` initializes client configuration lazily; no socket is opened until a query is executed.
3. **The Silent Execution Vulnerability:**
   - If a test author writes a database test that forgets to mock `db.select` / `db.update` / `db.insert`, or calls an endpoint executing raw SQL (such as `/api/health/readiness` which runs `db.execute(sql`select 1`)`):
   - The test will attempt a TCP connection to `localhost:5432`.
   - **Network Guard Gap:** The network sandbox in `setup.ts` intercepts only HTTP/HTTPS protocols (`globalThis.fetch`, `http.request`, `https.request`). It does not intercept raw TCP sockets (`net.Socket`).
   - If PostgreSQL happens to be running on `localhost:5432` on the host machine:
     - The test **will silently execute against the host's `workpilot` database** without any confirmation or isolation check.
   - If PostgreSQL is not running on `localhost:5432`:
     - The test fails with `ECONNREFUSED 127.0.0.1:5432`.
4. **The Mapping Disconnect:**
   - Even when a test runner sets `TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/workpilot_test"`, `setup.ts` validates it but **does not inject it** into `process.env.DATABASE_URL`.
   - As a result, `db/index.ts` continues to use its hardcoded default `"postgresql://postgres:postgres@localhost:5432/workpilot"`, ignoring the validated test database URL.

---

## 4. Full Test Suite Execution Proof

All 8 test files were verified offline and safe before running:
- **Command:** `npm test` (`vitest run`)
- **Working Directory:** `c:\Users\Admin\OneDrive\Desktop\unipile\server`
- **Results:**
  ```
   ✓ src/__tests__/unit/error-sanitization.test.ts (12 tests) 11ms
   ✓ src/__tests__/unit/webhook-auth.test.ts (10 tests) 16ms
   ✓ src/__tests__/unit/network-guard.test.ts (10 tests) 17ms
   ✓ src/__tests__/unit/crm-stage-defect.test.ts (6 tests) 24ms
   ✓ src/__tests__/unit/database-safety.test.ts (12 tests) 26ms
   ✓ src/__tests__/unit/tenant-isolation.test.ts (18 tests) 60ms
   ✓ src/__tests__/unit/migrated-legacy.test.ts (7 tests) 188ms
   ✓ src/__tests__/integration/http-routes.test.ts (27 tests) 253ms

   Test Files  8 passed (8)
        Tests  97 passed (97)
     Duration  6.98s
  ```
- **Exit Code:** `0`
- **TypeScript Check:** `npm run typecheck` passed with 0 errors (Exit Code 0).

---

## 5. Unresolved Decisions & Architectural Limitations (BLK-02)

**Neither Option A nor Option B has been selected.** The following architectural limitations and decisions remain pending:

| Area | Current Status | Limitation / Unresolved Risk | Option A Implication | Option B Implication |
|---|---|---|---|---|
| **Database Isolation** | 100% Mocked Queries | 0 tests execute against real PostgreSQL tables; SQL schema constraints and AST queries are unverified at driver level. | Retains pure mock isolation. Would add driver-level socket interceptor to fail closed on unmocked DB calls. | Requires automated disposable PostgreSQL container/loopback instance and test database provisioning. |
| **Test Database Mapping** | Disconnected | `TEST_DATABASE_URL` is validated if supplied, but never passed to `db/index.ts`. | Irrelevant (DB calls mocked). | Must inject validated URL into `client` configuration. |
| **Database Migrations** | Mocked in Tests | Migration scripts (`migrate.ts`, `apply-migrations.ts`) import `dotenv.config.js` and connect directly to Neon if executed via CLI. | Migrations remain manual/separate. | Requires a dedicated migration runner wrapped in `validateTestDatabaseUrl`. |
| **Row-Level Security (RLS)** | 0 Policies Active | All 13 tables have RLS disabled; tenant boundary relies 100% on application query filters (`where and(eq(id), eq(userId)))`. | Relies entirely on application-level and controller-level tests. | Adds defense-in-depth Postgres RLS policies for DB-level enforcement. |

---

## 6. Fresh Git Status & Working Tree Safety

```
Changes to be committed:
	deleted:    deploy.tar.gz

Changes not staged for commit:
	modified:   .dockerignore
	modified:   .github/workflows/deploy-production.yml
	modified:   .gitignore
	modified:   client/.dockerignore
	deploy/aws/deploy-remote.ps1
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

- **Staged Deletion Intact:** `deploy.tar.gz` remains staged for deletion.
- **No Destruction:** Zero database connections, Docker containers, migrations, commits, pushes, resets, or stashes were executed.
- **WP-04 Hold:** WP-04 remains blocked pending operator review of `BLK-01` and `BLK-02`.
