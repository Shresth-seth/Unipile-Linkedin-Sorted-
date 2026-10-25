# WP-06: Schedule Resiliency, Atomic Daily Run Idempotency & Timezone Proof

## 1. Scope & Invariants
Work Package WP-06 requires:
1. Atomic daily run idempotency keys (`daily:{userId}:{localDate}`) that prevent duplicate runs when workers trigger concurrently.
2. Safe lock recovery for crashed runs without overwriting active or completed runs.
3. Resilient schedule calculations respecting user timezones, daylight saving time (DST) transitions, and malformed inputs.
4. Timezone-aware outbound message scheduling that shifts messages outside business hours (19:00 to 08:00) in the user's timezone to the next morning (09:xx).

---

## 2. Hardened Architecture & Implementations

### 2.1 Daily Agent Atomic Run Key Claiming (`onConflictDoNothing`)
- **Location:** `server/src/agent/daily/daily-agent.service.ts` (`DailyAgentService.runForUser`)
- **Idempotency Key:** `daily:${userId}:${localDateStr}` (where `localDateStr` is formatted in the user's configured IANA timezone).
- **Atomic Locking:**
  ```typescript
  const [claimed] = await db
    .insert(dailyAgentRuns)
    .values({
      userId,
      runKey: activeRunKey,
      scheduledFor: startedAt,
      status: "RUNNING",
      startedAt,
    })
    .onConflictDoNothing()
    .returning();
  ```
- **Concurrency Protection:**
  - If two workers invoke `runForUser` at the exact same moment, Worker 1 claims the key while Worker 2 receives empty results from `onConflictDoNothing()`.
  - Worker 2 queries the existing run. If `status === 'RUNNING'` (and not stale) or `status === 'COMPLETED'`, Worker 2 cleanly returns `status: "SKIPPED"` without executing actions.
  - This eliminates the race condition where `onConflictDoUpdate` previously overwrote active or completed runs.

### 2.2 Timezone & Daylight Saving Time (DST) Boundary Calculations
- **Location:** `server/src/agent/daily/daily-agent.service.ts` (`calculateNextDailyRun`)
- **Mechanics:**
  - Uses Luxon's IANA timezone database (`DateTime.now().setZone(safeZone)`).
  - Automatically handles DST "spring forward" and "fall back" transitions, maintaining the intended wall-clock time (e.g. 04:00 AM) across time shifts.
  - Falls back gracefully to `"UTC"` if the provided timezone is invalid or unrecognized.
  - Sanitizes invalid time strings (e.g. `"25:99"`, `"invalid"`, `""`), safely defaulting to 04:00 AM without generating `NaN` timestamps.

### 2.3 Timezone-Aware Outbound Action Enqueuing
- **Location:** `server/src/services/queue/queue.service.ts` (`ActionQueueService.enqueue`)
- **Mechanics:**
  - `EnqueueOptions` accepts an optional `timezone?: string`.
  - If delay is greater than 0, evaluates whether the scheduled time falls outside business hours (`hour >= 19 || hour < 8`) in that timezone.
  - If so, rolls forward to 09:xx AM on the next business morning in the target timezone.
  - For immediate user-triggered actions (`delayMinutes: 0`), business hours postponement is bypassed, dispatching immediately.

---

## 3. Test Evidence

Validated in `server/src/__tests__/unit/jobs-and-schedules.test.ts`:
- `skips execution cleanly when runKey is already claimed by another active worker` (PASS)
- `calculateNextDailyRun calculates correct next run in target timezone` (PASS)
- `calculateNextDailyRun falls back gracefully to UTC on invalid or missing timezone` (PASS)
- `calculateNextDailyRun sanitizes malformed time strings without NaN` (PASS)
- `enqueue adjusts delay outside business hours based on specified timezone` (PASS)
- `enqueue with delayMinutes: 0 bypasses business hours adjustment for immediate actions` (PASS)
