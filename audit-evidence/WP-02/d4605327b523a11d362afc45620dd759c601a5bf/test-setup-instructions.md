# Reproducible Test Setup & Fixture Instructions (WP-02)

**Audit Target:** WorkPilot Platform  
**Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Revision Status:** Pinned Baseline  

---

## 1. Safety Invariants & Execution Boundaries

> [!CAUTION]
> **Strict Isolation Requirement:**
> Automated tests must never connect to live production databases or dispatch real messages to LinkedIn members. 
> All tests documented for safe routine execution utilize isolated in-memory checkpointers, fake LLM models, synthetic tenant IDs, or mock environment objects.

### Prohibited / Blocked Tests in Offline Environments
The following scripts in `server/src/scripts/` **must not be run** without dedicated sandbox mock servers:
1. `test-phase1.ts` (Attempts live LinkedIn search, invitation sending, and DMs via Unipile).
2. `test-phase2.ts` (Dispatches action queue items against live LinkedIn profiles).
3. `test-phase4.ts` (Attempts to react and comment on real LinkedIn posts).
4. `test-linkedin-connect.ts` (Polls live Unipile gateway authentication).

---

## 2. Test Fixture Architecture

### A. Synthetic Multi-Tenant Isolation Fixture
Implemented in [`server/src/scripts/test-agent-memory.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-agent-memory.ts):
- **Tenant A:** `user-uuid-aaaa-1111`
- **Tenant B:** `user-uuid-bbbb-2222`
- **Memory Checkpointer:** In-memory LangGraph `MemorySaver` instantiated separately per tenant ID.
> [!NOTE]
> This fixture exercises LangGraph conversational RAM checkpointers only. Real PostgreSQL multi-tenant isolation (Drizzle ORM queries, foreign key ownership, IDOR prevention on REST endpoints) must be verified through dedicated database integration tests in WP-03.
- **Mock LLM:** `FakeListChatModel` from `@langchain/core/utils/testing` providing deterministic, pre-programmed responses without network calls or OpenAI/Gemini API key consumption:
  ```typescript
  const fakeModelUserA = new FakeListChatModel({
    responses: [
      "I found 3 AI engineers in London: 1. Oliver Smith, 2. Charlotte Brown, 3. Liam Davies.",
      "Understood. I will prepare an invite for Charlotte Brown (the second person).",
    ],
  });
  ```

### B. In-Memory Store & Lead Batch Fixture
Implemented in [`server/src/scripts/test-multistep-subgraphs.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-multistep-subgraphs.ts):
- Namespace: `["test_users", "user_123", "leads"]`
- In-memory key-value storage using LangGraph `WORKPILOTStore`.
- 5 synthetic candidate fixtures (`ACoAA1` to `ACoAA5`) for verifying allocation into personalized note vs blank invitation queues.

### C. Isolated Canary Secret Fixture
Implemented in [`scripts/test-secret-scanner.mjs`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/scripts/test-secret-scanner.mjs):
- File: `scripts/test-fixtures/canary-secret.tmp`
- Canary string: `CANARY_API_KEY="dummyscan_live_secret_canary_key_9988776655aabbcc"`
- Injected on the fly into an isolated temporary folder and removed immediately after verification.

---

## 3. Step-by-Step Test Execution Guide

### Suite 1: Combined Repository Security & Secret Scanning
```powershell
# From repository root:
npm run test:all-security
```
**What this executes:**
1. `node scripts/scan-secrets.mjs` — Scans the entire codebase for committed private keys, AWS tokens, database passwords, and high-entropy credentials.
2. `node scripts/test-secret-scanner.mjs` — Injects the canary dummy secret, proves detection, and verifies clean post-cleanup status.
3. `node scripts/test-config-validation.mjs` — Tests missing mandatory environment variables, weak JWT secret rejection, and regex error message scrubbing.

### Suite 2: Short-Term Memory & Tenant Boundary Test
```powershell
# From server directory:
cd server
npx tsx src/scripts/test-agent-memory.ts
```
**Expected Outcome:**
- 5 tests pass cleanly (`Test 1` through `Test 5`).
- Verifies Tenant A and Tenant B checkpointers are distinct instances.
- Verifies Tenant B cannot query or inspect leads stored in Tenant A's conversational memory.
- Process exits cleanly with code `0`.

### Suite 3: Multi-Step Subgraph & Stop Control Test
```powershell
# From server directory:
cd server
npx tsx src/scripts/test-multistep-subgraphs.ts
```
**Expected Outcome:**
- Verifies LangGraph `InMemoryStore` put/get operations.
- Verifies batch queue orchestration.
- Verifies AbortSignal thread cancellation.

---

## 4. Controlled Defect Injection & Restoration Verification

To prove that the test suite catches real cross-tenant security regressions, follow this drill:

1. **Inject Controlled Defect:**
   In [`server/src/scripts/test-agent-memory.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/test-agent-memory.ts#L25), temporarily replace:
   ```typescript
   // Defect: Force User B to use User A's checkpointer (violates isolation)
   const checkpointerB = checkpointerA;
   ```
2. **Execute Test:**
   ```powershell
   npx tsx src/scripts/test-agent-memory.ts
   ```
   **Observed Result:** Test immediately throws `Error: User A and User B MUST NOT share the same MemorySaver instance!` and exits with code `1`.
3. **Restore Defect-Free Code:**
   ```typescript
   const checkpointerB = agentMemoryService.getUserCheckpointer(userB);
   ```
4. **Re-run Test:**
   ```powershell
   npx tsx src/scripts/test-agent-memory.ts
   ```
   **Observed Result:** All tests pass with code `0`.
