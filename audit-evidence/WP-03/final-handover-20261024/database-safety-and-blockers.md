# Work Package WP-03: Database Safety & Database-Level Isolation Blockers

**Target Commit Baseline:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Run ID:** `final-handover-20261024`  
**Document ID:** `WP-03-DB-SAFE-01`  
**Date:** 2026-10-24T17:58:00+05:30  
**Database Isolation Status:** **`BLOCKED (No local PostgreSQL service/container; zero production DB contact)`**  

---

## 1. Database Safety & Isolation Guards

### Rule 1: Never Use Production Database
Production Neon connection strings must never be reached by test runners under any circumstances.
- **Implementation in [`setup.ts:8-12`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts#L8-L12):**
  ```typescript
  // Strictly forbid test runner from inheriting or accessing cloud/production DATABASE_URL
  delete process.env.DATABASE_URL;
  ```
- **Fallback behavior in [`server/src/db/index.ts:13-16`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/index.ts#L13-L16):**
  When `DATABASE_URL` is undefined, postgres-js falls back to:
  `postgresql://postgres:postgres@localhost:5432/workpilot`
  Since port 5432 is closed on the host and no local PostgreSQL daemon is running, any accidental raw query will fail immediately on connection, guaranteeing that tests cannot reach cloud infrastructure.

### Rule 2: Dedicated TEST_DATABASE_URL Required
Tests requiring a real database must require an explicit `TEST_DATABASE_URL` variable.
- In [`setup.ts:15-24`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts#L15-L24):
  ```typescript
  if (process.env.TEST_DATABASE_URL) {
    const testUrl = process.env.TEST_DATABASE_URL.toLowerCase();
    if (testUrl.includes("neon.tech") || testUrl.includes("aws") || testUrl.includes("supabase")) {
      throw new Error(
        "[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL points to a remote/cloud database. Live tests must use a strictly local disposable database."
      );
    }
  }
  ```
- Tests **never** fall back from `TEST_DATABASE_URL` to `DATABASE_URL`.

### Rule 3: Multiple Independent Checks for Database Target Safety
A hostname or database name pattern alone (e.g. `localhost` or `test_db`) is **insufficient** to prove safety. When live database tests are authorized in the future, the test harness must perform four independent checks before executing any DDL/DML:
1. **Network Egress Boundary Check:** Verify that the connection target IP resolves strictly to `127.0.0.1` or `::1`.
2. **Sandbox Marker Table Check:** Query `SELECT is_isolated_test_sandbox FROM test_environment_marker`. If missing or false, abort immediately.
3. **Zero Production Data Verification:** Query `SELECT COUNT(*) FROM users WHERE email NOT LIKE '%@workpilot.test'`. If count > 0, abort immediately.
4. **Disposable Ephemeral Container Boundary:** Ensure the instance is running inside a temporary throwaway Docker/Podman container created specifically for the test run.

---

## 2. Why Database Row-Level Isolation Remains BLOCKED

### Host System State
1. **Docker / Container Engine:** Not installed or available on this Windows host.
2. **Local PostgreSQL Service (port 5432):** Inactive / closed (`TCP connection to 127.0.0.1:5432 failed: Connection refused`).
3. **Cloud Neon Database:** Strictly forbidden from being used as a test target.

### What the 58 Passing Tests DO Prove
- Express routing, route parameter decoding, request body parsing.
- Authentication token verification (`authenticate` middleware).
- Administrator authorization checks (`requireAdmin` middleware).
- Application-level tenant checks in controllers and services (`where(and(eq(userId, ...), eq(id, ...)))`).
- That unauthorized requests return `401`, `403`, or `404` with zero side effects.

### What the 58 Passing Tests DO NOT Prove (Explicit Limitation)
- **PostgreSQL Row-Level Security (RLS) policies.**
- **Real SQL query syntax correctness against a PostgreSQL parser.**
- **Foreign key cascades or database-level constraints.**
- **PostgreSQL transaction rollback and concurrency isolation.**

**Conclusion:** We explicitly **DO NOT claim PostgreSQL row-level isolation is proven**. This requirement remains **BLOCKED** until local database container infrastructure is provisioned and authorized.
