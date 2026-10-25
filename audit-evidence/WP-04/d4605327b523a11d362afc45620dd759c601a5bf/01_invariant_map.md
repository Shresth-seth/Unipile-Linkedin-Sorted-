# Database Invariant Map & Relationship Audit
**Package:** WP-04: Protect Database Integrity  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Date:** October 25, 2026

---

## 1. Table Ownership, Constraints, and Cascade Policies

| Table Name | Primary Key | Tenant Scoping (FK) | Cascade Behavior | Uniqueness Invariants | Orphan Handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | `id` (uuid) | N/A (Root entity) | N/A | `email` (unique), `razorpay_subscription_id` (unique) | Root entity |
| `linkedin_accounts` | `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE CASCADE` | `unipile_account_id` (unique) | Purged on user deletion |
| `contacts` | `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE CASCADE` | Scoped per tenant; compound indexed `(user_id, created_at DESC)` | Purged on user deletion |
| `daily_agent_settings`| `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE CASCADE` | `user_id` (unique, 1:1 with user) | Purged on user deletion |
| `daily_agent_runs` | `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE CASCADE` | `run_key` (`daily:{userId}:{date}`) | Purged on user deletion |
| `webhook_events` | `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE SET NULL` | `event_id` (unique) | Preserved for provider audit |
| `message_agent_jobs` | `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE CASCADE` | `message_id` (unique idempotency key) | Purged on user deletion |
| `messages` | `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE CASCADE` | Indexed `(user_id, sent_at DESC)` | Purged on user/contact deletion |
| `action_queue` | `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE CASCADE` | Atomic CAS status claiming; indexed `(status, scheduled_for)` | `contact_id` sets null; user deletion cascades |
| `systemSettings` | `key` (text) | `updated_by` -> `users(id)`| `ON DELETE SET NULL` | `key` (primary key) | Global system configuration |
| `billing_events` | `id` (uuid) | Derived from payload | N/A | `event_id` (unique Razorpay webhook ID) | Audit preserved |
| `auth_tokens` | `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE CASCADE` | `token_hash` (unique SHA-256) | Purged on user deletion |
| `agent_messages` | `id` (uuid) | `user_id` -> `users(id)` | `ON DELETE CASCADE` | Session indexed | Purged on user deletion |

---

## 2. Concurrency & State Invariants

### 2.1 Action Queue Claiming State Machine
1. **Atomic CAS Lock:** When a worker selects jobs scheduled for execution (`lte(scheduledFor, now)`), it attempts an atomic compare-and-swap:
   ```sql
   UPDATE action_queue
   SET status = 'PROCESSING', lockedAt = NOW(), attempts = attempts + 1
   WHERE id = $1 AND status = 'QUEUED'
   RETURNING id;
   ```
2. **Mutual Exclusion:** If multiple worker instances run concurrently, exactly one worker receives the updated row. All other workers match 0 rows and immediately skip without executing duplicate actions.
3. **Stale Lock Recovery:**
   - Active lock duration threshold: **5 minutes**.
   - If a worker crashes while processing a job with `attempts < 3`, the job is recovered back to `QUEUED` with `lockedAt = null`.
   - If a job has reached `attempts >= 3`, it is transitioned to `FAILED` with `errorMessage = 'Job execution timed out after maximum retry attempts.'` to eliminate permanently orphaned `PROCESSING` rows.

### 2.2 Ambiguous Provider Outcome Invariant
When interacting with external services (e.g., Unipile, LinkedIn):
1. **Network Boundary Rule:** Database transactions are **never** held open across external network requests.
2. **Provider Success Priority:** If the external provider returns success (e.g. invitation or message sent), but a subsequent local database write fails (e.g., lock timeout on `contacts`), the queue job records `status = 'COMPLETED'` with an explanatory audit notice.
3. **Anti-Duplication:** This prevents the worker from blindly re-attempting an outbound action that has already been delivered to the recipient.
