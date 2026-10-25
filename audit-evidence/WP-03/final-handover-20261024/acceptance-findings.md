# Work Package WP-03: Acceptance Findings

**Target Commit Baseline:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Run ID:** `final-handover-20261024`  
**Document ID:** `WP-03-ACCEPT-01`  
**Date:** 2026-10-24T17:58:00+05:30  
**Current Status:** **`PARTIALLY COMPLETE`**  

---

## 1. Summary of Acceptance Findings

| Item | Component / Scope | Evidence / Implementation Reference | Result | Impact / Limitations |
|---|---|---|---|---|
| **F-01** | **Vitest ESM Runner & Setup** | [`vitest.config.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/vitest.config.ts), [`setup.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts) | **VERIFIED** | Runs natively under Node.js v24 ESM without transpiler overhead; exit code 1 on failure. |
| **F-02** | **Fail-Closed Network Guard** | [`network-guard.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/network-guard.test.ts) (6 tests) | **VERIFIED (APPLICATION LEVEL)** | Blocks `fetch`, `http.request`, `https.request` to Unipile, Gemini, Razorpay, Resend. Does not sandbox raw sockets or child processes. |
| **F-03** | **CRM Stage Defect Remediation** | [`crm.service.ts:139`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/crm/crm.service.ts#L139), [`dashboard.controller.ts:98-106`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/dashboard.controller.ts#L98-L106) | **VERIFIED & REFINED** | Converts unauthorized CRM update from HTTP 500 to HTTP 404. Uses typed `NotFoundError`. |
| **F-04** | **Database Error 404 Masking Prevention** | [`dashboard.controller.ts:104`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/dashboard.controller.ts#L104), [`crm-stage-defect.test.ts:153-195`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/crm-stage-defect.test.ts#L153-L195) | **VERIFIED** | Ensures internal database errors (e.g. `relation not found`) return HTTP 500 with sanitized message, not 404. |
| **F-05** | **Legacy Memory & Crypto Preservation** | [`migrated-legacy.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/migrated-legacy.test.ts) (7 tests) | **VERIFIED** | Preserves 100% of legacy assertions from `test-saas-foundation.ts` and `test-agent-memory.ts`. |
| **F-06** | **14-Case Tenant Isolation Matrix** | [`tenant-isolation.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/tenant-isolation.test.ts) (14 tests) | **VERIFIED (CONTROLLER / SERVICE LEVEL)** | Proves application-level scoping. Database layer is stubbed; does not prove PostgreSQL RLS. |
| **F-07** | **Express HTTP Routing & Middleware** | [`http-routes.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/integration/http-routes.test.ts) (25 tests) | **VERIFIED (HTTP INTEGRATION)** | Exercises Express router mounts, parameter parsing, `authenticate` and `requireAdmin` middlewares, and controllers. |
| **F-08** | **Side-Effect Invariant Enforcement** | [`http-routes.test.ts:360-545`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/integration/http-routes.test.ts#L360-L545) | **VERIFIED** | Denied cross-tenant requests cause 0 database mutations and 0 downstream provider calls (`replyToThread`, `solveCheckpoint`). |
| **F-09** | **Live PostgreSQL Row-Level Isolation** | Host system inspection (Port 5432 closed; Docker absent) | **BLOCKED** | No local database instance is available. Production database access is strictly forbidden. |
| **F-10** | **Cloud Credential Rotation** | Cloud infrastructure inspection (Neon, Unipile, AWS) | **PENDING OPERATOR ACTION** | Requires manual out-of-band rotation by authorized human operator. |

---

## 2. In-Depth Analysis of Key Remediations

### Remediation A: CRM Stage Update Defect & Typed Error Refinement
- **Original Handover Defect:** Calling `PATCH /api/dashboard/contacts/:id/stage` with another tenant's `contactId` caused `crmService.updateContactStage` to throw an unhandled `Error: Contact ... not found.`, which `dashboard.controller.ts` caught and returned as `HTTP 500 Internal Server Error`.
- **First-Stage Fix:** Catch block added in `dashboard.controller.ts` returning `HTTP 404` if error message included `"not found"`.
- **Auditor Risk Identified:** Substring matching on `"not found"` created a concealment risk: any database or driver error containing `"not found"` (e.g. `relation contacts not found` or `connection error: host not found`) would be masked as a client 404, while leaking internal error details.
- **Final Refined Architecture:**
  1. `NotFoundError` class implemented in [`server/src/utils/error.util.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/utils/error.util.ts):
     ```typescript
     export class NotFoundError extends Error {
       public readonly statusCode = 404;
       constructor(message: string) {
         super(message);
         this.name = "NotFoundError";
         Object.setPrototypeOf(this, new.target.prototype);
       }
     }
     ```
  2. [`server/src/services/crm/crm.service.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/services/crm/crm.service.ts) throws `NotFoundError` on missing or unowned contacts.
  3. [`server/src/controllers/dashboard.controller.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/controllers/dashboard.controller.ts) checks `error instanceof NotFoundError`. If it is an internal DB error (checked via `isInternalDbError`), it returns `HTTP 500` and scrubs sensitive schema/query text via `safeErrorMessage`.
  4. Regression tests in [`crm-stage-defect.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/crm-stage-defect.test.ts) verify both the 404 response on `NotFoundError` and the 500 response on `PostgresError: relation contacts not found in schema`.

### Remediation B: Express HTTP Routing Pipeline Verification
- In prior iterations, tests invoked controller functions directly (`controller(req, res)`), leaving Express router dispatch, middleware chaining, and URL route parameter extraction unverified.
- With Supertest (`supertest@7.3.1`), 25 integration tests now send real HTTP requests to `app`:
  - **Authentication Middleware (`authenticate`):** Verified on 9 unauthenticated paths (401 response).
  - **Role Guard (`requireAdmin`):** Verified across 4 admin routes (`/api/admin/users`, `/api/admin/settings/unipile`, `/api/admin/daily-agent/run/:userId`, `/internal/admin/daily-agent/run/:userId`) returning 403 on regular users, and 200 on admin positive control.
  - **IDOR Scoping:** Verified across CRM contact listing, stage patch, conversation messages, replies, takeover toggle, LinkedIn checkpoint inspection, solve, and account disconnection.
