# WP-06: Contact Opt-Out & Safety Pre-Flight Enforcement

## 1. Overview
Work Package WP-06 mandates immediate suppression of queued outbound actions if a contact has opted out or automation is paused before dispatch.

---

## 2. Hardened Pre-Flight Check

### 2.1 Contact Opt-Out Guard
- **Location:** `server/src/services/safety/safety.service.ts` (`AccountSafetyService.verifyPreFlight`)
- **Implementation:**
```typescript
if (contact && contact.optedOut) {
  return {
    allowed: false,
    reason: `Contact ${contact.name || targetContactId} has opted out of automated communications.`,
    circuitBreakerTriggered: false,
  };
}
```

### 2.2 Pre-Flight Dispatch Suppression Mechanics
When `actionQueueService.processDueActions` runs:
1. The worker claims the job atomically from `QUEUED` to `PROCESSING`.
2. It executes `accountSafetyService.verifyPreFlight(job.userId, job.actionType, job.contactId, ...)`.
3. If the contact has `optedOut: true`:
   - `verifyPreFlight` returns `{ allowed: false, reason: "Contact ... has opted out of automated communications.", circuitBreakerTriggered: false }`.
   - The queue worker transitions the job to `status: "SKIPPED"` with the reason in `errorMessage`.
   - External provider API methods (`sendConnectionRequest`, `sendMessage`, etc.) are completely bypassed.
   - Zero outbound messages or connection invitations are transmitted to opted-out contacts.

---

## 3. Test Evidence

Validated in `server/src/__tests__/unit/jobs-and-schedules.test.ts`:
- `accountSafetyService.verifyPreFlight rejects queued action if contact has opted out` (PASS)
- `processDueActions marks job as SKIPPED and suppresses provider call when contact opted out` (PASS)
