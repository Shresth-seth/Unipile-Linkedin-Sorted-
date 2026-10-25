# Destructive Script Safeguards & Connection Pool Budget
**Package:** WP-04: Protect Database Integrity  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Date:** October 25, 2026

---

## 1. Destructive Script Safeguards

### 1.1 `server/src/scripts/clear-all-users.ts`
- **Hazard:** Executes `DELETE FROM users`, triggering cascade deletion across all accounts, contacts, jobs, runs, and messages.
- **Safeguards Implemented:**
  1. **Mandatory Environment Flag:** Execution aborts with exit code 1 unless `CONFIRM_DESTRUCTIVE_DATABASE_WIPE="YES_DELETE_ALL_DATA"`.
  2. **Production Lockout:** In `NODE_ENV === "production"`, execution is strictly blocked unless explicitly authorized with `ALLOW_PRODUCTION_DATA_WIPE="true"`.
- **Verification Result:** Tested in `src/__tests__/unit/database-integrity.test.ts` (both missing flag and production lockout cases passed).

### 1.2 `server/drizzle.config.ts`
- **Hazard:** Previously contained a fallback `process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/workpilot"`.
- **Safeguard Implemented:** Replaced fallback with `postgresql://offline-blocked:5432/offline_blocked`, ensuring drizzle-kit operations fail closed if `DATABASE_URL` is omitted.

---

## 2. Connection Pool Budgeting & Configuration

### 2.1 Configuration Parameters ([server/src/db/index.ts](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/index.ts))
The PostgreSQL client supports environment-controlled connection pool parameters:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DB_POOL_MAX` | `10` | Maximum connections allocated per process instance |
| `DB_IDLE_TIMEOUT` | `20` (seconds) | Time before idle connections are closed to release pool slots |
| `DB_CONNECT_TIMEOUT` | `10` (seconds) | Maximum wait time to establish a new connection before failing |

### 2.2 Multi-Process Budget Allocation Guide
When running in production on managed PostgreSQL (e.g. Neon connection pooler limit of 50 connections):
- **API Web Service (e.g. 2 replicas):** `DB_POOL_MAX=10` per replica (20 connections total)
- **Background Worker Process:** `DB_POOL_MAX=5` (5 connections total)
- **Migration & Admin Tasks:** `DB_POOL_MAX=2` (isolated, short-lived)
- **Buffer for Overhead:** ~23 connections reserved for health checks and failovers.
