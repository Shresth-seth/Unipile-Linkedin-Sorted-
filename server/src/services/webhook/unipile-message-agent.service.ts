import { db } from "../../db/index.js";
import {
  contacts,
  messages,
  actionQueue,
  linkedinAccounts,
  dailyAgentSettings,
} from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { accountSafetyService } from "../safety/safety.service.js";
import { linkedInMessageService } from "../linkedin/message.service.js";
import { linkedInProfileService } from "../linkedin/profile.service.js";
import { getGeminiChatModelForUser } from "../../agent/WORKPILOT-connect-agent.js";
import { taskManager } from "../../agent/WORKPILOT-task-manager.js";
import { HumanMessage } from "@langchain/core/messages";
import { webhookDedupService } from "./webhook-dedup.service.js";
import { messageAgentWorker } from "./message-agent.worker.js";
import {
  normalizeUnipileMessageWebhook,
  NormalizedUnipileMessageEvent,
} from "./unipile-normalizer.js";

export interface UnipileMessageWebhookPayload {
  account_id?: string;
  account_type?: string;
  account_info?: {
    type?: string;
    feature?: string;
    user_id?: string; // Provider ID of the connected user
  };
  event?: string; // 'message_received' | 'message_reaction' | etc.
  chat_id?: string;
  timestamp?: string;
  webhook_name?: string;
  message_id?: string;
  message?: string;
  text?: string;
  sender?: {
    attendee_id?: string;
    attendee_name?: string;
    attendee_provider_id?: string;
    attendee_profile_url?: string;
  };
  attendees?: Array<{
    attendee_id?: string;
    attendee_name?: string;
    attendee_provider_id?: string;
    attendee_profile_url?: string;
  }>;
}

export class UnipileMessageAgentService {
  /**
  /**
   * Validates and immediately persists incoming message into DB and message_agent_jobs queue.
   * Runs BEFORE returning HTTP 200 to satisfy persistence requirements and SLAs.
   */
  /**
   * Validates and immediately persists incoming message into DB and message_agent_jobs queue.
   * Runs BEFORE returning HTTP 200 to satisfy persistence requirements and SLAs.
   */
  public async prepareAndPersistInboundMessage(
    payloadOrNorm: UnipileMessageWebhookPayload | NormalizedUnipileMessageEvent,
  ): Promise<{
    isOwnSent: boolean;
    jobId?: string;
    skipped?: boolean;
    reason?: string;
  }> {
    const norm = "isValid" in payloadOrNorm ? (payloadOrNorm as NormalizedUnipileMessageEvent) : normalizeUnipileMessageWebhook(payloadOrNorm);

    const messageId = norm.messageId;
    const accountId = norm.accountId;
    const messageText = norm.text;

    if (!accountId) {
      console.warn("[WEBHOOK] Missing account_id in webhook payload. Skipping.");
      await webhookDedupService.markProcessed(messageId, "IGNORED", "Missing account_id");
      return { isOwnSent: false, skipped: true, reason: "Missing account_id" };
    }

    // 1. Resolve WorkPilot User & LinkedIn Account
    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.unipileAccountId, accountId))
      .limit(1);

    if (!account) {
      console.warn(`[ACCOUNT] No local user account found for Unipile account ID: ${accountId}`);
      await webhookDedupService.markProcessed(messageId, "IGNORED", "Account not found locally");
      return { isOwnSent: false, skipped: true, reason: "Account not found locally" };
    }

    const userId = account.userId;
    console.log(`[ACCOUNT] mapped userId=${userId}`);

    // 2. VERY IMPORTANT: Detect whether message was SENT by connected user
    if (norm.isOwnMessage) {
      console.log(`[WEBHOOK] direction=OUTBOUND`);
      console.log(`[WEBHOOK] own message ignored`);
      await this.recordOutboundMessage(userId, norm);
      await webhookDedupService.markProcessed(messageId, "PROCESSED");
      return { isOwnSent: true };
    }

    // 3. Inbound classification: Resolve or create Contact for the inbound sender
    const contact = await this.resolveOrCreateContact(userId, norm);
    if (!contact) {
      console.warn(`[CONTACT] Inbound classification failed: could not map contact for sender ${norm.senderProviderId}`);
      await webhookDedupService.markProcessed(messageId, "IGNORED", "Contact could not be resolved");
      return { isOwnSent: false, skipped: true, reason: "Contact could not be resolved" };
    }

    console.log(`[CONTACT] resolved`);

    // 4. Save Inbound Message to messages table (idempotent against polling sync and webhooks)
    const [existingInbound] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.contactId, contact.id),
          eq(messages.direction, "INBOUND"),
          eq(messages.content, messageText),
        ),
      )
      .limit(1);

    if (!existingInbound) {
      await db
        .insert(messages)
        .values({
          userId,
          contactId: contact.id,
          conversationId: norm.chatId || `chat_${contact.linkedinId}`,
          senderId: norm.senderProviderId || contact.linkedinId,
          senderName: norm.senderName || contact.name,
          direction: "INBOUND",
          content: messageText,
          sentAt: norm.timestamp ? new Date(norm.timestamp) : new Date(),
        });
    }

    // 5. Anti-Collision: Cancel any scheduled follow-up actions for this contact
    const cancelledActions = await db
      .update(actionQueue)
      .set({
        status: "CANCELLED",
        errorMessage: "Inbound message received from prospect. Automated follow-up cancelled to prevent collision.",
      })
      .where(
        and(
          eq(actionQueue.contactId, contact.id),
          eq(actionQueue.actionType, "MESSAGE"),
          eq(actionQueue.status, "QUEUED"),
        ),
      )
      .returning();

    if (cancelledActions.length > 0) {
      console.log(`🛑 [message-agent] Anti-collision: Cancelled ${cancelledActions.length} scheduled follow-up(s) for ${contact.name}`);
    }

    // Update contact conversation timestamp
    await db
      .update(contacts)
      .set({
        status: contact.status === "NEW" || contact.status === "CONTACTED" || contact.status === "CONNECTED" ? "CONVERSATION" : contact.status,
        lastMessageReceivedAt: new Date(),
        lastInboundMessageId: messageId,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contact.id));

    // 6. Enqueue persistent Message Job into message_agent_jobs table
    const targetChatId = norm.chatId || contact.linkedinId;
    const jobId = await messageAgentWorker.enqueueJob({
      userId,
      accountId,
      chatId: targetChatId,
      messageId,
      payload: norm.rawPayload,
    });

    return { isOwnSent: false, jobId };
  }

  /**
   * Main entrypoint for processing an incoming Unipile message event asynchronously.
   */
  public async handleMessageWebhook(payload: UnipileMessageWebhookPayload): Promise<void> {
    const messageId = payload.message_id || (payload as any).id || `msg_${Date.now()}`;
    const prep = await this.prepareAndPersistInboundMessage(payload);

    if (prep.isOwnSent || prep.skipped || !prep.jobId) {
      return;
    }

    // Process message job via worker
    await messageAgentWorker.processJob(prep.jobId);
    await webhookDedupService.markProcessed(messageId, "PROCESSED");
  }

  /**
   * Processes a queued message agent job asynchronously with full context and safety.
   */
  public async processMessageJob(job: any): Promise<{
    status: "COMPLETED" | "SKIPPED" | "NEEDS_USER" | "FAILED";
    suggestedReply?: string | undefined;
    sentReply?: string | undefined;
    reasoning?: string | undefined;
    error?: string | undefined;
  }> {
    const { userId, accountId, chatId, payload } = job;
    const norm = normalizeUnipileMessageWebhook(payload);
    const messageText = norm.text;

    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.unipileAccountId, accountId))
      .limit(1);

    if (!account) {
      return { status: "FAILED", error: "LinkedIn account not found locally" };
    }

    const contact = await this.resolveOrCreateContact(userId, norm);
    if (!contact) {
      return { status: "FAILED", error: "Contact could not be mapped or resolved" };
    }

    // 1. Deterministic Opt-Out / Stop Check
    const isOptOut = this.checkDeterministicOptOut(messageText);
    if (isOptOut) {
      console.log(`🛑 [message-agent] Opt-out detected from ${contact.name}: "${messageText}"`);
      await db
        .update(contacts)
        .set({
          status: "LOST",
          optedOut: true,
          optedOutAt: new Date(),
          optOutReason: messageText.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contact.id));

      taskManager.broadcastToUser(userId, "prospect_opted_out", {
        contactId: contact.id,
        contactName: contact.name,
        reason: messageText,
      });

      return { status: "SKIPPED", reasoning: "Contact requested stop / opted out" };
    }

    // 2. Check User Reply Mode Preferences
    const [settings] = await db
      .select()
      .from(dailyAgentSettings)
      .where(eq(dailyAgentSettings.userId, userId))
      .limit(1);

    const replyMode = settings?.replyMode || "AUTO"; // 'OFF' | 'DRAFT' | 'AUTO'
    console.log(`[AUTO-REPLY] mode=${replyMode}, contact conversationMode=${contact.conversationMode || "AUTOMATIC"}`);

    if (replyMode === "OFF") {
      console.log(`[AUTO-REPLY] mode=OFF for user ${userId}. Skipping AI reply.`);
      return { status: "SKIPPED", reasoning: "Reply mode is OFF in user settings" };
    }

    // 2b. Check Contact-Level Takeover: if human has taken over this contact, don't auto-send
    if (contact.conversationMode === "MANUAL") {
      console.log(`[AUTO-REPLY] Contact ${contact.name} is in MANUAL mode (Human Takeover). Staging suggestion as draft.`);
      const draftText = await this.generateDraftReply(
        userId,
        account,
        contact,
        payload,
        "Human takeover active: manual control mode.",
      );
      return {
        status: "NEEDS_USER",
        suggestedReply: draftText,
        reasoning: "Human takeover active for this contact.",
      };
    }

    // 3. Bot Loop Protection & Cooldown Check
    let consecutiveReplies = contact.automatedReplyCount || 0;
    const lastAutomatedReplyAt = contact.lastAutomatedReplyAt
      ? new Date(contact.lastAutomatedReplyAt).getTime()
      : 0;

    // If more than 2 hours passed since last automated reply, treat as new session
    if (lastAutomatedReplyAt && Date.now() - lastAutomatedReplyAt > 2 * 60 * 60 * 1000) {
      consecutiveReplies = 0;
    }

    // Quick 8-second debounce against duplicate webhook deliveries
    const cooldownViolation = Date.now() - lastAutomatedReplyAt < 8 * 1000;

    // Allow up to 12 automated replies in an active conversation so AI Pilot can drive the discussion
    if (consecutiveReplies >= 12 || cooldownViolation) {
      console.warn(
        `⚠️ [message-agent] Loop protection active for ${contact.name} (Consecutive: ${consecutiveReplies}, cooldown: ${cooldownViolation}). Forcing DRAFT mode.`,
      );
      const draftText = await this.generateDraftReply(
        userId,
        account,
        contact,
        payload,
        "Loop protection active: requires human review.",
      );
      return {
        status: "NEEDS_USER",
        suggestedReply: draftText,
        reasoning: `Loop protection active (Consecutive automated replies: ${consecutiveReplies})`,
      };
    }

    // 4. AI Intent Classification & Analysis
    const analysis = await this.analyzeMessageIntelligence(
      userId,
      contact,
      messageText,
      chatId || norm.chatId,
    );

    // If intent indicates opt-out or negative rejection:
    if (analysis.intent === "unsubscribe_or_stop" || analysis.intent === "not_interested") {
      console.log(`[message-agent] LLM identified opt-out/not-interested intent for ${contact.name}`);
      await db
        .update(contacts)
        .set({
          status: "LOST",
          optedOut: true,
          optedOutAt: new Date(),
          optOutReason: `AI classified as ${analysis.intent}: ${analysis.rationale}`,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contact.id));

      return {
        status: "SKIPPED",
        reasoning: `Opt-out intent detected (${analysis.intent}): ${analysis.rationale}`,
      };
    }

    // 5. Decide between DRAFT and AUTO mode
    let needsUserReview = false;
    if (replyMode === "DRAFT") {
      needsUserReview = true;
    } else if (replyMode === "AUTO") {
      // In fully autonomous mode, only fallback for spam or highly sensitive/legal issues.
      needsUserReview = analysis.intent === "spam" || analysis.intent === "sensitive_or_ambiguous";
    } else {
      needsUserReview = true;
    }

    if (needsUserReview) {
      console.log(
        `[message-agent] Staging DRAFT reply for ${contact.name} (Mode: ${replyMode}, NeedsReview: ${analysis.needsHumanReview}, Intent: ${analysis.intent})`,
      );
      await this.saveDraftReply(contact.id, analysis.suggestedReply, analysis.rationale, userId);
      return {
        status: replyMode === "DRAFT" ? "COMPLETED" : "NEEDS_USER",
        suggestedReply: analysis.suggestedReply,
        reasoning: analysis.rationale,
      };
    }

    // 6. AUTO Mode: Send Reply via Unipile
    if (replyMode === "AUTO" && analysis.suggestedReply) {
      const safetyCheck = await accountSafetyService.verifyPreFlight(
        userId,
        "MESSAGE",
        contact.id,
        contact.linkedinId,
        analysis.suggestedReply,
      );

      if (!safetyCheck.allowed) {
        console.warn(`[message-agent] Safety check blocked auto-reply: ${safetyCheck.reason}. Staging as draft.`);
        await this.saveDraftReply(contact.id, analysis.suggestedReply, `Blocked by safety: ${safetyCheck.reason}`, userId);
        return {
          status: "NEEDS_USER",
          suggestedReply: analysis.suggestedReply,
          reasoning: `Safety check: ${safetyCheck.reason}`,
        };
      }

      const targetChatId = chatId || norm.chatId;
      console.log(`[message-agent] Generated reply for ${contact.name}: "${analysis.suggestedReply}"`);

      // Human Timing Jitter: Simulate natural human reading & typing pause so messages never appear instantly like a bot
      if (process.env.NODE_ENV !== "test") {
        const delaySeconds = Math.floor(Math.random() * 16) + 15; // 15 to 30 seconds
        console.log(`⏳ [message-agent] Simulating natural human reading/typing delay (${delaySeconds}s) for ${contact.name}...`);
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }

      // Re-check contact status and latest message to prevent collision if user replied manually during the delay
      const [freshContact] = await db
        .select({ conversationMode: contacts.conversationMode, optedOut: contacts.optedOut })
        .from(contacts)
        .where(eq(contacts.id, contact.id))
        .limit(1);

      if (freshContact?.conversationMode === "MANUAL" || freshContact?.optedOut) {
        console.log(`🛑 [message-agent] Anti-collision: Contact entered MANUAL or OPTED_OUT during typing pause. Aborting auto-reply.`);
        return {
          status: "SKIPPED",
          reasoning: "Contact mode changed to MANUAL or opted out during delay",
        };
      }

      const [latestDbMsg] = await db
        .select({ direction: messages.direction, sentAt: messages.sentAt })
        .from(messages)
        .where(and(eq(messages.userId, userId), eq(messages.contactId, contact.id)))
        .orderBy(desc(messages.sentAt))
        .limit(1);

      if (latestDbMsg && latestDbMsg.direction === "OUTBOUND") {
        const inboundTime = norm.timestamp ? new Date(norm.timestamp).getTime() : 0;
        const outboundTime = latestDbMsg.sentAt ? new Date(latestDbMsg.sentAt).getTime() : 0;
        if (outboundTime >= inboundTime) {
          console.log(`🛑 [message-agent] Anti-collision: Outbound message was already sent by user. Cancelling redundant auto-reply.`);
          return {
            status: "SKIPPED",
            reasoning: "Outbound message was already sent during typing delay.",
          };
        }
      }

      let sendResult: any;
      if (targetChatId && targetChatId !== "none") {
        console.log(`🚀 [message-agent] AUTO-REPLY sending into existing chat_id: ${targetChatId}`);
        sendResult = await linkedInMessageService.sendChatReply(
          targetChatId,
          analysis.suggestedReply,
          account.unipileAccountId || undefined,
        );
      } else {
        console.log(`🚀 [message-agent] AUTO-REPLY sending direct message to ${contact.name} (${contact.linkedinId})`);
        sendResult = await linkedInMessageService.sendMessage(
          contact.linkedinId,
          analysis.suggestedReply,
          account.unipileAccountId || undefined,
        );
      }

      if (sendResult.success) {
        console.log(`[UNIPILE] send success`);
        const outboundMsgId = sendResult.data?.id || `out_${Date.now()}`;

        // Save outbound message to DB
        await db.insert(messages).values({
          userId,
          contactId: contact.id,
          conversationId: targetChatId,
          senderId: account.unipileAccountId || "self",
          senderName: account.linkedinName || "Me",
          direction: "OUTBOUND",
          content: analysis.suggestedReply,
          sentAt: new Date(),
        });

        // Update contact metrics
        await db
          .update(contacts)
          .set({
            lastMessageSentAt: new Date(),
            lastOutboundMessageId: outboundMsgId,
            lastAutomatedReplyAt: new Date(),
            automatedReplyCount: consecutiveReplies + 1,
            draftReply: null,
            draftReplyReason: null,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id));

        taskManager.broadcastToUser(userId, "auto_reply_sent", {
          contactId: contact.id,
          contactName: contact.name,
          text: analysis.suggestedReply,
          intent: analysis.intent,
        });

        console.log(`[AUTO-REPLY] completed`);
        return {
          status: "COMPLETED",
          sentReply: analysis.suggestedReply,
          reasoning: analysis.rationale,
        };
      } else {
        console.error(`❌ [message-agent] Failed to send auto-reply to ${contact.name}: ${sendResult.message}`);
        await this.saveDraftReply(contact.id, analysis.suggestedReply, `Send failure: ${sendResult.message}`, userId);
        return {
          status: "FAILED",
          suggestedReply: analysis.suggestedReply,
          error: sendResult.message,
        };
      }
    }

    return { status: "SKIPPED", reasoning: "No action required" };
  }

  /**
   * Deterministic pattern matching for opt-out / stop intent.
   */
  public checkDeterministicOptOut(text: string): boolean {
    const clean = text.trim().toLowerCase();

    // Direct common opt-out phrases
    const optOutSubstrings = [
      "unsubscribe",
      "stop messaging",
      "stop contacting",
      "stop emailing",
      "stop sending",
      "do not contact",
      "don't contact",
      "do not message",
      "don't message",
      "remove me",
      "remove from list",
      "take me off",
      "not interested",
      "leave me alone",
      "never contact",
      "un-subscribe",
      "opt out",
      "opt-out",
    ];

    if (optOutSubstrings.some((sub) => clean.includes(sub))) {
      return true;
    }

    const exactPatterns = [
      /^stop[\.\!]?$/,
      /^no thanks[\.\!]?$/,
      /^no thank you[\.\!]?$/,
      /^not for me[\.\!]?$/,
      /^pass[\.\!]?$/,
    ];

    if (exactPatterns.some((pattern) => pattern.test(clean))) {
      return true;
    }

    const keywordRegex = /\b(?:unsubscribe|stop\s+(?:messaging|contacting|texting|reaching|sending)|do\s+not\s+(?:message|email|contact)|remove\s+(?:me\s+)?(?:from\s+)?(?:your\s+)?list|take\s+me\s+off\s+(?:your\s+)?list|(?:no\s+longer|not)\s+interested)\b/i;
    return keywordRegex.test(clean);
  }

  /**
   * Deep context assembly & Gemini LLM intelligence analysis.
   */
  private async analyzeMessageIntelligence(
    userId: string,
    contact: any,
    incomingText: string,
    chatId?: string,
  ): Promise<{
    intent: string;
    confidence: number;
    needsHumanReview: boolean;
    suggestedReply: string;
    rationale: string;
  }> {
    let recentMessages: Array<{ direction: string; content: string; sentAt: Date | null }> = [];
    try {
      // 1. Fetch recent conversation history from DB
      recentMessages = await db
        .select({
          direction: messages.direction,
          content: messages.content,
          sentAt: messages.sentAt,
        })
        .from(messages)
        .where(eq(messages.contactId, contact.id))
        .orderBy(desc(messages.sentAt))
        .limit(10);

      // If DB has 1 or fewer messages and chatId is available, fetch live thread history from Unipile
      if (recentMessages.length <= 1 && chatId && chatId !== "none") {
        try {
          const liveThread = await linkedInMessageService.getMessages(chatId);
          if (liveThread.length > 0) {
            recentMessages = liveThread.slice(-10).map((m) => ({
              direction: m.isSender ? "OUTBOUND" : "INBOUND",
              content: m.message,
              sentAt: m.time ? new Date(m.time) : new Date(),
            }));
          }
        } catch {}
      }

      const historyFormatted = recentMessages
        .reverse()
        .map((m) => `${m.direction === "OUTBOUND" ? "User" : contact.name}: "${m.content}"`)
        .join("\n");

      // 2. Fetch ground-truth user profile and personality
      const userProfileTruth = await linkedInProfileService.getUserProfileGroundTruth(userId);
      const [settings] = await db
        .select()
        .from(dailyAgentSettings)
        .where(eq(dailyAgentSettings.userId, userId))
        .limit(1);

      const personality = settings?.personality || "Talk like an authentic, articulate human peer texting on LinkedIn. Warm, casual, direct, concise, and helpful.";
      const companyKnowledge = settings?.companyKnowledge ? `\nUSER'S COMPANY / PRODUCT KNOWLEDGE:\n${settings.companyKnowledge}\n` : "";
      const faq = settings?.faq ? `\nUSER'S FAQ / PREFERRED ANSWERS:\n${settings.faq}\n` : "";
      const networkingGoal = settings?.networkingGoal || "explore collaboration and coordinate a meeting or quick demo call";

      console.log(`[CONTEXT] loaded with ${recentMessages.length} history message(s)`);

      const model = await getGeminiChatModelForUser(userId, { temperature: 0.2 });

      const prompt = `You are the WorkPilot Real-Time LinkedIn Reply Agent.
You are directly speaking and replying ON BEHALF OF THE USER in a live 1-on-1 direct message.
Write in the FIRST PERSON ("I", "my", "we"). Talk like an authentic human peer, NEVER an AI assistant or bot.

YOUR TOP OBJECTIVES:
1. LISTEN & UNDERSTAND: Look at the full conversation history. Comprehend what the other person is actually saying or responding to.
2. TALK LIKE A REAL HUMAN: Sound like a respected, thoughtful peer sending a quick DM. Warm, casual, direct.
3. STRICTLY COMPACT: 1 to 2 sentences (strictly max 3 if answering a detailed question). Cut all corporate fluff, filler, and buzzwords.

USER'S VERIFIED GROUND TRUTH PROFILE:
${userProfileTruth}

USER'S PREFERRED COMMUNICATION PERSONALITY:
${personality}
${companyKnowledge}${faq}
USER'S NETWORKING GOAL: ${networkingGoal}

CONTACT INFORMATION:
- Name: ${contact.name}
- Headline/Role: ${contact.designation || "Not specified"}
- Company: ${contact.company || "Not specified"}
- Initial Match Context: ${contact.matchReason || "Professional connection"}

CONVERSATION HISTORY (OLDEST TO NEWEST):
${historyFormatted || "(No previous messages recorded)"}

LATEST INCOMING MESSAGE FROM ${contact.name}:
"""
${incomingText}
"""

CRITICAL CONVERSATIONAL INTELLIGENCE & ONGOING THREAD RULES:
- NEVER RE-GREET IN ONGOING CONVERSATIONS:
  - If CONVERSATION HISTORY has messages, you are in the MIDDLE of an ongoing chat!
  - STRICTLY FORBIDDEN: NEVER start your reply with "Hey [Name]", "Hi [Name]", "Hello [Name]", "Hey there", or any name greeting.
  - A real person texting on LinkedIn does NOT say "Hey [Name]" in every response. Jump directly into your sentence!
  - ONLY use a greeting like "Hey [First Name]!" if CONVERSATION HISTORY is completely empty (first message of a new thread).
- USE THE FULL CONVERSATION CONTEXT:
  - Connect your thought directly to the previous messages in the history.
- SHORT AFFIRMATIONS ("Yeah sure", "Sure", "Sounds good", "Sure thing", "Yes", "Yep", "I'd be open to that", "Interested"):
  The prospect is affirmatively saying YES to what the User previously proposed in the conversation history!
  - If the User previously proposed a quick chat/call or demo (e.g. "open to a quick chat about a demo call?"):
    Respond enthusiastically and smoothly coordinate without saying "Hey [Name]":
    e.g. "Awesome! How does Thursday afternoon or Friday morning look for a quick 10-min chat?"
  - If the User previously shared an article or idea, follow up warmly on that topic.
  - NEVER say "Thank you for confirming" or "As an AI" or repeat "Yeah sure" robotically.
- DIRECT QUESTIONS ("What do you guys do?", "What's the pricing?", "How does it work?"):
  Answer the question directly and honestly using the User's profile and company knowledge in 1 crisp sentence without repeating their name.
- CASUAL GREETINGS IN ONGOING THREADS ("Hi Vedic", "Hey", "Hello"):
  Do NOT reset with "Hey [Name]! Great to connect with you." Instead, keep the flow natural: e.g. "Hey! How's your week going?" or reply directly to what they said.
- OBJECTIONS / NOT RIGHT NOW ("Too busy", "Not right now"):
  Be completely respectful and low-pressure: "Totally understand, thanks for letting me know! Reach out anytime down the road."

STRICT HUMAN REPLY RULES:
1. ONGOING CONVERSATION CONTINUITY (DO NOT RE-GREET):
   - In ongoing threads (history exists), NEVER prepend "Hey [Name]" or "Hi [Name]".
   - Speak fluidly as if continuing a real-time conversation.
2. ACTIVE LISTENING & CONTEXT: Address what ${contact.name} actually meant or asked based on the prior conversation history.
3. STRICT BAN ON ROBOTIC AI OPENERS: NEVER start with "I hope this message finds you well", "Thank you for reaching out!", "Thanks for connecting!", "I appreciate your message", "Hope you're having a great week!", or "That's fantastic to hear!".
4. STRICT BAN ON AI BUZZWORDS & TIRED JARGON: Never use words or phrases like "synergy", "game-changer", "transformative", "streamline", "leverage", "delve", "cutting-edge", "seamless", "touch base", "circle back", "reach out", "pick your brain", or "deep dive". Speak in plain, casual human English.
5. WRITE COMPACT & CRISP: Strictly 1 to 2 sentences (maximum 3 short sentences if answering a specific question). No long paragraphs, no bullet points, no corporate sign-offs like "Best regards".
6. NATURAL HUMAN CONNECTORS: Use natural bridges when appropriate, such as "Awesome!", "Good question -", "Makes total sense,", "Got it -", "Totally agree,", "Yeah, we actually...", or just jump straight into the answer.
7. NO AGGRESSIVE PITCHING: Do not push multiple links. If coordinating a call, just suggest 2 flexible times or ask what day works best.
8. STRICT TRUTHFULNESS: Only state facts present in the user's verified profile and knowledge base.

Respond ONLY with valid JSON:
{
  "understoodWhatTheySaid": "1-sentence summary of what they actually said and what they care about",
  "intent": "category_name",
  "confidence": number_between_0_and_1,
  "needsHumanReview": boolean,
  "rationale": "short 1-sentence reasoning",
  "suggestedReply": "Drafted 1-2 sentence natural human reply"
}`;

      const res = await model.invoke([new HumanMessage(prompt)]);
      console.log(`[AGENT] reply generated`);
      const rawText =
        typeof res.content === "string"
          ? res.content
          : Array.isArray(res.content)
            ? res.content.map((c: any) => (typeof c === "string" ? c : c.text || "")).join("")
            : "";

      let parsed: any = null;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
          parsed = JSON.parse(cleanJson);
        }
      } else {
        const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanJson);
      }

      let cleanReply = typeof parsed?.suggestedReply === "string" 
        ? parsed.suggestedReply.trim().replace(/^["']|["']$/g, "") 
        : "";

      // In ongoing conversations, strip accidental "Hey [Name]," or "Hi [Name]," openers so it never sounds like a cold outreach note
      if (recentMessages.length > 0 && cleanReply) {
        const regreetPattern = /^(?:Hey|Hi|Hello|Dear)(?:\s+[A-Za-z]+){0,2}[,!:\s-]+\s*/i;
        if (regreetPattern.test(cleanReply)) {
          const stripped = cleanReply.replace(regreetPattern, "").trim();
          if (stripped.length > 0) {
            cleanReply = stripped.charAt(0).toUpperCase() + stripped.slice(1);
          }
        }
      }

      return {
        intent: parsed?.intent || "general_reply",
        confidence: Number(parsed?.confidence) || 0.8,
        needsHumanReview: Boolean(parsed?.needsHumanReview),
        suggestedReply: cleanReply,
        rationale: parsed?.rationale || "AI analyzed context and formulated reply.",
      };
    } catch (err: any) {
      const hasHistory = recentMessages.length > 0;
      const firstName = contact.name ? (contact.name.split(" ")[0] || "there") : "there";
      return {
        intent: "general_reply",
        confidence: 0.5,
        needsHumanReview: true,
        suggestedReply: hasHistory
          ? "Got your note! Let me check this and get right back to you."
          : `Hi ${firstName}, got your note! Let me check this and get right back to you.`,
        rationale: "LLM analysis fallback: staged for manual verification.",
      };
    }
  }

  /**
   * Helper to persist draft reply on contact record and notify dashboard.
   */
  public async saveDraftReply(
    contactId: string,
    draftReply: string,
    reason: string,
    userId: string,
  ): Promise<void> {
    await db
      .update(contacts)
      .set({
        draftReply,
        draftReplyReason: reason,
        draftReplyAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contactId));

    taskManager.broadcastToUser(userId, "draft_reply_created", {
      contactId,
      draftReply,
      reason,
    });
  }

  private async generateDraftReply(
    userId: string,
    _account: any,
    contact: any,
    _payload: UnipileMessageWebhookPayload,
    reason: string,
  ): Promise<string> {
    const hasPriorMessages = Boolean(contact.lastMessageSentAt || contact.lastMessageReceivedAt);
    const firstName = contact.name ? (contact.name.split(" ")[0] || "there") : "there";
    const fallbackText = hasPriorMessages
      ? "Got your note! Give me a quick moment to look into this and follow up."
      : `Hi ${firstName}, got your message! Give me a quick moment to look into this and follow up.`;
    await this.saveDraftReply(contact.id, fallbackText, reason, userId);
    return fallbackText;
  }

  private async recordOutboundMessage(
    userId: string,
    payloadOrNorm: UnipileMessageWebhookPayload | NormalizedUnipileMessageEvent,
  ): Promise<void> {
    const norm = "isValid" in payloadOrNorm ? payloadOrNorm : normalizeUnipileMessageWebhook(payloadOrNorm);
    const contact = await this.resolveOrCreateContact(userId, norm);
    if (!contact) return;

    await db.insert(messages).values({
      userId,
      contactId: contact.id,
      conversationId: norm.chatId || `chat_${contact.linkedinId}`,
      senderId: norm.connectedUserProviderId || "self",
      senderName: "Me",
      direction: "OUTBOUND",
      content: norm.text,
      sentAt: norm.timestamp ? new Date(norm.timestamp) : new Date(),
    });

    await db
      .update(contacts)
      .set({
        lastMessageSentAt: new Date(),
        lastOutboundMessageId: norm.messageId || null,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contact.id));
  }

  private async resolveOrCreateContact(
    userId: string,
    payloadOrNorm: UnipileMessageWebhookPayload | NormalizedUnipileMessageEvent,
  ): Promise<any> {
    const norm = "isValid" in payloadOrNorm ? payloadOrNorm : normalizeUnipileMessageWebhook(payloadOrNorm);
    const providerId = norm.senderProviderId;
    if (!providerId) {
      console.warn("[CONTACT] Missing senderProviderId, cannot resolve contact.");
      return null;
    }

    const [existing] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.linkedinId, providerId)))
      .limit(1);

    if (existing) return existing;

    // Create provisional lightweight contact record without fabricating unknown details
    const [created] = await db
      .insert(contacts)
      .values({
        userId,
        name: norm.senderName || "LinkedIn Member",
        linkedinId: providerId,
        profileUrl: norm.senderProfileUrl || null,
        status: "CONVERSATION",
      })
      .returning();

    return created;
  }
}

export const unipileMessageAgentService = new UnipileMessageAgentService();
