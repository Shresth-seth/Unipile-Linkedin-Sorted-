# WP-09: Opt-Out & Safety Circuit Breaker Negative Journey

**Work Package:** WP-09 ("Verify Complete User Journeys", Handover Pages 22–23)  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Date:** 2026-10-25  
**Harness Test:** `user-journeys.test.ts` (Journey 5)

---

## 1. Safety Negative Path Overview

When a lead indicates unwillingness to communicate (via keyword "STOP", explicit refusal, or manual opt-out flag in CRM), the platform must guarantee that:
1. All pending actions targeting that lead are immediately halted.
2. No automated messages, connections, or follow-ups are dispatched to LinkedIn / Unipile.
3. The queue worker records the rejection reason cleanly without crashing or retrying continuously.

---

## 2. Verification Mechanism

In `server/src/services/queue/queue.service.ts`:
```typescript
const safety = await accountSafetyService.verifyPreFlight(
  job.userId,
  job.actionType as any,
  job.contactId || undefined,
  payload?.person?.linkedin_id || payload?.recipientId,
  payload?.message || payload?.note,
);

if (!safety.allowed) {
  const newStatus = safety.circuitBreakerTriggered ? "PAUSED" : "SKIPPED";
  await db
    .update(actionQueue)
    .set({
      status: newStatus,
      errorMessage: safety.reason,
      lockedAt: null,
    })
    .where(eq(actionQueue.id, job.id));

  results.push({
    jobId: job.id,
    action: job.actionType,
    status: newStatus,
    reason: safety.reason,
  });
  continue; // Halts processing before ANY external provider call
}
```

---

## 3. Test Assertion Results

- **Input:** Queued job targeting `contact-journey-lead-1` who has opted out.
- **Safety Result:** `allowed: false`, `reason: "Contact Devin AI has opted out of automated communications."`.
- **Worker Execution:**
  - `queueResult.processed`: `1`
  - `queueResult.results[0].status`: `"SKIPPED"`
  - `queueResult.results[0].reason`: `"Contact Devin AI has opted out of automated communications."`
  - External provider `sendMessage` call count: `0` (Zero outbound calls).
- **Outcome:** Negative safety test PASSED.
