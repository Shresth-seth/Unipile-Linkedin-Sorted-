import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { linkedinAccounts, actionQueue, contacts } from "../../db/schema.js";

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  circuitBreakerTriggered?: boolean;
}

export class AccountSafetyService {
  public async verifyPreFlight(
    userId: string,
    actionType: "CONNECT" | "MESSAGE" | "VIEW" | "REACT" | "COMMENT",
    targetContactId?: string,
    targetPersonLinkedinId?: string,
    messageText?: string,
  ): Promise<SafetyCheckResult> {
    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, userId))
      .limit(1);

    if (!account) {
      return {
        allowed: false,
        reason: "No LinkedIn account configured for this user.",
        circuitBreakerTriggered: true,
      };
    }

    if (!account.isConnected) {
      await this.triggerCircuitBreaker(account.id, "Account is not connected.");
      return {
        allowed: false,
        reason: "Account is disconnected. Reconnection required.",
        circuitBreakerTriggered: true,
      };
    }

    if (account.healthStatus !== "HEALTHY") {
      await this.triggerCircuitBreaker(
        account.id,
        `Account health degraded: ${account.healthStatus}`,
      );
      return {
        allowed: false,
        reason: `Account health issue: ${account.healthStatus}`,
        circuitBreakerTriggered: true,
      };
    }

    if (account.automationStatus === "PAUSED") {
      return {
        allowed: false,
        reason: "Automation is currently PAUSED by user or safety trigger.",
        circuitBreakerTriggered: false,
      };
    }

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    if (actionType === "CONNECT") {
      const [connectCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(actionQueue)
        .where(
          and(
            eq(actionQueue.userId, userId),
            eq(actionQueue.actionType, "CONNECT"),
            eq(actionQueue.status, "COMPLETED"),
            gte(actionQueue.executedAt, todayMidnight),
          ),
        );

      const count = Number(connectCountResult?.count || 0);
      if (count >= account.dailyConnectionsLimit) {
        await this.triggerCircuitBreaker(
          account.id,
          `Daily connection invite limit (${account.dailyConnectionsLimit}) reached for today.`,
        );
        return {
          allowed: false,
          reason: `Daily connection limit reached (${count}/${account.dailyConnectionsLimit}). Pausing automation for account safety.`,
          circuitBreakerTriggered: true,
        };
      }
    }

    if (actionType === "MESSAGE") {
      const [msgCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(actionQueue)
        .where(
          and(
            eq(actionQueue.userId, userId),
            eq(actionQueue.actionType, "MESSAGE"),
            eq(actionQueue.status, "COMPLETED"),
            gte(actionQueue.executedAt, todayMidnight),
          ),
        );

      const count = Number(msgCountResult?.count || 0);
      if (count >= account.dailyMessagesLimit) {
        await this.triggerCircuitBreaker(
          account.id,
          `Daily direct message limit (${account.dailyMessagesLimit}) reached for today.`,
        );
        return {
          allowed: false,
          reason: `Daily message limit reached (${count}/${account.dailyMessagesLimit}). Pausing for safety.`,
          circuitBreakerTriggered: true,
        };
      }
    }

    if (targetContactId || targetPersonLinkedinId) {
      if (actionType === "CONNECT") {
        let contact;
        if (targetContactId) {
          [contact] = await db
            .select()
            .from(contacts)
            .where(eq(contacts.id, targetContactId))
            .limit(1);
        } else if (targetPersonLinkedinId) {
          [contact] = await db
            .select()
            .from(contacts)
            .where(
              and(
                eq(contacts.userId, userId),
                eq(contacts.linkedinId, targetPersonLinkedinId),
              ),
            )
            .limit(1);
        }

        if (
          contact &&
          (contact.status === "CONTACTED" || contact.status === "CONNECTED")
        ) {
          return {
            allowed: false,
            reason: `Deduplication: Connection invite already sent to ${contact.name}. Skipping action.`,
            circuitBreakerTriggered: false,
          };
        }
      }

      if (actionType === "MESSAGE" && messageText) {
        const [dupMsg] = await db
          .select()
          .from(actionQueue)
          .where(
            and(
              eq(actionQueue.userId, userId),
              eq(actionQueue.contactId, targetContactId || ""),
              eq(actionQueue.actionType, "MESSAGE"),
              eq(actionQueue.status, "COMPLETED"),
              sql`payload->>'message' = ${messageText}`,
            ),
          )
          .limit(1);

        if (dupMsg) {
          return {
            allowed: false,
            reason:
              "Deduplication: Same message copy was already dispatched to this contact.",
            circuitBreakerTriggered: false,
          };
        }
      }
    }

    return { allowed: true };
  }

  public async triggerCircuitBreaker(
    accountId: string,
    reason: string,
  ): Promise<void> {
    console.warn(
      `🛑 [CIRCUIT BREAKER TRIGGERED] Account ${accountId}: ${reason}`,
    );
    await db
      .update(linkedinAccounts)
      .set({
        automationStatus: "PAUSED",
        updatedAt: new Date(),
      })
      .where(eq(linkedinAccounts.id, accountId));
  }

  public async pauseAutomation(
    userId: string,
    reason?: string,
  ): Promise<boolean> {
    console.warn(
      `🛑 [MANUAL PAUSE] User ${userId} requested automation pause${reason ? `: ${reason}` : ""}`,
    );
    await db
      .update(linkedinAccounts)
      .set({
        automationStatus: "PAUSED",
        updatedAt: new Date(),
      })
      .where(eq(linkedinAccounts.userId, userId));
    return true;
  }

  public async resumeAutomation(userId: string): Promise<boolean> {
    await db
      .update(linkedinAccounts)
      .set({
        automationStatus: "RUNNING",
        updatedAt: new Date(),
      })
      .where(eq(linkedinAccounts.userId, userId));
    return true;
  }

  public async getAccountHealth(userId: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId,
      );
    if (!isUuid) {
      return {
        hasAccount: false,
        isConnected: false,
        healthStatus: "DISCONNECTED",
        automationStatus: "PAUSED",
        dailyLimits: {
          connections: { limit: 25, usedToday: 0, remaining: 25 },
          messages: { limit: 50, usedToday: 0, remaining: 50 },
        },
      };
    }

    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, userId))
      .limit(1);

    if (
      !account ||
      !account.unipileAccountId ||
      !account.isConnected ||
      account.healthStatus === "DISCONNECTED"
    ) {
      return {
        hasAccount: false,
        isConnected: false,
        healthStatus: "DISCONNECTED",
        automationStatus: "PAUSED",
        dailyLimits: {
          connections: { limit: 25, usedToday: 0, remaining: 25 },
          messages: { limit: 50, usedToday: 0, remaining: 50 },
        },
      };
    }

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const [connectCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(actionQueue)
      .where(
        and(
          eq(actionQueue.userId, userId),
          eq(actionQueue.actionType, "CONNECT"),
          eq(actionQueue.status, "COMPLETED"),
          gte(actionQueue.executedAt, todayMidnight),
        ),
      );

    const [msgCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(actionQueue)
      .where(
        and(
          eq(actionQueue.userId, userId),
          eq(actionQueue.actionType, "MESSAGE"),
          eq(actionQueue.status, "COMPLETED"),
          gte(actionQueue.executedAt, todayMidnight),
        ),
      );

    const connectionsUsed = Number(connectCountResult?.count || 0);
    const messagesUsed = Number(msgCountResult?.count || 0);

    return {
      hasAccount: true,
      accountId: account.id,
      linkedinAccountId: account.unipileAccountId,
      isConnected: account.isConnected,
      healthStatus: account.healthStatus,
      automationStatus: account.automationStatus,
      dailyLimits: {
        connections: {
          limit: account.dailyConnectionsLimit,
          usedToday: connectionsUsed,
          remaining: Math.max(
            0,
            account.dailyConnectionsLimit - connectionsUsed,
          ),
        },
        messages: {
          limit: account.dailyMessagesLimit,
          usedToday: messagesUsed,
          remaining: Math.max(0, account.dailyMessagesLimit - messagesUsed),
        },
      },
      lastCheckedAt: new Date().toISOString(),
    };
  }
}

export const accountSafetyService = new AccountSafetyService();
