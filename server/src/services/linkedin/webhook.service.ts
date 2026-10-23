import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contacts, messages, linkedinAccounts } from "../../db/schema.js";
import { unipileClient } from "../unipile/unipile.client.js";

export class LinkedInWebhookService {
  public async handleWebhookEvent(
    event: any,
  ): Promise<{ handled: boolean; action?: string }> {
    if (!event || !event.event) {
      return { handled: false, action: "IGNORED_EMPTY_EVENT" };
    }

    const eventType = String(event.event).toLowerCase();
    const accountId = event.account_id || event.accountId;

    let userId: string | undefined;
    if (accountId) {
      const [acc] = await db
        .select()
        .from(linkedinAccounts)
        .where(eq(linkedinAccounts.unipileAccountId, accountId))
        .limit(1);
      userId = acc?.userId;
    }

    if (eventType.includes("message") && event.data) {
      const msg = event.data;
      const senderId = msg.sender_id || msg.senderId;
      const chatText = msg.text || msg.content || "";

      if (userId && senderId) {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(
            and(eq(contacts.userId, userId), eq(contacts.linkedinId, senderId)),
          )
          .limit(1);

        if (contact) {
          await db.insert(messages).values({
            userId,
            contactId: contact.id,
            conversationId:
              msg.chat_id || msg.conversation_id || "conv_external",
            senderId: senderId,
            senderName: msg.sender_name || contact.name,
            direction: "INBOUND",
            content: chatText,
            sentAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          });

          const newStatus =
            contact.status === "CONTACTED" || contact.status === "CONNECTED"
              ? "CONVERSATION"
              : contact.status;

          await db
            .update(contacts)
            .set({
              status: newStatus,
              lastMessageReceivedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, contact.id));

          return { handled: true, action: "INBOUND_MESSAGE_RECORDED" };
        }
      }
    }

    if (
      eventType.includes("invitation_accepted") ||
      eventType.includes("connection")
    ) {
      const providerId = event.data?.user_id || event.data?.provider_id;
      if (userId && providerId) {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.userId, userId),
              eq(contacts.linkedinId, providerId),
            ),
          )
          .limit(1);

        if (contact) {
          await db
            .update(contacts)
            .set({
              status: "CONNECTED",
              connectedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, contact.id));

          return { handled: true, action: "CONNECTION_ACCEPTED_RECORDED" };
        }
      }
    }

    if (
      eventType.includes("account_status") ||
      eventType.includes("checkpoint")
    ) {
      if (accountId) {
        const [acc] = await db
          .select()
          .from(linkedinAccounts)
          .where(eq(linkedinAccounts.unipileAccountId, accountId))
          .limit(1);

        if (acc) {
          const status =
            event.data?.status ||
            (event.data?.checkpoint ? "CHALLENGED" : "HEALTHY");
          await db
            .update(linkedinAccounts)
            .set({
              healthStatus: status === "OK" ? "HEALTHY" : status,
              updatedAt: new Date(),
            })
            .where(eq(linkedinAccounts.id, acc.id));

          return { handled: true, action: "ACCOUNT_STATUS_SYNCED" };
        }
      }
    }

    return { handled: true, action: "GENERIC_EVENT_ACKNOWLEDGED" };
  }

  public async listWebhooks(): Promise<any[]> {
    return unipileClient.listWebhooks();
  }

  public async registerWebhook(
    targetUrl: string,
    events?: string[],
  ): Promise<any> {
    const defaultEvents = [
      "message_received",
      "invitation_accepted",
      "account_status_changed",
    ];
    return unipileClient.createWebhook(targetUrl, events || defaultEvents);
  }
}

export const linkedInWebhookService = new LinkedInWebhookService();
