# WP-03 Decision & Architecture Planning Document
## Test Framework Selection, Multi-Layered Offline Network Sandbox, Database Safety, and Tenant-Isolation Negative-Test Matrix

**Document ID:** `WP-03-PLAN-01` (Revision 2 - Hardened Planning Baseline)  
**Current Phase:** WP-03 Planning & Architectural Design Only  
**WP-02 Baseline Status:** **BLOCKED**  
**WP-03 Status:** **PLANNING ONLY — WP-03 NOT STARTED**  
**Recorded Upstream Base Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
*Critical Distinguishing Notice: The commit hash above identifies the upstream baseline commit where the readiness audit began. It does NOT imply that uncommitted working-tree modifications, WP-01 remediations, or audit evidence belong to or have been committed into that Git commit.*  
**Target Repository:** `YuvrajKhare2025/unipile-linkedin-automation`  
**Author:** Antigravity AI  

---

## 0. Non-Negotiable Safety & Planning Invariants
- **Read-Only Planning Scope:** Strictly planning-only. Zero application source code modified, zero packages installed, zero lockfiles altered.
- **Git State Preserved:** All 1 staged deletion (`deploy.tar.gz`), 16 unstaged modified files, and untracked evidence files are strictly preserved. Zero commits, resets, or discards performed.
- **Zero Live Network Access:** Zero requests made to live external services (Unipile, LinkedIn, Google Gemini, Razorpay, Resend).
- **Zero Database Connections:** No database connections were initiated or tested during this planning task.
- **Zero Customer Data / Real Credentials:** All test designs specify synthetic mock actors and synthetic fixtures only.
- **Release Gate Status:** The overall release gate remains strictly **CLOSED**; no production readiness is claimed.

---

## 1. Test Framework Decision Matrix: Vitest vs. Jest

### A. Verified Repository Facts (Server Stack Profile)
Inspection of [`server/package.json`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/package.json) and [`server/tsconfig.json`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/tsconfig.json) establishes the following active repository facts:
1. **Module System:** Native ECMAScript Modules (`"type": "module"` in `package.json`).
2. **TypeScript Compilation & Resolution:** `"target": "ES2022"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"` in `tsconfig.json`.
3. **Import Syntax:** All internal imports across `server/src/` use explicit `.js` extension specifiers (e.g. `import authRoutes from "./routes/auth.routes.js";`) in compliance with TypeScript `NodeNext` rules.
4. **Host Runtime:** Node.js `v24.22.1` on Windows 11 64-bit.
5. **Toolchain & Dependencies:**
   - Compiler: `typescript@^7.0.2` preview (`@typescript/typescript-win32-x64` with native `tsc.exe`).
   - Runner: `tsx@^4.23.13` (internally powered by `esbuild`).
   - Core ESM dependencies: `@langchain/core` (`^1.2.9`), `@langchain/langgraph` (`^1.4.14`), `drizzle-orm` (`^0.45.2`), `postgres` (`^3.4.9`), `zod` (`^4.5.4`).
6. **Current Test Framework State:** Neither Vitest nor Jest is installed in `server/package.json` or root `package.json`.

---

### B. Detailed Comparative Matrix

| Evaluation Dimension | Vitest | Jest | Repository Fit & Analysis |
|---|---|---|---|
| **Native ESM Support** | Built natively for ESM. Treats `"type": "module"` as default. | Experimental in ESM. Requires `NODE_OPTIONS=--experimental-vm-modules`. | **Vitest Winner.** Node 24 ESM under Jest frequently suffers from circular module resolution crashes and VM context isolation errors. |
| **`NodeNext` Import Mapping (`.js` -> `.ts`)** | Automatically resolves `./foo.js` to `./foo.ts` matching TypeScript `NodeNext` specification with zero configuration. | Requires complex `moduleNameMapper` regex rules (e.g., `'^(\\.{1,2}/.*)\\.js$': '$1'`), which frequently fail on nested packages. | **Vitest Winner.** WorkPilot uses `.js` imports throughout `server/src/`. Jest requires brittle custom resolver regexes. |
| **ESM Module Mocking** | `vi.mock("./service.js")` cleanly intercepts native ESM imports before module evaluation. | `jest.mock()` is broken in native ESM; requires `jest.unstable_mockModule()` with dynamic top-level `await import()` in every test file. | **Vitest Winner.** Mocking `UnipileClient` and `GeminiConfigService` in Jest ESM requires substantial asynchronous boilerplate. |
| **TypeScript Engine** | Uses `esbuild` underneath (same instantaneous engine as `tsx`). | Requires `ts-jest` (heavy typechecking overhead) or extra `@swc/jest` / `babel-jest` transform layers. | **Vitest Winner.** Tests boot and execute in milliseconds. |
| **LangGraph / LangChain Compatibility** | Resolves LangGraph's dual ESM/CJS export maps natively. | Known package export-map resolution errors in Jest (`Cannot find module '@langchain/core/utils/testing'`). | **Vitest Winner.** LangGraph `MemorySaver` and `FakeListChatModel` are central to agent testing. |
| **Failure Exit Codes** | Exits with non-zero code (`1`) on any failed assertion or unhandled rejection. | Exits with non-zero code (`1`) on any failed assertion. | **Tie.** Both frameworks resolve the critical repository defect where ad-hoc scripts swallow errors and exit with code `0`. |

---

### C. Untested Compatibility Claims & Proposed Proof-of-Compatibility

#### Untested Claims & Assumptions
- **Assumption 1:** It is assumed that Vitest's runner seamlessly executes alongside the pre-release `typescript@^7.0.2` package in `server/package.json`. Because Vitest uses `esbuild` for TypeScript stripping rather than invoking `tsc`, standard TS syntax should work out of the box, but **full end-to-end compatibility has not yet been demonstrated in an active run**.
- **Assumption 2:** It is assumed that Drizzle ORM schemas and LangGraph subgraphs load without ESBuild transform issues in Vitest's worker threads on Node 24. This remains an **unverified claim** until a proof-of-compatibility test is executed.

#### Minimal Isolated Proof-of-Compatibility (To Be Executed ONLY After Authorization)
To validate Vitest without modifying tracked files or altering lockfiles:
1. Create a temporary scratch script `scratch/vitest-poc.test.ts` outside tracked application code:
   ```typescript
   import { describe, it, expect } from "vitest";
   import { FakeListChatModel } from "@langchain/core/utils/testing";

   describe("Proof of Compatibility", () => {
     it("validates Node 24 ESM and LangGraph testing utilities", async () => {
       const model = new FakeListChatModel({ responses: ["OK"] });
       const res = await model.invoke("test");
       expect(res.content).toBe("OK");
     });
   });
   ```
2. Execute via one-off NPX invocation without modifying `package.json`:
   ```powershell
   npx vitest run scratch/vitest-poc.test.ts
   ```
3. Record exact exit code, execution time, and output. Remove temporary scratch file immediately.

---

### D. Smallest Safe Migration Plan (When WP-03 Is Authorized)
1. **Package Installation:** Install `vitest` in `server/devDependencies` (`npm install -D vitest`).
2. **Minimal Configuration ([server/vitest.config.ts](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/vitest.config.ts)):**
   ```typescript
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     test: {
       environment: "node",
       globals: true,
       setupFiles: ["./src/__tests__/setup.ts"],
       testTimeout: 10000,
       include: ["src/__tests__/**/*.test.ts"],
     },
   });
   ```
3. **Add NPM Script:** Add `"test": "vitest run"` in [`server/package.json`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/package.json).
4. **Phased Test Suite Migration:**
   - *Phase 1:* Create `server/src/__tests__/setup.ts` (network killswitch & test DB guard) and `server/src/__tests__/tenant-isolation.test.ts`.
   - *Phase 2:* Migrate legacy scripts ([`test-agent-memory.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-agent-memory.ts), [`test-saas-foundation.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-saas-foundation.ts)).
   - *Phase 3:* Convert blocked phase scripts (`test-phase1.ts`..`test-phase4.ts`) to use offline mock providers.

---

## 2. Multi-Layered Offline Network Sandbox Plan

### A. Critical Technical Invariant
> [!IMPORTANT]
> **Intercepting `globalThis.fetch` and `http.request` is NOT a complete network sandbox.**  
> Application-level monkey-patching cannot intercept raw TCP/TLS sockets (`node:net`, `node:tls`), native binary C++ bindings, or spawned child processes. True network isolation requires an operating-system or container-level network denial boundary.

---

### B. Codebase Network Transport Inventory
An audit of dependencies and communication pathways across the WorkPilot codebase identified the following network transports:

1. **Raw TCP/TLS Sockets (`node:net`, `node:tls`):**
   - The PostgreSQL client driver (`postgres@^3.4.9` in [`server/src/db/index.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/index.ts)) establishes direct TCP/TLS connections to PostgreSQL on port 5432. It **bypasses `fetch` and `http.request` completely**.
2. **Global Fetch & HTTP/HTTPS Client:**
   - [`server/src/services/unipile/unipile.client.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/unipile/unipile.client.ts): Communicates with `https://api*.unipile.com` via HTTP requests.
   - Transactional Email (`server/src/services/email/email.service.ts`): Communicates with Resend API over HTTPS.
   - Billing (`server/src/services/billing/razorpay.service.ts`): Communicates with Razorpay API over HTTPS.
3. **SDK-Specific Transports:**
   - Google Generative AI (`@langchain/google-genai` / `@google/generative-ai`): Bundles internal HTTP dispatch logic communicating with `generativelanguage.googleapis.com`.
4. **Child Processes (`node:child_process`):**
   - Maintenance scripts and potential deployment helpers may invoke child processes (`curl`, `ssh`, `git`, or PowerShell) that communicate directly over the host network stack outside Node.js runtime visibility.

---

### C. Recommended Multi-Layered Isolation Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               LAYER 1: OS / CONTAINER-LEVEL NETWORK DENIAL (Primary Boundary)          │
│  - Docker Test Container: run with --network none (blocks all external TCP/UDP traffic) │
│  - Host Environment: Outbound firewall block or non-routable proxy for test processes   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│            LAYER 2: APPLICATION-LEVEL FAIL-CLOSED GUARD (Defense-in-Depth)             │
│  - Wrapped globalThis.fetch, http.request, https.request in setup.ts                   │
│  - Intercepts net.Socket.connect to reject non-localhost IP/ports                     │
│  - Throws [NETWORK HAZARD BLOCKED] hard process crash on any outbound attempt         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│              LAYER 3: IN-MEMORY SYNTHETIC STUBS & DETERMINISTIC FIXTURES               │
│  - MockUnipileClient (canned LinkedIn accounts, relations, messages, checkpoints)      │
│  - FakeListChatModel (deterministic canned LLM responses)                              │
│  - Synthetic webhook fixtures (message_received, connection_accepted)                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Layer 1: OS / Container-Level Network Denial (Primary Boundary)
For CI and local automated testing, tests must run inside a containerized sandbox with outbound network access physically disabled:
- **Docker Flag:** `--network none` (allows only local inter-process / loopback communication).
- If a test database container is used: Docker compose internal bridge network with zero external gateway routing (`internal: true`).

#### Layer 2: Application-Level Fail-Closed Guard (Defense-in-Depth in `setup.ts`)
```typescript
import net from "node:net";

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

// Intercept global fetch
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.toString());
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(
      `🚨 [NETWORK HAZARD BLOCKED] Test attempted outbound fetch to external host: ${url.hostname}${url.pathname}. All tests must use offline stubs!`
    );
  }
  return originalFetch(input, init);
};

// Intercept raw TCP socket connections (catches non-HTTP socket leaks)
const originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args: any[]) {
  const [options] = args;
  const host = typeof options === "object" ? options.host : args[1];
  if (host && typeof host === "string" && !ALLOWED_HOSTS.has(host) && !host.startsWith("127.")) {
    throw new Error(`🚨 [SOCKET HAZARD BLOCKED] Raw TCP socket connection attempted to external host: ${host}`);
  }
  return originalSocketConnect.apply(this, args as any);
};
```

#### Layer 3: Deterministic Synthetic Stubs
- **`MockUnipileClient`:** Replaces `UnipileClient` with in-memory state for accounts, relations, chats, and invitations.
- **`FakeListChatModel`:** Deterministic canned LLM responses via `@langchain/core/utils/testing`.
- **Synthetic Webhooks:** Canned JSON fixtures representing Unipile webhooks.

*Non-Isolation Notice: Complete network isolation is NOT claimed until verified through an active execution test in WP-03.*

---

## 3. Dedicated Test Database Safety Plan

### A. Dedicated Test Database Requirement
Tests must **never** run against the production database, staging environments, or developer personal databases.
- The test harness requires an explicitly declared environment variable: `TEST_DATABASE_URL`.
- Default Target: Dedicated local PostgreSQL database named `workpilot_test_db` (`postgresql://postgres:postgres@localhost:5432/workpilot_test_db`).

---

### B. Fail-Closed Test Database Guard (in `setup.ts`)
Before establishing any database connection pool, the test runner must validate the database connection string. If it is missing, invalid, or resembles production, the runner terminates immediately:
```typescript
export function assertSafeTestDatabase(url: string | undefined): void {
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error(
      "🚨 [TEST DATABASE BLOCKED] TEST_DATABASE_URL is not set! Tests refuse to run without an explicitly configured test database."
    );
  }

  const parsed = new URL(url);

  // Production and cloud host blocklist
  const BLOCKED_DOMAINS = ["neon.tech", "aws.com", "supabase.co", "render.com", "railway.app"];
  for (const domain of BLOCKED_DOMAINS) {
    if (parsed.hostname.includes(domain)) {
      throw new Error(
        `🚨 [TEST DATABASE BLOCKED] TEST_DATABASE_URL points to a cloud/production host (${parsed.hostname})! Tests refuse to execute against cloud databases.`
      );
    }
  }

  // Production database name blocklist
  const DANGEROUS_DB_NAMES = ["workpilot", "production", "prod", "workpilot_prod", "main"];
  const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
  if (DANGEROUS_DB_NAMES.includes(dbName)) {
    throw new Error(
      `🚨 [TEST DATABASE BLOCKED] Database name '${dbName}' resembles production! Test database name must contain 'test' (e.g., workpilot_test_db).`
    );
  }
}
```

---

### C. Synthetic Fixture Generation & PII Elimination
- All test entities must use dedicated synthetic prefixes:
  - Users: `test_iso_user_a_uuid`, `test_iso_user_b_uuid`, `test_iso_admin_uuid`
  - Emails: `tenant_a_synthetic@workpilot.test`, `tenant_b_synthetic@workpilot.test`
  - Contacts: `test_iso_contact_a1`, `test_iso_contact_b1`
  - Accounts: `act_test_synth_111`, `act_test_synth_222`
- Zero customer PII, real phone numbers, or genuine LinkedIn profile URLs may be used.

---

### D. Transactional Isolation & Residual-Data Risk Strategy

#### The Residual-Data Risk
If a test process is abruptly killed (`SIGINT`, worker crash, test timeout, or power failure) during an active database transaction, any uncommitted transactional changes roll back automatically. However, if tests perform direct database writes without rollback, residual synthetic rows will remain in `contacts`, `users`, `messages`, and `action_queue`. Subsequent test runs may fail due to primary key collisions or unexpected row counts.

#### The Dual-Phase Sweeping Strategy
To achieve deterministic safety and eliminate residual-data pollution:
1. **Pre-Run Sweeper (`beforeAll`):**  
   Before any test suite executes, run an unconditional purge of all synthetic test records:
   ```sql
   DELETE FROM action_queue WHERE user_id LIKE 'test_iso_%';
   DELETE FROM messages WHERE user_id LIKE 'test_iso_%';
   DELETE FROM contacts WHERE user_id LIKE 'test_iso_%';
   DELETE FROM linkedin_accounts WHERE user_id LIKE 'test_iso_%';
   DELETE FROM daily_agent_runs WHERE user_id LIKE 'test_iso_%';
   DELETE FROM users WHERE id LIKE 'test_iso_%';
   ```
2. **Per-Test Transactional Rollback (`beforeEach` / `afterEach`):**  
   Whenever supported by Drizzle ORM and Postgres client, wrap individual test cases in a database transaction that rolls back on completion (`ROLLBACK`).
3. **Post-Run Sweeper (`afterAll`):**  
   Re-execute the synthetic purge to leave the test database in a clean state.

---

## 4. Refined 14-Case Tenant-Isolation Negative-Test Matrix

### Actual Controller Contract Context (Verified in Code)
- **`conversation.controller.ts`:** Explicitly checks `where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))`. If not found, returns **404 Not Found** with message `"Contact not found or access denied."`.
- **`linkedin.controller.ts`:** Explicitly checks `where(and(eq(linkedinAccounts.unipileAccountId, accountId), eq(linkedinAccounts.userId, userId)))`. If not found, returns **404 Not Found** with message `"LinkedIn account not found or access denied."`.
- **`admin.middleware.ts` (`requireAdmin`):** Checks `if (user.role !== "ADMIN" && !isSuperAdminEmail)`. Returns **403 Forbidden** with message `"Access forbidden. You do not have administrator privileges."`.
- **`dashboard.controller.ts` (`patchContactStage`):** Calls `crmService.updateContactStage`. When `userId` does not match, Drizzle returns 0 rows and the service throws `Error("Contact <id> not found.")`. The controller catch block currently catches this and returns **500 Internal Server Error** with `{ success: false, error: error.message }` (an existing controller contract bug/quirk). The test suite must be configurable to assert `[403, 404, 500]` while asserting zero database mutation.

---

### Detailed 14-Case Negative IDOR & Isolation Test Specification

#### 1. CRM Contacts Domain

##### Test ISO-CRM-01: List Contacts Cross-Tenant Scoping
- **Preconditions & Setup:**
  - Insert Tenant A (`id: 'test_iso_user_a'`) with Contact A1 (`id: 'test_iso_cnt_a1'`).
  - Insert Tenant B (`id: 'test_iso_user_b'`) with Contact B1 (`id: 'test_iso_cnt_b1'`).
- **Authenticated Actor:** Tenant B (JWT `tokenB`, claims: `{ userId: 'test_iso_user_b' }`).
- **Target Route:** `GET /api/dashboard/contacts`
- **Expected HTTP Response:** `200 OK`. Response body: `{ success: true, data: [ { id: 'test_iso_cnt_b1', ... } ] }`.
- **Response-Data Leakage Assertion:**  
  `expect(res.body.data.some((c: any) => c.id === 'test_iso_cnt_a1')).toBe(false);`  
  Assert 0 bytes of Contact A1's name, email, or LinkedIn URL are present in the response payload.
- **Database State Assertion:**  
  `SELECT count(*) FROM contacts WHERE user_id = 'test_iso_user_a'` remains strictly 1. Zero records deleted or altered.
- **Side-Effect Assertion:** Zero outbound provider calls.
- **Cleanup Strategy:** Pre/post-run purge of `test_iso_%`.

##### Test ISO-CRM-02: Unauthorized Pipeline Stage Update
- **Preconditions & Setup:** Contact A1 exists in stage `"LEAD"` owned by Tenant A.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `PATCH /api/dashboard/contacts/test_iso_cnt_a1/stage`
- **Payload:** `{ stage: "CLOSED_WON" }`
- **Expected HTTP Response:** Denied. Expected status: `403`, `404`, or existing controller contract `500` (with error message `"Contact test_iso_cnt_a1 not found."`).
- **Response-Data Leakage Assertion:** Response body must not return updated Contact A1 details.
- **Database State Assertion (Before vs After):**  
  `SELECT status FROM contacts WHERE id = 'test_iso_cnt_a1'` must evaluate strictly to `"LEAD"`. Zero stage mutation.
- **Side-Effect Assertion:** No automated follow-up or celebration webhook dispatched.
- **Cleanup Strategy:** Purge synthetic records.

##### Test ISO-CRM-03: Direct Contact IDOR Access
- **Preconditions & Setup:** Contact A1 exists owned by Tenant A.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `GET /api/dashboard/contacts/test_iso_cnt_a1`
- **Expected HTTP Response:** `403 Forbidden` or `404 Not Found`.
- **Response-Data Leakage Assertion:** Response body contains `{ success: false }` and zero Contact A1 fields.
- **Database State Assertion:** Record untouched in database.
- **Side-Effect Assertion:** N/A.
- **Cleanup Strategy:** Purge synthetic records.

---

#### 2. Conversations & Messaging Domain

##### Test ISO-MSG-01: Cross-Tenant Conversation History Retrieval
- **Preconditions & Setup:** Contact A1 has 3 direct messages in `messages` table owned by Tenant A.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `GET /api/conversations/test_iso_cnt_a1/messages`
- **Expected HTTP Response:** `404 Not Found` (matching `conversation.controller.ts:47` contract: `"Contact not found or access denied."`).
- **Response-Data Leakage Assertion:**  
  `expect(res.body.data).toBeUndefined();`  
  Assert zero messages belonging to Tenant A are returned in response body.
- **Database State Assertion:** All 3 messages in `messages` table remain unchanged.
- **Side-Effect Assertion:** Zero Unipile inbox sync triggered.
- **Cleanup Strategy:** Purge synthetic messages and contacts.

##### Test ISO-MSG-02: Cross-Tenant Manual Reply Spoofing
- **Preconditions & Setup:** Contact A1 belongs to Tenant A.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `POST /api/conversations/test_iso_cnt_a1/reply`
- **Payload:** `{ text: "Unauthorized spoofed reply message" }`
- **Expected HTTP Response:** `404 Not Found` (matching `conversation.controller.ts:140` contract).
- **Response-Data Leakage Assertion:** Response confirms failure; zero message metadata leaked.
- **Database State Assertion (Before vs After):**  
  `SELECT count(*) FROM messages WHERE content = 'Unauthorized spoofed reply message'` returns **0**.  
  `SELECT count(*) FROM action_queue WHERE payload::text LIKE '%spoofed%'` returns **0**.
- **Side-Effect Assertion:** `MockUnipileClient.messaging.sendMessage` is **NOT called**.
- **Cleanup Strategy:** Purge synthetic records.

##### Test ISO-MSG-03: Cross-Tenant Human Takeover Tampering
- **Preconditions & Setup:** Contact A1 has `conversationMode: "AUTO"` owned by Tenant A.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `POST /api/conversations/test_iso_cnt_a1/takeover`
- **Expected HTTP Response:** `404 Not Found` (matching `conversation.controller.ts:97` contract).
- **Response-Data Leakage Assertion:** Zero contact data returned.
- **Database State Assertion:**  
  `SELECT conversation_mode FROM contacts WHERE id = 'test_iso_cnt_a1'` remains strictly `"AUTO"`.
- **Side-Effect Assertion:** Autonomous AI agent worker is not halted for Tenant A.
- **Cleanup Strategy:** Purge synthetic records.

---

#### 3. LinkedIn Account & Checkpoint Domain

##### Test ISO-LNK-01: Unauthorized Checkpoint Status Inspection
- **Preconditions & Setup:** LinkedIn Account A (`unipileAccountId: 'act_synth_a'`) belongs to Tenant A.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `GET /api/linkedin/checkpoint/status/act_synth_a`
- **Expected HTTP Response:** `404 Not Found` (matching `linkedin.controller.ts:827` contract: `"LinkedIn account not found or access denied."`).
- **Response-Data Leakage Assertion:** Zero 2FA challenge tokens or phone hints returned.
- **Database State Assertion:** Zero updates to `linkedin_accounts`.
- **Side-Effect Assertion:** `MockUnipileClient.accounts.getCheckpointStatus` is **NOT called** for Account A.
- **Cleanup Strategy:** Purge synthetic accounts.

##### Test ISO-LNK-02: Unauthorized Checkpoint Solve Submission
- **Preconditions & Setup:** LinkedIn Account A belongs to Tenant A.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `POST /api/linkedin/checkpoint/solve`
- **Payload:** `{ accountId: "act_synth_a", code: "654321" }`
- **Expected HTTP Response:** `404 Not Found` (matching `linkedin.controller.ts:707` contract).
- **Response-Data Leakage Assertion:** No account status leaked.
- **Database State Assertion:** `linkedin_accounts` row for Tenant A is not mutated.
- **Side-Effect Assertion:** `MockUnipileClient.accounts.solveCheckpoint` is **NOT called**.
- **Cleanup Strategy:** Purge synthetic accounts.

##### Test ISO-LNK-03: Unauthorized Account Disconnection
- **Preconditions & Setup:** LinkedIn Account A has `healthStatus: "CONNECTED"` owned by Tenant A.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `POST /api/linkedin/disconnect` (targeting Account A)
- **Expected HTTP Response:** `403 Forbidden` or `404 Not Found` (or disconnect operates strictly on caller's account, leaving Account A untouched).
- **Response-Data Leakage Assertion:** No session tokens leaked.
- **Database State Assertion:**  
  `SELECT health_status FROM linkedin_accounts WHERE unipile_account_id = 'act_synth_a'` remains strictly `"CONNECTED"`.
- **Side-Effect Assertion:** `MockUnipileClient.accounts.disconnect` is **NOT called** for Account A.
- **Cleanup Strategy:** Purge synthetic accounts.

---

#### 4. Administrative Authorization Domain

##### Test ISO-ADM-01: Unprivileged Access to User Roster
- **Preconditions & Setup:** Tenant B has `role: "USER"`.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `GET /api/admin/users` and `GET /internal/admin/users`
- **Expected HTTP Response:** `403 Forbidden` (matching `admin.middleware.ts:44` contract: `"Access forbidden. You do not have administrator privileges."`).
- **Response-Data Leakage Assertion:** Response body contains `{ success: false }` and zero user objects, emails, or password hashes.
- **Database State Assertion:** User records untouched.
- **Side-Effect Assertion:** Zero telemetry recorded.
- **Cleanup Strategy:** Purge synthetic users.

##### Test ISO-ADM-02: Unprivileged Daily Agent Execution Trigger
- **Preconditions & Setup:** Tenant B has `role: "USER"`.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `POST /internal/admin/daily-agent/run/test_iso_user_a`
- **Expected HTTP Response:** `403 Forbidden`.
- **Response-Data Leakage Assertion:** No execution metadata returned.
- **Database State Assertion:**  
  `SELECT count(*) FROM daily_agent_runs WHERE user_id = 'test_iso_user_a'` remains **0**.
- **Side-Effect Assertion:** `dailyAgentWorker` is **NOT invoked**.
- **Cleanup Strategy:** Purge synthetic runs.

##### Test ISO-ADM-03: Unprivileged Global Settings Mutation
- **Preconditions & Setup:** Tenant B has `role: "USER"`.
- **Authenticated Actor:** Tenant B (JWT `tokenB`).
- **Target Route:** `POST /api/admin/settings/unipile`
- **Payload:** `{ dsn: "https://malicious.unipile.com", apiKey: "stolen_key" }`
- **Expected HTTP Response:** `403 Forbidden`.
- **Response-Data Leakage Assertion:** Master DSN and API key not leaked.
- **Database State Assertion:**  
  `SELECT unipile_dsn FROM system_settings` remains strictly unchanged.
- **Side-Effect Assertion:** Zero network connection tests triggered.
- **Cleanup Strategy:** Purge synthetic settings.

---

#### 5. Background Asynchronous Workers Domain

##### Test ISO-WRK-01: Action Queue Worker Quota & Credential Scoping
- **Preconditions & Setup:**
  - Tenant A has 1 pending action in `action_queue` with daily quota limit 25 (current: 5).
  - Tenant B has 1 pending action in `action_queue` with daily quota limit 25 (current: 24).
- **Executing Context:** Background worker (`ActionQueueWorker.processDueActions`).
- **Action:** Worker processes pending queue actions.
- **Denial / Isolation Behavior:** Worker processes Tenant A's action using Account A's credentials. When Tenant B's quota reaches 25, Tenant B's subsequent action is paused; Tenant A's queue processing is **not starved or blocked**.
- **Database State Assertion:**  
  Tenant A's quota counter increments to 6. Tenant B's quota counter reaches 25 and triggers pause. Zero cross-tenant credential usage.
- **Side-Effect Assertion:** `MockUnipileClient` records invitations sent with sender `act_synth_a` for Tenant A, and `act_synth_b` for Tenant B. Zero mixed dispatches.
- **Cleanup Strategy:** Purge synthetic queue rows.

##### Test ISO-WRK-02: Message Agent Webhook Worker BYOK Scoping
- **Preconditions & Setup:**
  - Tenant A has a personal Gemini BYOK key in `users.geminiApiKey`.
  - Tenant B has no BYOK key (relies on platform fallback).
  - An inbound message webhook arrives for Tenant A's account.
- **Executing Context:** `MessageAgentWorker.processPendingJobs`.
- **Action:** Worker triggers intent analysis and auto-reply.
- **Denial / Isolation Behavior:** Worker resolves Tenant A's specific BYOK key. Tenant B's credentials/settings are never loaded.
- **Database State Assertion:** Job status updates to `COMPLETED`. AI reply logged in Tenant A's messages.
- **Side-Effect Assertion:** `MockGeminiService` receives invocation tagged with Tenant A's BYOK identifier.
- **Cleanup Strategy:** Purge synthetic jobs and messages.

---

## 5. Distinguishing Facts, Design, Assumptions, and Unverified Claims

| Category | Item Description | Verification Source | Status |
|---|---|---|---|
| **Repository Fact** | Host runs Node.js `v24.22.1` with native ESM (`"type": "module"`), `"moduleResolution": "NodeNext"`, and `.js` import specifiers. | Inspected [`server/package.json`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/package.json) & [`server/tsconfig.json`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/tsconfig.json). | **Verified Fact** |
| **Repository Fact** | Neither Vitest nor Jest is installed in dependencies. Existing test scripts swallow runner errors and exit with code `0`. | Inspected dependency manifests and code in `server/src/scripts/`. | **Verified Fact** |
| **Repository Fact** | Controllers enforce tenant scoping in some routes via 404 (`conversation.controller.ts`), 403 via middleware (`admin.routes.ts`), and 500 via unmapped service throw (`dashboard.controller.ts`). | Inspected controller source code lines directly. | **Verified Fact** |
| **Proposed Design** | Multi-layered network sandbox (OS-level denial + fail-closed Node interceptor + in-memory stubs). | Architecture specification in Section 2. | **Proposed Design** |
| **Proposed Design** | 14-case tenant-isolation negative IDOR matrix with explicit database before/after assertions. | Architecture specification in Section 4. | **Proposed Design** |
| **Assumption** | Vitest will compile and execute cleanly alongside `typescript@^7.0.2` preview using `esbuild`. | Proposed minimal proof-of-compatibility test in Section 1.C. | **Untested Assumption** |
| **Assumption** | `postgres@^3.4.9` raw TCP socket connections can be constrained to local test databases via OS/container firewall. | Network architecture analysis in Section 2.B. | **Untested Assumption** |
| **Unverified Claim** | "The application achieves zero cross-tenant data leakage across all endpoints." | Historical claim from `SECURITY_TEST_AUDIT.md`. Disproved by absence of negative tests. | **Unverified Claim** |

---

## 6. Required Human Approvals Before WP-03 Authorization

Before transitioning from **WP-03 Planning** to active **WP-03 Implementation**, explicit human operator sign-offs are required:

1. **Sign-off on Test Framework:** Approve running the minimal isolated Vitest proof-of-compatibility test and subsequently installing `vitest` in `server/devDependencies`.
2. **Sign-off on Network Isolation Architecture:** Approve container/OS-level outbound network denial (`--network none`) supplemented by application-level fail-closed guards in `setup.ts`.
3. **Sign-off on Test Database Safety Guard:** Approve the requirement for an explicit `TEST_DATABASE_URL` with fail-closed production connection blocking and dual-phase synthetic sweeping.
4. **Sign-off on Isolation Test Matrix:** Approve the 14-case negative-test matrix and its acceptance criteria.
5. **Sign-off on Git Commit Strategy:** Decide whether to commit WP-01/WP-02 remediations into a preparation branch before starting WP-03, or keep them in the working tree.

---

## 7. Final Planning Status

**Status: `PLANNING ONLY — WP-03 NOT STARTED`**  
**WP-02 Status: `BLOCKED`**  
*(This document provides the complete, hardened architectural plan for WP-03. Application code has not been modified, no dependencies have been installed, no database connections have been made, and WP-03 will not commence until explicit human approval is received).*
