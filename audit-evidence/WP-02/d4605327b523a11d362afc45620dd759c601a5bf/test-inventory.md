# WP-02 Test Inventory & Quality Audit

**Recorded Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
*Notice: The commit hash above identifies the upstream baseline commit where this audit commenced. It does not imply that uncommitted working tree modifications or audit evidence files are part of that Git commit.*  
**Repository:** `YuvrajKhare2025/unipile-linkedin-automation`  
**Branch:** `main`  
**Date:** October 24, 2026  
**Auditor:** Antigravity AI  
**WP-02 Baseline Status:** **BLOCKED**  
*(Blocked due to material discrepancies: absence of an automated test runner framework, false-pass scripts exiting 0 on fatal errors, lack of cross-tenant database isolation tests, and 0 of 15 historical readiness claims verified).*

---

## 1. Executive Reconciliation of Discrepancies

### A. Next.js Version Discrepancy (Next.js 16 vs 15.3)
- **Reported Claim:** Handover dossier referenced Next.js 15.3 in Section 1 and Next.js 16 in Section 4.
- **Observed Reality in Code:**
  - `client/package.json` (Line 17): `"next": "16.3.4"`
  - `client/package.json` (Line 18): `"react": "19.2.8"`
  - `client/package-lock.json`: `"node_modules/next": { "version": "16.3.4" }`
  - SHA256 of `client/package-lock.json`: `b01e60f9622f3bde54e404ed746001fd34ae6aeca3af60f8684a8fb3525ce178`
- **Reconciliation Verdict:** **CONTRADICTED**. Next.js 15.3 is completely absent from the dependency tree. The repository is locked on **Next.js 16.3.4** and **React 19.2.8**. The mention of 15.3 was an unverified claim from an older prototype or draft.

---

### B. Security Test Counts (30 vs 18 vs 12)
- **Reported Claims:**
  - Executive summary claimed **30 security tests**.
  - `SECURITY_TEST_AUDIT.md` table details **18 security tests** (`SEC-01` through `SEC-18`).
- **Observed Reality in Code:**
  - `server/src/scripts/test-security.ts` implements exactly **12 test scenarios** (`SEC-01` through `SEC-12`).
  - Scenarios `SEC-13` through `SEC-18` (Checkpoint IDOR, CORS Enforcement, Queue Route Shield, Error Sanitization, Client Parameter Sanitization, Strict Compilation) exist **only as Markdown rows** in `SECURITY_TEST_AUDIT.md` and have **no code implementation** in `test-security.ts`.
  - The claim of "30 security tests" appears to have been fabricated by double-counting the 18 markdown rows + 12 automated script executions (18 + 12 = 30).
- **Reconciliation Verdict:** **CONTRADICTED**. Only **12 automated security tests** exist in code. Zero unit security tests exist in Jest/Vitest.

---

### C. The 84-Test Subtotal Discrepancy (32 + 18 + 25 + 9 = 84)
- **Reported Claim:** The historical report cited a grand total of **84 automated tests passing** across the platform, constructed as:
  `32 + 18 + 25 + 9 = 84`
- **Observed Reality in Code:**
  No test framework (Jest, Vitest, Mocha, Playwright, or Cypress) is installed in either `client` or `server`. All tests are standalone ad-hoc scripts executed via `tsx`.
  The components of `84` reconcile as follows:
  1. **32 Phase Tests:** The planned steps across `test-phase1.ts` (13), `test-phase2.ts` (8), `test-phase3.ts` (7), and `test-phase4.ts` (4 planned) sum to **32**.
  2. **18 Security Table Rows:** The 18 markdown entries (`SEC-01` to `SEC-18`) in `SECURITY_TEST_AUDIT.md`.
  3. **25 Assertions / Audit Records:** The 24-25 `recordAudit` calls in `test-security.ts` or 25 assertions in `test-unipile-webhook.ts`.
  4. **9 Validation & Auth Steps:** The 6 rate-limit/validator steps in `test-validator-rate-limit.ts` + 3 auth steps in `test-auth.ts`.
  - **Reconciliation Verdict:** **CONTRADICTED**. The 84 total was an executive roll-up combining planned manual steps, unexecuted markdown documentation rows, and scattered ad-hoc assertions. Furthermore, almost all phase scripts swallow runner errors and exit with code `0`.

---

### D. The 20 HTTP Endpoint Checks & Overlap
- **Reported Claim:** A separate suite of **20 HTTP endpoint checks** verified API readiness.
- **Observed Reality in Code:**
  - File `test-all-endpoints.ts` **does not exist** in the repository or Git history.
  - The 20 HTTP checks were individual `axios` / `fetch` calls scattered inside `test-security.ts` (~12 calls) and `test-validator-rate-limit.ts` (~8 calls).
  - **Overlap:** 100% overlap. These checks hit `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/dashboard/contacts`, and `/api/queue/process`.
  - **Quality Flaw:** Every one of these checks tests only `res.status === 200` or `res.status === 401`. None of them assert database mutation, response payload schemas, or end-to-end browser workflows.

---

### E. Authoritative AST Route Count Reconciliation (128 vs 100 vs 155)
- **Reported Claim:** The handover report summary cited **128 endpoints**, while the itemized category list in the report summed to **100** (8 + 15 + 16 + 7 + 5 + 8 + 4 + 18 + 6 + 5 + 2 + 3 + 3 = 100).
- **AST Parser Verification:**
  Executed [`server/src/scripts/ast-route-inventory.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/ast-route-inventory.ts) (`esbuild` TS desugaring + `acorn` ESTree parser + `acorn-walk` AST traversal):
  - **Route Files (12 files in `server/src/routes/*.ts`):** Exactly **128 AST CallExpressions** declaring **128 (Method, Path) endpoints**.
  - **Direct App Handlers (`server/src/app.ts`):** Exactly **2 AST CallExpressions** declaring **3 direct endpoints** (`GET /api/health`, `GET /api/health/liveness`, `GET /api/health/readiness`).
  - **Unique Handler Implementations:** 128 + 3 = **131 unique implementations**.
  - **Express Router Mounts (`server/src/app.ts`):** 15 total mounts, including **3 duplicate alias mounts** creating **24 mount aliases** (`/internal/admin` [16], `/api/webhook` [4], `/api/user/settings` [4]).
  - **Total Reachable HTTP Endpoints:** 131 unique implementations + 24 aliases = **155 reachable endpoints**.
- **The Source of the 100 Subtotal:** The author counted 128 route handlers originally, but when drafting the markdown text, they manually approximated category subtotals (underestimating `linkedin.routes.ts` as 16 instead of 44, underestimating `agent.routes.ts` as 8 instead of 17, and overestimating `dashboard.routes.ts` as 15 instead of 9), producing an arbitrary sum of 100.
- **Route Shadowing Detected:** `GET /api/health/liveness` and `GET /api/health/readiness` are registered both directly on `app.ts` (lines 80, 108 of stripped AST / 98, 126 of original) and inside `dashboard.routes.ts` (lines 53, 58). Because direct handlers are mounted first in `app.ts`, they intercept incoming requests and shadow the handlers in `dashboard.routes.ts`.

---

## 2. Test Isolation Limitations & Multi-Tenancy Reality

### A. Separation of In-Memory Checks vs Real Multi-Tenant Isolation
- `server/src/scripts/test-agent-memory.ts` verifies that two distinct LangGraph `MemorySaver` instances (`checkpointerA` and `checkpointerB`) do not share conversational short-term memory keys in Node.js process RAM.
- **Critical Limitation:** **In-memory checkpointer isolation DOES NOT equate to cross-tenant data isolation.**
  - `MemorySaver` is a pure RAM cache used during an active LangGraph execution graph.
  - Production WorkPilot traffic does **not** rely on in-memory state for tenant isolation; all user data, leads, LinkedIn sessions, and chat histories are stored in PostgreSQL tables managed via Drizzle ORM (`contacts`, `messages`, `linkedin_accounts`, `action_queue`, `users`).
  - Proving that two in-memory objects in Node.js heap memory don't collide does not prove that an authenticated HTTP request from Tenant B cannot access or mutate Tenant A's database records.

### B. Route & Worker Surfaces Requiring Negative Tenant-Isolation Tests (WP-03)
The following critical areas currently lack negative automated tests proving that Tenant B cannot access Tenant A's data (IDOR prevention):

1. **CRM Contacts & Pipelines (`server/src/routes/dashboard.routes.ts`):**
   - `GET /api/dashboard/contacts`: Needs negative test proving Tenant B receives an empty list or only their own contacts when querying with an active token.
   - `PATCH /api/dashboard/contacts/:id/stage`: Needs negative test verifying that passing Tenant A's `contact.id` with Tenant B's JWT returns HTTP 403 or 404, preventing unauthorized stage transitions.
2. **Conversations & Messaging Takeover (`server/src/routes/conversation.routes.ts`):**
   - `GET /api/conversations/:contactId/messages`: Needs negative test verifying that Tenant B cannot retrieve chat history for Tenant A's leads by specifying Tenant A's `contactId`.
   - `POST /api/conversations/:contactId/reply`: Needs negative test ensuring Tenant B cannot trigger outbound messages on Tenant A's connected LinkedIn account.
   - `POST /api/conversations/:contactId/takeover`: Needs negative test ensuring Tenant B cannot toggle the human takeover status of Tenant A's leads.
3. **LinkedIn Session Management & Checkpoints (`server/src/routes/linkedin.routes.ts`):**
   - `GET /api/linkedin/checkpoint/status/:accountId`: Needs negative test proving Tenant B cannot view checkpoint/2FA prompts for Tenant A's `accountId`.
   - `POST /api/linkedin/checkpoint/solve`: Needs negative test ensuring Tenant B cannot submit PINs or bypass checkpoints on Tenant A's account.
   - `POST /api/linkedin/disconnect`: Needs negative test preventing Tenant B from disconnecting Tenant A's LinkedIn account.
4. **Administrative Routes & Privilege Escalation (`server/src/routes/admin.routes.ts`):**
   - `GET /api/admin/users`, `GET /internal/admin/users`: Needs negative test proving non-admin users (`role: 'USER'`) receive HTTP 403 Forbidden.
   - `POST /internal/admin/daily-agent/run/:userId`: Needs negative test proving non-admins cannot trigger batch agent runs on arbitrary user IDs.
   - `POST /api/admin/settings/unipile`: Needs negative test verifying regular users cannot modify global master API keys.
5. **Background Asynchronous Workers:**
   - **`ActionQueueWorker` (`server/src/services/queue/queue.service.ts`):** Needs unit tests with synthetic multi-tenant records proving that scheduled actions for Tenant A are executed exclusively with Tenant A's credentials and respect Tenant A's daily quotas without starving or leaking to Tenant B.
   - **`MessageAgentWorker` (`server/src/services/webhook/message-agent.worker.ts`):** Needs negative tests proving that inbound webhook jobs for Tenant A's account use Tenant A's BYOK Gemini key or tenant settings, and do not fall back to or contaminate Tenant B.

### C. Live Provider Test Boundaries & Enforcement
- `test-phase1.ts`, `test-phase2.ts`, `test-phase3.ts`, `test-phase4.ts`, and `test-linkedin-connect.ts` connect directly to live Unipile servers (`api*.unipile.com`) and initiate real LinkedIn interactions.
- **Execution Boundary:** These tests are strictly **BLOCKED** from automated/CI execution.
- Running them without deterministic local stubs violates safety protocols, risks credential leakage, triggers LinkedIn rate limits/account bans, and incurs per-request fees.
- In WP-03, deterministic offline HTTP mock interceptors (e.g. `nock` or `msw`) must be implemented before any of these test suites can be safely run.

---

## 3. Comprehensive Test Script Quality Audit

| Script Name | Purpose | Asserts | Mocks / Stubs | Real DB Access? | Real Network / LinkedIn? | Exit on Failure? | False Pass Potential & Quality Flaws |
|---|---|:---:|:---:|:---:|:---:|:---:|---|
| **`test-security.ts`** | Evaluates auth, SQL injection, IDOR, anti-spam, and caps | 24 | None (Expects local Express running on 4000) | **Yes** (Direct Drizzle queries) | No (Internal HTTP to Express) | **Yes** (`process.exit(1)`) | Tests require a running backend server and active DB connection. Only implements `SEC-01` to `SEC-12`; skips `SEC-13` to `SEC-18`. |
| **`test-validator-rate-limit.ts`** | Tests express-validator rules and sliding window rate limits | 0 | None (HTTP to `localhost:4000`) | No | No (Internal HTTP to Express) | **Yes** (`process.exit(1)` on 429 mismatch) | Does not use an assertion library. Prints formatted logs. Tests 6 auth scenarios. Fails if server is offline. |
| **`test-unipile-webhook.ts`** | Ingests mock webhook payloads for messages and connections | 25 | Partial (Injects synthetic webhook payloads) | **Yes** (Mutates `webhook_events`, `messages`, `contacts`) | No | **Yes** (`failedCount > 0 -> exit(1)`) | Mutates real database tables without rollback. Relies on active Postgres instance. |
| **`rigorous-system-test.ts`** | Edge-case tests: deduplication, stale messages, anti-collision, opt-out | 12 | In-memory message queues and synthetic tenants | **Yes** (Creates `test_rigorous_*` rows) | No | **Yes** (`failedCount > 0 -> exit(1)`) | Strongest test in the repo. Tests idempotency and opt-out logic against real schema. Does not clean up all inserted synthetic rows. |
| **`test-agent-memory.ts`** | Verifies short-term LangGraph MemorySaver isolation across tenants | 0 (Throws) | `FakeListChatModel` for deterministic LLM | **No** (Pure in-memory checkpointers) | **No** | **Yes** (`throw Error` -> unhandled exit 1) | **High Quality:** Uses LangGraph `MemorySaver` and `FakeListChatModel`. Completely safe to run offline with zero side effects. Proves in-memory separation only, not DB isolation. |
| **`test-multistep-subgraphs.ts`** | LangGraph batch outreach subgraph, InMemoryStore, and stop control | 0 (Throws) | Mock lead candidates in memory | **No** (In-memory LangGraph store) | **No** | **Yes** (`throw Error` -> exit 1) | **FLAW DETECTED:** Test 2 dispatches 5 leads which all fail (5 failed), but test prints `✅ [PASS]` because it only asserts `queue.length === 5` rather than dispatch outcome! |
| **`test-phase1.ts`** | Raunak's 13 LinkedIn feature tests (Connect, Search, DMs, Posts) | 0 | **None** (Calls live Unipile client) | **Yes** | **YES (Live LinkedIn / Unipile)** | **NO** (`catch` logs error, exits code 0) | **CRITICAL RISK:** Contacts live LinkedIn via Unipile. If network fails or credentials missing, catches error and exits code 0 (false pass in CI). **BLOCKED.** |
| **`test-phase2.ts`** | Prospect discovery, pre-flight safety, queue worker | 0 | None | **Yes** | **YES (Unipile)** | **NO** (Swallows errors, exits 0) | **CRITICAL RISK:** Dispatches real queue items. Exits code 0 on failure. **BLOCKED.** |
| **`test-phase3.ts`** | Multi-step cadence, AI intent, human takeover | 0 | None | **Yes** | Partial | **NO** (Swallows errors, exits 0) | Exits code 0 even on fatal error. **BLOCKED.** |
| **`test-phase4.ts`** | Social warmup, contextual comments, clichés | 0 | None | **Yes** | **YES (Unipile)** | **NO** (Swallows errors, exits 0) | Calls live LinkedIn post interaction. Exits code 0 on failure. **BLOCKED.** |
| **`test-phase5.ts`** | Pipeline progression, health probes, emergency pause | 0 | None | **Yes** | No | **Yes** (`process.exit(1)`) | Direct DB mutation. Requires active database. |
| **`test-auth.ts`** | Basic signup, login, /me, and logout HTTP flow | 0 | None | No | No (HTTP to `localhost:4000`) | **NO** (Logs error, exits code 0) | False pass risk. |
| **`test-daily-agent.ts`** | Autonomous daily outreach agent cycle | 27 | Partial stubs | **Yes** (Mutates `daily_agent_runs`) | No | **Yes** (`failedCount > 0 -> exit 1`) | Mutates real DB. |
| **`test-gemini-byok.ts`** | BYOK key validation and fallback | 20 | None | **Yes** (Queries `system_settings`) | No | **Yes** | Modifies settings in DB. |
| **`test-linkedin-connect.ts`** | Live Unipile connection test | 0 | **None** (Live gateway) | **Yes** | **YES (Unipile)** | **NO** (Exits code 0 on error) | Direct live provider call. **BLOCKED.** |
| **`test-message-listening.ts`** | Intelligence classification of messages | 0 | In-memory message strings | **No** | **No** | **Yes** (`throw Error`) | Pure in-memory unit test of message intelligence regex. Safe to run offline. |
| **`test-reply-quality.ts`** | Banned clichés and length checks | 0 | In-memory string tests | **No** | **No** | **NO** (Logs to console, exits 0) | Safe to run, but lacks formal assertions. |
| **`test-saas-foundation.ts`** | Razorpay plan initialization & crypto | 10 | None | **No** | **No** | **Yes** (`assert.equal`) | Uses `node:assert/strict`. Tests encryption and hashing. |
| **`scan-secrets.mjs`** | Repository secret scanner (WP-01) | 0 | None | **No** | **No** | **Yes** (`exit(1)` on secret) | Zero-dependency static scan. Clean exit 0. |
| **`test-secret-scanner.mjs`** | Canary dummy-secret regression test (WP-01) | 3 | Injected temporary fixture | **No** | **No** | **Yes** (`assert.ok`) | Regression test proving scanner detects secrets and cleans up. |
| **`test-config-validation.mjs`**| Production config guards & redaction (WP-01) | 12 | In-memory mock environments | **No** | **No** | **Yes** (`assert.throws`) | Verifies missing envs reject startup, error redaction scrubs secrets. |

---

## 4. Controlled Defect Drill & Flaw Verification

To prove that automated test scripts actually detect regressions and do not provide false confidence, a controlled defect drill was performed on `test-agent-memory.ts`:

1. **Defect Injection:** `server/src/scripts/test-agent-memory.ts` was edited to force Tenant B to share Tenant A's checkpointer:
   ```typescript
   // Injected defect:
   const checkpointerB = checkpointerA;
   ```
2. **Defect Detection Output:** Running `npx tsx src/scripts/test-agent-memory.ts` immediately failed with exit code 1:
   ```
   ❌ Test failed: Error: User A and User B MUST NOT share the same MemorySaver instance!
       at runTest (c:\Users\Admin\OneDrive\Desktop\unipile\server\src\scripts\test-agent-memory.ts:31:11)
   ```
3. **Restoration & Clean Verification:** The line was restored to `agentMemoryService.getUserCheckpointer(userB)`, and the test passed cleanly with exit code 0. Both executions are captured verbatim in `raw-test-outputs.txt`.
