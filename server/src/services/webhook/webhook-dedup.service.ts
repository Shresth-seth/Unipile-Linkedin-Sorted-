import { db } from "../../db/index.js";
import { webhookEvents } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export class WebhookDedupService {
  /**
   * Atomically checks whether this event/message ID has already been recorded.
   * If not recorded, registers it with status 'RECEIVED'.
   * If already exists, returns isDuplicate: true.
   */
  public async claimEvent(
    eventId: string,
    eventType: string,
    payload: any,
    accountId?: string,
    userId?: string,
  ): Promise<{ isDuplicate: boolean; eventDbId?: string }> {
    if (!eventId || !eventId.trim()) {
      // If eventId cannot be derived, allow processing without dedup
      return { isDuplicate: false };
    }

    try {
      // 1. Check if event was already recorded
      const [existing] = await db
        .select({ id: webhookEvents.id, status: webhookEvents.status })
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, eventId))
        .limit(1);

      if (existing) {
        return { isDuplicate: true, eventDbId: existing.id };
      }

      // 2. Insert new record atomically
      const [inserted] = await db
        .insert(webhookEvents)
        .values({
          eventId,
          eventType,
          accountId: accountId || null,
          userId: userId || null,
          payload: payload || {},
          status: "RECEIVED",
          processedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning();

      if (!inserted) {
        // Another concurrent worker just claimed it
        return { isDuplicate: true };
      }

      return { isDuplicate: false, eventDbId: inserted.id };
    } catch (err: any) {
      console.warn(`[webhook-dedup] Error checking idempotency for ${eventId}:`, err?.message || err);
      // Fail-open: allow webhook to proceed if DB check encountered temporary glitch
      return { isDuplicate: false };
    }
  }

  /**
   * Updates status of processed webhook event.
   */
  public async markProcessed(eventId: string, status: "PROCESSED" | "FAILED" | "IGNORED", errorMessage?: string): Promise<void> {
    try {
      await db
        .update(webhookEvents)
        .set({
          status,
          errorMessage: errorMessage || null,
          processedAt: new Date(),
        })
        .where(eq(webhookEvents.eventId, eventId));
    } catch {}
  }
}

export const webhookDedupService = new WebhookDedupService();
