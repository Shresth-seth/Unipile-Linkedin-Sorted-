import { unipileClient } from "../unipile/unipile.client.js";
import { Message, ActionResult } from "../../types/linkedin.types.js";
import { linkedInPeopleService } from "./people.service.js";
import { db } from "../../db/index.js";
import { contacts, messages } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

export class LinkedInMessageService {
  private attendeeCache = new Map<string, { attendee: any; expiresAt: number }>();

  /**
   * Resolves attendee details for a chat using memory cache, DB contacts cache, or Unipile API.
   */
  public async resolveAttendeeForChat(
    chatId: string,
    attendeeProviderId?: string,
    accountId?: string,
  ): Promise<any> {
    const cacheKey = attendeeProviderId || chatId;
    if (!cacheKey) return null;

    const cached = this.attendeeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.attendee;
    }

    // 1. Check local DB contacts cache first
    if (attendeeProviderId) {
      try {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(eq(contacts.linkedinId, attendeeProviderId))
          .limit(1);

        if (contact && contact.name && contact.name !== "LinkedIn Member") {
          const resolved = {
            name: contact.name,
            headline: contact.designation || "LinkedIn Connection",
            picture_url: contact.profileUrl || null,
            profile_url: contact.profileUrl || null,
            provider_id: contact.linkedinId,
          };
          this.attendeeCache.set(cacheKey, {
            attendee: resolved,
            expiresAt: Date.now() + 30 * 60 * 1000,
          });
          return resolved;
        }
      } catch {}
    }

    // 2. Fetch directly from Unipile chat attendees sub-resource
    try {
      const attendeesRes = await unipileClient
        .request<any>(`/api/v1/chats/${chatId}/attendees`)
        .catch(() => null);

      const items = attendeesRes?.items || attendeesRes?.data || (Array.isArray(attendeesRes) ? attendeesRes : []);
      const found = items.find((a: any) => !a.is_self && (!accountId || a.provider_id !== accountId)) || items[0];

      if (found && (found.name || found.provider_id)) {
        let realName = found.name || found.attendee_name;
        let pictureUrl = found.picture_url || found.attendee_profile_url || null;
        let headline = found.specifics?.occupation || found.headline || found.role;

        // If headline is missing but we have provider_id and accountId, try user profile endpoint
        const targetProviderId = attendeeProviderId || found.provider_id;
        if ((!headline || !realName) && targetProviderId && accountId) {
          try {
            const userProfile = await unipileClient
              .request<any>(`/api/v1/users/${targetProviderId}?account_id=${accountId}`)
              .catch(() => null);
            if (userProfile) {
              if (userProfile.first_name || userProfile.last_name) {
                realName = `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim();
              }
              headline = userProfile.headline || headline;
              pictureUrl = userProfile.profile_picture_url || userProfile.profile_picture_url_large || pictureUrl;
            }
          } catch {}
        }

        const resolved = {
          name: realName || "LinkedIn Member",
          headline: headline || "LinkedIn Connection",
          picture_url: pictureUrl,
          profile_url: found.profile_url || null,
          provider_id: targetProviderId,
        };

        this.attendeeCache.set(cacheKey, {
          attendee: resolved,
          expiresAt: Date.now() + 30 * 60 * 1000,
        });

        // Background update of local contact if exists
        if (targetProviderId && realName && realName !== "LinkedIn Member") {
          db.update(contacts)
            .set({
              name: realName,
              designation: headline || undefined,
              profileUrl: pictureUrl || undefined,
              updatedAt: new Date(),
            })
            .where(eq(contacts.linkedinId, targetProviderId))
            .catch(() => {});
        }

        return resolved;
      }
    } catch {}

    return null;
  }

  /**
   * Retrieves active messaging threads with enriched attendee names, PFPs, and headlines.
   */
  public async getConversations(
    accountId?: string,
    limit = 30,
  ): Promise<any[]> {
    if (!unipileClient.isConfigured()) {
      return [];
    }

    if (!accountId || !accountId.trim()) {
      return [];
    }

    try {
      const resolvedAccountId = accountId.trim();

      const chatsEndpoint = `/api/v1/chats?account_id=${resolvedAccountId}&limit=${limit}`;
      const attendeesEndpoint = `/api/v1/chat_attendees?account_id=${resolvedAccountId}&limit=100`;

      const [chatsRes, attendeesRes] = await Promise.all([
        unipileClient.request<any>(chatsEndpoint).catch(() => ({ items: [] })),
        unipileClient
          .request<any>(attendeesEndpoint)
          .catch(() => ({ items: [] })),
      ]);

      const chats = chatsRes.items || chatsRes.data || (Array.isArray(chatsRes) ? chatsRes : []);
      const attendees =
        attendeesRes.items || attendeesRes.data || (Array.isArray(attendeesRes) ? attendeesRes : []);

      const attendeesMap = new Map<string, any>();
      for (const att of attendees) {
        if (att.provider_id) attendeesMap.set(att.provider_id, att);
        if (att.id) attendeesMap.set(att.id, att);
        if (att.attendee_id) attendeesMap.set(att.attendee_id, att);
      }

      // Concurrently enrich any chat missing direct attendee mapping
      const enrichedChats = await Promise.all(
        chats.map(async (chat: any) => {
          const inlineAttendees = Array.isArray(chat.attendees) ? chat.attendees : [];
          const inlineAtt =
            inlineAttendees.find((a: any) => !a.is_self && a.provider_id !== resolvedAccountId) ||
            inlineAttendees[0] ||
            chat.attendee ||
            null;

          let att =
            (chat.attendee_provider_id && attendeesMap.get(chat.attendee_provider_id)) ||
            (chat.attendee_id && attendeesMap.get(chat.attendee_id)) ||
            (inlineAtt?.provider_id && attendeesMap.get(inlineAtt.provider_id)) ||
            inlineAtt ||
            null;

          // If attendee name is still missing or defaults to LinkedIn Member, resolve via chat attendees endpoint
          if (!att?.name && !chat.name) {
            const extraAtt = await this.resolveAttendeeForChat(
              chat.id,
              chat.attendee_provider_id || inlineAtt?.provider_id,
              resolvedAccountId,
            );
            if (extraAtt) {
              att = { ...att, ...extraAtt };
            }
          }

          const realName =
            att?.name ||
            att?.attendee_name ||
            chat.name ||
            (chat.subject ? `Subject: ${chat.subject}` : "LinkedIn Member");

          const occupation =
            att?.headline ||
            att?.specifics?.occupation ||
            att?.role ||
            (chat.subject ? `Subject: ${chat.subject}` : "LinkedIn Connection");

          const pictureUrl =
            att?.picture_url ||
            att?.attendee_profile_url ||
            chat.picture_url ||
            chat.image_url ||
            null;

          const profileUrl =
            att?.profile_url ||
            att?.attendee_profile_url ||
            chat.profile_url ||
            null;

          const attendeeProviderId =
            chat.attendee_provider_id ||
            att?.provider_id ||
            att?.attendee_provider_id ||
            inlineAtt?.provider_id ||
            null;

          return {
            ...chat,
            name: realName,
            attendee_name: realName,
            picture_url: pictureUrl,
            role: occupation,
            headline: occupation,
            profile_url: profileUrl,
            attendee_provider_id: attendeeProviderId,
          };
        }),
      );

      return enrichedChats;
    } catch (err: any) {
      console.warn("Failed to get enriched conversations:", err);
      return [];
    }
  }

  /**
   * Retrieves messages for a specific conversation thread.
   */
  public async getMessages(conversationId: string): Promise<Message[]> {
    if (!unipileClient.isConfigured()) {
      return [];
    }

    try {
      const res = await unipileClient.request<any>(
        `/api/v1/chats/${conversationId}/messages`,
      );
      const items = res.items || res.data || (Array.isArray(res) ? res : []);
      return items.map((item: any) => {
        const isSender = Boolean(
          item.is_sender ||
          item.sender === "Me" ||
          item.direction === "OUTBOUND" ||
          item.is_self
        );
        return {
          id: item.id || `msg_${Date.now()}_${Math.random()}`,
          conversation: conversationId,
          sender: isSender ? "Me" : (item.sender_name || item.sender_id || "Prospect"),
          receiver: isSender ? "Prospect" : "Me",
          message: item.text || item.body || "",
          time: item.timestamp || item.created_at || new Date().toISOString(),
          isSender,
          senderName: item.sender_name,
          senderId: item.sender_id,
          attachments: item.attachments || [],
        };
      });
    } catch (err: any) {
      console.warn(`Failed to fetch messages for conversation ${conversationId}:`, err);
      return [];
    }
  }

  /**
   * Deep synchronization: Fetches recent conversations and messages from Unipile
   * and synchronizes them into local CRM contacts and messages tables.
   */
  public async syncInbox(
    userId: string,
    accountId: string,
    limit = 30,
  ): Promise<{
    success: boolean;
    syncedChatsCount: number;
    syncedMessagesCount: number;
    message: string;
  }> {
    if (!userId || !accountId) {
      return {
        success: false,
        syncedChatsCount: 0,
        syncedMessagesCount: 0,
        message: "User ID and active Account ID are required.",
      };
    }

    try {
      const conversations = await this.getConversations(accountId, limit);
      let syncedMessagesCount = 0;

      for (const chat of conversations) {
        const providerId =
          chat.attendee_provider_id ||
          (chat.id ? `chat_${chat.id}` : undefined);

        if (!providerId) continue;

        // 1. Resolve or upsert contact record
        let [contact] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.userId, userId),
              eq(contacts.linkedinId, providerId),
            ),
          )
          .limit(1);

        if (!contact) {
          const [newContact] = await db
            .insert(contacts)
            .values({
              userId,
              name: chat.name || "LinkedIn Member",
              linkedinId: providerId,
              profileUrl: chat.profile_url || null,
              designation: chat.role || "LinkedIn Connection",
              status: "CONVERSATION",
              conversationMode: "AUTOMATIC",
            })
            .returning();
          contact = newContact;
        } else {
          // Update details if missing
          await db
            .update(contacts)
            .set({
              name: contact.name === "LinkedIn Member" && chat.name ? chat.name : contact.name,
              profileUrl: contact.profileUrl || chat.profile_url || null,
              designation: contact.designation || chat.role || null,
              status:
                contact.status === "NEW" || contact.status === "CONTACTED" || contact.status === "CONNECTED"
                  ? "CONVERSATION"
                  : contact.status,
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, contact.id));
        }

        if (!contact) continue;

        // 2. Fetch and synchronize messages for this chat
        try {
          const chatMessages = await this.getMessages(chat.id);
          if (chatMessages.length > 0) {
            const existingMsgs = await db
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
              existingMsgs.map((m) => `${m.direction}:::${m.content}`),
            );

            const toInsert: any[] = [];
            for (const msg of chatMessages) {
              if (!msg.message || !msg.message.trim()) continue;

              const msgDirection = msg.isSender ? "OUTBOUND" : "INBOUND";
              const key = `${msgDirection}:::${msg.message}`;

              if (!existingMsgSet.has(key)) {
                existingMsgSet.add(key);
                toInsert.push({
                  userId,
                  contactId: contact.id,
                  conversationId: chat.id,
                  senderId: msg.isSender ? "self" : msg.senderId || providerId,
                  senderName: msg.isSender ? "Me" : msg.senderName || chat.name || "Prospect",
                  direction: msgDirection,
                  content: msg.message,
                  sentAt: msg.time ? new Date(msg.time) : new Date(),
                });
              }
            }

            if (toInsert.length > 0) {
              await db.insert(messages).values(toInsert);
              syncedMessagesCount += toInsert.length;
            }
          }

          // Update contact timestamps
          if (chatMessages.length > 0) {
            const lastMsg = chatMessages[chatMessages.length - 1];
            if (lastMsg) {
              if (lastMsg.isSender) {
                await db
                  .update(contacts)
                  .set({ lastMessageSentAt: new Date(lastMsg.time) })
                  .where(eq(contacts.id, contact.id));
              } else {
                await db
                  .update(contacts)
                  .set({ lastMessageReceivedAt: new Date(lastMsg.time) })
                  .where(eq(contacts.id, contact.id));
              }
            }
          }
        } catch (msgErr) {
          console.warn(`Failed to sync messages for chat ${chat.id}:`, msgErr);
        }
      }

      return {
        success: true,
        syncedChatsCount: conversations.length,
        syncedMessagesCount,
        message: `Successfully synchronized ${conversations.length} conversation(s) and ${syncedMessagesCount} new message(s).`,
      };
    } catch (err: any) {
      console.error("syncInbox error:", err);
      return {
        success: false,
        syncedChatsCount: 0,
        syncedMessagesCount: 0,
        message: `Sync failed: ${err.message}`,
      };
    }
  }

  /**
   * Sends a message directly to an existing chat thread.
   */
  public async sendChatReply(
    chatId: string,
    messageText: string,
    accountId?: string,
    userId?: string,
  ): Promise<ActionResult> {
    if (!chatId || !chatId.trim()) {
      return { success: false, message: "Chat ID is required to reply to a conversation." };
    }
    const cleanText = (messageText || "").trim();
    if (!cleanText || cleanText === "null" || cleanText === "undefined") {
      return { success: false, message: "Message text cannot be empty." };
    }

    try {
      const res = await unipileClient.sendChatMessage(chatId.trim(), cleanText, accountId?.trim());
      if (userId) {
        this.recordOutboundSentMessage(userId, chatId.trim(), cleanText).catch(() => {});
      }
      return {
        success: true,
        message: "Message sent to chat successfully",
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to send message to chat: ${err.message}`,
      };
    }
  }

  /**
   * Helper to persist outbound messages to the local database for instant sync.
   */
  private async recordOutboundSentMessage(
    userId: string,
    targetIdentifier: string,
    text: string,
    chatId?: string,
  ): Promise<void> {
    try {
      // Find contact by matching linkedinId or checking for contact associated with this chat
      let [matchedContact] = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.userId, userId),
            eq(contacts.linkedinId, targetIdentifier),
          ),
        )
        .limit(1);

      if (!matchedContact && chatId) {
        // Also check if any messages exist under this conversationId
        const [priorMsg] = await db
          .select({ contactId: messages.contactId })
          .from(messages)
          .where(and(eq(messages.userId, userId), eq(messages.conversationId, chatId)))
          .limit(1);

        if (priorMsg?.contactId) {
          const [found] = await db
            .select()
            .from(contacts)
            .where(and(eq(contacts.userId, userId), eq(contacts.id, priorMsg.contactId)))
            .limit(1);
          matchedContact = found;
        }
      }

      if (matchedContact) {
        await db.insert(messages).values({
          userId,
          contactId: matchedContact.id,
          conversationId: chatId || (targetIdentifier.startsWith("chat_") ? targetIdentifier : `chat_${matchedContact.linkedinId}`),
          senderId: "self",
          senderName: "Me",
          direction: "OUTBOUND",
          content: text,
          sentAt: new Date(),
        });
        await db
          .update(contacts)
          .set({
            lastMessageSentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, matchedContact.id));
      }
    } catch (dbErr) {
      console.warn("Could not log sent message to DB:", dbErr);
    }
  }

  /**
   * Sends a direct message to a recipient or directly into a chat.
   */
  public async sendMessage(
    recipientId: string,
    messageText: string,
    accountId?: string,
    _userId?: string,
    chatId?: string,
  ): Promise<ActionResult> {
    if (!accountId || !accountId.trim()) {
      return {
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account to send messages.",
      };
    }

    const cleanText = (messageText || "").trim();
    if (!cleanText || cleanText === "null" || cleanText === "undefined") {
      return {
        success: false,
        message: "Message text cannot be empty.",
      };
    }

    const resolvedAccountId = accountId.trim();

    try {
      // 1. If an explicit chatId is provided, dispatch directly to existing chat
      if (chatId && chatId.trim()) {
        const chatRes = await unipileClient.sendChatMessage(
          chatId.trim(),
          cleanText,
          resolvedAccountId,
        );
        if (_userId) {
          this.recordOutboundSentMessage(_userId, recipientId || chatId.trim(), cleanText, chatId.trim()).catch(() => {});
        }
        return {
          success: true,
          message: "Message sent successfully to LinkedIn chat",
          data: chatRes,
        };
      }

      // 2. Determine if recipientId is a Unipile chat ID vs a LinkedIn member/profile ID
      const trimmedRecipient = (recipientId || "").trim();
      const isExplicitPerson =
        trimmedRecipient.startsWith("ACo") ||
        trimmedRecipient.startsWith("ACw") ||
        trimmedRecipient.startsWith("urn:li:") ||
        trimmedRecipient.includes("@");

      let isChatId =
        trimmedRecipient.startsWith("chat_") ||
        (!isExplicitPerson && trimmedRecipient.length >= 20 && trimmedRecipient.length <= 32);

      let res;
      if (isChatId) {
        try {
          res = await unipileClient.sendChatMessage(
            trimmedRecipient,
            cleanText,
            resolvedAccountId,
          );
          if (_userId) {
            this.recordOutboundSentMessage(_userId, recipientId || trimmedRecipient, cleanText, trimmedRecipient).catch(() => {});
          }
          return {
            success: true,
            message: "Message sent successfully to LinkedIn chat",
            data: res,
          };
        } catch (chatErr: any) {
          // If chat lookup failed with 404/422, fall back to person-level outreach
          console.warn("Direct chat dispatch failed, attempting recipient resolution:", chatErr.message);
        }
      }

      // 3. Fallback / Person-level Direct Outreach
      let providerId = trimmedRecipient;
      if (providerId.startsWith("urn:li:fsd_profile:")) {
        providerId = providerId.replace("urn:li:fsd_profile:", "");
      } else if (providerId.startsWith("urn:li:fs_miniProfile:")) {
        providerId = providerId.replace("urn:li:fs_miniProfile:", "");
      } else if (providerId.startsWith("urn:li:member:")) {
        providerId = providerId.replace("urn:li:member:", "");
      }

      const isAlreadyProviderId =
        providerId.startsWith("ACo") ||
        providerId.startsWith("ACw") ||
        providerId.startsWith("urn:li:");

      if (!isAlreadyProviderId) {
        try {
          const profile = await unipileClient.getProfile(resolvedAccountId, trimmedRecipient);
          providerId = profile.provider_id || profile.linkedin_id || providerId;
        } catch (e) {
          console.error("Failed to resolve profile for messaging:", e);
          if (!providerId.startsWith("urn:li:member:")) {
            const candidates = await linkedInPeopleService.searchPeople(
              { role: trimmedRecipient, keywords: trimmedRecipient, limit: 3 },
              resolvedAccountId,
            );
            const bestMatch = candidates?.[0];
            if (bestMatch) {
              providerId = (bestMatch as any).provider_id || bestMatch.linkedin_id || providerId;
            }
          }
        }
      }
      
      const payload = {
        attendees_ids: [providerId],
        text: cleanText,
        account_id: resolvedAccountId,
      };
      res = await unipileClient.request("/api/v1/chats", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (_userId) {
        this.recordOutboundSentMessage(_userId, providerId, cleanText, res?.id || chatId).catch(() => {});
      }

      return {
        success: true,
        message: "Message sent successfully to LinkedIn recipient",
        data: res,
      };
    } catch (err: any) {
      const errMsg = err?.message || "";
      let friendlyMsg = errMsg;
      if (errMsg.includes("subscription to provider") || errMsg.includes("403")) {
        friendlyMsg = "LinkedIn restricted: Direct messaging requires an active 1st-degree connection or a LinkedIn InMail subscription.";
      }
      return {
        success: false,
        message: `Failed to send message: ${friendlyMsg}`,
      };
    }
  }

  /**
   * Sends rich message with optional PDF/image attachments or voice notes.
   */
  public async sendRichMessage(params: {
    recipientId: string;
    messageText?: string | undefined;
    voiceNoteUrl?: string | undefined;
    attachments?:
      | Array<{ url?: string; name?: string; type?: string; data?: string }>
      | undefined;
    accountId?: string | undefined;
  }): Promise<ActionResult> {
    if (!params.accountId || !params.accountId.trim()) {
      return {
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account to send rich messages.",
      };
    }

    try {
      const res = await unipileClient.sendRichMessage({
        accountId: params.accountId,
        recipientId: params.recipientId,
        text: params.messageText,
        attachments: params.attachments,
        voiceNoteUrl: params.voiceNoteUrl,
      });

      return {
        success: true,
        message: "Rich message sent successfully",
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to send rich message: ${err.message}`,
      };
    }
  }

  /**
   * Marks a conversation thread as read or unread.
   */
  public async markConversationRead(
    conversationId: string,
    unread: boolean = false,
  ): Promise<ActionResult> {
    if (!unipileClient.isConfigured()) {
      return { success: false, message: "Unipile is not configured." };
    }

    try {
      const res = await unipileClient.markChatRead(conversationId, unread);
      return {
        success: true,
        message: `Conversation ${conversationId} marked as ${unread ? "unread" : "read"}`,
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to update read status: ${err.message}`,
      };
    }
  }

  /**
   * Polling fallback for fetching recent unread messages.
   */
  public async receiveNewMessage(accountId?: string): Promise<Message[]> {
    if (!unipileClient.isConfigured()) {
      return [];
    }

    try {
      const endpoint = accountId
        ? `/api/v1/messages?account_id=${accountId}&unread=true`
        : "/api/v1/messages?unread=true";
      const res = await unipileClient.request<any>(endpoint);
      const items = res.items || [];
      return items.map((item: any) => ({
        conversation: item.chat_id || "conv_unknown",
        sender: item.sender_name || item.sender_id || "Contact",
        receiver: "Me",
        message: item.text || "",
        time: item.timestamp || new Date().toISOString(),
      }));
    } catch (err: any) {
      return [];
    }
  }
}

export const linkedInMessageService = new LinkedInMessageService();
