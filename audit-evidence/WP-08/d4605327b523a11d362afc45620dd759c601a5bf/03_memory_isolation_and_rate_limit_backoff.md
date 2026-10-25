# WP-08: Agent Memory Isolation & Rate Limit Backoff Proof

## 1. Scope & Invariants
Work Package WP-08 mandates:
1. Strict per-user isolation of short-term LangGraph conversation memory (`MemorySaver`).
2. Enforcement of user-customizable personality and daily outreach quotas (1 to 20/day).
3. Graceful handling of Gemini model 429 rate limits, ResourceExhausted errors, and provider restrictions.

---

## 2. Hardened Architecture

### 2.1 Per-User MemorySaver Checkpointers
- **Location:** `server/src/services/agent/agent-memory.service.ts` (`AgentMemoryService`)
- **Mechanics:**
  - Maintains `userCheckpointers = new Map<string, MemorySaver>()`.
  - User A and User B receive distinct, isolated `MemorySaver` instances.
  - Calling `clearHistory(userId)` strictly deletes the checkpointer and session messages for the specified user, ensuring zero cross-tenant contamination.

### 2.2 Bounded Daily Outreach Quotas
- User agent settings enforce daily connection limits constrained strictly between 1 and 20 (`Math.min(Math.max(quota, 1), 20)`), preventing aggressive spamming that could compromise LinkedIn account health.

### 2.3 Gemini Rate Limit (429) Containment & Fallback
- **Primary Model Rate Limit:**
  - In `WORKPILOT-connect-agent.ts`, if primary model execution throws `429`, `ResourceExhausted`, or `quota`, the agent falls back to `gemini-3.1-flash-lite` to complete the reasoning turn without crashing the user's session.
- **Provider Restriction Safety Halt:**
  - In `daily-agent.service.ts`, if an outreach dispatch detects a LinkedIn/Unipile rate limit or restriction (`restricted`, `429`, `weekly limit`), the agent immediately halts all further invitations for that run and marks the run summary with `providerErrorReason`, protecting user account standing.

---

## 3. Test Evidence

Validated in `server/src/__tests__/unit/ai-tools-and-byok.test.ts`:
- `allocates separate MemorySaver instances per user and clears only target user` (PASS)
- `saveUserSettings enforces dailyQuota boundary between 1 and 20` (PASS)
