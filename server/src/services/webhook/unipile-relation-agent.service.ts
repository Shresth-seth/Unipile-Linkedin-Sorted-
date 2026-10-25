import { db } from "../../db/index.js";
import { contacts, linkedinAccounts, dailyAgentSettings } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { followUpSequencerService } from "../sequence/followup.service.js";
import { taskManager } from "../../agent/WORKPILOT-task-manager.js";
import { webhookDedupService } from "./webhook-dedup.service.js";
import { getGeminiChatModelForUser } from "../../agent/WORKPILOT-connect-agent.js";
import { HumanMessage } from "@langchain/core/messages";

export interface UnipileRelationWebhookPayload {
  event?: string; // 'new_relation'
  account_id?: string;
  account_type?: string;
  webhook_name?: string;
  user_full_name?: string;
  user_provider_id?: string;
  user_public_identifier?: string;
  user_profile_url?: string;
  user_picture_url?: string;
}

export class UnipileRelationAgentService {
  /**
   * Uses Gemini to craft a personalized opening message for a new connection.
   */
  private async generateWelcomeMessage(
    contactName: string,
    contactDesignation: string | null | undefined,
    contactCompany: string | null | undefined,
    settings: {
      personality?: string | null | undefined;
      companyKnowledge?: string | null | undefined;
      faq?: string | null | undefined;
      newConnectionMessageTemplate?: string | null | undefined;
    },
    userId?: string,
  ): Promise<string> {
    const firstName =
      contactName && contactName.trim()
        ? contactName.trim().split(" ")[0] || "there"
        : "there";

    // If user provided a custom template, do variable substitution only
    if (settings.newConnectionMessageTemplate?.trim()) {
      return settings.newConnectionMessageTemplate
        .replace(/\{\{firstName\}\}/gi, firstName)
        .replace(/\{\{name\}\}/gi, contactName)
        .replace(/\{\{company\}\}/gi, contactCompany || "your company")
        .replace(/\{\{role\}\}/gi, contactDesignation || "your role");
    }

    // Otherwise use Gemini to write a personalized message
    const personality = settings.personality || "Professional, warm, and concise.";
    const companyKnowledge = settings.companyKnowledge ? `\nYour company context:\n${settings.companyKnowledge}` : "";

    const prompt = `You are directly speaking on behalf of the user to a new LinkedIn connection.
A person just accepted your connection request. Write a short, natural, warm human opening message.

YOUR COMMUNICATION STYLE:
${personality}
${companyKnowledge}

NEW CONNECTION DETAILS:
Name: ${contactName}
Role: ${contactDesignation || "Professional"}
Company: ${contactCompany || "their company"}

RULES:
- Write ONLY the message text, no quotes, no labels
- STRICTLY COMPACT: 1 to 2 short sentences max
- Sound like a real person, NOT an automated sequence or bot
- NEVER use robotic clichés like "thrilled to connect", "looking forward to synergy", or "touch base"
- Be authentic, warm, and humble
- Start with "Hi ${firstName},"
- Do NOT pitch or sell anything`;

    try {
      const model = await getGeminiChatModelForUser(userId, { temperature: 0.7 });
      const result = await model.invoke([new HumanMessage(prompt)]);
      const text = typeof result.content === "string" ? result.content.trim() : `Hi ${firstName}, glad to connect! Really looking forward to following your work.`;
      return text;
    } catch (err) {
      console.warn("[relation-agent] Gemini failed to generate welcome message, using fallback:", err);
      return `Hi ${firstName}, glad to connect! Looking forward to following your work and staying in touch.`;
    }
  }

  /**
   * Processes the Unipile new_relation event when an outbound LinkedIn invitation is accepted.
   */
  public async handleRelationWebhook(payload: UnipileRelationWebhookPayload): Promise<void> {
    const accountId = payload.account_id;
    const providerId = payload.user_provider_id;
    const eventKey = `rel_${accountId}_${providerId}`;

    if (!accountId || !providerId) {
      console.warn("[relation-agent] Missing account_id or user_provider_id in new_relation payload.");
      return;
    }

    // 1. Resolve WorkPilot User Account
    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.unipileAccountId, accountId))
      .limit(1);

    if (!account) {
      console.warn(`[relation-agent] No local user account found for Unipile account: ${accountId}`);
      return;
    }

    const userId = account.userId;

    // 2. Find Contact in database
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.linkedinId, providerId)))
      .limit(1);

    if (!contact) {
      // If contact record was not previously saved, create a new CONNECTED contact record
      console.log(`[relation-agent] Creating new connected contact for ${payload.user_full_name || providerId}`);
      await db.insert(contacts).values({
        userId,
        name: payload.user_full_name || "LinkedIn Member",
        linkedinId: providerId,
        profileUrl: payload.user_profile_url || null,
        status: "CONNECTED",
        connectedAt: new Date(),
      });
      await webhookDedupService.markProcessed(eventKey, "PROCESSED");
      return;
    }

    // 3. Deduplication: Check if already marked CONNECTED
    if (contact.status === "CONNECTED" && contact.connectedAt) {
      console.log(`[relation-agent] Contact ${contact.name} is already marked CONNECTED. Ignoring duplicate relation event.`);
      await webhookDedupService.markProcessed(eventKey, "PROCESSED");
      return;
    }

    // 4. Update contact status to CONNECTED
    const [updatedContact] = await db
      .update(contacts)
      .set({
        status: "CONNECTED",
        connectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, contact.id), eq(contacts.userId, userId)))
      .returning();

    console.log(`🤝 [relation-agent] Contact ${contact.name} accepted LinkedIn invitation! Marked as CONNECTED.`);

    // 5. Load user settings to check automation preferences
    const [settings] = await db
      .select()
      .from(dailyAgentSettings)
      .where(eq(dailyAgentSettings.userId, userId))
      .limit(1);

    // 6. AUTO NEW CONNECTION MESSAGE (AI-personalized welcome)
    const shouldSendWelcome = settings?.autoNewConnectionMessage !== false && !contact.optedOut;

    if (shouldSendWelcome) {
      try {
        const welcomeMessage = await this.generateWelcomeMessage(
          contact.name,
          contact.designation,
          contact.company,
          {
            personality: settings?.personality,
            companyKnowledge: settings?.companyKnowledge,
            faq: settings?.faq,
            newConnectionMessageTemplate: settings?.newConnectionMessageTemplate,
          },
          userId,
        );

        // Schedule the welcome message with a realistic human delay (8-15 minutes)
        const delayMinutes = Math.floor(Math.random() * 7) + 8; // 8 to 15 minutes
        await followUpSequencerService.scheduleFollowUpSequence(userId, updatedContact || contact, {
          followUp1: {
            text: welcomeMessage,
            delayMinutes,
          },
        });

        console.log(`✉️ [relation-agent] Scheduled AI-personalized welcome message for ${contact.name} in ${delayMinutes} minutes.`);
        console.log(`   Message preview: "${welcomeMessage.substring(0, 80)}..."`);
      } catch (fuErr: any) {
        console.warn(`[relation-agent] Failed to schedule welcome message for ${contact.name}:`, fuErr?.message || fuErr);
      }
    } else if (settings?.autoFollowUps && !contact.optedOut) {
      // Fallback: legacy generic follow-up if welcome is off but autoFollowUps is on
      try {
        const firstName = contact.name ? contact.name.split(" ")[0] : "there";
        const followUpText = `Hi ${firstName}, thanks for connecting! Looking forward to following your work and staying in touch.`;
        await followUpSequencerService.scheduleFollowUpSequence(userId, updatedContact || contact, {
          followUp1: { text: followUpText, delayMinutes: 30 },
        });
      } catch (fuErr: any) {
        console.warn(`[relation-agent] Failed to schedule follow-up for ${contact.name}:`, fuErr?.message || fuErr);
      }
    }

    // 7. Broadcast SSE event to active frontend
    taskManager.broadcastToUser(userId, "connection_accepted", {
      contactId: contact.id,
      contactName: contact.name,
      connectedAt: new Date().toISOString(),
    });

    await webhookDedupService.markProcessed(eventKey, "PROCESSED");
  }
}

export const unipileRelationAgentService = new UnipileRelationAgentService();
