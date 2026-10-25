# WP-07: Account Disconnect, Cookie Purge & Checkpoint Resolution

## 1. Scope & Invariants
Work Package WP-07 mandates:
1. Complete cleanup upon user disconnect: remote Unipile session disconnect, local state transition to `DISCONNECTED`/`PAUSED`, purge of stored encrypted credentials, and immediate pausing of pending queue actions.
2. Permanent account deletion and cookie purge (`deleteLinkedInLoginAndCookies`): deletes the database login row and deletes all pending queue actions.
3. Checkpoint resolution support (`solveCheckpoint`, `resendCheckpoint`, `checkCheckpointStatus`) for 2FA, OTP, and in-app validation challenges.

---

## 2. Hardened Cleanup & Checkpoint Mechanics

### 2.1 Account Disconnect
- **Location:** `server/src/services/linkedin/account.service.ts` (`disconnect`)
- **Operations:**
  ```typescript
  // 1. Remote Unipile disconnect
  await unipileClient.disconnectAccount(account.unipileAccountId);

  // 2. Clear credentials and update account status
  await db.update(linkedinAccounts).set({
    unipileAccountId: null,
    linkedinName: null,
    linkedinEmail: null,
    isConnected: false,
    healthStatus: "DISCONNECTED",
    automationStatus: "PAUSED",
    authMethod: null,
    encryptedCredentials: null,
    updatedAt: new Date(),
  }).where(eq(linkedinAccounts.id, account.id));

  // 3. Immediately pause pending queued actions to prevent unauthorized dispatch
  await db.update(actionQueue).set({
    status: "PAUSED",
    errorMessage: "Account disconnected by user. Outbound actions paused.",
  }).where(and(eq(actionQueue.userId, userId), eq(actionQueue.status, "QUEUED")));
  ```

### 2.2 Permanent Deletion & Cookie Purge
- **Location:** `server/src/services/linkedin/account.service.ts` (`deleteLinkedInLoginAndCookies`)
- **Operations:**
  - Remote Unipile account disconnected.
  - Hard deletion of `linkedinAccounts` row (`db.delete(linkedinAccounts).where(eq(linkedinAccounts.userId, userId))`).
  - Hard deletion of pending items in `actionQueue` for that user.

### 2.3 Checkpoint Challenge Handling
- **`solveCheckpoint(userId, accountId, code)`:**
  - Dispatches resolution code to Unipile.
  - If challenge resolves, automatically synchronizes and updates local account status to `HEALTHY`.
  - If challenge prompts for next verification step (e.g. from 2FA to OTP), returns the next checkpoint type without premature sync.
- **`checkCheckpointStatus(userId, accountId)`:**
  - Polls live status for in-app validation challenges and syncs upon remote completion.

---

## 3. Test Evidence

Validated in `server/src/__tests__/unit/linkedin-account-lifecycle.test.ts`:
- `disconnect marks account DISCONNECTED, clears credentials, and immediately pauses queued actions` (PASS)
- `deleteLinkedInLoginAndCookies purges account record and deletes pending queue actions` (PASS)
- `solveCheckpoint calls Unipile checkpoint resolver and syncs account upon success` (PASS)
- `solveCheckpoint returns next checkpoint if multi-step verification is required` (PASS)
- `checkCheckpointStatus checks live status and auto-syncs when account becomes connected` (PASS)
