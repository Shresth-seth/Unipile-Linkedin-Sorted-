import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  contacts,
  messages,
  actionQueue,
  linkedinAccounts,
} from "../../db/schema.js";
import { intentDetectionService } from "../intelligence/intent.service.js";

import { normalizeUnipileMessageWebhook } from "./unipile-normalizer.js";

export class InboundWebhookService {
  public async handleInboundMessage(rawPayload: any) {
    const norm = normalizeUnipileMessageWebhook(rawPayload);

    if (!norm.isValid) {
      console.warn(`[INBOUND MESSAGE] Invalid webhook payload: ${norm.validationError}`);
      return { success: false, reason: norm.validationError };
    }

    if (norm.isOwnMessage) {
      console.log(`[WEBHOOK] direction=OUTBOUND\n[WEBHOOK] own message ignored`);
      return { success: true, ignored: true, direction: "OUTBOUND" };
    }

    console.log(
      `📩 [INBOUND MESSAGE] From ${norm.senderName} (${norm.senderProviderId}): "${norm.text}"`,
    );

    const userId = await this.resolveUserIdFromAccount(norm.accountId);
    if (!userId) {
      throw new Error(`Unable to map incoming message account (${norm.accountId}) to a WorkPilot user.`);
    }

    // Scoped query: user + senderProviderId to prevent cross-user leakage
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.linkedinId, norm.senderProviderId)))
      .limit(1);

    let contactRecord: any = contact;
    if (!contactRecord) {
      console.log(`[CONTACT] Contact not found for sender ${norm.senderProviderId}. Creating provisional contact.`);
      const [created] = await db
        .insert(contacts)
        .values({
          userId,
          name: norm.senderName || "LinkedIn Member",
          linkedinId: norm.senderProviderId,
          profileUrl: norm.senderProfileUrl || null,
          status: "CONVERSATION",
        })
        .returning();
      contactRecord = created;
    }

    if (!contactRecord) {
      throw new Error(`Failed to resolve or create contact for sender ${norm.senderProviderId}`);
    }

    const [savedMsg] = await db
      .insert(messages)
      .values({
        userId,
        contactId: contactRecord.id,
        conversationId: norm.chatId || `chat_${norm.senderProviderId}`,
        senderId: norm.senderProviderId,
        senderName: norm.senderName,
        direction: "INBOUND",
        content: norm.text,
        sentAt: norm.timestamp ? new Date(norm.timestamp) : new Date(),
      })
      .returning();

    let cancelledFollowUpsCount = 0;
    const cancelled = await db
      .update(actionQueue)
      .set({
        status: "CANCELLED",
        errorMessage:
          "Inbound reply received from prospect. Scheduled follow-up auto-cancelled.",
      })
      .where(
        and(
          eq(actionQueue.contactId, contactRecord.id),
          eq(actionQueue.actionType, "MESSAGE"),
          eq(actionQueue.status, "QUEUED"),
        ),
      )
      .returning();

    cancelledFollowUpsCount = cancelled.length;
    if (cancelledFollowUpsCount > 0) {
      console.log(
        `🛑 [ANTI-COLLISION] Cancelled ${cancelledFollowUpsCount} scheduled follow-up(s) for ${contactRecord.name}`,
      );
    }

    const intent = intentDetectionService.analyzeIntent(norm.text);

    const newStatus = intent.isHotLead ? "HOT_LEAD" : "CONVERSATION";
    const newConversationMode = intent.isHotLead
      ? "MANUAL"
      : contactRecord.conversationMode;

    const [updated] = await db
      .update(contacts)
      .set({
        status: newStatus,
        conversationMode: newConversationMode,
        isHotLead: intent.isHotLead,
        hotLeadReason: intent.reason || null,
        lastMessageReceivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contactRecord.id))
      .returning();

    const updatedContact = updated || contactRecord;

    if (intent.isHotLead) {
      console.log(
        `🔥 [HOT LEAD DETECTED] ${contactRecord.name}: ${intent.reason}. AI sending halted, human takeover ready.`,
      );
    }

    return {
      success: true,
      messageId: savedMsg?.id,
      cancelledFollowUps: cancelledFollowUpsCount,
      intent,
      contact: updatedContact,
    };
  }

  private async resolveUserIdFromAccount(
    accountId?: string,
  ): Promise<string | null> {
    if (!accountId) return null;
    const [acc] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.unipileAccountId, accountId))
      .limit(1);
    return acc ? acc.userId : null;
  }
}

export const inboundWebhookService = new InboundWebhookService();
