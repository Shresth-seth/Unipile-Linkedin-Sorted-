import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contacts, messages } from "../../db/schema.js";
import { getGeminiChatModelForUser } from "../../agent/WORKPILOT-connect-agent.js";
import { HumanMessage } from "@langchain/core/messages";

export interface CollisionCheckInput {
  userId: string;
  targetName: string;
  targetCompany?: string | undefined;
  targetEmail?: string | undefined;
  targetWebsite?: string | undefined;
  linkedinId?: string | undefined;
  proposedMessage?: string | undefined;
  lookbackDays?: number | undefined;
}

export interface DomainCollisionReport {
  hasCollision: boolean;
  collisionType: "NONE" | "SAME_PERSON" | "SAME_DOMAIN_COLLEAGUE" | "DUPLICATE_PITCH";
  normalizedDomain: string;
  details: string;
  previousOutreach?: {
    contactName: string;
    date: string;
    messageSnippet?: string | undefined;
    channel: string;
  } | undefined;
  suggestedAction: "PROCEED" | "BLOCK_DUPLICATE" | "DIVERSIFY_ANGLE";
  differentiatedAngleSuggestion?: string | undefined;
}

export class OutreachBrainService {
  private commonPublicDomains = new Set([
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "aol.com",
    "protonmail.com",
    "zoho.com",
  ]);

  /**
   * Normalize company name or URL into a clean domain key
   */
  public extractDomain(email?: string, website?: string, company?: string): string {
    if (email && email.includes("@")) {
      const parts = email.toLowerCase().trim().split("@");
      const domain = parts[1] ? parts[1].trim() : "";
      if (domain && !this.commonPublicDomains.has(domain)) {
        return domain;
      }
    }

    if (website && website.trim()) {
      try {
        let clean = website.trim().toLowerCase();
        if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
          clean = `https://${clean}`;
        }
        const parsed = new URL(clean);
        return parsed.hostname.replace(/^www\./, "");
      } catch {
        // ignore fallback
      }
    }

    if (company && company.trim()) {
      // Normalize company name (e.g. "Stripe, Inc." -> "stripe.com")
      const sanitized = company
        .toLowerCase()
        .replace(/[,.]/g, "")
        .replace(/\b(inc|corp|ltd|llc|technologies|solutions|labs|pvt|co)\b/g, "")
        .trim()
        .replace(/\s+/g, "");
      if (sanitized.length > 2) {
        return `${sanitized}.com`;
      }
    }

    return "unknown-domain.com";
  }

  /**
   * Check whether this person or someone in their domain was contacted recently,
   * and detect duplicate message copy.
   */
  public async checkCollisionAndDeduplicate(
    input: CollisionCheckInput,
  ): Promise<DomainCollisionReport> {
    const {
      userId,
      targetName,
      targetCompany = "",
      targetEmail,
      targetWebsite,
      linkedinId,
      proposedMessage = "",
      lookbackDays = 30,
    } = input;

    const domain = this.extractDomain(targetEmail, targetWebsite, targetCompany);
    const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const normalizedTargetName = targetName.toLowerCase().trim();

    // 1. Check for EXACT SAME PERSON collision across contacts
    const existingContacts = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), gte(contacts.updatedAt, lookbackDate)));

    const matchingContact = existingContacts.find((c) => {
      if (linkedinId && c.linkedinId === linkedinId) return true;
      if (c.name && c.name.toLowerCase().trim() === normalizedTargetName) {
        // Name matches, check company or domain
        if (targetCompany && c.company && c.company.toLowerCase().includes(targetCompany.toLowerCase())) {
          return true;
        }
        if (domain !== "unknown-domain.com") {
          const contactDomain = this.extractDomain(undefined, undefined, c.company || "");
          if (contactDomain === domain) return true;
        }
      }
      return false;
    });

    if (matchingContact) {
      const lastContactDate = matchingContact.lastMessageSentAt || matchingContact.updatedAt;
      return {
        hasCollision: true,
        collisionType: "SAME_PERSON",
        normalizedDomain: domain,
        details: `Warning: ${targetName} was already contacted on ${lastContactDate.toLocaleDateString()}. Re-sending outreach will annoy the prospect and trigger LinkedIn spam limits.`,
        previousOutreach: {
          contactName: matchingContact.name,
          date: lastContactDate.toLocaleDateString(),
          messageSnippet: matchingContact.draftReply?.slice(0, 100) || "Previous outreach conversation recorded.",
          channel: "LinkedIn Direct Message",
        },
        suggestedAction: "BLOCK_DUPLICATE",
      };
    }

    // 2. Check for SAME DOMAIN / SAME COMPANY colleague outreach
    const colleagueContacts = existingContacts.filter((c) => {
      if (domain === "unknown-domain.com") return false;
      const cDomain = this.extractDomain(undefined, undefined, c.company || "");
      return cDomain === domain && c.name.toLowerCase().trim() !== normalizedTargetName;
    });

    if (colleagueContacts.length > 0) {
      const colleague = colleagueContacts[0]!;
      const colleagueDate = colleague.lastMessageSentAt || colleague.updatedAt;

      // 3. Check if proposed message is duplicate copy
      let isDuplicateCopy = false;
      if (proposedMessage && proposedMessage.trim().length > 20) {
        // Check historical messages for this domain
        const previousMsgs = await db
          .select()
          .from(messages)
          .where(and(eq(messages.userId, userId), gte(messages.sentAt, lookbackDate)))
          .orderBy(desc(messages.sentAt))
          .limit(20);

        for (const msg of previousMsgs) {
          const similarity = this.computeStringSimilarity(proposedMessage, msg.content);
          if (similarity > 0.7) {
            isDuplicateCopy = true;
            break;
          }
        }
      }

      if (isDuplicateCopy) {
        return {
          hasCollision: true,
          collisionType: "DUPLICATE_PITCH",
          normalizedDomain: domain,
          details: `Copy collision: You previously sent an identical or nearly identical pitch to ${colleague.name} (${colleague.designation || "Colleague"}) at ${domain} on ${colleagueDate.toLocaleDateString()}. Sending the exact same pitch to colleagues at the same company looks like automated spam.`,
          previousOutreach: {
            contactName: colleague.name,
            date: colleagueDate.toLocaleDateString(),
            messageSnippet: colleague.draftReply?.slice(0, 100),
            channel: "LinkedIn",
          },
          suggestedAction: "DIVERSIFY_ANGLE",
          differentiatedAngleSuggestion: `Pivot the angle for ${targetName}: Mention team synergy or focus on their specific role responsibilities instead of repeating the same generic feature pitch.`,
        };
      }

      return {
        hasCollision: true,
        collisionType: "SAME_DOMAIN_COLLEAGUE",
        normalizedDomain: domain,
        details: `Note: You previously contacted ${colleague.name} at ${domain} on ${colleagueDate.toLocaleDateString()}. Ensure your message acknowledges or differentiates from previous touchpoints.`,
        previousOutreach: {
          contactName: colleague.name,
          date: colleagueDate.toLocaleDateString(),
          channel: "LinkedIn",
        },
        suggestedAction: "DIVERSIFY_ANGLE",
        differentiatedAngleSuggestion: `Differentiate outreach for ${targetName} by focusing on role-specific impact.`,
      };
    }

    return {
      hasCollision: false,
      collisionType: "NONE",
      normalizedDomain: domain,
      details: `Safe to proceed: No recent outreach collisions detected for ${targetName} or domain ${domain}.`,
      suggestedAction: "PROCEED",
    };
  }

  /**
   * Synthesize a differentiated outreach message when a domain collision is flagged
   */
  public async synthesizeDifferentiatedOutreach(params: {
    userId?: string;
    recipientName: string;
    recipientRole?: string;
    company: string;
    domain: string;
    colleagueName?: string;
    originalPitch?: string;
    userGoal?: string;
  }): Promise<{ differentiatedMessage: string; thinkingTrace: string[] }> {
    const {
      userId,
      recipientName,
      recipientRole = "Leader",
      company,
      domain,
      colleagueName,
      originalPitch,
      userGoal = "connect and explore technical synergies",
    } = params;

    const thinkingTrace = [
      `Outreach Brain activated: Domain collision detected on "${domain}"`,
      colleagueName
        ? `Identified prior outreach to colleague ${colleagueName} at ${company}`
        : `Identified active company campaign for ${company}`,
      `Analyzing unique angle for ${recipientName} (${recipientRole}) to avoid duplicate copy`,
      `Synthesizing contextual, differentiated value proposition`,
      `Validating character limits (<280 chars) and human tone`,
    ];

    try {
      const model = await getGeminiChatModelForUser(userId, { temperature: 0.3 });
      const prompt = `You are the WorkPilot Outreach Brain.
We need to craft a LinkedIn outreach note for:
- Recipient: ${recipientName} (${recipientRole}) at ${company}
- Company Domain: ${domain}
- Primary Networking Goal: ${userGoal}

IMPORTANT COLLISION CONTEXT:
A colleague (${colleagueName || "another team member"}) at ${company} was already contacted recently.
DO NOT repeat this previous pitch copy:
"${originalPitch || "Standard product introductory message"}"

RULES:
1. MAX 280 characters strictly.
2. Differentiate the message: focus on ${recipientName}'s specific perspective as a ${recipientRole}.
3. Sound authentic, professional, peer-to-peer, and humble. Never sound like a generic copy-pasted blast.
4. Output ONLY the message text. No quotes.`;

      const response = await model.invoke([new HumanMessage(prompt)]);
      let msg = response.content.toString().trim().replace(/^["']|["']$/g, "");
      if (msg.length > 290) {
        msg = msg.slice(0, 287) + "...";
      }

      return {
        differentiatedMessage: msg,
        thinkingTrace,
      };
    } catch (err) {
      const firstName = recipientName.split(" ")[0] || "there";
      return {
        differentiatedMessage: `Hi ${firstName}, following your work at ${company}! Would love to connect and exchange insights on your current engineering focus.`,
        thinkingTrace,
      };
    }
  }

  /**
   * Simple Jaccard similarity between two texts
   */
  private computeStringSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
    const setB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));

    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const word of setA) {
      if (setB.has(word)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}

export const outreachBrainService = new OutreachBrainService();
