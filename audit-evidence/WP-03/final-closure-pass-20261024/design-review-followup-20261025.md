# Independent Design Review: Tenant Isolation, Database Safety & Boundary Verification
**Document ID:** `WP-03-DESIGN-REVIEW-FOLLOWUP-20261025`  
**Date:** 2026-10-25T14:15:00+05:30  
**Baseline Git Commit:** [`d4605327b523a11d362afc45620dd759c601a5bf`](file:///c:/Users/Admin/OneDrive/Desktop/unipile) (`Initial commit: unipile-linkedin-automation project`, branch `main`)  
**Working Tree Status:** Preserved (1 staged deletion `deploy.tar.gz`, 20 modified files, 7 untracked paths)  
**Readiness Status:** **`PARTIALLY VERIFIED (Design Review Complete; No Application Code Modified)`**  
**BLK-01 Status:** **`BLOCKED (Awaiting Human Operator Acceptance of WP-02 Dossier)`**  
**BLK-02 Status:** **`BLOCKED / UNVERIFIED (PostgreSQL RLS Non-Existent; Live Engine Unverified)`**  
**BLK-03 Status:** **`PENDING AUTHORIZED OPERATOR ACTION (Cloud Credential Rotation)`**  
**Production Readiness:** **`NOT READY`**  
**Gating Rule:** **`DO NOT START WP-04`**

---

## 1. Executive Summary & Review Scope

Following the authorization for Step 5, this read-only engineering and security design review evaluates the concrete technical state of WorkPilot's customer boundaries, database initialization, URL safety validators, and test harnesses.

### Primary Audit Findings:
1. **PostgreSQL Row Level Security (RLS) is Completely Non-Existent:**
   - A full inspection of [`server/src/db/schema.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/schema.ts) and all 9 migration scripts (`0000_late_arclight.sql` through `0008_saas_billing.sql`) reveals **zero** RLS policies, **zero** `ENABLE ROW LEVEL SECURITY` statements, and **zero** `CREATE POLICY` definitions.
   - Foreign key constraints (`REFERENCES users(id) ON DELETE CASCADE`) enforce referential integrity on user deletion, but **do not** enforce query scoping or row-level tenant barriers in PostgreSQL.
2. **Unscoped Writes Discovered in Application Code:**
   - Multiple background and controller write paths omit `userId` scoping in their `WHERE` clauses:
     - [`queue.service.ts:193-200`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/queue/queue.service.ts#L193-L200) and line 222: `await db.update(contacts)...where(eq(contacts.id, job.contactId))` omits `contacts.userId`.
     - [`agent.controller.ts:572`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/agent.controller.ts#L572): `await db.update(contacts)...where(eq(contacts.id, contact.id))` omits `contacts.userId`.
   - In the absence of PostgreSQL RLS, the database engine will not trap or block these unscoped mutations.
3. **`validateTestDatabaseUrl` Edge-Case Vulnerabilities:**
   - The validation helper in [`server/src/__tests__/setup.ts:33-61`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts#L33-L61) silently returns on missing/empty input (`if (!url) return;`), rejects valid bracketed IPv6 loopbacks (`[::1]`) due to a Node.js `URL` hostname mismatch (`"[::1]" !== "::1"`), and lacks database protocol enforcement (`postgresql:` / `postgres:`).
4. **Standalone Script & Migration Hazard Outside Vitest:**
   - The fail-closed dotenv interception and network killswitches exist **exclusively inside Vitest** ([`setup.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts)).
   - Standalone CLI scripts (`migrate.ts`, `apply-migrations.ts`, `drizzle.config.ts`, `clear-all-users.ts`, `reset-admin.ts`, `assign-admin.ts`) directly evaluate `import "../config/dotenv.config.js"`, loading [`server/.env`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/.env). Running any of these via `node` or `tsx` connects to the cloud Neon database. Specifically, `clear-all-users.ts` executes an unprompted `DELETE FROM users`.
5. **100% Mocked Database Coverage vs 0% Real Engine Coverage:**
   - All 79 passing tests in the Vitest suite mock `db.select`, `db.update`, and `db.insert` via in-memory spies (`vi.spyOn`). Exactly zero queries, transactions, or migrations have been executed against a real PostgreSQL engine.
   - Out of 155 AST-declared route paths, only 27 are tested in [`http-routes.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/integration/http-routes.test.ts); 128 route endpoints remain without automated negative cross-tenant tests.

---

## 2. In-Depth Inspection of `validateTestDatabaseUrl` & Unit Tests

### Code Inspection: [`server/src/__tests__/setup.ts:33-61`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts#L33-L61)
```typescript
export function validateTestDatabaseUrl(url?: string | null): void {
  if (!url) return;
  const lower = url.toLowerCase();
  // Multiple independent rejection checks:
  // 1. Cloud provider keywords
  if (
    lower.includes("neon.tech") ||
    lower.includes("aws") ||
    lower.includes("supabase") ||
    lower.includes("rds.amazonaws.com")
  ) {
    throw new Error(
      `[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL points to a remote/cloud database target '${url}'. Live tests must use a strictly local disposable database.`
    );
  }
  // 2. Must resolve strictly to loopback host
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
      throw new Error(
        `[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL points to non-loopback host '${host}'. Offline testing forbids remote databases.`
      );
    }
  } catch (err: any) {
    if (err.message.includes("[DATABASE HAZARD BLOCKED]")) throw err;
    throw new Error(`[DATABASE HAZARD BLOCKED] Invalid TEST_DATABASE_URL: ${err.message}`);
  }
}
```

### Edge-Case Analysis:

| Scenario / Edge Case | Current Behavior | Safety Impact | Fail-Closed Assessment |
|---|---|---|:---:|
| **Missing / Undefined / Empty URL** (`url === undefined`, `""`) | Line 34 evaluates `if (!url) return;` and returns silently with `undefined`. | If a caller (such as a migration runner) assumes `validateTestDatabaseUrl` enforces that a valid URL was provided, it silently passes. | **FAILS OPEN** (Vulnerable if caller lacks separate truthiness assertion) |
| **Protocol Validation** (`http://localhost:5432`, `ftp://localhost:5432`) | `parsed.protocol` is never inspected. Any non-PostgreSQL scheme pointing to `localhost` passes host check without error. | Non-Postgres protocols pass validation. | **PARTIAL** (Blocks non-loopback, but accepts wrong protocols) |
| **IPv4 Standard Loopback** (`postgresql://user:pass@127.0.0.1:5432/db`) | `parsed.hostname` evaluates to `"127.0.0.1"`. Matches whitelist. | Properly allowed. | **SAFE** |
| **IPv4 Alternate Loopback** (`127.0.0.2`, `127.1`, `2130706433`) | In Node.js URL parser, hostname is `"127.0.0.2"` or `"127.1"`. Condition `host !== "127.0.0.1"` triggers error. | Throws `[DATABASE HAZARD BLOCKED]`. | **FAILS CLOSED** (Safe, strict whitelist) |
| **IPv6 Standard Bracketed Loopback** (`postgresql://user:pass@[::1]:5432/db`) | In WHATWG URL standard, Node.js `new URL(...).hostname` returns `"[::1]"` (with brackets). Condition checks `host !== "::1"`. Because `"[::1]" !== "::1"`, it triggers error. | Throws `[DATABASE HAZARD BLOCKED]` on valid IPv6 bracketed loopback syntax. | **FAILS CLOSED** (Safe against leaks, but defect in IPv6 parsing) |
| **Malformed URL String** (`"invalid string"`, `"://bad"`) | `new URL(url)` throws `TypeError`. Caught by line 118-120 and re-thrown as `[DATABASE HAZARD BLOCKED] Invalid TEST_DATABASE_URL: ...`. | Rejected safely. | **FAILS CLOSED** |
| **Keyword Substring False-Positives** (`postgresql://aws_user:secret@localhost:5432/db`) | Line 38 evaluates `lower.includes("aws")` on the *entire* URL string (including credentials and database name). | A local database username or password containing `"aws"` is blocked even though the target is `localhost`. | **FAILS CLOSED** (Safe, but overly broad regex match) |
| **Subdomain Spoofing** (`postgresql://localhost.attacker.com:5432/db`) | `parsed.hostname` is `"localhost.attacker.com"`. Does not match whitelist. | Rejected safely. | **FAILS CLOSED** |
| **URL Userinfo Confusion** (`postgresql://localhost@attacker.com:5432/db`) | `parsed.hostname` is `"attacker.com"`. Userinfo is `"localhost"`. Host is rejected. | Rejected safely. | **FAILS CLOSED** |

### Existing vs Missing Unit Tests:
- **Existing Coverage ([`database-safety.test.ts:60-86`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/database-safety.test.ts#L60-L86)):**
  - Asserts rejection of `neon.tech`, `rds.amazonaws.com`, `supabase`, and `198.51.100.25`.
  - Asserts allowance of `localhost` and `127.0.0.1`.
- **Missing Tests:**
  - Zero tests for missing, empty, or `undefined` arguments.
  - Zero tests for IPv6 `[::1]` syntax (which currently fails).
  - Zero tests for invalid protocols (`http:`, `file:`, `redis:`).
  - Zero tests for malformed URL strings.
  - Zero tests for URL userinfo/subdomain spoofing (`localhost@evil.com`).

---

## 3. Database Initialization & Dotenv Import Pathways

### Active Source Code Inventory:

1. **Application Connection Entrypoint ([`server/src/db/index.ts:1-18`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/index.ts#L1-L18)):**
   - Line 1: `import "../config/dotenv.config.js";`
   - Line 6-16: Reads `process.env.DATABASE_URL?.trim()`. In production (`NODE_ENV === "production"`), throws if unset. In development/test, falls back to `"postgresql://postgres:postgres@localhost:5432/workpilot"`.
   - Exported objects: `client` (postgres-js instance) and `db` (Drizzle ORM instance).
2. **Drizzle Kit Configuration ([`server/drizzle.config.ts:1-12`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/drizzle.config.ts#L1-L12)):**
   - Line 2: `import "./src/config/dotenv.config.js";`
   - Line 9: `dbCredentials: { url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/workpilot" }`
   - **Hazard:** Running `npx drizzle-kit push` or `npx drizzle-kit studio` directly evaluates `dotenv.config.js`, reads [`server/.env`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/.env), and connects to cloud Neon without confirmation.
3. **Migration Runner Scripts:**
   - [`server/src/db/migrate.ts:1-6`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/migrate.ts#L1-L6): Line 1 imports `dotenv.config.js`; line 5 imports `db, client from "./index.js"`. Automatically runs `migrate(db, ...)` against `process.env.DATABASE_URL`.
   - [`server/src/db/apply-migrations.ts:1-5`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/apply-migrations.ts#L1-L5): Line 1 imports `dotenv.config.js`; line 5 imports `client from "./index.js"`. Executes raw SQL statements from migrations `0005` through `0008` against `process.env.DATABASE_URL`.
4. **Destructive Administrative Utility Scripts:**
   - [`server/src/scripts/clear-all-users.ts:1-50`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/clear-all-users.ts#L1-L50): Line 1 imports `dotenv.config.js`; line 6 reads `process.env.DATABASE_URL`. Line 40 executes `await db.execute(sql\`DELETE FROM users\`);`. Because tables reference `users` with `ON DELETE CASCADE`, running `npm run db:clear-users` completely deletes all contacts, accounts, messages, settings, and runs in the targeted database!
   - [`server/src/scripts/reset-admin.ts:1-38`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/reset-admin.ts#L1-L38): Line 1 imports `dotenv.config.js`; line 26 executes raw `UPDATE users SET password = ...`.
   - [`server/src/scripts/assign-admin.ts:1-60`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/assign-admin.ts#L1-L60): Line 1 imports `dotenv.config.js`; line 34 executes raw `UPDATE users SET role = 'ADMIN'`.

### The Boundary of `setup.ts`:
- [`server/src/__tests__/setup.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts) patches `dotenv.config` and `dotenv.parse` and deletes `process.env.DATABASE_URL`.
- However, `setup.ts` is **only** loaded by Vitest when executing `npm test` or `npx vitest`.
- It does **not** protect `node`, `tsx`, or `npx drizzle-kit` executions from the terminal. Any CLI invocation of `npm run db:migrate` or `npm run db:push` will load production environment variables.

---

## 4. Drizzle Schema & Migrations Inspection: RLS Verification

### Detailed Schema Analysis ([`server/src/db/schema.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/schema.ts)):

The application defines 13 PostgreSQL tables:
1. `users` (Core identity, authentication, plan, role)
2. `linkedinAccounts` (FK: `userId` -> `users.id` ON DELETE CASCADE)
3. `contacts` (FK: `userId` -> `users.id` ON DELETE CASCADE)
4. `dailyAgentSettings` (FK: `userId` -> `users.id` ON DELETE CASCADE, UNIQUE)
5. `dailyAgentRuns` (FK: `userId` -> `users.id` ON DELETE CASCADE)
6. `webhookEvents` (FK: `userId` -> `users.id` ON DELETE SET NULL)
7. `messageAgentJobs` (FK: `userId` -> `users.id` ON DELETE CASCADE)
8. `messages` (FK: `userId` -> `users.id` ON DELETE CASCADE; FK: `contactId` -> `contacts.id` ON DELETE CASCADE)
9. `actionQueue` (FK: `userId` -> `users.id` ON DELETE CASCADE; FK: `contactId` -> `contacts.id` ON DELETE SET NULL)
10. `systemSettings` (Global key-value table; FK: `updatedBy` -> `users.id` ON DELETE SET NULL)
11. `billingEvents` (Global webhook event log; NO `userId` column)
12. `authTokens` (FK: `userId` -> `users.id` ON DELETE CASCADE)
13. `agentMessages` (FK: `userId` -> `users.id` ON DELETE CASCADE)

### Search Verification for RLS & Policies:
- Ripgrep pattern `ROW LEVEL SECURITY` across `server/src/db/`: **0 results**.
- Ripgrep pattern `POLICY` across `server/src/db/`: **0 results**.
- Ripgrep pattern `ENABLE ROW LEVEL` across all `.sql` migration files: **0 results**.

### Architectural Distinction: Referential Integrity vs Row Level Security:
- **Referential Integrity (Foreign Keys):** Guarantees that orphan rows do not persist when a parent `users` record is deleted (`ON DELETE CASCADE`). It has zero influence over `SELECT`, `UPDATE`, or `DELETE` operations during standard queries.
- **Row Level Security (RLS):** Operates inside the PostgreSQL kernel. When enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`), PostgreSQL inspects every query and automatically appends policy filters (e.g. `USING (user_id = current_setting('app.current_tenant_id'))`).
- **Conclusion:** **PostgreSQL RLS is completely absent.** The system relies 100% on application-level TypeScript `where(eq(..., userId))` filters.

---

## 5. Query Scoping & Authorization Audit Across Application Paths

### A. Controllers & Services: Scoped vs Unscoped Paths

1. **CRM Operations ([`server/src/services/crm/crm.service.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/crm/crm.service.ts)):**
   - `getFunnelAnalytics`: Line 26 enforces `where(eq(contacts.userId, userId))`.
   - `updateContactStage`: Line 136 enforces `where(and(eq(contacts.userId, userId), eq(contacts.id, contactId)))`. Throws `NotFoundError` if zero rows are updated, returning HTTP 404.
   - `getContactsByStage`: Line 152 enforces `where(and(eq(contacts.userId, userId), eq(contacts.status, stage)))`.
   - **Verdict:** Properly scoped in CRM service.
2. **Conversation Operations ([`server/src/controllers/conversation.controller.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/conversation.controller.ts)):**
   - `getConversationHistory`: Line 43 selects contact with `and(eq(contacts.id, validContactId), eq(contacts.userId, userId))`. If missing, returns 404. Line 58 queries messages with `and(eq(messages.contactId, validContactId), eq(messages.userId, userId))`.
   - `takeOverConversation`: Line 93 updates contact with `and(eq(contacts.id, validContactId), eq(contacts.userId, userId))`. If missing, returns 404.
   - `sendManualReply`: Line 136 selects contact with `and(eq(contacts.id, validContactId), eq(contacts.userId, userId))`.
   - **Verdict:** Properly scoped in conversation controller.
3. **LinkedIn Account Operations ([`server/src/controllers/linkedin.controller.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/linkedin.controller.ts)):**
   - Line 26-54: `resolveUserUnipileAccountId(userId)` selects `linkedinAccounts` filtered strictly by `where(eq(linkedinAccounts.userId, userId))`.
   - `getConnectedLinkedInAccount`, `getProfile`, `getAccountStatus`: All derive `userId` from `resolveUserId(req)` (which pulls from validated JWT) and query solely through `resolveUserUnipileAccountId(userId)`.
   - **Verdict:** Properly scoped for authenticated user routes.

### B. Discovered Unscoped Writes in Application Logic

1. **Unscoped Contact Update in Action Queue ([`server/src/services/queue/queue.service.ts:193-200`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/queue/queue.service.ts#L193-L200) & Line 222):**
   ```typescript
   if (job.actionType === "CONNECT") {
     ...
     if (job.contactId) {
       await db
         .update(contacts)
         .set({
           status: "CONTACTED",
           connectionSentAt: new Date(),
           updatedAt: new Date(),
         })
         .where(eq(contacts.id, job.contactId)); // <--- MISSING eq(contacts.userId, job.userId)
     }
   }
   ```
   - **Finding:** The update query targets `contacts` solely by `eq(contacts.id, job.contactId)`. If an action queue entry contains a foreign `contactId`, the worker mutates another user's contact record.
2. **Unscoped Contact Update in Draft Reply Approval ([`server/src/controllers/agent.controller.ts:564-573`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/agent.controller.ts#L564-L573)):**
   ```typescript
   // Clear draft on contact
   await db
     .update(contacts)
     .set({
       draftReply: null,
       draftReplyReason: null,
       lastMessageSentAt: new Date(),
       updatedAt: new Date(),
     })
     .where(eq(contacts.id, contact.id)); // <--- MISSING eq(contacts.userId, userId)
   ```
   - **Finding:** While `contact` was read with `userId` at line 522, the subsequent write query omits the tenant filter. In contrast, `rejectDraftReply` at line 612 correctly enforces `where(and(eq(contacts.userId, userId), eq(contacts.id, contactId)))`.

### C. Admin Routes & Authorization Auditing ([`server/src/controllers/admin.controller.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/admin.controller.ts))
- **Cross-Tenant Queries by Design:** Endpoints such as `adminDisconnectAccount` (line 312) and `adminCheckAccountHealth` (line 378) query accounts directly:
  `where(sql\`${linkedinAccounts.id} = ${id}\`)`
- **Authorization Guard:** Protected by [`requireAdmin`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/middlewares/admin.middleware.ts), which queries `users.role === 'ADMIN'` or checks `ADMIN_EMAILS`.
- **Audit Logging Defect:** All administrative mutations (disconnecting accounts, forcing runs) write log statements solely via `console.log(...)`. There is **no persistent audit trail table** in PostgreSQL. In a production incident, admin actions cannot be audited if container logs rotate or are lost.

### D. Background Jobs & Workers
1. **`DailyAgentWorker` ([`server/src/agent/daily/daily-agent.worker.ts:27-31`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/agent/daily/daily-agent.worker.ts#L27-L31)):**
   - The automatic 4:00 AM daily connection runner is permanently disabled in code (`return { checkedCount: 0, executedCount: 0 };`).
2. **`ActionQueueService.processDueActions` ([`server/src/services/queue/queue.service.ts:82-113`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/queue/queue.service.ts#L82-L113)):**
   - When invoked without an explicit `userId` (i.e. by a multi-tenant cron job), the query fetches 10 queued jobs across **all** tenants (`where(and(eq(actionQueue.status, "QUEUED"), lte(actionQueue.scheduledFor, now)))`).
   - While the loop resolves each user's LinkedIn account using `job.userId`, the unscoped contact updates noted above represent a cross-tenant mutation risk.

### E. Webhook Ingestion & Tenant Mapping
1. **Inbound Webhook Authentication ([`server/src/services/webhook/webhook-auth.service.ts:13-16`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/webhook/webhook-auth.service.ts#L13-L16)):**
   - If `process.env.UNIPILE_WEBHOOK_SECRET` is unset, `verifyWebhookRequest` automatically returns `{ valid: true }` in non-production environments (`NODE_ENV !== "production"`).
2. **Tenant Resolution ([`server/src/services/webhook/unipile-message-agent.service.ts:83-95`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/webhook/unipile-message-agent.service.ts#L83-L95)):**
   - Maps inbound events to tenants via `where(eq(linkedinAccounts.unipileAccountId, accountId))`.
   - Because `unipileAccountId` has a `unique()` constraint on `linkedinAccounts`, it resolves uniquely to a single tenant.

### F. Complete Inventory of Raw SQL Execution Paths (`db.execute` and `sql\``)

| File Location | Query Syntax | Scope / Function | Isolation Assessment |
|---|---|---|---|
| [`dashboard.controller.ts:196`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/dashboard.controller.ts#L196) | `db.execute(sql`SELECT 1`)` | Health check liveness | Safe (No table queried) |
| [`app.ts:128`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/app.ts#L128) | `db.execute(sql`select 1`)` | Direct Express health check | Safe (No table queried) |
| [`admin.controller.ts:312, 349`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/admin.controller.ts#L312) | `where(sql`${linkedinAccounts.id} = ${id}`)` | Disconnect LinkedIn account | Admin-only; cross-tenant by design |
| [`admin.controller.ts:378, 451`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/admin.controller.ts#L378) | `where(sql`${linkedinAccounts.id} = ${id}`)` | Health check update | Admin-only; cross-tenant by design |
| [`safety.service.ts:163`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/safety/safety.service.ts#L163) | `sql`payload->>'message' = ${messageText}`` | JSON payload message duplicate filter | Scoped with `and(eq(actionQueue.userId, userId), ...)` |
| [`daily-agent.service.ts:697, 698`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/agent/daily/daily-agent.service.ts#L697) | `sql`${contacts.lastMessageSentAt} IS NULL`` | Contact query filter | Scoped with `and(eq(contacts.userId, userId), ...)` |
| [`auth.controller.ts:343`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/auth.controller.ts#L343) | `sessionVersion: sql`${users.sessionVersion} + 1`` | Session invalidation increment | Scoped by `where(eq(users.id, userId))` |
| [`clear-all-users.ts:18, 40, 42`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/clear-all-users.ts#L18) | `db.execute(sql`DELETE FROM users`)` | Standalone CLI user wipe | Unscoped global database deletion |
| [`reset-admin.ts:26`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/reset-admin.ts#L26) | `db.execute(sql`UPDATE users SET password = ...`)` | Standalone CLI password reset | Filtered by `LOWER(email)` |
| [`assign-admin.ts:27, 34, 41, 55`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/assign-admin.ts#L27) | `db.execute(sql`UPDATE users SET role = 'ADMIN'...`)` | Standalone CLI role assignment | Filtered by `LOWER(email)` |

---

## 6. Mocked Test Evidence vs Real PostgreSQL Verification Reality

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        VERIFICATION REALITY MATRIX                                     │
├───────────────────────────────────┬────────────────────────────────────────────────────┤
│ WHAT HAS BEEN TESTED (MOCKED)     │ WHAT REMAINS UNTESTED / UNVERIFIED (REAL ENGINE)   │
├───────────────────────────────────┼────────────────────────────────────────────────────┤
│ • In-memory Express request router│ • Real PostgreSQL query execution & latency        │
│ • Supertest HTTP request dispatch │ • Live schema migration against real PostgreSQL    │
│ • In-memory mocks (`vi.spyOn(db)`)│ • Foreign key cascade deletes (ON DELETE CASCADE)  │
│ • Mocked 404 / 403 status returns │ • Real constraint enforcement (UNIQUE, NOT NULL)   │
│ • Regex network killswitches      │ • Multi-tenant concurrent transactions & pooling   │
│ • MemorySaver in-process caching  │ • PostgreSQL Row Level Security (RLS) policies     │
└───────────────────────────────────┴────────────────────────────────────────────────────┘
```

**Every test in the repository mocks database interactions.** Zero TCP packets have reached a PostgreSQL database server. All referential integrity, unique constraints, and schema operations remain **UNVERIFIED**.

---

## 7. Prioritized Risk Register

### Critical Risks (Immediate System Hazards):
1. **Accidental Cloud Database Deletion via Standalone Scripts (CRIT-01):**
   - Running `npm run db:clear-users` (`clear-all-users.ts`) or `npm run db:migrate` outside Vitest bypasses `setup.ts`, loads `server/.env`, and executes against cloud Neon. `clear-all-users.ts` executes `DELETE FROM users` without interactive confirmation.
2. **False Production Readiness Assumption (CRIT-02):**
   - Declaring customer boundaries complete based solely on 79 mocked unit/HTTP tests risks releasing code with zero real engine-level isolation and unverified migration behavior.

### High Risks (Data Integrity & Boundary Vulnerabilities):
3. **Unscoped Contact Mutation in Queue Worker (HIGH-01):**
   - [`queue.service.ts:200, 222`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/queue/queue.service.ts#L200): Updates `contacts` by `id` without `userId` condition. In the absence of RLS, a corrupted or cross-tenant queue entry will overwrite foreign contacts.
4. **Unscoped Contact Update in Draft Approval (HIGH-02):**
   - [`agent.controller.ts:572`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/agent.controller.ts#L572): Updates `contacts` without `userId` condition.
5. **128 Unverified Route Endpoints (HIGH-03):**
   - Only 27 of 155 AST route declarations have automated negative cross-tenant integration tests. 128 endpoints remain unverified.
6. **Unauthenticated Webhooks in Non-Production (HIGH-04):**
   - [`webhook-auth.service.ts:13`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/webhook/webhook-auth.service.ts#L13): Silently accepts all webhook traffic when `UNIPILE_WEBHOOK_SECRET` is unset in non-production.

### Medium Risks (Implementation Discrepancies):
7. **`validateTestDatabaseUrl` False Pass & IPv6 Failure (MED-01):**
   - Silently returns on `undefined` input; rejects valid bracketed IPv6 loopbacks (`[::1]`); omits protocol validation.
8. **In-Memory Agent Memory Loss & "default" Fallback (MED-02):**
   - `AgentMemoryService` stores checkpointers strictly in Node.js process heap memory. Restart wipes conversation turns. Fallbacks to `"default"` in `agent.controller.ts` risk shared tenancy on unauthenticated calls.
9. **Lack of Administrative Audit Log Table (MED-03):**
   - Administrative cross-tenant operations log only to stdout console and do not write to a database audit log table.

### Low Risks (Code Hygiene & Dead Code):
10. **Shadowed Health Check Endpoints (LOW-01):**
    - Duplicate declarations for `GET /api/health/liveness` and `GET /api/health/readiness` in `app.ts` shadow unreachable declarations in `dashboard.routes.ts`.
11. **Raw String Interpolation in Admin Controller (LOW-02):**
    - Usage of `sql\`${linkedinAccounts.id} = ${id}\`` rather than Drizzle `eq(linkedinAccounts.id, id)`.

---

## 8. Safe Next-Step Recommendations & Command Permissions Ledger

### A. Commands SAFE to Run Now (Offline, Static, Read-Only):

| Permitted Command | Execution Directory | Purpose & Guardrail |
|---|---|---|
| `npm test` | `server/` | Runs 79 offline Vitest tests with active `setup.ts` killswitches and dotenv interception. |
| `npm run typecheck` | `server/` | Runs `tsc --noEmit` (pure static analysis; zero network/DB calls). |
| `npm run test:all-security` | Workspace root | Runs local secret scanner and config validation tests. |
| `npx tsx src/scripts/ast-route-inventory.ts` | `server/` | Pure static AST route analysis; read-only. |
| `git status --short` | Workspace root | Inspects working tree without making changes. |

### B. Commands FORBIDDEN to Run Without Explicit Human Authorization:

| Forbidden Command | Reason for Prohibition |
|---|---|
| `npm run db:push` / `npx drizzle-kit push` | Connects directly to `process.env.DATABASE_URL` (cloud Neon) via `drizzle.config.ts`. |
| `npm run db:migrate` / `tsx src/db/migrate.ts` | Loads `server/.env` and attempts live migrations on remote database. |
| `npm run db:custom-migrate` / `apply-migrations.ts` | Loads `server/.env` and applies raw SQL migrations to remote database. |
| `npm run db:clear-users` / `clear-all-users.ts` | **CRITICAL DESTRUCTIVE HAZARD:** Executes `DELETE FROM users` on remote database. |
| `npm run db:studio` | Launches web database viewer connected to remote database. |
| `npm run test:auth`, `test:connect`, `test:phase*` | Standalone test scripts that bypass `setup.ts`, load `.env`, and contact live providers. |
| `npm run agent:daily` / `worker:daily-agent` | Standalone job runners that connect to `DATABASE_URL`. |
| `docker run` / `docker-compose up` | Provisioning containers without explicit user authorization is forbidden. |
| `git reset`, `git clean`, `git checkout`, `git restore` | Destructive working-tree modifications are strictly forbidden. |

---

## 9. Single Recommended Safe Next Action

The next safe task is **purely test-level hardening that modifies zero application code and contacts zero external systems**:
1. **Fix and Test `validateTestDatabaseUrl` Edge Cases:**
   - Author comprehensive unit tests in [`database-safety.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/database-safety.test.ts) covering:
     - Mandatory parameter assertion (throws on `undefined`, `null`, `""`).
     - Protocol validation (enforces `postgresql:` or `postgres:`).
     - IPv6 loopback bracket handling (`[::1]`).
     - Malformed string handling.
   - Update `validateTestDatabaseUrl` in [`server/src/__tests__/setup.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts) so it is truly fail-closed before any migration runner uses it.
2. **Remain Gated:**
   - Maintain WP-03 status as **`PARTIALLY VERIFIED`**.
   - Maintain BLK-01, BLK-02, and BLK-03 as **`BLOCKED`**.
   - Keep WP-04 as **`DO NOT START`**.
