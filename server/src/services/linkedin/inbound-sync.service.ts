import { db } from "../../db/index.js";
import { contacts, messages, linkedinAccounts, messageAgentJobs } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { unipileClient } from "../unipile/unipile.client.js";
import { linkedInMessageService } from "./message.service.js";
import { unipileMessageAgentService } from "../webhook/unipile-message-agent.service.js";
import { messageAgentWorker } from "../webhook/message-agent.worker.js";

export class InboundSyncService {
  private isPolling = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastSyncTime = 0;

  /**
   * Ultra-fast synchronization of recent conversations and inbound messages.
   * Utilizes in-memory deduplication sets, batched SQL inserts, and non-blocking
   * background agent job dispatch to achieve sub-second execution times.
   */
  public async syncAccount(
    userId: string,
    accountId: string,
    options: { limit?: number } = {},
  ): Promise<{
    syncedChatsCount: number;
    newInboundCount: number;
    totalMessagesSynced: number;
    processedJobsCount: number;
  }> {
    if (!unipileClient.isConfigured() || !userId || !accountId) {
      return { syncedChatsCount: 0, newInboundCount: 0, totalMessagesSynced: 0, processedJobsCount: 0 };
    }

    const limit = options.limit || 25;
    let newInboundCount = 0;
    let totalMessagesSynced = 0;
    let processedJobsCount = 0;

    try {
      // 1. Fetch conversations with enriched attendee profiles
      const chats = await linkedInMessageService.getConversations(accountId, limit);
      if (!chats || chats.length === 0) {
        return { syncedChatsCount: 0, newInboundCount: 0, totalMessagesSynced: 0, processedJobsCount: 0 };
      }

      // 2. Pre-fetch all existing user contacts in ONE single database query
      const existingContactsList = await db
        .select()
        .from(contacts)
        .where(eq(contacts.userId, userId));

      const contactByLinkedinId = new Map<string, any>();
      for (const c of existingContactsList) {
        if (c.linkedinId) {
          contactByLinkedinId.set(c.linkedinId, c);
        }
      }

      // 3. Process each chat with concurrent message fetching (concurrency pool of 4)
      const chunkSize = 4;
      for (let i = 0; i < chats.length; i += chunkSize) {
        const chunk = chats.slice(i, i + chunkSize);

        await Promise.all(
          chunk.map(async (chat) => {
            const attendeeProviderId =
              chat.attendee_provider_id ||
              (chat.id ? `chat_${chat.id}` : undefined);

            if (!attendeeProviderId) return;

            // Resolve or upsert contact record
            let contact = contactByLinkedinId.get(attendeeProviderId);

            const realName =
              chat.name && chat.name !== "LinkedIn Member"
                ? chat.name
                : contact?.name || "LinkedIn Member";
            const realDesignation =
              chat.role || chat.headline || contact?.designation || "LinkedIn Connection";
            const realProfileUrl =
              chat.picture_url || chat.profile_url || contact?.profileUrl || null;

            if (!contact) {
              const [created] = await db
                .insert(contacts)
                .values({
                  userId,
                  name: realName,
                  linkedinId: attendeeProviderId,
                  profileUrl: realProfileUrl,
                  designation: realDesignation,
                  status: "CONVERSATION",
                  conversationMode: "AUTOMATIC",
                })
                .returning();
              contact = created;
              if (contact) {
                contactByLinkedinId.set(attendeeProviderId, contact);
              }
            } else {
              // Update details if missing or changed
              if (
                (contact.name === "LinkedIn Member" && realName !== "LinkedIn Member") ||
                (!contact.profileUrl && realProfileUrl) ||
                (!contact.designation && realDesignation)
              ) {
                await db
                  .update(contacts)
                  .set({
                    name: realName,
                    designation: realDesignation,
                    profileUrl: realProfileUrl,
                    updatedAt: new Date(),
                  })
                  .where(eq(contacts.id, contact.id));
              }
            }

            if (!contact) return;

            // Fetch recent messages for this chat thread from Unipile
            let threadMessages: any[] = [];
            try {
              threadMessages = await linkedInMessageService.getMessages(chat.id);
            } catch (msgErr: any) {
              console.warn(
                `[INBOUND-SYNC] Could not fetch messages for chat ${chat.id}:`,
                msgErr.message,
              );
              return;
            }

            if (threadMessages.length === 0) return;

            // Sort messages chronologically (oldest to newest)
            const sortedMessages = [...threadMessages].sort(
              (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
            );

            // Fetch existing message content for this contact in ONE query
            const existingMessagesList = await db
              .select({
                direction: messages.direction,
                content: messages.content,
              })
              .from(messages)
              .where(
                and(
                  eq(messages.userId, userId),
                  eq(messages.contactId, contact.id),
                ),
              );

            const existingMsgSet = new Set(
              existingMessagesList.map((m) => `${m.direction}:::${m.content}`),
            );

            // Filter new messages in-memory (0ms)
            const newMsgRows: any[] = [];
            let latestInboundMsg: any = null;

            for (const msg of sortedMessages) {
              if (!msg.message || !msg.message.trim()) continue;

              const msgDirection = msg.isSender ? "OUTBOUND" : "INBOUND";
              const key = `${msgDirection}:::${msg.message}`;

              if (!existingMsgSet.has(key)) {
                existingMsgSet.add(key);
                const sentDate = msg.time ? new Date(msg.time) : new Date();

                newMsgRows.push({
                  userId,
                  contactId: contact.id,
                  conversationId: chat.id,
                  senderId: msg.isSender ? "self" : msg.senderId || attendeeProviderId,
                  senderName: msg.isSender ? "Me" : msg.senderName || contact.name,
                  direction: msgDirection,
                  content: msg.message,
                  sentAt: sentDate,
                });

                if (!msg.isSender) {
                  latestInboundMsg = msg;
                  newInboundCount++;
                }
              }
            }

            // Batch insert all new messages in ONE single SQL operation
            if (newMsgRows.length > 0) {
              await db.insert(messages).values(newMsgRows);
              totalMessagesSynced += newMsgRows.length;
            }

            // Update contact timestamps based on latest message
            const newestMsg = sortedMessages[sortedMessages.length - 1];
            if (newestMsg) {
              if (newestMsg.isSender) {
                await db
                  .update(contacts)
                  .set({
                    lastMessageSentAt: new Date(newestMsg.time),
                    updatedAt: new Date(),
                  })
                  .where(eq(contacts.id, contact.id));
              } else {
                await db
                  .update(contacts)
                  .set({
                    lastMessageReceivedAt: new Date(newestMsg.time),
                    updatedAt: new Date(),
                  })
                  .where(eq(contacts.id, contact.id));
              }
            }

            // If the newest message in thread is from the prospect and unreplied:
            const isProspectWaiting = newestMsg && !newestMsg.isSender;
            const targetInbound = latestInboundMsg || (isProspectWaiting ? newestMsg : null);

            if (isProspectWaiting && targetInbound && targetInbound.message) {
              const msgAgeMs = targetInbound.time
                ? Date.now() - new Date(targetInbound.time).getTime()
                : 0;
              const isRecent = msgAgeMs < 48 * 60 * 60 * 1000; // within 48 hours

              if (!isRecent) {
                console.log(
                  `ℹ️ [INBOUND-SYNC] Stale inbound message for ${contact.name} (${Math.round(msgAgeMs / 3600000)}h old). Skipping autonomous dispatch to prevent sending to cold thread.`,
                );
                return;
              }

              // Check if an AI job has already been completed or skipped for this inbound message
              const effectiveMsgId = targetInbound.id || `sync_${chat.id}_${new Date(targetInbound.time).getTime()}`;
              
              const [existingJob] = await db
                .select({ id: messageAgentJobs.id, status: messageAgentJobs.status })
                .from(messageAgentJobs)
                .where(
                  and(
                    eq(messageAgentJobs.chatId, chat.id),
                    eq(messageAgentJobs.messageId, effectiveMsgId),
                  ),
                )
                .limit(1);

              if (existingJob && (existingJob.status === "COMPLETED" || existingJob.status === "SKIPPED")) {
                return;
              }

              console.log(
                `📥 [INBOUND-SYNC] Triggering AI Pilot for ${contact.name}: "${targetInbound.message}"`,
              );

              const prep = await unipileMessageAgentService.prepareAndPersistInboundMessage({
                account_id: accountId,
                chat_id: chat.id,
                message_id: effectiveMsgId,
                text: targetInbound.message,
                timestamp: targetInbound.time,
                sender: {
                  attendee_provider_id: attendeeProviderId,
                  attendee_name: contact.name,
                  ...(contact.profileUrl
                    ? { attendee_profile_url: contact.profileUrl }
                    : {}),
                },
              });

              if (prep.jobId) {
                console.log(
                  `⚙️ [INBOUND-SYNC] Enqueued AI Agent Job ${prep.jobId} for ${contact.name} (dispatching asynchronously)...`,
                );
                // Run job asynchronously in the background so sync finishes immediately
                messageAgentWorker.processJob(prep.jobId).catch((err: any) => {
                  console.warn(
                    `[INBOUND-SYNC] Background job ${prep.jobId} execution notice:`,
                    err.message,
                  );
                });
                processedJobsCount++;
              }
            }
          }),
        );
      }

      return {
        syncedChatsCount: chats.length,
        newInboundCount,
        totalMessagesSynced,
        processedJobsCount,
      };
    } catch (err: any) {
      console.error(`[INBOUND-SYNC] Error syncing account ${accountId}:`, err);
      return { syncedChatsCount: 0, newInboundCount: 0, totalMessagesSynced: 0, processedJobsCount: 0 };
    }
  }

  /**
   * Synchronizes all active LinkedIn accounts across the platform.
   */
  public async syncAllActiveAccounts(): Promise<void> {
    const now = Date.now();
    // Prevent overlapping runs and guard against hung locks with 45s expiry
    if (this.isSyncing && now - this.lastSyncTime < 45000) {
      return;
    }
    this.isSyncing = true;
    this.lastSyncTime = now;

    try {
      const accounts = await db.select().from(linkedinAccounts);
      for (const acc of accounts) {
        if (!acc.unipileAccountId || !acc.userId) continue;
        await this.syncAccount(acc.userId, acc.unipileAccountId).catch((err) => {
          console.warn(
            `[INBOUND-SYNC] Account sync failed for ${acc.unipileAccountId}:`,
            err.message,
          );
        });
      }
    } catch (err: any) {
      console.warn("[INBOUND-SYNC] syncAllActiveAccounts error:", err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Starts periodic background polling for live LinkedIn message syncing.
   */
  public startPolling(intervalMs = 30000): void {
    if (this.isPolling) return;
    this.isPolling = true;

    console.log(
      `🔄 [INBOUND-SYNC] Started live LinkedIn polling worker (every ${intervalMs / 1000}s).`,
    );

    // Initial sync after 3 seconds to allow boot
    setTimeout(() => {
      this.syncAllActiveAccounts().catch(() => {});
    }, 3000);

    this.pollInterval = setInterval(() => {
      this.syncAllActiveAccounts().catch(() => {});
    }, intervalMs);
  }

  /**
   * Stops periodic background polling.
   */
  public stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log("🛑 [INBOUND-SYNC] Stopped live LinkedIn polling worker.");
  }
}

export const inboundSyncService = new InboundSyncService();
