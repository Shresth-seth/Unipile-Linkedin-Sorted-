# WP-03 Automated Test Inventory

**Target Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Test Runner:** Vitest v5.0.5 (Node.js v24.22.1 ESM, native TypeScript NodeNext)  
**Total Automated Test Suites:** 4 test files  
**Total Automated Tests:** 31 tests  
**Overall Execution Duration:** ~2.16s  
**Exit Code Propagation:** Non-zero exit code (`1`) on any assertion failure verified  

---

## 1. Test Suite Summary Table

| Test File | Category | Tests | Assertions Focus | Status |
|-----------|----------|-------|------------------|--------|
| `src/__tests__/unit/network-guard.test.ts` | Network Isolation | 6 | Egress blocking on fetch, http, https | VERIFIED PASS |
| `src/__tests__/unit/crm-stage-defect.test.ts` | Defect Remediation & Regression | 4 | 401, 400, 404 (not 500), 200 positive control | VERIFIED PASS |
| `src/__tests__/unit/tenant-isolation.test.ts` | 14-Case Tenant Matrix | 14 | Negative authorization, zero data leakage, zero mutation, zero side effects | VERIFIED PASS |
| `src/__tests__/unit/migrated-legacy.test.ts` | Migrated High-Value Tests | 7 | Cryptographic HMAC, AES-256 roundtrip, LangGraph MemorySaver isolation | VERIFIED PASS |
| **Total** | | **31** | **All suites offline-only & deterministic** | **31 / 31 PASS** |

---

## 2. Detailed Test Inventory by File

### A. `src/__tests__/unit/network-guard.test.ts` (6 tests)
- `blocks outbound fetch calls to Unipile API` (Asserts `[NETWORK HAZARD BLOCKED]`)
- `blocks outbound fetch calls to Google Gemini API` (Asserts `[NETWORK HAZARD BLOCKED]`)
- `blocks outbound fetch calls to Razorpay API` (Asserts `[NETWORK HAZARD BLOCKED]`)
- `blocks outbound fetch calls to Resend API` (Asserts `[NETWORK HAZARD BLOCKED]`)
- `blocks outbound node:http.request to external IP/host` (Asserts `[NETWORK HAZARD BLOCKED]`)
- `blocks outbound node:https.request to external IP/host` (Asserts `[NETWORK HAZARD BLOCKED]`)

### B. `src/__tests__/unit/crm-stage-defect.test.ts` (4 tests)
- `returns 401 Unauthorized when no user is authenticated` (Unauthenticated guard)
- `returns 400 Bad Request when contactId or stage is missing` (Input validation guard)
- `remediation verified: cross-tenant access returns 404 Not Found (not 500) and halts mutation` (Targeted defect regression)
- `positive control: same-tenant update succeeds with 200 OK` (Positive control verification)

### C. `src/__tests__/unit/tenant-isolation.test.ts` (14 tests)
- `ISO-CRM-01: List Contacts Scoping` (Tenant B receives only own contacts; 0 bytes Tenant A data)
- `ISO-CRM-02: Mutate Another Tenant's Contact Stage` (Tenant B cannot update Tenant A stage; 404 Not Found; zero mutation)
- `ISO-CRM-03: Filtered Scoping & Direct Parameter Isolation` (Filtered queries strictly respect tenant boundary)
- `ISO-MSG-01: Conversation History Leakage` (Tenant B reading Tenant A conversation returns 404; zero messages leaked)
- `ISO-MSG-02: Send Reply to Another Tenant's Contact` (Tenant B replying returns 404; Unipile mock NOT called)
- `ISO-MSG-03: Conversation Takeover State Manipulation` (Tenant B takeover returns 404; conversationMode unchanged)
- `ISO-LNK-01: LinkedIn Checkpoint Status Scoping` (Tenant B inspecting Tenant A checkpoint returns 404; 0 challenge hints leaked)
- `ISO-LNK-02: Solve Checkpoint on Another Tenant's Account` (Tenant B solving Tenant A checkpoint returns 404; Unipile mock NOT called)
- `ISO-LNK-03: LinkedIn Account Disconnect Scoping` (Disconnect is strictly self-scoped; cannot disconnect other tenants)
- `ISO-ADM-01: Admin Users Roster Authorization` (Regular user requesting user roster receives 403 Forbidden)
- `ISO-ADM-02: Triggering Administrative Jobs` (Regular user triggering admin daily-agent receives 403 Forbidden)
- `ISO-ADM-03: Mutating Master Provider Settings` (Regular user mutating master Unipile settings receives 403 Forbidden)
- `ISO-WRK-01: Action Queue Worker Account and Quota Isolation` (Worker executes actions strictly for owning tenant account)
- `ISO-WRK-02: Message Agent Worker & AI BYOK Tenant Isolation` (Worker resolves AI config and BYOK key strictly per tenant)

### D. `src/__tests__/unit/migrated-legacy.test.ts` (7 tests)
- `verifies Razorpay subscription creation notes and plan binding` (Preserved from `test-saas-foundation.ts`)
- `verifies cryptographic HMAC webhook signature validation` (Preserved from `test-saas-foundation.ts`)
- `verifies AES-256 data and secret encryption roundtrips and legacy fallback` (Preserved from `test-saas-foundation.ts`)
- `verifies production config validation enforces mandatory parameters` (Preserved from `test-saas-foundation.ts`)
- `Test 1: guarantees dedicated isolated MemorySaver checkpointer instances per user` (Preserved from `test-agent-memory.ts`)
- `Test 2 & 3: retains short-term memory across turns and prevents cross-tenant memory leakage` (Preserved from `test-agent-memory.ts`)
- `Test 4: clearHistory strictly isolates cache clearing to target user` (Preserved from `test-agent-memory.ts`)

---

## 3. Legacy Script Audit & Status

| Legacy Script | Original Issue | WP-03 Action Taken | Current Status |
|---------------|----------------|-------------------|----------------|
| `test-agent-memory.ts` | Ad-hoc runner, not integrated | Migrated assertions into `migrated-legacy.test.ts` | Preserved in scripts, covered in Vitest |
| `test-saas-foundation.ts` | Ad-hoc script | Migrated assertions into `migrated-legacy.test.ts` | Preserved in scripts, covered in Vitest |
| `test-security.ts` | Swallowed errors / live DB dependency | Replaced by pure offline `tenant-isolation.test.ts` | Preserved in scripts, not run in offline suite |
| `test-linkedin-connect.ts` | Made external provider calls | Prohibited in offline runner; replaced with `MockUnipileClient` | Excluded from automated CI |
| `test-unipile-webhook.ts` | Ad-hoc script | Covered by offline webhook and normalizer stubs | Preserved in scripts |
