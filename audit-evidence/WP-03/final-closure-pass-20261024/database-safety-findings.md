# WP-03 Database Safety & Dotenv Interception Findings (Final Closure Pass)

**Target Commit Baseline:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Run ID:** `final-closure-pass-20261024`  
**Document ID:** `WP-03-DB-FINDINGS-02`  
**Date:** 2026-10-24T20:07:00+05:30  
**Database Isolation Status:** **`PARTIALLY VERIFIED (Test setup fails closed; live PostgreSQL RLS engine tests BLOCKED)`**  

---

## 1. Resolution of the Dotenv Safety Defect

### The Vulnerability Identified in Independent Audit
In earlier test harness iterations, `setup.ts` executed `delete process.env.DATABASE_URL`. However, when [`server/src/db/index.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/index.ts) was subsequently imported, line 1 evaluated `import "../config/dotenv.config.js"`. This called `dotenv.config()`, which detected `DATABASE_URL` as unset and **re-injected** it from [`server/.env`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/.env). Although tests did not connect to the cloud database because all queries were mocked with `vi.spyOn`, the client instance held the cloud connection string rather than loopback.

### Robust Test-Only Fix Implemented
In [`server/src/__tests__/setup.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts), `dotenv.config` and `dotenv.parse` are intercepted at module startup:

```typescript
// Strictly forbid test runner from inheriting or accessing cloud/production DATABASE_URL
delete process.env.DATABASE_URL;

// Intercept dotenv.config to prevent re-injection from server/.env, root .env, or any .env file
const nativeDotenvConfig = dotenv.config;
dotenv.config = function (options?: any) {
  const result = nativeDotenvConfig.call(dotenv, options);
  if (result?.parsed && "DATABASE_URL" in result.parsed) {
    delete result.parsed.DATABASE_URL;
  }
  delete process.env.DATABASE_URL;
  return result;
};

// Intercept dotenv.parse to sanitize parsed key-value pairs
const nativeDotenvParse = dotenv.parse;
dotenv.parse = function (src: any) {
  const parsed = nativeDotenvParse.call(dotenv, src);
  if (parsed && "DATABASE_URL" in parsed) {
    delete parsed.DATABASE_URL;
  }
  return parsed as any;
} as any;
```

### Empirical Regression Proof
Dedicated unit tests in [`server/src/__tests__/unit/database-safety.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/database-safety.test.ts) prove:
1. `process.env.DATABASE_URL` is `undefined` at runner startup.
2. Calling `dotenv.config()` leaves `process.env.DATABASE_URL` as `undefined`.
3. Calling `dotenv.config({ override: true })` leaves `process.env.DATABASE_URL` as `undefined`.
4. Dynamic `import("../../config/dotenv.config.js")` does not re-inject `DATABASE_URL`.
5. Calling `dotenv.parse(fakeEnv)` removes `DATABASE_URL` from parsed output.
6. In [`server/src/db/index.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/index.ts), `client.options.host` evaluates strictly to `['localhost']` and port `[5432]`.

---

## 2. Test Database URL Validation Rules

To prevent tests from accidentally using a cloud database when `TEST_DATABASE_URL` is set, `setup.ts` enforces `validateTestDatabaseUrl`:
1. **Cloud Target Rejection:** If `TEST_DATABASE_URL` contains `neon.tech`, `aws`, `supabase`, or `rds.amazonaws.com`, it immediately throws `[DATABASE HAZARD BLOCKED]`.
2. **Loopback Host Requirement:** Target hostname must resolve strictly to `localhost`, `127.0.0.1`, or `::1`.
3. Tested and verified in [`database-safety.test.ts:55-82`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/database-safety.test.ts#L55-L82).

---

## 3. Why Engine-Level Isolation Remains BLOCKED

- **Host System Constraints:** Docker is not installed, and no local PostgreSQL daemon is running (port 5432 connection refused).
- **Prohibited Actions:** Connecting to production Neon is strictly forbidden.
- **Audit Truth:** While application-level scoping is 100% verified across 79 unit/integration tests, **true database engine row-level isolation (PostgreSQL RLS policies, triggers, raw SQL constraints) remains BLOCKED** until a local containerized PostgreSQL instance is provisioned by an authorized operator.
