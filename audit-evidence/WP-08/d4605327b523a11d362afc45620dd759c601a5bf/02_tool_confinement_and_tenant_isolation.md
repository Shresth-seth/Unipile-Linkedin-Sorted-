# WP-08: AI Tool Confinement & Tenant Isolation Proof

## 1. Scope & Invariants
Work Package WP-08 mandates:
1. Strict user-scoped isolation for all LangGraph and system tool executions.
2. Prevention of cross-tenant LinkedIn account hijacking via tool parameters (`preferredAccountId`).
3. Elimination of hardcoded developer fallback identifiers in autonomous agents and workflows.

---

## 2. Hardened Architecture

### 2.1 AsyncLocalStorage Tenant Scoping
- **Location:** `server/src/tools/tools.ts` (`runWithToolTenant`)
- **Mechanics:**
  - Uses Node.js `AsyncLocalStorage<string>` to bind the authenticated `userId` across the asynchronous tool execution call stack.
  - Rejects execution immediately if `userId` is empty or missing:
    ```typescript
    export function runWithToolTenant<T>(userId: string, operation: () => Promise<T>): Promise<T> {
      if (!userId.trim()) throw new Error("Authenticated user context is required for agent tools.");
      return toolTenantContext.run(userId.trim(), operation);
    }
    ```

### 2.2 Account Ownership Verification Inside Tools
- When a tool attempts to resolve an active LinkedIn account (`resolveActiveLinkedInAccount`):
  ```typescript
  const conditions = [
    eq(linkedinAccounts.userId, resolvedUserId),
    eq(linkedinAccounts.isConnected, true),
  ];
  if (preferredAccountId?.trim()) {
    conditions.push(eq(linkedinAccounts.unipileAccountId, preferredAccountId.trim()));
  }
  const [acc] = await db.select().from(linkedinAccounts).where(and(...conditions)).limit(1);
  if (!acc && preferredAccountId?.trim()) {
    throw new Error("The requested LinkedIn account does not belong to this workspace.");
  }
  ```
- **Proof:** If Tenant B passes Tenant A's `unipileAccountId`, the query yields zero rows and throws an explicit authorization failure.

### 2.3 Elimination of Hardcoded Developer UUIDs
- Prior defect: `WORKPILOT-connect-agent.ts` contained `params.userId || "83efcc7b-d348-429f-a454-770a2a540dbe"`.
- Remediated implementation: Both `chatWithWORKPILOTAgent` and `executeAutonomousCampaignWorkflow` fail closed with `401 / Authentication required` when `userId` is omitted.

---

## 3. Test Evidence

Validated in `server/src/__tests__/unit/ai-tools-and-byok.test.ts`:
- `runWithToolTenant establishes isolated user context for tool execution` (PASS)
- `runWithToolTenant fails closed if userId is empty` (PASS)
- `rejects tool calls attempting to use another tenant's LinkedIn account` (PASS)
- `chatWithWORKPILOTAgent rejects calls without userId (no hardcoded fallback)` (PASS)
- `executeAutonomousCampaignWorkflow rejects calls without userId (no hardcoded fallback)` (PASS)
