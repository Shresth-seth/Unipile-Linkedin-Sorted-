# Concurrency & Transaction Verification
**Package:** WP-04: Protect Database Integrity  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Date:** October 25, 2026

---

## 1. Concurrency Control in Action Queue Execution

### 1.1 Atomic Compare-and-Swap (CAS)
In `server/src/services/queue/queue.service.ts`:
```ts
const [claimed] = await db.update(actionQueue)
  .set({ status: "PROCESSING", lockedAt: new Date(), attempts: job.attempts + 1 })
  .where(and(eq(actionQueue.id, job.id), eq(actionQueue.status, "QUEUED")))
  .returning({ id: actionQueue.id });

if (!claimed) continue;
```
- **Verification Result:** When multiple workers concurrently query due jobs and pick the same action ID, only the worker that successfully transitions status from `QUEUED` to `PROCESSING` receives the returned ID.
- Tested in `src/__tests__/unit/database-integrity.test.ts` ("two concurrent workers attempting to claim the same queued job: exactly one succeeds; zero duplicate execution"): **PASSED**.

---

## 2. Stale Lock Recovery & Elimination of Orphan Jobs

### 2.1 Two-Tiered Lock Recovery
```ts
// 1. Reclaim transient worker crashes back to QUEUED
await db.update(actionQueue).set({ status: "QUEUED", lockedAt: null })
  .where(and(
    eq(actionQueue.status, "PROCESSING"),
    lt(actionQueue.lockedAt, new Date(now.getTime() - 5 * 60 * 1000)),
    lt(actionQueue.attempts, 3),
  ));

// 2. Mark exhausted locks as FAILED
await db.update(actionQueue).set({
  status: "FAILED",
  lockedAt: null,
  errorMessage: "Job execution timed out after maximum retry attempts.",
})
  .where(and(
    eq(actionQueue.status, "PROCESSING"),
    lt(actionQueue.lockedAt, new Date(now.getTime() - 5 * 60 * 1000)),
    gte(actionQueue.attempts, 3),
  ));
```
- **Verification Result:** Jobs with attempts < 3 are safely retried. Jobs with attempts >= 3 are permanently marked `FAILED` rather than being left orphaned in `PROCESSING` status indefinitely.
- Tested in `src/__tests__/unit/database-integrity.test.ts` ("stale lock query resets jobs with attempts < 3 to QUEUED and marks attempts >= 3 as FAILED"): **PASSED**.

---

## 3. Ambiguous Provider Outcome Protection

### 3.1 Divergence Mitigation
If a LinkedIn connection request or direct message succeeds on the provider side, but the subsequent database update on `contacts` encounters a lock timeout or connection glitch:
- The queue service records:
  ```ts
  const isAmbiguousProviderOutcome = providerSuccess;
  await db.update(actionQueue).set({
    status: isAmbiguousProviderOutcome ? "COMPLETED" : "FAILED",
    errorMessage: isAmbiguousProviderOutcome
      ? `Provider action succeeded, but secondary record update failed: ${err.message}`
      : err.message,
    attempts: job.attempts + 1,
    lockedAt: null,
    executedAt: isAmbiguousProviderOutcome ? new Date() : null,
  }).where(eq(actionQueue.id, job.id));
  ```
- **Verification Result:** Prevents the worker from automatically retrying the job and sending duplicate outreach messages to leads on LinkedIn.
- Tested in `src/__tests__/unit/database-integrity.test.ts` ("when provider succeeds but secondary DB contact update throws, job is marked COMPLETED with warning to prevent duplicate sends"): **PASSED**.
