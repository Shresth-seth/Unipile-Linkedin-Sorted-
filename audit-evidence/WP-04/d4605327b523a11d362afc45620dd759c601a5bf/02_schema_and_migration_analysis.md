# Schema & Migration Analysis & Pipeline Unification
**Package:** WP-04: Protect Database Integrity  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Date:** October 25, 2026

---

## 1. Migration Inventory & Status

The repository contains 10 migration stages:

| Migration File | Description | Execution Mechanism | Verified Status |
| :--- | :--- | :--- | :--- |
| `0000_late_arclight.sql` | Core `users` & `linkedin_accounts` schema | Drizzle Journal | Pre-existing |
| `0001_nasty_bloodstrike.sql` | Initial `contacts` & `action_queue` tables | Drizzle Journal | Pre-existing |
| `0002_messy_thundra.sql` | LinkedIn daily limit enhancements | Drizzle Journal | Pre-existing |
| `0003_mature_cammi.sql` | System settings table | Drizzle Journal | Pre-existing |
| `0004_blue_veda.sql` | Agent memory message history | Drizzle Journal | Pre-existing |
| `0005_daily_agent_and_webhooks.sql` | Daily agent settings/runs & webhook inbox | Idempotent Custom Pipeline | Verified (`IF NOT EXISTS`) |
| `0006_message_jobs_and_daily_run_keys.sql` | Message agent jobs & run keys | Idempotent Custom Pipeline | Verified (`IF NOT EXISTS`) |
| `0007_user_gemini_api_key.sql` | BYOK Gemini key configuration | Idempotent Custom Pipeline | Verified (`IF NOT EXISTS`) |
| `0008_saas_billing.sql` | SaaS billing plans & performance indexes | Idempotent Custom Pipeline | Verified (`IF NOT EXISTS`) |
| `0009_agent_new_connection_message.sql` | Missing `daily_agent_settings` columns | Idempotent Custom Pipeline | **Added in WP-04** |

---

## 2. Identified Schema Divergence & Remediation

### Defect:
- In `server/src/db/schema.ts`, `dailyAgentSettings` defined:
  - `autoNewConnectionMessage: boolean("auto_new_connection_message").default(true).notNull()`
  - `newConnectionMessageTemplate: text("new_connection_message_template")`
- These two columns were absent from all prior migration SQL scripts (`0000` through `0008`).
- An ad-hoc script `server/manual-migrate.ts` was historically used to patch these columns outside of the versioned pipeline.

### Remediation:
1. Created official migration `server/src/db/migrations/0009_agent_new_connection_message.sql`.
2. Updated `server/src/db/apply-migrations.ts` to include `0009_agent_new_connection_message.sql` in its sequential execution chain.
3. Updated `server/src/db/migrate.ts` to automatically call `applyCustomMigrations()` after applying Drizzle journal migrations, unifying the migration workflow into a single deterministic command: `npm run db:migrate`.
4. Refactored `server/manual-migrate.ts` to delegate to the standard migration pipeline, eliminating divergence risks.

---

## 3. Migration Lock & Statement Timeouts
To prevent migration operations from blocking production tables indefinitely during lock contention:
- Configured statement and lock timeouts in both `migrate.ts` and `apply-migrations.ts`:
  ```sql
  SET statement_timeout = '60s';
  SET lock_timeout = '10s';
  ```
- If an exclusive table lock cannot be acquired within 10 seconds, the migration fails fast with an explicit error and exits with code 1, preventing application starvation.
