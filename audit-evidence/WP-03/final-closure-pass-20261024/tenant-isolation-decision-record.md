# Architectural Decision Record: Tenant Isolation Strategy & Migration Safety
## Option A (PostgreSQL RLS) vs Option B (Application-Level Query Scoping)

**Target Commit Baseline:** `d4605327b523a11d362afc45620dd759c601a5bf` (branch `main`)  
*Notice: This Git hash identifies the upstream repository commit where the readiness audit began. Uncommitted working-tree modifications, remediations, and audit evidence are preserved locally in the working tree and have not been committed.*  
**Run ID:** `final-closure-pass-20261024`  
**Document ID:** `WP-03-ADR-TENANT-ISOLATION-01`  
**Timestamp:** 2026-10-24T22:15:00+05:30  
**Overall Readiness Status:** **`PARTIALLY COMPLETE (Design Document Only; No Code Executed)`**  
**BLK-02 Status:** **`BLOCKED (Awaiting Operator Architectural Selection)`**  
**WP-02 Status:** **`BLOCKED`**  
**Cloud Credential Rotation:** **`PENDING AUTHORIZED OPERATOR ACTION`**  
**Production Readiness:** **`NOT READY`**  
**Next Work Package:** **`DO NOT START WP-04`**

---

## 1. Context & Problem Statement

Work Package WP-03 requires multi-tenant isolation across CRM contacts, LinkedIn accounts, conversations, background action queues, and AI configuration keys. The recent technical review ([`blk-02-readiness-review.md`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-03/final-closure-pass-20261024/blk-02-readiness-review.md)) proved that:
1. **Actual PostgreSQL Row Level Security (RLS) policies are currently non-existent** in [`server/src/db/schema.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/schema.ts) and migration files.
2. Tenant isolation in WorkPilot is currently enforced **exclusively at the application layer** via explicit Drizzle ORM query filters (`where(and(eq(table.userId, authUserId), ...))`).
3. Standard database tooling (`drizzle.config.ts`, `migrate.ts`, `apply-migrations.ts`) contains an active cloud connection hazard by automatically importing `dotenv.config.js` and reading `server/.env`.

To resolve BLK-02 safely, engineering leadership must choose between two architectural patterns:
- **Option A:** Implement native PostgreSQL engine-level Row Level Security (RLS).
- **Option B:** Formalize and harden Application-Level Tenant Scoping with defense-in-depth.

---

## 2. In-Depth Comparative Evaluation

| Architectural Dimension | Option A: PostgreSQL Row Level Security (RLS) | Option B: Application-Level Tenant Scoping (Current) |
|---|---|---|
| **Enforcement Point** | Database Engine Kernel (`pg_policy` in PostgreSQL) | Application Layer (Drizzle ORM queries in Node.js) |
| **Session / Transaction Context Requirements** | **High Overhead:** Requires executing `SET LOCAL app.current_tenant_id = :userId` inside an explicit transaction block (`BEGIN ... COMMIT`) for **every** request. | **Zero Database Overhead:** Context is derived from validated JWT in memory (`req.user.userId`) and passed into query parameters. |
| **Neon / PgBouncer Pooling Compatibility** | **High Risk:** In transaction-mode connection pooling (Neon pooler), session-level `SET` commands contaminate subsequent transactions on reused connections unless strictly wrapped in `SET LOCAL` within transactions. | **Fully Compatible:** Completely stateless at the connection level; works seamlessly with transaction-mode pooling. |
| **Database-Role Privileges** | **Complex Role Architecture:** The app must connect as a non-superuser, non-table-owner role (e.g. `workpilot_app`). Superusers and table owners (`neondb_owner`) bypass RLS unless `FORCE ROW LEVEL SECURITY` is applied. | **Standard Role:** Connects as standard application user; permissions managed via schema grants. |
| **Cross-Tenant Admin & Worker Access** | **Complex Bypass Logic:** Requires special RLS bypass policies or super-role impersonation for background workers (`ActionQueueWorker`), cron jobs, and admin routes (`requireAdmin`). | **Straightforward:** Admin endpoints omit tenant filters or inspect explicit `userId` route parameters with role guards. |
| **Threat Model Protection** | • Protects against SQL injection bypassing `WHERE` clauses.<br>• Protects against developer omission of `where(eq(..., userId))`.<br>• Protects against direct database access via compromised app credentials. | • Protects against HTTP/API IDOR cross-tenant access.<br>• Protects against unauthorized state mutations.<br>• Protects against data leakage via verified 404/403 responses. |
| **Migration & Refactoring Impact** | **Severe:** Requires writing SQL migrations for RLS policies across 11 tables, altering table ownership/grants, and refactoring every controller, service, and worker to use transaction wrappers. | **Zero Schema Impact:** All 11 tables already possess `user_id` foreign keys; 79 automated regression tests already verify application-level scoping. |
| **Rollback Strategy** | Run migration: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY; DROP POLICY ...`. High blast radius if connection pooling breaks. | Zero rollback required; native baseline code. |

---

## 3. Engineering Recommendation & Rationalization

### Recommendation: **Option B (Application-Level Tenant Scoping with Automated Verification)**
Option B is recommended as the official architecture for closing WP-03, with Option A designated as an optional future compliance hardening milestone.

### Key Justifications & Assumptions:
1. **Neon Serverless Pooling Reality:** WorkPilot's database infrastructure relies on Neon serverless pooling over port 5432 / pooler endpoints. Implementing Option A in transaction-pooling environments requires wrapping every single read operation (even simple `SELECT` queries) in a database transaction with `SET LOCAL`. This would increase database round-trips by 200–300%, elevate connection latency, and substantially increase transaction contention.
2. **Empirical Verification Exists:** The existing test suite already contains **79 fully passing offline tests** (including 27 HTTP route integration tests) proving that cross-tenant access returns `HTTP 404 Not Found`, causes **zero** database mutations, and causes **zero** provider side effects.
3. **Primary Security Hazard is Credential Exposure, Not RLS:** The immediate critical risk to WorkPilot is the exposed production credentials in historical commits and `deploy.tar.gz` (BLK-03), not SQL injection. Adding engine RLS does not fix leaked cloud credentials.
4. **Pragmatic Path to WP-03 Closure:** Formally accepting Option B allows BLK-02 to be reclassified from "PostgreSQL Engine RLS" to "Live Local Database Schema & Referential Integrity Verification", which can be executed safely in a throwaway container without architectural churn.

---

## 4. Threat Model Analysis

### Threats Addressed by Option B:
- **T-01: Direct HTTP IDOR (Insecure Direct Object Reference):** An attacker (Tenant B) crafts an HTTP request targeting Tenant A's contact ID, conversation, or LinkedIn account.  
  *Mitigation:* Authenticated JWT extracts `userId`. Query strictly enforces `where(and(eq(table.id, targetId), eq(table.userId, authUserId)))`. Returns `HTTP 404`. Verified by tests `ISO-CRM-01` through `ISO-CRM-03`, `ISO-MSG-01` through `ISO-MSG-03`.
- **T-02: Unauthorized State Mutation:** An attacker attempts to change contact stage or take over a conversation belonging to another tenant.  
  *Mitigation:* Drizzle `update` query condition matches zero rows; controller returns 404; state in database remains unchanged. Verified by positive/negative controls.
- **T-03: Provider Side-Effect Injection:** An attacker attempts to trigger a LinkedIn message or solve a checkpoint on an unowned account.  
  *Mitigation:* Execution aborts on 404 before calling `linkedInMessageService` or `linkedInAccountService`. Provider mock calls remain zero.

### Residual Threats Requiring Governance (Accepted Risks of Option B):
- **T-04: Developer Omission of `userId` in New Queries:** A developer writes a new endpoint and forgets the `where(eq(..., userId))` condition.  
  *Governance Mitigation:* Mandatory CI regression test requiring every new route to have an unauthenticated and cross-tenant negative test in `http-routes.test.ts`.
- **T-05: Raw Database Credential Access:** An attacker with direct database connection string credentials connects via `psql`.  
  *Governance Mitigation:* Database network access restricted via VPC/IP allowlisting; credentials rotated per BLK-03.

---

## 5. Security Test Suite Specification (Positive & Negative Matrix)

When verifying Option B against a disposable local database, the following matrix must be executed:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        OPTION B SECURITY VERIFICATION MATRIX                           │
├─────────┬──────────────────────┬───────────────────────────────────────────────────────┤
│ Test ID │ Test Scenario        │ Expected Outcome & Concrete Invariant                 │
├─────────┼──────────────────────┼───────────────────────────────────────────────────────┤
│ SEC-POS1│ Tenant A Reads Own   │ Returns Tenant A records with HTTP 200 OK.            │
│         │ Resource             │ Data contains only Tenant A ownership tags.           │
├─────────┼──────────────────────┼───────────────────────────────────────────────────────┤
│ SEC-POS2│ Tenant A Updates Own │ Mutates record to new state; returns HTTP 200 OK.     │
│         │ Resource             │ Provider side-effect (if any) invoked exactly once.   │
├─────────┼──────────────────────┼───────────────────────────────────────────────────────┤
│ SEC-NEG1│ Tenant B Reads       │ Query returns zero rows; API returns HTTP 404.        │
│         │ Tenant A Resource    │ Zero bytes of Tenant A data in response payload.      │
├─────────┼──────────────────────┼───────────────────────────────────────────────────────┤
│ SEC-NEG2│ Tenant B Mutates     │ Query matches zero rows; API returns HTTP 404.        │
│         │ Tenant A Resource    │ Database record remains unmutated (verified in DB).   │
├─────────┼──────────────────────┼───────────────────────────────────────────────────────┤
│ SEC-NEG3│ Tenant B Provider    │ API returns HTTP 404; zero outbound API calls         │
│         │ Action on Tenant A   │ (Unipile / LinkedIn mock calls === 0).                │
├─────────┼──────────────────────┼───────────────────────────────────────────────────────┤
│ SEC-INT1│ Foreign Key Cascade  │ Deleting Tenant A user deletes all associated contacts│
│         │ Integrity            │ and accounts automatically via ON DELETE CASCADE.     │
└─────────┴──────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 6. Specification: Fail-Closed Test-Only Migration Runner

### Problem with Current Tooling:
`server/drizzle.config.ts`, `server/src/db/migrate.ts`, and `server/src/db/apply-migrations.ts` all import `dotenv.config.js`. Running them on a workstation loads `server/.env` and risks connecting to cloud Neon.

### Safe Design Specification (`server/src/__tests__/helpers/test-migration-runner.ts`):
1. **Zero External Dotenv Imports:** Does NOT import `dotenv`, `dotenv.config.js`, or any `.env` file.
2. **Explicit Parameter Passing:** Accepts target connection string strictly as an explicit function argument (`runIsolatedTestMigrations(targetUrl: string)`).
3. **Fail-Closed Target Validation:** Validates `targetUrl` using `validateTestDatabaseUrl`:
   - Immediately throws `[DATABASE HAZARD BLOCKED]` if target URL contains `neon.tech`, `aws`, `supabase`, `rds.amazonaws.com`, or any non-loopback hostname.
4. **Ephemeral Connection Pool:** Instantiates a standalone `postgres(targetUrl, { max: 1 })` client, applies migrations using `drizzle-orm/postgres-js/migrator`, and closes the client in a mandatory `finally` block.

### Verification of the Test-Only Runner:
A dedicated unit test in `server/src/__tests__/unit/database-safety.test.ts` will verify that:
1. Attempting to call `runIsolatedTestMigrations` with a Neon URL throws `[DATABASE HAZARD BLOCKED]` without establishing a network connection.
2. Calling `runIsolatedTestMigrations` does not read or re-inject `process.env.DATABASE_URL`.

---

## 7. Status & Prerequisites Summary

- **Document Status:** Complete Architecture & Design Decision Record.
- **Code State:** No application code modified. No database started.
- **Git State:** 100% preserved (`D deploy.tar.gz` staged, 20 unstaged modified files, untracked evidence intact).
- **Blockers:**
  - **BLK-01 (WP-02):** `BLOCKED` (Awaiting human audit review).
  - **BLK-02 (Database):** `BLOCKED` (Awaiting operator decision between Option A and Option B).
  - **BLK-03 (Credentials):** `PENDING AUTHORIZED OPERATOR ACTION` (Cloud console rotation required).
  - **Production Readiness:** `NOT READY`.
  - **WP-04:** `DO NOT START`.
