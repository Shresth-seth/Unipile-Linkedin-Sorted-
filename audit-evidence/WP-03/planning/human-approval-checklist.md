# WP-03 Human-Approval & Readiness Checklist
## Pre-Implementation Governance, Decision Gates, and Technical Verifications

**Document ID:** `WP-03-CHK-01`  
**Reference Planning Baseline:** [`audit-evidence/WP-03/planning/decision-and-architecture.md`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-03/planning/decision-and-architecture.md)  
**WP-02 Baseline Status:** **`BLOCKED`**  
**WP-03 Status:** **`PLANNING ONLY — WP-03 NOT STARTED`**  
**Recorded Upstream Base Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
*Critical Distinguishing Notice: The commit hash above identifies the upstream baseline commit where the readiness audit began. It does NOT imply that uncommitted working-tree modifications, WP-01 remediations, or audit evidence belong to or have been committed into that Git commit.*  
**Author:** Antigravity AI  

---

## 1. Governance Separation: Human Decisions vs. Technical Verifications

To maintain strict engineering rigor, items requiring **human operator authorization** are strictly separated from **technical facts that must be empirically proven** before implementation.

```
┌────────────────────────────────────────────────────────┐     ┌────────────────────────────────────────────────────────┐
│             HUMAN OPERATOR DECISION GATES              │     │             TECHNICAL VERIFICATION TASKS               │
│  (Policy, architecture, scope, and commit decisions)   │     │ (Empirical proofs required before code implementation) │
├────────────────────────────────────────────────────────┤     ├────────────────────────────────────────────────────────┤
│ [ ] Gate 1: Vitest runner adoption & migration scope   │     │ [ ] Task A: Isolated Vitest compatibility POC run      │
│ [ ] Gate 2: Multi-layer network denial architecture    │     │ [ ] Task B: Database isolation proof via canary marker │
│ [ ] Gate 3: Test database policy & safety boundaries   │     │ [ ] Task C: Local PostgreSQL loopback connection proof │
│ [ ] Gate 4: 14-case negative-test matrix sign-off      │     │ [ ] Task D: CRM stage 500 controller contract check    │
│ [ ] Gate 5: Git working tree preservation invariant    │     │ [ ] Task E: Legacy assertion preservation audit        │
│ [ ] Gate 6: Authorize cloud credential rotation        │     │                                                        │
└────────────────────────────────────────────────────────┘     └────────────────────────────────────────────────────────┘
```

---

## 2. Decision Gate 1: Test Framework Selection & Compatibility Proof

### Human Decision Required
- [ ] **Approve Vitest as the Official Test Framework:**  
  Authorize adopting Vitest in `server/` to resolve the repository's native ESM (`"type": "module"`), TypeScript `NodeNext` (`.js` import specifiers), and exit-code propagation defects.

### Technical Facts to Empirically Verify (Before Installation)
- **Known Repository Facts:** Stack runs Node.js `v24.22.1`, native ESM, TypeScript with `NodeNext` resolution, `drizzle-orm@0.45.2`, `@langchain/core@1.2.9`, and `tsx@4.23.13`. Neither Vitest nor Jest is currently installed.
- **Untested Assumption:** Compatibility between Vitest's runner and the specific `typescript@^7.0.2` preview binary (`@typescript/typescript-win32-x64`) has not yet been demonstrated in an active execution.
- **Minimum Safe Proof-of-Compatibility (To Be Executed ONLY After Authorization):**
  1. Create an isolated temporary scratch file `scratch/vitest-poc.test.ts` outside application code:
     ```typescript
     import { describe, it, expect } from "vitest";
     import { FakeListChatModel } from "@langchain/core/utils/testing";

     describe("Vitest Node 24 ESM Compatibility Proof", () => {
       it("validates esbuild desugaring and LangGraph testing tools", async () => {
         const model = new FakeListChatModel({ responses: ["PONG"] });
         const res = await model.invoke("PING");
         expect(res.content).toBe("PONG");
       });
     });
     ```
  2. Execute via one-off NPX invocation without modifying `package.json` or `package-lock.json`:
     ```powershell
     npx vitest run scratch/vitest-poc.test.ts
     ```
  3. Verify exit code `0` and clean termination, then immediately remove the scratch file.

### Assertion Preservation Invariant
- Existing ad-hoc test scripts in `server/src/scripts/` contain domain assertions (e.g. LangGraph in-memory state in [`test-agent-memory.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-agent-memory.ts), cryptographic signature checks in [`test-saas-foundation.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-saas-foundation.ts)).
- **Rule:** When porting legacy scripts into Vitest test suites, all existing domain assertions must be preserved 1:1. Zero assertions may be removed, relaxed, or bypassed.

---

## 3. Decision Gate 2: Multi-Layered Offline Network Sandbox Boundary

### Human Decision Required
- [ ] **Approve Multi-Layered Network Denial Boundary:**  
  Acknowledge that application-level monkey-patching of `globalThis.fetch` is **not a complete network sandbox** and approve the multi-layered defense-in-depth architecture.

### Technical Facts to Empirically Verify
- **Inventory of Codebase Transports:**
  - Raw TCP/TLS Sockets: The PostgreSQL driver (`postgres@^3.4.9` in [`server/src/db/index.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/db/index.ts)) communicates via raw TCP sockets on port 5432, completely bypassing `fetch` and `http.request`.
  - Global Fetch & HTTP/HTTPS: [`unipile.client.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/unipile/unipile.client.ts), Resend API, Razorpay API.
  - SDK Internal Transports: Google Generative AI internal HTTP transport.
  - Subprocesses: Potential `node:child_process` invocations.

### Mandatory Boundary Specifications
1. **Layer 1: OS / Container-Level Network Denial (Primary Boundary):**
   - In containerized CI: Tests must run in Docker with `--network none` (or an internal isolated bridge with zero external gateway routing).
   - Outbound egress to the public internet must be physically blocked at the host network layer.
2. **Safe Local PostgreSQL Access:**
   - Local database communication must occur strictly over Unix domain socket or localhost loopback (`127.0.0.1:5432`) on the local host or via an internal Docker bridge network (`internal: true`).
   - Sibling database container is accessible on the internal bridge, while all outbound gateway routing to external IPs is dropped.
3. **Layer 2: Application Fail-Closed Guard (Defense-in-Depth in `setup.ts`):**
   - Intercepts `globalThis.fetch`, `http.request`, `https.request`, and `net.Socket.prototype.connect`.
   - Aborts with `[NETWORK HAZARD BLOCKED]` on any non-localhost hostnames (`*.unipile.com`, `*.googleapis.com`, `api.razorpay.com`, `api.resend.com`).
4. **Layer 3: Deterministic In-Memory Stubs:**
   - `MockUnipileClient`, `FakeListChatModel`, and synthetic webhook fixtures.

---

## 4. Decision Gate 3: Dedicated Test Database Safety & Isolation Proof

### Human Decision Required
- [ ] **Approve Test Database Safety & Isolation Policy:**  
  Approve the requirement for an explicitly declared `TEST_DATABASE_URL`, fail-closed connection blocking, and dual-phase sweeping.

### Proving Test Database Isolation (Without Connecting to Production)
Relying only on hostname or database-name string patterns is insufficient. The test suite must prove database isolation **without ever establishing a connection to production**:

1. **Zero Connection to Production Invariant:**  
   The test runner must **never** read or connect to `DATABASE_URL` (production DSN) to compare databases. It reads `TEST_DATABASE_URL` exclusively.
2. **Local Target & Name Pattern Guard:**  
   `TEST_DATABASE_URL` must point to `localhost` or `127.0.0.1`, and the database name must explicitly contain `test` (e.g. `workpilot_test_db`). Strings containing `neon.tech` or cloud endpoints immediately abort.
3. **The Negative Canary Probe / Isolation Token Proof:**
   - Before executing tests, the runner queries the target database for a dedicated canary marker table:
     ```sql
     SELECT is_isolated_test_sandbox, canary_token 
     FROM test_environment_marker 
     LIMIT 1;
     ```
   - If the `test_environment_marker` table is missing, or `is_isolated_test_sandbox` is not `true`, the runner **fails closed and halts immediately**.
   - If the database contains real user records (e.g. `SELECT count(*) FROM users WHERE email NOT LIKE '%@workpilot.test'` > 0), the runner **aborts immediately**, preventing execution against a copied production database.
4. **Residual-Data Risk & Dual-Phase Sweeping:**
   - If an earlier test crashed, residual synthetic rows could pollute subsequent runs.
   - **Pre-Run Sweep (`beforeAll`):** Unconditionally purges `test_iso_%` records across all tables before tests run.
   - **Per-Test Rollback (`afterEach`):** Wraps test queries in transactional rollbacks (`ROLLBACK`).
   - **Post-Run Sweep (`afterAll`):** Re-runs purge to leave the database clean.
5. **No DB Connections in Planning:** Zero database connections were established during this planning task.

---

## 5. Decision Gate 4: 14-Case Tenant-Isolation Negative-Test Matrix

### Human Decision Required
- [ ] **Approve the 14-Case Isolation Test Matrix as Proposed:**  
  Acknowledge that the matrix remains proposed until route contracts and synthetic fixtures are verified, and approve flagging the CRM 500 behavior as a defect.

### Defect Flag: `PATCH /api/dashboard/contacts/:id/stage` Returning HTTP 500
- **Observed Controller Reality:**  
  In [`crm.service.ts:139`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/crm/crm.service.ts#L139), when `userId` does not match, Drizzle returns 0 rows and the service throws `Error("Contact <id> not found.")`.  
  In [`dashboard.controller.ts:101`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/dashboard.controller.ts#L101), the generic `catch` block catches this error and returns:  
  `res.status(500).json({ success: false, error: error.message })`.
- **Defect Classification:**  
  An unhandled service exception leaking as HTTP 500 is a **potential controller defect**, not an intentional passing authorization outcome. The proper REST contract should return `404 Not Found` (matching `conversation.controller.ts`) or `403 Forbidden`.
- **Testing Approach:**  
  The test assertion must verify that **zero database mutation occurs** (stage remains unchanged) while flagging the 500 status code as an unmapped error handling defect to be remediated.

### Summary of 14 Proposed Negative Test Cases
1. `ISO-CRM-01` (`GET /api/dashboard/contacts`): Tenant B receives only own contacts; 0 bytes of Contact A returned.
2. `ISO-CRM-02` (`PATCH /api/dashboard/contacts/:id/stage`): Tenant B cannot update Contact A stage; stage remains `"LEAD"`.
3. `ISO-CRM-03` (`GET /api/dashboard/contacts/:id`): Tenant B direct IDOR access denied.
4. `ISO-MSG-01` (`GET /api/conversations/:contactId/messages`): Returns 404; zero Tenant A message history leaked.
5. `ISO-MSG-02` (`POST /api/conversations/:contactId/reply`): Returns 404; zero messages inserted into DB; Unipile mock not called.
6. `ISO-MSG-03` (`POST /api/conversations/:contactId/takeover`): Returns 404; `conversation_mode` remains `"AUTO"`.
7. `ISO-LNK-01` (`GET /api/linkedin/checkpoint/status/:accountId`): Returns 404; zero 2FA challenge hints leaked.
8. `ISO-LNK-02` (`POST /api/linkedin/checkpoint/solve`): Returns 404; Tenant A account not mutated; Unipile mock not called.
9. `ISO-LNK-03` (`POST /api/linkedin/disconnect`): Denies disconnecting Tenant A; `healthStatus` remains `"CONNECTED"`.
10. `ISO-ADM-01` (`GET /api/admin/users`): Regular user receives 403 Forbidden; zero user roster leaked.
11. `ISO-ADM-02` (`POST /internal/admin/daily-agent/run/:userId`): Regular user receives 403 Forbidden; 0 agent runs created.
12. `ISO-ADM-03` (`POST /api/admin/settings/unipile`): Regular user receives 403 Forbidden; master DSN unchanged.
13. `ISO-WRK-01` (`ActionQueueWorker`): Queue actions execute strictly with owning account credentials; quota separated.
14. `ISO-WRK-02` (`MessageAgentWorker`): Inbound jobs resolve AI settings and BYOK key strictly for owning tenant.

---

## 6. Decision Gate 5: Mandatory Git Working Tree Preservation Invariant

### Human Decision Required
- [ ] **Approve Git Working Tree Preservation Strategy:**  
  Decide whether to commit WP-01/WP-02 remediations into a preparation branch before starting WP-03, or maintain them in the working tree.

### Non-Negotiable Preservation Invariant
All existing staged, unstaged, and untracked changes must be preserved. **Zero resets, checkouts, discards, or clean commands may be suggested or run.**

- **Recorded Upstream Base Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`
- **Staged Changes (1 file):** `D  deploy.tar.gz` (staged deletion containing unencrypted production keys; must NOT be unstaged or committed yet).
- **Unstaged Modified Changes (16 files):** Active WP-01 credential containment and sanitization (`.dockerignore`, `.gitignore`, `.github/workflows/deploy-production.yml`, `client/.dockerignore`, `deploy/aws/deploy-remote.ps1`, `package.json`, `server/.dockerignore`, `server/check-role.cjs`, `server/check_unipile.mjs`, `server/get-accounts.ts`, `server/src/db/index.ts`, `server/src/scripts/assign-admin.ts`, `server/src/scripts/clear-all-users.ts`, `server/src/scripts/reset-admin.ts`, `server/src/utils/error.util.ts`, `server/test-batch-dm.mts`).
- **Untracked Paths (5 paths):** [`audit-evidence/`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/), [`scripts/scan-secrets.mjs`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/scripts/scan-secrets.mjs), [`scripts/test-config-validation.mjs`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/scripts/test-config-validation.mjs), [`scripts/test-secret-scanner.mjs`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/scripts/test-secret-scanner.mjs), and [`server/src/scripts/ast-route-inventory.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/ast-route-inventory.ts).
- **Tracked Lockfiles:** `package-lock.json`, `client/package-lock.json`, `server/package-lock.json` are completely untouched (zero `git diff`).

---

## 7. Separate Authorized-Operator Action: WP-01 Cloud Credential Rotation

### Human Operator Action Required (External Cloud Systems)
- [ ] **Authorized-Operator Cloud Credential Rotation (Separate Out-of-Band Task):**  
  Acknowledge that live cloud credentials remain active on external third-party infrastructure and require manual operator rotation outside this codebase:
  1. **Neon PostgreSQL:** Rotate the database user password (`npg_NoBl***`) via the Neon Console.
  2. **Unipile Gateway:** Rotate the master DSN API key via the Unipile Developer Dashboard.
  3. **AWS EC2:** Remove the exposed public key from `~ubuntu/.ssh/authorized_keys` on the EC2 host and generate a new key pair via AWS EC2 Management Console.
  *This action is strictly out-of-scope for automated codebase testing and remains an independent prerequisite for release.*

---

## 8. Summary of Active Blockers & Final Status

### Active Blockers Preventing Release Gate Closure
1. **Live Cloud Credentials Active (WP-01 Blocker):** Database passwords and API keys remain active on cloud consoles pending operator rotation.
2. **Contradicted Handover Baseline (WP-02 Blocker):** 0 of 15 historical claims supported by code; historical dossier cannot serve as release evidence.
3. **Missing Automated Test Runner (WP-02 Blocker):** Neither Vitest nor Jest is installed.
4. **False-Pass Scripts in Repository (WP-02 Blocker):** 8 test scripts swallow errors and exit code 0.
5. **Untested Multi-Tenant Database Isolation (WP-02 Blocker):** Real PostgreSQL queries and REST controllers currently lack automated negative IDOR tests.

---

### Final Governance Status
**`PLANNING ONLY — WP-03 NOT STARTED`**  
**`WP-02 Baseline Status: BLOCKED`**  
*(This checklist establishes the required human decision gates and empirical verification criteria. No implementation may begin until explicit human authorization is granted).*
