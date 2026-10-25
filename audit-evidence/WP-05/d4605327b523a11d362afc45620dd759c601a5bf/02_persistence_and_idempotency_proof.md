# WP-05: Webhook Persistence & Idempotency Proof

## 1. Scope & Invariants
Work Package WP-05 mandates that incoming webhooks:
1. Guarantee idempotency across multiple simultaneous deliveries.
2. Require durable persistence in PostgreSQL BEFORE acknowledging success (`HTTP 200`) to Unipile.
3. Fail closed with `HTTP 500 Internal Server Error` if database persistence fails, ensuring the external provider retries.
4. Correctly isolate and skip unknown account deliveries without enqueuing spurious AI jobs.
5. Record own outbound echoes without triggering autonomous response loops.

---

## 2. Implementation Mechanics

### 2.1 Atomic Idempotency Claim (`webhook_events`)
- **Location:** `server/src/services/webhook/webhook-dedup.service.ts`
- **Table:** `webhook_events` (`event_id` PRIMARY KEY)
- **Mechanics:**
  - `claimEvent(eventId, eventType, payload, accountId)` executes an atomic insert with `onConflictDoNothing()`.
  - If the row already exists (`inserted.length === 0`), the event is marked duplicate.
  - In `server/src/controllers/webhook.controller.ts`:
    ```typescript
    const dedup = await webhookDedupService.claimEvent(norm.messageId, norm.event, req.body, norm.accountId);
    if (dedup.isDuplicate) {
      console.log(`⚡ [WEBHOOK] Duplicate messageId=${norm.messageId} recognized. Returning HTTP 200 safely.`);
      res.status(200).json({ success: true, duplicate: true, message: "Event already processed." });
      return;
    }
    ```
  - This prevents duplicate processing of retried deliveries while acknowledging delivery to avoid endless webhook replay loops.

### 2.2 Persistence Prior to HTTP 200 Acknowledgment
- **Location:** `server/src/controllers/webhook.controller.ts` (lines 126–178)
- **Fix Applied:**
  - Previously, a database insertion failure was logged while returning `HTTP 200 { success: true, queued: true }`, causing unrecoverable message loss.
  - Hardened implementation:
    ```typescript
    try {
      const prep = await unipileMessageAgentService.prepareAndPersistInboundMessage(norm);
      ...
    } catch (err: any) {
      console.error(`❌ [WEBHOOK] Error during validation/persistence for message '${norm.messageId}':`, err);
      res.status(500).json({
        success: false,
        message: "Database persistence failed. Provider should retry.",
        error: err?.message,
      });
      return;
    }
    ```
  - Returning `HTTP 500` signals Unipile's delivery broker that the webhook was not durably accepted, triggering standard exponential backoff retries.

### 2.3 Account Resolution & Skipped Processing
- If `account_id` does not match any local `linkedin_accounts` entry:
  - `unipileMessageAgentService.prepareAndPersistInboundMessage` returns `{ skipped: true, reason: "Account not found locally" }`.
  - Controller responds with `HTTP 200 { success: true, skipped: true, reason: "Account not found locally" }`.
  - Zero background jobs are enqueued in `message_agent_jobs`.

### 2.4 Outbound Echo Bypass
- If the sender provider ID matches the owning account or `isOwnSent === true`:
  - Controller records the outbound message for conversation thread completeness.
  - Controller immediately returns `HTTP 200 { success: true, ignored: true, direction: "OUTBOUND" }`.
  - AI prompt generation is completely bypassed, eliminating self-messaging infinite loops.

---

## 3. Test Evidence

Validated in `server/src/__tests__/unit/webhook-pipeline.test.ts`:
- `simultaneous duplicate event delivery returns duplicate=true and prevents duplicate job enqueuing` (PASS)
- `returns HTTP 500 if database persistence fails, preventing misleading success acknowledgment` (PASS)
- `unknown account ID returns HTTP 200 with skipped: true and does not create an AI job` (PASS)
- `own outbound echo returns ownMessage: true and bypasses AI generation` (PASS)
