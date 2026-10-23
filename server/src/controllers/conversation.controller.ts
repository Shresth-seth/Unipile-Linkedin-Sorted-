import { Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { contacts, messages, linkedinAccounts, dailyAgentSettings } from "../db/schema.js";
import { inboundWebhookService } from "../services/webhook/inbound.service.js";
import { linkedInMessageService } from "../services/linkedin/message.service.js";
import { linkedInProfileService } from "../services/linkedin/profile.service.js";
import { outreachBrainService } from "../services/intelligence/outreach-brain.service.js";
import { getGeminiChatModelForUser } from "../agent/WORKPILOT-connect-agent.js";
import { HumanMessage } from "@langchain/core/messages";
import { AuthRequest } from "../middlewares/auth.middleware.js";

export const handleInboundWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body;
    const result = await inboundWebhookService.handleInboundMessage(payload);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getConversationHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const rawContactId = req.params.contactId;
    if (!rawContactId) {
      res.status(400).json({ success: false, message: "contactId is required." });
      return;
    }
    const validContactId = Array.isArray(rawContactId) ? rawContactId[0]! : rawContactId;

    // Strict Tenant Validation: Ensure this contact belongs to the authenticated user
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, validContactId), eq(contacts.userId, userId)))
      .limit(1);

    if (!contact) {
      res.status(404).json({
        success: false,
        message: "Contact not found or access denied.",
      });
      return;
    }

    // Fetch only messages belonging to this user and contact
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(and(eq(messages.contactId, validContactId), eq(messages.userId, userId)))
      .orderBy(desc(messages.sentAt));

    res.status(200).json({
      success: true,
      contact,
      messages: conversationMessages.reverse(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const takeOverConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const rawContactId = req.params.contactId;
    if (!rawContactId) {
      res.status(400).json({ success: false, message: "contactId is required." });
      return;
    }
    const validContactId = Array.isArray(rawContactId) ? rawContactId[0]! : rawContactId;

    // Strict Tenant Scoping: Only allow updating contacts owned by the current user
    const [updated] = await db
      .update(contacts)
      .set({
        conversationMode: "MANUAL",
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, validContactId), eq(contacts.userId, userId)))
      .returning();

    if (!updated) {
      res.status(404).json({
        success: false,
        message: "Contact not found or access denied.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Human takeover active. AI autonomous messaging halted.",
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendManualReply = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const rawContactId = req.params.contactId;
    const text = req.body?.text;

    if (!rawContactId || !text) {
      res.status(400).json({ success: false, message: "contactId and text are required." });
      return;
    }
    const validContactId = Array.isArray(rawContactId) ? rawContactId[0]! : rawContactId;
    const validText: string = String(text);

    // Strict Tenant Scoping: Ensure contact belongs to authenticated user
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, validContactId), eq(contacts.userId, userId)))
      .limit(1);

    if (!contact) {
      res.status(404).json({ success: false, message: "Contact not found or access denied." });
      return;
    }

    // Get active LinkedIn account for this user
    const [userAccount] = await db
      .select()
      .from(linkedinAccounts)
      .where(and(eq(linkedinAccounts.userId, userId), eq(linkedinAccounts.isConnected, true)))
      .limit(1);

    const activeAccountId = userAccount?.unipileAccountId || undefined;

    // 1. Dispatch message via LinkedIn Service using user's own Unipile account
    const dispatchResult = await linkedInMessageService.sendMessage(contact.linkedinId, validText, activeAccountId);
    if (!dispatchResult.success) {
      res.status(400).json({
        success: false,
        message: dispatchResult.message || "Failed to dispatch message to LinkedIn.",
      });
      return;
    }

    // 2. Record outbound message in DB
    const [savedMsg] = await db
      .insert(messages)
      .values({
        userId,
        contactId: validContactId,
        conversationId: `chat_${contact.linkedinId}`,
        senderId: "me",
        senderName: "Me (Human Agent)",
        direction: "OUTBOUND",
        content: validText,
      })
      .returning();

    // 3. Update contact timestamp
    await db
      .update(contacts)
      .set({
        lastMessageSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, validContactId), eq(contacts.userId, userId)));

    res.status(200).json({
      success: true,
      message: "Reply sent successfully.",
      data: savedMsg,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Configure AI Pilot Mode for a conversation thread.
 * POST /api/conversations/:contactId/pilot-mode
 * mode: 'AUTOMATIC' (AI Pilot takes over) | 'MANUAL' (Human takeover) | 'SUGGESTED' (Co-Pilot drafts)
 */
export const setPilotMode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const rawContactId = req.params.contactId;
    const contactId: string = (
      Array.isArray(rawContactId) ? rawContactId[0] || "" : rawContactId || ""
    ).trim();
    const { mode = "AUTOMATIC" } = req.body as {
      mode: "AUTOMATIC" | "MANUAL" | "SUGGESTED";
    };

    if (!contactId) {
      res
        .status(400)
        .json({ success: false, message: "contactId is required." });
      return;
    }

    // Try finding contact by id (if valid UUID) or by linkedinId
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        contactId,
      );
    let contact;
    if (isUuid) {
      const [found] = await db
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.id, contactId), eq(contacts.userId, userId)),
        )
        .limit(1);
      contact = found;
    }
    if (!contact) {
      const [found] = await db
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.linkedinId, contactId), eq(contacts.userId, userId)),
        )
        .limit(1);
      contact = found;
    }

    if (contact) {
      const [updated] = await db
        .update(contacts)
        .set({
          conversationMode: mode,
          // Reset loop counter when user enables Auto-Pilot so pilot has full capacity
          automatedReplyCount: mode === "AUTOMATIC" ? 0 : contact.automatedReplyCount,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contact.id))
        .returning();

      res.status(200).json({
        success: true,
        message:
          mode === "AUTOMATIC"
            ? "🚀 AI Pilot is now actively piloting this conversation on your behalf."
            : mode === "MANUAL"
            ? "✋ Human takeover active. AI Pilot paused for this conversation."
            : "🤝 Co-Pilot mode active. AI will prepare draft suggestions for review.",
        data: updated,
      });
      return;
    }

    // Acknowledge for live LinkedIn chat if no DB contact record yet
    res.status(200).json({
      success: true,
      message:
        mode === "AUTOMATIC"
          ? "🚀 AI Pilot is now actively piloting this live chat on your behalf."
          : "✋ Human takeover active for this live chat.",
      data: { conversationMode: mode },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Generate a high-context AI Pilot reply on behalf of the user using Gemini AI.
 * Includes step-by-step thinking traces and Outreach Brain collision checks.
 * POST /api/conversations/generate-reply
 */
export const generateAiReply = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const {
      contactName,
      contactRole,
      contactCompany,
      history,
      lastMessage,
      instruction,
    } = req.body as {
      contactName?: string;
      contactRole?: string;
      contactCompany?: string;
      history?: Array<{ sender: string; text: string }>;
      lastMessage?: string;
      instruction?: string;
    };

    // 1. Fetch user ground truth profile and settings
    const userProfileTruth = await linkedInProfileService.getUserProfileGroundTruth(userId);
    const [settings] = await db
      .select()
      .from(dailyAgentSettings)
      .where(eq(dailyAgentSettings.userId, userId))
      .limit(1);

    const personality = settings?.personality || "Talk like an authentic human peer texting on LinkedIn. Actively listen and directly address what the other person actually said in 1-2 punchy, compact sentences. Zero AI fluff, no buzzwords, no corporate boilerplate.";
    const companyKnowledge = settings?.companyKnowledge ? `\nUSER'S COMPANY / PRODUCT KNOWLEDGE:\n${settings.companyKnowledge}\n` : "";
    const faq = settings?.faq ? `\nUSER'S FAQ / OBJECTION HANDLING:\n${settings.faq}\n` : "";
    const goal = settings?.networkingGoal || "explore collaboration and coordinate a meeting or quick demo call";

    // 2. Format conversation history
    let historyText = "";
    if (Array.isArray(history) && history.length > 0) {
      historyText = history
        .slice(-10)
        .map((m) => `${m.sender}: "${m.text}"`)
        .join("\n");
    }

    const targetName = contactName || "the connection";
    const company = contactCompany || (contactRole && contactRole.includes("·") ? contactRole.split("·")[1]?.trim() : "") || "";

    // 3. Run Outreach Brain Collision & Domain Deduplication Check
    const domainReport = await outreachBrainService.checkCollisionAndDeduplicate({
      userId,
      targetName,
      targetCompany: company,
      proposedMessage: lastMessage || "",
    });

    const prompt = `You are the WorkPilot AI Auto-Pilot on LinkedIn.
You are directly speaking and replying ON BEHALF OF THE USER in an active conversation.
Write in the FIRST PERSON ("I", "my", "we"). Talk like an authentic human professional, NEVER an AI bot.

YOUR TOP OBJECTIVES:
1. LISTEN & UNDERSTAND: Deeply comprehend what the other person is actually saying. Notice their specific questions, updates, concerns, or tone. Directly answer their specific questions or acknowledge their points.
2. TALK LIKE A REAL HUMAN: Write naturally, warmly, and conversationally like a respected peer sending a quick DM.
3. COMPACT & PUNCHY: Keep replies short and concise (strictly 1 to 2 sentences, max 3 if answering a specific question). Zero corporate filler, zero fluff.

USER'S VERIFIED PROFILE:
${userProfileTruth}

USER'S PREFERRED COMMUNICATION PERSONALITY & TONE:
${personality}
${companyKnowledge}${faq}
USER'S MAIN GOAL: ${goal}

CONTACT: ${targetName}${contactRole ? ` (${contactRole})` : ""}
OUTREACH BRAIN STATUS:
- Normalized Domain: ${domainReport.normalizedDomain}
- Collision Detected: ${domainReport.hasCollision ? `YES (${domainReport.collisionType}) - ${domainReport.details}` : "NO (Safe)"}
${domainReport.differentiatedAngleSuggestion ? `- Differentiation Directive: ${domainReport.differentiatedAngleSuggestion}` : ""}

RECENT CONVERSATION HISTORY (OLDEST TO NEWEST):
${historyText || "(No previous messages recorded)"}

LATEST INCOMING MESSAGE:
"""
${lastMessage || (history && history.length > 0 ? history[history.length - 1]?.text : "Hi!")}
"""
${instruction ? `\nUSER INSTRUCTION FOR THIS REPLY: ${instruction}\n` : ""}

CRITICAL CONVERSATIONAL INTELLIGENCE & ONGOING THREAD RULES:
- NEVER RE-GREET IN ONGOING CONVERSATIONS:
  - If RECENT CONVERSATION HISTORY has messages, you are in the MIDDLE of an ongoing chat!
  - STRICTLY FORBIDDEN: NEVER start your reply with "Hey [Name]", "Hi [Name]", "Hello [Name]", "Hey there", or any name greeting.
  - A real person texting on LinkedIn does NOT say "Hey [Name]" in every response. Jump directly into your sentence!
  - ONLY use a greeting like "Hey [First Name]!" if RECENT CONVERSATION HISTORY is completely empty (first message of a new thread).
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
2. ACTIVE LISTENING: Directly address the exact points or questions raised by ${targetName} using prior context in the chat. Do not give a canned or evasive answer.
3. STRICT BAN ON ROBOTIC OPENERS: Never say "Hope this message finds you well", "Thank you for reaching out!", "Thanks for connecting!", "I appreciate your message", or "That's fantastic to hear!".
4. STRICT BAN ON AI BUZZWORDS & TIRED JARGON: Never use words or phrases like "synergy", "game-changer", "transformative", "streamline", "leverage", "delve", "cutting-edge", "seamless", "touch base", "circle back", "reach out", "pick your brain", or "deep dive". Speak in plain, casual human English.
5. WRITE COMPACT & CRISP: Strictly 1 to 2 sentences (max 3 short sentences if answering a specific question). No long text blocks or corporate sign-offs like "Best regards".
6. NATURAL HUMAN CONNECTORS: Use natural bridges like "Awesome!", "Good question -", "Got it,", "Makes total sense -", "Totally agree,", "Yeah, we actually...", or dive straight into the answer.
7. NO AGGRESSIVE PITCHING: Do not push multiple links. If coordinating a call, just suggest 2 flexible times or ask what day works best.
8. Provide a 4-step thinking trace showing how you listened to their message and formulated a human reply.
9. Output valid JSON:
{
  "understoodWhatTheySaid": "1-sentence summary of what they actually said and what they care about",
  "thinkingSteps": [
    "Step 1: Listened to ${targetName}'s message and extracted specific question/point",
    "Step 2: Checked Outreach Brain and verified knowledge base for domain ${domainReport.normalizedDomain}",
    "Step 3: Grounded response directly in what was said, eliminating all AI clichés",
    "Step 4: Formulated compact 1-2 sentence human response"
  ],
  "suggestedReply": "The exact compact human response to send",
  "intent": "e.g. answering_question / positive_interest / meeting_coordination",
  "rationale": "1-sentence why this is the best human reply",
  "confidenceScore": 0.95
}
`;

    const model = await getGeminiChatModelForUser(userId, { temperature: 0.3 });
    const response = await model.invoke([new HumanMessage(prompt)]);
    const rawContent = response.content.toString().trim();

    let replyData: {
      understoodWhatTheySaid?: string;
      thinkingSteps?: string[];
      suggestedReply: string;
      intent?: string;
      rationale?: string;
      confidenceScore?: number;
    };

    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        replyData = JSON.parse(jsonMatch[0]);
      } else {
        replyData = { suggestedReply: rawContent.replace(/```json|```/g, "").trim() };
      }
    } catch {
      replyData = { suggestedReply: rawContent.replace(/```json|```/g, "").trim() };
    }

    let cleanReply = (replyData.suggestedReply || "").trim().replace(/^["']|["']$/g, "");

    // In ongoing conversations, strip accidental "Hey [Name]," or "Hi [Name]," openers
    const hasPriorHistory = Boolean(
      (Array.isArray(history) && history.length > 0) ||
      (historyText && historyText !== "(No previous messages recorded)")
    );

    if (hasPriorHistory && cleanReply) {
      const regreetPattern = /^(?:Hey|Hi|Hello|Dear)(?:\s+[A-Za-z]+){0,2}[,!:\s-]+\s*/i;
      if (regreetPattern.test(cleanReply)) {
        const stripped = cleanReply.replace(regreetPattern, "").trim();
        if (stripped.length > 0) {
          cleanReply = stripped.charAt(0).toUpperCase() + stripped.slice(1);
        }
      }
    }
    replyData.suggestedReply = cleanReply;

    const defaultThinkingSteps = [
      `Step 1: Listened to ${targetName}'s latest message and extracted core context`,
      `Step 2: Outreach Brain checked domain ${domainReport.normalizedDomain} (${domainReport.hasCollision ? "Collision handled" : "Clean status"})`,
      `Step 3: Grounded response directly in what was said, eliminating robotic AI clichés`,
      `Step 4: Formulated authentic, compact 1-2 sentence human response`,
    ];

    res.status(200).json({
      success: true,
      suggestedReply: replyData.suggestedReply,
      intent: replyData.intent || "pilot_reply",
      rationale: replyData.rationale || "Generated by AI Pilot based on conversation history and knowledge base.",
      thinkingSteps: Array.isArray(replyData.thinkingSteps) && replyData.thinkingSteps.length > 0
        ? replyData.thinkingSteps
        : defaultThinkingSteps,
      confidenceScore: replyData.confidenceScore || 0.94,
      domainIntelligence: domainReport,
    });
  } catch (error: any) {
    console.error("generateAiReply error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate AI pilot reply.",
    });
  }
};

/**
 * Interactive Copilot chat endpoint.
 * Lets users chat with the AI Copilot to refine responses, ask strategy questions, or handle objections.
 * POST /api/conversations/copilot-chat
 */
export const chatWithCopilot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const {
      message,
      contactName,
      contactRole,
      contactCompany,
      history,
      currentDraft,
    } = req.body as {
      message: string;
      contactName?: string;
      contactRole?: string;
      contactCompany?: string;
      history?: Array<{ sender: string; text: string }>;
      currentDraft?: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ success: false, message: "Message prompt is required." });
      return;
    }

    const userProfileTruth = await linkedInProfileService.getUserProfileGroundTruth(userId);
    const [settings] = await db
      .select()
      .from(dailyAgentSettings)
      .where(eq(dailyAgentSettings.userId, userId))
      .limit(1);

    const personality = settings?.personality || "Talk like an authentic human peer texting on LinkedIn. Actively listen and directly address what the other person actually said in 1-2 punchy, compact sentences. Zero AI fluff, no buzzwords, no corporate boilerplate.";
    const companyKnowledge = settings?.companyKnowledge ? `\nUSER'S COMPANY / PRODUCT KNOWLEDGE:\n${settings.companyKnowledge}\n` : "";
    const faq = settings?.faq ? `\nUSER'S FAQ / OBJECTION HANDLING:\n${settings.faq}\n` : "";

    let historyText = "";
    if (Array.isArray(history) && history.length > 0) {
      historyText = history
        .slice(-8)
        .map((m) => `${m.sender}: "${m.text}"`)
        .join("\n");
    }

    const targetName = contactName || "the prospect";
    const company = contactCompany || (contactRole && contactRole.includes("·") ? contactRole.split("·")[1]?.trim() : "") || "";

    // Domain collision report
    const domainReport = await outreachBrainService.checkCollisionAndDeduplicate({
      userId,
      targetName,
      targetCompany: company,
    });

    const prompt = `You are the WorkPilot Thinking AI Copilot.
You assist the user in managing LinkedIn conversations, drafting responses, objection handling, and outreach strategies.
You think step-by-step and show your reasoning clearly before answering.

USER'S VERIFIED PROFILE:
${userProfileTruth}

TONE & BEHAVIOR:
${personality}
${companyKnowledge}${faq}

CONVERSATION SUBJECT:
- Contact: ${targetName}${contactRole ? ` (${contactRole})` : ""}
- Company Domain: ${domainReport.normalizedDomain}
- Domain Status: ${domainReport.hasCollision ? `Collision: ${domainReport.details}` : "Safe, no collisions"}

RECENT CONVERSATION:
${historyText || "(None)"}

CURRENT DRAFTED MESSAGE (IF ANY):
"${currentDraft || ""}"

USER REQUEST TO COPILOT:
"${message}"

INSTRUCTIONS:
1. When proposing or editing message copy: ALWAYS actively listen and respond to what the contact actually said or asked. Speak naturally like a real human colleague (strictly ban AI clichés like "synergy", "delve", "game-changer", "streamline", and generic greetings like "Hope all is well"). Keep suggested replies compact and punchy (1-2 sentences).
2. Provide a step-by-step thinking trace (3-5 items) describing how you listened to the prospect, eliminated robotic fluff, and optimized the reply.
3. Provide your direct answer / suggested message.
4. Provide 2-3 quick follow-up action buttons (e.g. "Make it more compact", "Make it more casual", "Address objection").
5. Output valid JSON:
{
  "thinkingSteps": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "reply": "Your clear answer or drafted message here",
  "suggestedActions": ["Action 1", "Action 2"],
  "rationale": "Short explanation"
}
`;

    const model = await getGeminiChatModelForUser(userId, { temperature: 0.3 });
    const response = await model.invoke([new HumanMessage(prompt)]);
    const rawContent = response.content.toString().trim();

    let parsed: any;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = { reply: rawContent.replace(/```json|```/g, "").trim() };
      }
    } catch {
      parsed = { reply: rawContent.replace(/```json|```/g, "").trim() };
    }

    res.status(200).json({
      success: true,
      thinkingSteps: parsed.thinkingSteps || [
        `Analyzing context for ${targetName}...`,
        `Checking domain deduplication on ${domainReport.normalizedDomain}...`,
        `Formulating strategic recommendation...`,
      ],
      reply: parsed.reply || "I reviewed the conversation and prepared a recommendation.",
      suggestedActions: parsed.suggestedActions || ["Shorten message", "Make more formal", "Propose 15m call"],
      rationale: parsed.rationale || "Optimized based on prospect profile and goals.",
      domainIntelligence: domainReport,
    });
  } catch (error: any) {
    console.error("chatWithCopilot error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Copilot reasoning error.",
    });
  }
};

/**
 * Check collision & domain status for outreach.
 * POST /api/conversations/outreach-brain/check
 */
export const checkOutreachCollision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const {
      targetName,
      targetCompany,
      targetEmail,
      targetWebsite,
      linkedinId,
      proposedMessage,
    } = req.body;

    if (!targetName) {
      res.status(400).json({ success: false, message: "targetName is required." });
      return;
    }

    const report = await outreachBrainService.checkCollisionAndDeduplicate({
      userId,
      targetName,
      targetCompany,
      targetEmail,
      targetWebsite,
      linkedinId,
      proposedMessage,
    });

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Synthesize a differentiated angle when a domain collision is flagged.
 * POST /api/conversations/outreach-brain/differentiate
 */
export const differentiateOutreach = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const {
      recipientName,
      recipientRole,
      company,
      domain,
      colleagueName,
      originalPitch,
    } = req.body;

    const result = await outreachBrainService.synthesizeDifferentiatedOutreach({
      recipientName: recipientName || "Prospect",
      recipientRole,
      company: company || "their company",
      domain: domain || "target-company.com",
      colleagueName,
      originalPitch,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get current Chatbot personalisation and ON/OFF status
 * GET /api/conversations/chatbot/status
 */
export const getChatbotStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const [settings] = await db
      .select()
      .from(dailyAgentSettings)
      .where(eq(dailyAgentSettings.userId, userId))
      .limit(1);

    const isEnabled = settings ? (settings.autoMessageReplies && settings.replyMode !== "OFF") : true;

    res.status(200).json({
      success: true,
      data: {
        isEnabled,
        replyMode: settings?.replyMode || "AUTO",
        autoMessageReplies: settings ? settings.autoMessageReplies : true,
        personality: settings?.personality || "Talk like an authentic human peer texting on LinkedIn. Actively listen and directly address what the other person actually said in 1-2 punchy, compact sentences. Zero AI fluff, no buzzwords, no corporate boilerplate.",
        companyKnowledge: settings?.companyKnowledge || "",
        faq: settings?.faq || "",
        networkingGoal: settings?.networkingGoal || "explore collaboration and coordinate a meeting or quick demo call",
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Toggle Chatbot master switch ON / OFF and update personalisation
 * POST /api/conversations/chatbot/toggle
 */
export const toggleChatbot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const {
      enabled,
      replyMode,
      personality,
      companyKnowledge,
      faq,
      networkingGoal,
    } = req.body as {
      enabled?: boolean;
      replyMode?: "AUTO" | "DRAFT" | "OFF";
      personality?: string;
      companyKnowledge?: string;
      faq?: string;
      networkingGoal?: string;
    };

    const targetEnabled = enabled !== undefined ? Boolean(enabled) : true;
    const targetReplyMode = replyMode || (targetEnabled ? "AUTO" : "OFF");

    const [existing] = await db
      .select()
      .from(dailyAgentSettings)
      .where(eq(dailyAgentSettings.userId, userId))
      .limit(1);

    let updated;
    if (existing) {
      [updated] = await db
        .update(dailyAgentSettings)
        .set({
          autoMessageReplies: targetEnabled,
          replyMode: targetReplyMode,
          ...(personality !== undefined ? { personality: personality.trim() } : {}),
          ...(companyKnowledge !== undefined ? { companyKnowledge: companyKnowledge.trim() } : {}),
          ...(faq !== undefined ? { faq: faq.trim() } : {}),
          ...(networkingGoal !== undefined ? { networkingGoal: networkingGoal.trim() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(dailyAgentSettings.userId, userId))
        .returning();
    } else {
      [updated] = await db
        .insert(dailyAgentSettings)
        .values({
          userId,
          autoMessageReplies: targetEnabled,
          replyMode: targetReplyMode,
          personality: personality?.trim() || "Talk like an authentic human peer texting on LinkedIn. Actively listen and directly address what the other person actually said in 1-2 punchy, compact sentences. Zero AI fluff, no buzzwords, no corporate boilerplate.",
          companyKnowledge: companyKnowledge?.trim() || "",
          faq: faq?.trim() || "",
          networkingGoal: networkingGoal?.trim() || "explore collaboration and coordinate a meeting or quick demo call",
        })
        .returning();
    }

    res.status(200).json({
      success: true,
      message: targetEnabled
        ? "🚀 Chatbot turned ON. Auto-pilot & Copilot will actively personalize responses."
        : "✋ Chatbot turned OFF. Human takeover active — automated suggestions paused.",
      data: {
        isEnabled: targetEnabled,
        replyMode: targetReplyMode,
        settings: updated,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};



