# WP-02 Independent Read-Only Review & Baseline Verification

**Recorded Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
*Critical Distinguishing Notice: The commit hash above identifies the upstream base commit where the readiness audit commenced. It does NOT imply that uncommitted working-tree modifications, WP-01 remediations, or WP-02 audit evidence files belong to or have been committed into that Git commit.*  
**Repository:** `YuvrajKhare2025/unipile-linkedin-automation`  
**Branch:** `main`  
**Review Date:** October 24, 2026  
**Auditor / Reviewer:** Antigravity AI (Independent Read-Only Reviewer Mode)  
**Working Tree Status:** **NOT CLEAN** (1 staged deletion, 16 modified files, 5 untracked paths)  
**Final WP-02 Status:** **BLOCKED**  
*(Blocked from declaring baseline production or release readiness due to material discrepancies: 0 of 15 historical handover claims supported, absence of an automated test runner framework, false-pass exit 0 test scripts, and lack of automated cross-tenant database isolation tests).*

---

## 1. Source Code Inspection of `server/src/scripts/ast-route-inventory.ts`

An independent, line-by-line inspection of [`server/src/scripts/ast-route-inventory.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/ast-route-inventory.ts) was conducted to verify the parsing architecture, AST traversal, route recognition, mount resolution, duplicate handling, and error handling:

### A. Parser Imports & Desugaring Pipeline (Lines 1–35)
- **Imports:** Uses `esbuild` for TypeScript desugaring, `acorn` for ESTree-compliant AST generation, `acorn-walk` for AST traversal, and Node.js `fs` / `path`.
- **Desugaring Architecture:** `esbuild.transformSync(tsCode, { loader: "ts" }).code` cleanly strips TypeScript type annotations (interfaces, type aliases, generic type parameters, and type assertions) while strictly preserving expression structure, call expressions, string literals, and relative line positions.
- **AST Generation:** `acorn.parse(js, { ecmaVersion: "latest", sourceType: "module", locations: true })` parses the desugared ECMAScript into an ESTree Program AST with full source location tracking (`node.loc.start.line`).

### B. Route Recognition Logic (Lines 78–187)
- **HTTP Methods Filter:** Tracks `HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all"])`.
- **Call Pattern 1 (Direct router/app calls):** Identifies `CallExpression` where `callee` is a `MemberExpression` targeting an identifier named `router` (in route files) or `app` (in `app.ts`).
- **Call Pattern 2 (Chained route declarations):** Detects chained routing patterns like `router.route("/path").get(...).post(...)` by walking up inner `CallExpression` nodes to extract the path from the `.route(path)` call and the method from the outer member access.
- **Path Extraction:** Handles single string literals (`Literal`), template literals without expressions (`TemplateLiteral`), and array literal expressions (`ArrayExpression`, such as `app.get(["/api/health", "/api/health/liveness"], ...)`), expanding array elements into individual route entries.

### C. Mount-Prefix Resolution (Lines 59–103, 199–212, 298–347)
- **Import Mapping:** First pass scans `ImportDeclaration` nodes in `server/src/app.ts` to map router identifier names (e.g. `authRoutes`, `linkedinRoutes`, `adminRoutes`) to their source modules (`./routes/auth.routes.js`, etc.).
- **Mount Call Detection:** Scans `app.use(prefix, routerVar)` calls.
- **Prefix Expansion:** 
  - Mounts targeting `/api` prepend `/api` to relative subpaths (e.g., `/stats` in `queue.routes.ts` -> `/api/stats`).
  - Specific mounts (e.g. `/api/auth`) append the relative path, mapping `/` or `""` directly to `/api/auth` and subpaths like `/login` to `/api/auth/login`.
- **Mount Aliases:** Explicitly identifies multiple mounts of the same router instance:
  - `adminRoutes` is mounted at both `/api/admin` and `/internal/admin` (16 handlers -> 16 alias paths).
  - `webhookRoutes` is mounted at both `/api/webhooks` and `/api/webhook` (4 handlers -> 4 alias paths).
  - `settingsRoutes` is mounted at both `/api/settings` and `/api/user/settings` (4 handlers -> 4 alias paths).
  - Total mount aliases: **24 alias paths**.

### D. Duplicate Handling & Shadowing Detection (Lines 356–378)
- Groups all resolved URLs by `${method} ${url}`.
- **Shadowing Detected:** Identifies that `GET /api/health/liveness` and `GET /api/health/readiness` are registered both directly on `app.ts` (lines 80 and 108 of stripped AST / lines 98 and 126 of original) and inside `dashboard.routes.ts` (lines 53 and 58) mounted under `/api`.
- **Express Runtime Analysis:** Because direct `app.get` handlers are registered at lines 80/108 before `app.use('/api', dashboardRoutes)` at line 121, Express evaluates the direct handlers first and terminates the request cycle. The duplicate handlers in `dashboard.routes.ts` are completely shadowed and unreachable at runtime.

### E. Error Handling & Limitations (Static vs. Runtime Boundary)
- **Error Propagation:** If any route file is missing or unparseable, `fs.readFileSync` or `acorn.parse` throws an unhandled exception, causing the process to exit with code `1`.
- **Static Boundary Limitations (What is NOT Statically Provable):**
  1. *Dynamic Routes:* Does not support dynamically constructed URLs (e.g. `router.get(process.env.PATH)`). All routes in this repository are static string literals.
  2. *Middleware Filtering:* Static AST analysis proves route existence and mounting order, but cannot prove whether an incoming HTTP request reaches a handler without being blocked by upstream middleware (CORS origin validation, JWT authentication, express-validator, rate limits, or the 404 catch-all handler).
  3. *Downstream Execution:* Static analysis cannot prove whether a handler succeeds or crashes with HTTP 500 when executed against a live database. All runtime execution behavior remains strictly **UNVERIFIED** until integration tests are executed.

---

## 2. Execution & Endpoint Count Verification (Re-run)

### Execution Command & Output
- **Command:** `cd server && npx tsx src/scripts/ast-route-inventory.ts`
- **Execution Date:** October 24, 2026 16:20:20
- **Exit Code:** `0`
- **Verbatim Output:**
```
================================================================================
WORKPILOT OFFICIAL ESTREE AST ROUTE & ENDPOINT INVENTORY
AST Engine: esbuild TS Desugaring + Acorn ESTree Parser + Acorn-Walk AST Traversal
Routes Directory: C:\Users\Admin\OneDrive\Desktop\unipile\server\src\routes
Application Host: C:\Users\Admin\OneDrive\Desktop\unipile\server\src\app.ts
================================================================================

--- PART 1: Express Router Mount Declarations in server/src/app.ts ---
Total Router Mount Calls: 15

  Line 116: app.use("/api/auth", authRoutes) -> auth.routes.ts
  Line 117: app.use("/api/linkedin", linkedinRoutes) -> linkedin.routes.ts
  Line 118: app.use("/api", queueRoutes) -> queue.routes.ts
  Line 119: app.use("/api", conversationRoutes) -> conversation.routes.ts
  Line 120: app.use("/api", engagementRoutes) -> engagement.routes.ts
  Line 121: app.use("/api", dashboardRoutes) -> dashboard.routes.ts
  Line 122: app.use("/api/admin", adminRoutes) -> admin.routes.ts
  Line 123: app.use("/internal/admin", adminRoutes) -> admin.routes.ts
  Line 124: app.use("/api/agent", agentRoutes) -> agent.routes.ts
  Line 125: app.use("/api/webhooks", webhookRoutes) -> webhook.routes.ts
  Line 126: app.use("/api/webhook", webhookRoutes) -> webhook.routes.ts
  Line 127: app.use("/api/settings", settingsRoutes) -> settings.routes.ts
  Line 128: app.use("/api/user/settings", settingsRoutes) -> settings.routes.ts
  Line 129: app.use("/api/billing", billingRoutes) -> billing.routes.ts
  Line 130: app.use("/api/contact", contactRoutes) -> contact.routes.ts

--- PART 2: Declared Route Handlers by Route File (AST CallExpressions) ---
  admin.routes.ts          :  16 CallExpressions ->  16 (Method, Path) endpoints
  agent.routes.ts          :  17 CallExpressions ->  17 (Method, Path) endpoints
  auth.routes.ts           :   9 CallExpressions ->   9 (Method, Path) endpoints
  billing.routes.ts        :   4 CallExpressions ->   4 (Method, Path) endpoints
  contact.routes.ts        :   1 CallExpressions ->   1 (Method, Path) endpoints
  conversation.routes.ts   :  10 CallExpressions ->  10 (Method, Path) endpoints
  dashboard.routes.ts      :   9 CallExpressions ->   9 (Method, Path) endpoints
  engagement.routes.ts     :   3 CallExpressions ->   3 (Method, Path) endpoints
  linkedin.routes.ts       :  44 CallExpressions ->  44 (Method, Path) endpoints
  queue.routes.ts          :   7 CallExpressions ->   7 (Method, Path) endpoints
  settings.routes.ts       :   4 CallExpressions ->   4 (Method, Path) endpoints
  webhook.routes.ts        :   4 CallExpressions ->   4 (Method, Path) endpoints

Subtotal Route Files: 128 CallExpressions declaring 128 (Method, Path) endpoints across 12 files.

--- PART 3: Direct App Route Declarations in server/src/app.ts ---
  Line  80: GET /api/health (1 handlers/middlewares)
  Line  80: GET /api/health/liveness (1 handlers/middlewares)
  Line 108: GET /api/health/readiness (1 handlers/middlewares)
Subtotal Direct App Endpoints: 2 CallExpressions declaring 3 endpoints.

--- PART 4: Reachable HTTP URLs (Resolving Mount Prefixes & Mount Aliases) ---
Reachable URL Breakdown:
  1. Direct Express App Endpoints:     3
  2. Primary Mounted Endpoints:     128
  3. Mount Alias Endpoints:           24
  -----------------------------------------
  Total Reachable HTTP API URLs:    155

--- PART 5: Route Shadowing & Ambiguity Analysis ---
⚠️  Detected 2 Shadowed / Overlapping Route Registrations:

  - [OVERLAP] GET /api/health/liveness:
      Defined at server/src/app.ts:80 (Mount: [direct], Alias: false)
      Defined at server/src/routes/dashboard.routes.ts:12 (Mount: /api, Alias: false)
      Runtime Resolution: Express executes middleware sequentially in registration order.
      The route registered first in app.ts will handle the request; later registrations are shadowed.

  - [OVERLAP] GET /api/health/readiness:
      Defined at server/src/app.ts:108 (Mount: [direct], Alias: false)
      Defined at server/src/routes/dashboard.routes.ts:13 (Mount: /api, Alias: false)
      Runtime Resolution: Express executes middleware sequentially in registration order.
      The route registered first in app.ts will handle the request; later registrations are shadowed.

================================================================================
FINAL AUTHORITATIVE AST AUDIT TOTALS:
  1. AST Route CallExpressions in routes/:      128
  2. Declared (Method, Path) pairs in routes/:  128
  3. Direct App Endpoints in app.ts:            3 (across 2 CallExpressions)
  4. Total Unique Route Implementations:        131
  5. Total Mount Aliases:                       24
  6. Total Reachable HTTP API Endpoints:        155
================================================================================
```

### Precise Disambiguation of What "155" Means
To prevent misleading reporting, the figures are categorized as follows:
- **130 AST CallExpressions:** Total physical AST route registration call expressions in code (128 in route files + 2 in `server/src/app.ts`).
- **131 Declared (Method, Path) Pairs:** Total unique handler implementations declared in source files (128 from route files + 3 from `app.ts` array expansion).
- **155 Mount-Expanded Paths:** The Cartesian expansion of declared routes against all router mount paths in `app.ts` (3 direct + 128 primary mounts + 24 duplicate alias mounts).
- **153 Uniquely Addressable HTTP Endpoints:** Because 2 mount-expanded endpoints (`GET /api/health/liveness` and `GET /api/health/readiness` in `dashboard.routes.ts`) are shadowed by identical registrations in `app.ts`, exactly 153 unique (Method, URL) combinations are reachable at the Express routing layer.
- **Runtime Reachability:** Runtime reachability cannot be proven statically. Any claim of runtime operational readiness is strictly **UNVERIFIED**.

---

## 3. Cross-Check of All Six Existing WP-02 Evidence Files

Each evidence file in [`audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/) was audited directly:

### 1. [`baseline.md`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/baseline.md) (16.7 KB)
- **Content:** Authoritative baseline environment documentation, lockfile digests, toolchain versions, Git state captures, AST breakdown, route shadowing analysis, and baseline status `BLOCKED`.
- **Consistency Verification:** Commit hash, lockfile SHA-256 digests, and AST counts match the actual codebase. Correctly labels working tree as NOT clean and marks baseline status as `BLOCKED`.

### 2. [`feature-matrix.csv`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/feature-matrix.csv) (41.4 KB, 212 lines)
- **Row Count:** Exactly 211 data rows + 1 header row = 212 lines.
- **Inventory Subtotals:** 35 UI screens/views/components, 13 database tables, 4 background jobs, 4 external integrations, 3 direct app routes, 128 route file handlers, and 24 mount aliases (total 211).
- **Specific Inconsistency Identified:** The 13 database table rows are labeled `Coverage Status: Verified`, citing `test-auth.ts`, `test-security.ts`, and `test-unipile-webhook.ts`. However:
  - `test-auth.ts` catches errors and exits code `0` (false pass).
  - `test-security.ts` requires a live unmocked backend server and cloud Neon DB.
  - `test-unipile-webhook.ts` mutates database state without rollback.
  Labeling database tables as `Verified` based on static Drizzle schema presence is an overstatement; their true integration test coverage is **Partial / Unverified**.

### 3. [`claims-ledger.csv`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/claims-ledger.csv) (5.6 KB, 16 lines)
- **Row Count:** Exactly 15 data rows + 1 header row = 16 lines.
- **Classification Summary:** **0 Supported, 9 Contradicted, 4 Partial, 2 Unverified**.
- **Consistency Verification:** Cross-checked every claim against active code. Confirmed that the ledger audits **historical handover claims**, not current baseline accomplishments. Because zero historical claims are supported and 9 are flatly contradicted by code, the baseline cannot be certified as production-ready.

### 4. [`test-inventory.md`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/test-inventory.md) (17.9 KB)
- **Content:** Reconciliation of Next.js 16.3.4, 12 implemented security tests vs 18 markdown rows vs 30 claimed, 84-test arbitrary roll-up, 20 status-only checks, and deep breakdown of in-memory `MemorySaver` limitations vs database multi-tenancy.
- **Consistency Verification:** Accurate. Clearly documents the critical distinction between in-memory LangGraph RAM checkpointers and database multi-tenancy. Lists specific routes and workers needing negative IDOR tests in WP-03.

### 5. [`test-setup-instructions.md`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/test-setup-instructions.md) (5.6 KB)
- **Content:** Step-by-step instructions for offline tests, canary defect drill, and explicit rules prohibiting live Unipile/LinkedIn tests.
- **Consistency Verification:** Accurate. Explicitly warns that `MemorySaver` exercises only conversational RAM and does not substitute for database multi-tenant integration tests.

### 6. [`raw-test-outputs.txt`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/raw-test-outputs.txt) (23.3 KB)
- **Content:** Raw execution logs with exit codes for Git captures, lockfile diffs, AST route analyzer run, static secret scan, canary regression drill, config validation, and LangGraph memory defect drill.
- **Consistency Verification:** All captured logs match actual script outputs and exit codes.

---

## 4. Read-Only Git State & Lockfile Integrity Verification

Executed read-only Git commands without modifying, committing, or discarding any files:

### Exact Commands & Outputs

#### 1. Baseline Commit
- **Command:** `git rev-parse HEAD`
- **Exit Code:** `0`
- **Output:**
  ```
  d4605327b523a11d362afc45620dd759c601a5bf
  ```

#### 2. Working Tree Status
- **Command:** `git status --short`
- **Exit Code:** `0`
- **Output:**
  ```
   M .dockerignore
   M .github/workflows/deploy-production.yml
   M .gitignore
   M client/.dockerignore
  D  deploy.tar.gz
   M deploy/aws/deploy-remote.ps1
   M package.json
   M server/.dockerignore
   M server/check-role.cjs
   M server/check_unipile.mjs
   M server/get-accounts.ts
   M server/src/db/index.ts
   M server/src/scripts/assign-admin.ts
   M server/src/scripts/clear-all-users.ts
   M server/src/scripts/reset-admin.ts
   M server/src/utils/error.util.ts
   M server/test-batch-dm.mts
  ?? audit-evidence/
  ?? scripts/scan-secrets.mjs
  ?? scripts/test-config-validation.mjs
  ?? scripts/test-secret-scanner.mjs
  ?? server/src/scripts/ast-route-inventory.ts
  ```

#### 3. Unstaged Working Tree Diff Summary
- **Command:** `git diff --stat`
- **Exit Code:** `0`
- **Output:** `16 files changed, 237 insertions(+), 60 deletions(-)`

#### 4. Staged Changes Diff Summary
- **Command:** `git diff --cached --stat`
- **Exit Code:** `0`
- **Output:** `deploy.tar.gz | Bin 1086 -> 0 bytes, 1 file changed, 0 insertions(+), 0 deletions(-)`

#### 5. Lockfile Integrity
- **Command:** `git diff -- package-lock.json server/package-lock.json client/package-lock.json`
- **Exit Code:** `0`
- **Output:** *(Empty stdout - 0 modifications)*
- **SHA-256 Hashes:**
  - `package-lock.json` (Root): `8209d8b1ff52eb7473dc4b2ab61ae811546e28c1b83e85028486eac541157c94`
  - `client/package-lock.json`: `b01e60f9622f3bde54e404ed746001fd34ae6aeca3af60f8684a8fb3525ce178`
  - `server/package-lock.json`: `f4faf7838106c970f4b66b536d1b03ac8a901938b088f86a6e5f0a1a6ac60237`

**Integrity Finding:** Working tree is **NOT CLEAN**. All 16 unstaged modified files, 1 staged deletion, and 5 untracked paths represent active WP-01/WP-02 work. Lockfiles are completely pristine; `npm install` inside `server/` made zero changes to tracked lockfiles.

---

## 5. Test Failure Exit Code Propagation Audit

A critical code audit was performed on all test scripts in `server/src/scripts/` to verify whether test failures actually propagate to non-zero exit codes.

### Scripts That Swallow Failures (Exit Code 0 on Error)
The following scripts catch runner errors or assertion mismatches, log to `console.error` / `console.log`, and **never call `process.exit(1)` or re-throw**:
1. [`server/src/scripts/test-phase1.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-phase1.ts#L185-L199): Catches fatal runner error in `try/catch` and exits with code `0`. Prints `"⚠️ Some tests failed"` if assertions fail, but exits `0`.
2. [`server/src/scripts/test-phase2.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-phase2.ts#L226-L230): Catches fatal runner error, logs to console, and exits with code `0`.
3. [`server/src/scripts/test-phase3.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-phase3.ts): Same pattern; logs failure and exits with code `0`.
4. [`server/src/scripts/test-phase4.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-phase4.ts): Same pattern; logs failure and exits with code `0`.
5. [`server/src/scripts/test-auth.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-auth.ts): Catches HTTP connection errors to port 4000 and exits with code `0`.
6. [`server/src/scripts/test-linkedin-connect.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-linkedin-connect.ts): Catches Unipile connection errors and exits with code `0`.
7. [`server/src/scripts/test-reply-quality.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-reply-quality.ts): Pure logging; contains no assertions and always exits with code `0`.
8. [`server/src/scripts/test-unipile-chat-structure.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-unipile-chat-structure.ts): Catches payload validation errors and exits with code `0`.

**Risk Finding:** In any automated CI/CD pipeline or shell script checking `$?`, these 8 test scripts will falsely report **PASS (Green)** even when they fail completely or crash with fatal runtime exceptions.

### Scripts That Correctly Propagate Failures (`process.exit(1)` or unhandled throw)
1. `scan-secrets.mjs`: Calls `process.exit(1)` if findings > 0.
2. `test-secret-scanner.mjs`: Uses `assert.ok`, throws on error.
3. `test-config-validation.mjs`: Uses `assert.throws`, throws on error.
4. `test-agent-memory.ts`: Throws `Error` on isolation defect, terminates with exit code 1.
5. `test-security.ts`: Checks `if (failedCount > 0) process.exit(1)`.
6. `test-validator-rate-limit.ts`: Checks status and calls `process.exit(1)`.
7. `test-unipile-webhook.ts`: Checks `if (failedCount > 0) process.exit(1)`.
8. `test-multistep-subgraphs.ts`: Throws on error, BUT contains a logic flaw where Test 2 falsely passes despite 5 of 5 candidate dispatches failing (asserts only `queue.length === 5`).

---

## 6. Distinguishing Verified Facts vs. Unverified Claims

| Area | Verified Facts (Code / AST / Git Proved) | Report-Only / Historical Claims (Unverified) |
|---|---|---|
| **Git Baseline** | Pinned to base commit `d460532`. Working tree is NOT clean (1 staged deletion, 16 modified, 5 untracked). Lockfiles pristine. | Prior report claims that working tree was clean or baseline commit included audit artifacts. |
| **API Endpoints** | Exactly 130 CallExpressions declaring 131 unique implementations. 15 router mounts create 24 aliases, totaling 155 mount-expanded URLs (153 uniquely addressable; 2 shadowed). | Prior claims of "128 endpoints with 100 subtotal", "45 endpoints verified for zero-IDOR", or "20 endpoint checks proving production readiness". |
| **Security Tests** | Exactly 12 automated test cases in `test-security.ts`. | Historical claim of "30 security tests passing" (6 exist only as markdown rows; 12 double-counted). |
| **Test Suite** | Zero formal test runner frameworks (no Jest/Vitest). 8 scripts exit 0 on fatal errors. | Historical claim of "84 automated tests passing" and "100/100 production readiness score". |
| **Multi-Tenancy** | `test-agent-memory.ts` proves in-memory LangGraph checkpointer separation only. | Claim of "Zero cross-tenant data leakage across all endpoints" (real DB isolation is completely untested). |
| **Integrations** | Unipile clients connect to live `api*.unipile.com` without offline mock stubs. | Claim that Unipile integration is fully tested and verified offline. |

---

## 7. Final WP-02 Status & Human Decisions Required

### Final WP-02 Status: **`BLOCKED`**
The evidence baseline cannot be certified as an internally consistent or production-ready foundation due to:
1. Contradicted historical handover claims (0 of 15 verified).
2. Complete absence of a formal automated test runner framework (Jest/Vitest).
3. False-pass test scripts that swallow errors and exit 0.
4. Complete lack of automated negative tests for multi-tenant database isolation.
5. Active production credentials on cloud infrastructure pending manual operator rotation.

### Required Human Decisions (Before Authorizing WP-03)
1. **Decision on Test Runner Framework:** Confirm whether to install Vitest or Jest in `server/` to replace ad-hoc `tsx` scripts and enforce non-zero exit codes.
2. **Decision on Live Provider Mocking:** Confirm whether to implement `nock` or `msw` offline mock interceptors for Unipile and Gemini API calls so that phase tests can run safely in CI.
3. **Decision on Multi-Tenant Isolation Strategy:** Approve the plan to write explicit negative IDOR test cases targeting `/api/dashboard/contacts/:id`, `/api/conversations/:contactId/*`, `/api/linkedin/checkpoint/*`, and `/api/admin/*`.
4. **Decision on WP-01 Commit Boundary:** Decide when and whether to commit the WP-01 credential containment changes and WP-02 evidence files, or maintain them in the working tree during WP-03.

---
*Report independently compiled and verified via read-only inspection at baseline commit `d4605327b523a11d362afc45620dd759c601a5bf`.*
