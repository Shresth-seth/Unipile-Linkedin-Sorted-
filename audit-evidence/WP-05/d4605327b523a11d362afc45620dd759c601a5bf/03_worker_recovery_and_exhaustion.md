# WP-05: Message Agent Worker Recovery & Job Exhaustion

## 1. Overview
The asynchronous processing of incoming conversational messages is managed by `messageAgentWorker` (`server/src/services/webhook/message-agent.worker.ts`). This worker polls and executes jobs from `message_agent_jobs`.

---

## 2. Hardened Mechanics

### 2.1 Server Restart & Crash Recovery
- **Function:** `messageAgentWorker.processPendingJobs()`
- **Implementation:**
  - Upon server boot or scheduled worker interval, the worker queries `message_agent_jobs` for jobs in `PENDING` status.
  - Recovers jobs orphaned by an unexpected process crash or container termination before execution could start.

### 2.2 Stale Processing Timeout & Exhaustion
- **Function:** `messageAgentWorker.resetStuckJobs()`
- **Stuck Threshold:** 5 minutes (`Date.now() - 5 * 60 * 1000`)
- **Dual-Tier State Transition:**
  1. **Retryable (`attempts < 3`):**
     - Reset status to `PENDING` so the worker can retry processing.
  2. **Exhausted (`attempts >= 3`):**
     - Prior defect: Stale jobs with `attempts >= 3` remained permanently stuck in `PROCESSING` status, clogging queue metrics and leaking locks.
     - Remediated implementation:
       ```typescript
       await db
         .update(messageAgentJobs)
         .set({
           status: "FAILED",
           error: "Job timed out and reached maximum retry attempts (3)",
           updatedAt: new Date(),
         })
         .where(
           and(
             eq(messageAgentJobs.status, "PROCESSING"),
             gte(messageAgentJobs.attempts, 3),
             lt(messageAgentJobs.updatedAt, stuckThreshold)
           )
         );
       ```
     - Permanently terminates exhausted jobs with diagnostic reason.

### 2.3 Opt-Out & Safety Invariants
- **Opt-Out ("STOP") Handling:**
  - If an inbound message contains opt-out triggers (e.g., "stop", "unsubscribe"), the agent marks the contact as unsubscribed/opted-out.
  - Automated follow-up response drafts and message generation are suppressed.
- **Reply Mode OFF:**
  - When the account's configured reply mode is `OFF`, inbound messages are persisted to the conversation timeline for CRM visibility, but AI response generation and outbound action queuing are strictly inhibited.

---

## 3. Test Evidence

Validated in `server/src/__tests__/unit/webhook-pipeline.test.ts`:
- `processPendingJobs polls unhandled PENDING jobs to resume work after restart` (PASS)
- `resetStuckJobs resets PROCESSING jobs with attempts < 3 back to PENDING` (PASS)
- `resetStuckJobs marks PROCESSING jobs with attempts >= 3 as FAILED with timeout error` (PASS)
