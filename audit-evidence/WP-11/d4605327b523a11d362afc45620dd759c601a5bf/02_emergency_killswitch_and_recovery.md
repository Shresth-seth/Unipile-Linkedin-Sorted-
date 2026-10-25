# WP-11: Emergency Killswitch & Stale Lock Recovery Audit

**Work Package:** WP-11 ("Add Visibility and Recovery", Handover Pages 26–27)  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Date:** 2026-10-25  
**Harness Tests:** `server/src/__tests__/unit/visibility-and-recovery.test.ts`

---

## 1. One-Click Safety Killswitch (`emergencyPause`)

When an operator or user observes anomalous behavior or LinkedIn checkpointing, they can trigger an immediate, tenant-isolated emergency pause:

### Endpoint: `POST /api/dashboard/emergency-pause`
- **Authentication:** Bearer JWT required.
- **Tenant Scope:** Scoped exclusively to `userId` from the authenticated session.
- **Action:** Sets `linkedinAccounts.automationStatus = "PAUSED"`.
- **Pre-Flight Enforcement:** In `accountSafetyService.verifyPreFlight`:
  ```typescript
  if (account.automationStatus === "PAUSED") {
    return {
      allowed: false,
      reason: "Automation is currently paused for this account.",
      circuitBreakerTriggered: true,
    };
  }
  ```
  Every queued job is intercepted at pre-flight and transitioned to `PAUSED` without making external provider calls.

---

## 2. Safe Automation Resume (`resumeAutomation`)

### Endpoint: `POST /api/dashboard/resume`
- **Authentication:** Bearer JWT required.
- **Tenant Scope:** Updates `linkedinAccounts.automationStatus = "RUNNING"` for the caller only.
- **Action:** Re-enables the queue worker to process subsequent scheduled actions safely.

---

## 3. Worker Stale Lock Self-Healing

Distributed workers can crash, time out, or restart mid-execution. To prevent jobs from becoming permanently trapped in `PROCESSING`:

In `ActionQueueService.processDueActions`:
```typescript
// Tier 1: Reset recoverable jobs (stale > 5 mins, attempts < 3) back to QUEUED
await db.update(actionQueue).set({
  status: "QUEUED",
  lockedAt: null,
})
  .where(and(
    eq(actionQueue.status, "PROCESSING"),
    lt(actionQueue.lockedAt, new Date(now.getTime() - 5 * 60 * 1000)),
    lt(actionQueue.attempts, 3),
  ));

// Tier 2: Exhausted jobs (attempts >= 3) marked permanently as FAILED
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

This guarantees zero stuck jobs and bounds all retries deterministically.
