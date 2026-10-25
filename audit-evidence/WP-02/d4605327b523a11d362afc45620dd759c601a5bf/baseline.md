# WP-02 Evidence Baseline & System Inventory

**Recorded Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
*Important Distinguishing Notice: The commit hash above identifies the upstream baseline commit where this audit commenced. It does NOT assert that uncommitted working tree modifications or audit evidence files belong to or have been committed into that Git commit.*  
**Repository:** `YuvrajKhare2025/unipile-linkedin-automation`  
**Branch:** `main`  
**Audit Date:** October 24, 2026  
**Auditor / Agent:** Antigravity AI  
**Working Tree Status:** **NOT CLEAN** (1 staged deletion, 16 modified files, 5 untracked paths)  
**WP-02 Baseline Status:** **BLOCKED**  
*(Blocked from declaring baseline production or release readiness due to material discrepancies: 0 of 15 historical handover claims supported, absence of an automated test runner framework, false-pass exit 0 test scripts, and lack of automated cross-tenant database isolation tests).*

---

## 1. Frozen Baseline Environment & Toolchain

### Toolchain & Runtime Versions
- **Host Operating System:** Windows 11 Pro 64-bit (`Windows-11-10.0.26200-SP0`)
- **Node.js:** `v24.22.1`
- **npm:** `12.2.1`
- **TypeScript (Backend):** `^7.0.2` (in `server/package.json`)
- **TypeScript (Frontend):** `^5` (in `client/package.json`)
- **Python:** `3.13.14`
- **Git:** `git version 2.54.0.windows.1`
- **Frontend Framework:** `next@16.3.4` with `react@19.2.8` (Locked in `client/package-lock.json`)

### Authoritative Lockfile Hashes (SHA-256)
| File | Size (Bytes) | SHA-256 Digest | Status after `npm install` |
|---|---|---|---|
| `package-lock.json` (Root) | 2,752 | `8209d8b1ff52eb7473dc4b2ab61ae811546e28c1b83e85028486eac541157c94` | Unchanged (`git diff` clean) |
| `client/package-lock.json` | 240,498 | `b01e60f9622f3bde54e404ed746001fd34ae6aeca3af60f8684a8fb3525ce178` | Unchanged (`git diff` clean) |
| `server/package-lock.json` | 134,845 | `f4faf7838106c970f4b66b536d1b03ac8a901938b088f86a6e5f0a1a6ac60237` | Unchanged (`git diff` clean) |

*Note: `npm install` was run inside `server/` to provide local dependencies (`node_modules`) for script execution. As verified by SHA-256 comparison and `git diff -- package-lock.json server/package-lock.json client/package-lock.json`, zero tracked files or lockfiles were modified.*

### Authoritative Git State Captures

#### `git rev-parse HEAD` (Exit Code: 0)
```
d4605327b523a11d362afc45620dd759c601a5bf
```

#### `git status --short` (Exit Code: 0)
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

#### `git diff --stat` (Unstaged Working Tree Changes, Exit Code: 0)
```
 .dockerignore                           | 12 +++++++
 .github/workflows/deploy-production.yml | 11 +++++++
 .gitignore                              | 15 +++++++++
 client/.dockerignore                    | 11 ++++++-
 deploy/aws/deploy-remote.ps1            | 30 +++++++++++++----
 package.json                            |  6 +++-
 server/.dockerignore                    | 11 ++++++-
 server/check-role.cjs                   | 24 ++++++++++++--
 server/check_unipile.mjs                | 57 +++++++++++++++++++++++++--------
 server/get-accounts.ts                  | 11 ++++++-
 server/src/db/index.ts                  | 14 +++++---
 server/src/scripts/assign-admin.ts      | 33 ++++++++++++-------
 server/src/scripts/clear-all-users.ts   |  8 +++--
 server/src/scripts/reset-admin.ts       | 27 ++++++++++------
 server/src/utils/error.util.ts          | 17 ++++++++--
 server/test-batch-dm.mts                | 10 ++++--
 16 files changed, 237 insertions(+), 60 deletions(-)
```

#### `git diff --cached --stat` (Staged Changes, Exit Code: 0)
```
 deploy.tar.gz | Bin 1086 -> 0 bytes
 1 file changed, 0 insertions(+), 0 deletions(-)
```

#### Working Tree Explanation
The working tree is **NOT clean**. It contains:
1. **Committed at Baseline Commit (`d460532`):** Upstream code prior to WP-01.
2. **Staged Changes (1 file):** `deploy.tar.gz` staged for deletion (contains sensitive unencrypted deployment keys and .env files contained during WP-01).
3. **Unstaged Modified Changes (16 files):** Active WP-01 containment and sanitization fixes (.dockerignore, .gitignore, CI workflow, deploy script, package.json, server utility and maintenance scripts).
4. **Untracked Paths (5 paths):** `audit-evidence/` (WP-02 audit dossier), `scripts/scan-secrets.mjs`, `scripts/test-config-validation.mjs`, `scripts/test-secret-scanner.mjs` (WP-01 validation scripts), and `server/src/scripts/ast-route-inventory.ts` (official AST route analyzer).
5. **Preservation Invariant:** All files are preserved. Zero files were reset, discarded, cleaned, or committed.

---

## 2. Historical Claims Ledger vs. Baseline Status

The 15 claims recorded in [`claims-ledger.csv`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/claims-ledger.csv) represent **Historical Handover Claims** made by previous authors in the WorkPilot Handover Dossier, Architecture Reports, and markdown trackers. They do **not** represent claims about what Antigravity built.

When audited against actual repository code at baseline commit `d460532`, the findings are:
- **Supported: 0** (Zero of the 15 major historical production-readiness claims are verified by code).
- **Contradicted: 9** (Live credentials remained in maintenance scripts, Next.js 15.3 was claimed instead of 16.3.4, only 12 of 30 security tests exist in code, the 84-test total was an arbitrary sum of unexecuted table rows and roadmap steps, 100/100 readiness score was based purely on `tsc --noEmit`, etc.).
- **Partial: 4** (BYOK key loading exists but lacks invalid-key isolation; deduplication tables exist but high-concurrency race conditions lack transactional row locks; tenant scoping exists in dashboard routes but is missing in admin routes; CI workflow lacked security gates until WP-01).
- **Unverified: 2** (AWS $30/mo cost claims omit per-account Unipile fees; automated disaster recovery checklist entries have no code or infrastructure implementation).

Because these material discrepancies between historical claims and codebase reality remain unresolved, **WP-02 is marked BLOCKED**. The baseline cannot be declared "internally consistent" or ready for release gates until these fundamental issues are remediated.

---

## 3. Product Behavior Inventory Summary

### A. UI Screens & Navigation (35 Views)
- **Public & Marketing (8):** `/` (Landing), `/about`, `/contact`, `/how-it-works`, `/pricing`, `/privacy`, `/terms`, `/product`, `/resources`.
- **Authentication & Recovery (5):** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`.
- **Integrations & Callbacks (1):** `/linkedin/callback` (Unipile hosted redirect).
- **Core User Dashboard (10 Views):** `/dashboard` with dynamic subviews: `agent`, `campaigns`, `integrations`, `messages`, `prospects`, `settings`, `activity`, `training`, `automation`.
- **Admin Panel (5 Views):** `/admin`, `/admin/accounts`, `/admin/queue`, `/admin/settings`, `/admin/users`.
- **Product Interactive Demos & Components (6):** `discovery-transform.tsx`, `product-hero-preview.tsx`, `login-form.tsx`, `register-form.tsx`, `contact-form.tsx`.

---

### B. Official ESTree AST Route & Reachable URL Inventory

#### Inventory Methodology
The route inventory was conducted using a genuine JavaScript/TypeScript Abstract Syntax Tree (AST) analyzer:
- **Engine:** `esbuild` TypeScript desugaring + `acorn` ESTree parser + `acorn-walk` AST traversal.
- **Script:** [`server/src/scripts/ast-route-inventory.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/ast-route-inventory.ts).
- **Execution Command:** `cd server && npx tsx src/scripts/ast-route-inventory.ts` (Exit Code: 0).
- **Verification:** Every CallExpression, array argument, router mount, chained route, and direct app registration was traversed and mapped to exact line numbers in source files.

#### Verified AST Totals
1. **Route CallExpressions in Route Files:** **128** CallExpressions across 12 files in `server/src/routes/*.ts`.
2. **Declared (Method, Path) Pairs in Route Files:** **128** endpoints (no array literals used in router files; exactly 1 path per declaration).
3. **Direct App Declarations in `server/src/app.ts`:** **2** CallExpressions declaring **3** endpoints:
   - Line 80: `app.get(["/api/health", "/api/health/liveness"], ...)` -> 2 endpoints
   - Line 108: `app.get("/api/health/readiness", ...)` -> 1 endpoint
4. **Total Unique Route Implementations:** **131** (128 router handlers + 3 direct app handlers).
5. **Express Router Mounts in `server/src/app.ts`:** **15** total `app.use` router mounts, including **3 duplicate alias mounts**:
   - `app.use('/internal/admin', adminRoutes)` -> 16 alias paths
   - `app.use('/api/webhook', webhookRoutes)` -> 4 alias paths
   - `app.use('/api/user/settings', settingsRoutes)` -> 4 alias paths
   - Total Mount Aliases = **24 endpoints**.
6. **Total Reachable HTTP API Endpoints:** **155** (131 unique implementations + 24 mount aliases).

#### Detailed Breakdown by Route File
| Route File | AST CallExpressions | Declared Endpoints | Primary Mount | Alias Mounts | Reachable URLs |
|---|:---:|:---:|---|---|:---:|
| [`admin.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/admin.routes.ts) | 16 | 16 | `/api/admin` | `/internal/admin` (16) | 32 |
| [`agent.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/agent.routes.ts) | 17 | 17 | `/api/agent` | None | 17 |
| [`auth.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/auth.routes.ts) | 9 | 9 | `/api/auth` | None | 9 |
| [`billing.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/billing.routes.ts) | 4 | 4 | `/api/billing` | None | 4 |
| [`contact.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/contact.routes.ts) | 1 | 1 | `/api/contact` | None | 1 |
| [`conversation.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/conversation.routes.ts) | 10 | 10 | `/api` | None | 10 |
| [`dashboard.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/dashboard.routes.ts) | 9 | 9 | `/api` | None | 9 |
| [`engagement.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/engagement.routes.ts) | 3 | 3 | `/api` | None | 3 |
| [`linkedin.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/linkedin.routes.ts) | 44 | 44 | `/api/linkedin` | None | 44 |
| [`queue.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/queue.routes.ts) | 7 | 7 | `/api` | None | 7 |
| [`settings.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/settings.routes.ts) | 4 | 4 | `/api/settings` | `/api/user/settings` (4) | 8 |
| [`webhook.routes.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/routes/webhook.routes.ts) | 4 | 4 | `/api/webhooks` | `/api/webhook` (4) | 8 |
| **Direct [server/src/app.ts](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/app.ts)** | 2 | 3 | `[direct]` | None | 3 |
| **Total** | **130** | **131** | | **24** | **155** |

#### Route Shadowing & Ambiguity Analysis
The AST traversal detected **2 overlapping / shadowed route registrations**:
1. `GET /api/health/liveness`:
   - Registered at `server/src/app.ts:80` (Direct `app.get`)
   - Registered at `server/src/routes/dashboard.routes.ts:12` (Mounted under `/api`)
2. `GET /api/health/readiness`:
   - Registered at `server/src/app.ts:108` (Direct `app.get`)
   - Registered at `server/src/routes/dashboard.routes.ts:13` (Mounted under `/api`)
- **Runtime Resolution:** Express matches routes sequentially in registration order. In `server/src/app.ts`, the direct `app.get` handlers are registered at lines 80 and 108, before `app.use('/api', dashboardRoutes)` at line 121. Therefore, the direct app handlers intercept all requests; the identical declarations in `dashboard.routes.ts` are shadowed and unreachable.

#### Root Cause of Historical 128 vs 100 Handover Discrepancy
- The historical handover summary claimed **128 endpoints** because the author ran a count on `server/src/routes/*.ts` (which has exactly 128 route handlers).
- When drafting the markdown report summary, the author hastily approximated numbers in an uncurated bullet list (writing 16 instead of 44 for LinkedIn, and 8 instead of 17 for Agent), which happened to sum to 100.
- Both figures failed to account for direct `app.ts` handlers (+3) and mount aliases (+24), which create the real runtime surface of **155 reachable HTTP endpoints**.

---

### C. Database Models (13 Relational Tables via Drizzle ORM)
1. `users` — Authentication credentials, role (`USER`/`ADMIN`), personal Gemini BYOK key.
2. `linkedin_accounts` — Connected Unipile accounts, health status, AES-256-GCM encrypted session credentials.
3. `contacts` — CRM prospect records, 10 pipeline stages, manual takeover flag.
4. `daily_agent_settings` — Agent reply mode (`AUTO`/`MANUAL`), daily connection quotas.
5. `daily_agent_runs` — Atomic calendar date run keys (`YYYY-MM-DD`) preventing double-execution.
6. `webhook_events` — Deduplication tracking for incoming Unipile events.
7. `message_agent_jobs` — Durable processing queue for inbound LinkedIn messages.
8. `messages` — Conversation history, message direction (`IN`/`OUT`), sentiment, delivery status.
9. `action_queue` — Outbound scheduled tasks with randomized jitter execution timestamps.
10. `system_settings` — Encrypted global config (Unipile DSN/key, default Gemini model).
11. `billing_events` — Razorpay payment tracking.
12. `auth_tokens` — Refresh session and token revocation registry.
13. `agent_messages` — In-memory LangGraph short-term memory message backup.

---

### D. Background Workers & Schedulers
1. **Action Queue Worker:** In-process 30-second interval polling `action_queue` where `status = 'PENDING'` and `executeAt <= NOW()`. Dispatches connection invites and messages.
2. **Inbound Message Worker:** In-process 30-second interval polling `message_agent_jobs`. Invokes LangChain/Gemini intent triage.
3. **LinkedIn Polling Sync:** In-process 30-second fallback poller querying Unipile relations.
4. **Daily Outreach Agent:** Batch job (`server/src/jobs/run-daily-agent.ts`) triggered manually or via cron.

---

### E. External Cloud Integrations
- **Unipile API Gateway:** Third-party bridge for LinkedIn messaging, relations, and auth.
- **Google Gemini AI:** LangChain Generative AI integration (`gemini-2.5-flash`) for intent detection and messaging.
- **Razorpay:** Payment gateway for SaaS monthly and annual subscriptions.
- **Resend:** Transactional email delivery service.

---

## 4. Evidence File Manifest & Verification

All evidence files are stored in `audit-evidence/WP-02/d4605327b523a11d362afc45620dd759c601a5bf/`:
1. `baseline.md`: Authoritative environment state, Git captures, lockfile digests, and AST system inventory.
2. `feature-matrix.csv`: Comprehensive 211-row machine-readable matrix mapping all 35 UI screens, 13 DB models, 4 background jobs, 4 integrations, 131 unique endpoints, and 24 mount aliases to test coverage and ownership.
3. `claims-ledger.csv`: 15 historical claims audited against source code and categorized as Supported (0), Contradicted (9), Partial (4), or Unverified (2).
4. `test-inventory.md`: Complete audit of all test scripts, detailing test quality flaws, false pass patterns, endpoint reconciliations, and test isolation limitations.
5. `test-setup-instructions.md`: Step-by-step instructions for reproducing safe offline test executions, identifying blocked live provider scripts, and defining test boundary requirements.
6. `raw-test-outputs.txt`: Exact stdout/stderr captures with exit codes for Git state commands, lockfile verification, AST route analyzer run, secret scanner static checks, regression tests, config validation tests, and LangGraph memory isolation tests (including controlled defect drills).
