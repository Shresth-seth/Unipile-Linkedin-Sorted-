import { ProspectCandidate } from "../../agent/daily/daily-agent.types.js";
import { UserTargetingContext } from "./prospect-matching.service.js";
import { getGeminiChatModel } from "../../agent/WORKPILOT-connect-agent.js";
import { HumanMessage } from "@langchain/core/messages";

export interface PersonalizationInput {
  candidate: ProspectCandidate;
  userContext: UserTargetingContext;
  matchReason?: string | undefined;
  customTemplate?: string | undefined;
}

export class OutreachPersonalizationService {
  /**
   * Generates a genuinely personalized LinkedIn connection invitation note.
   * Strict requirements:
   * - Must establish a genuine reason for connecting based on shared professional relevance.
   * - Strictly below 295 characters (LinkedIn 300 char hard limit).
   * - Never invent/hallucinate facts, company achievements, mutual connections, or posts.
   * - Avoids weak generic openers like "I saw your profile and wanted to connect".
   * - If information is insufficient, falls back to a clean truthful note or blank note.
   */
  public async generatePersonalizedNote(input: PersonalizationInput): Promise<string | undefined> {
    const { candidate, userContext, matchReason, customTemplate } = input;

    // If a custom template is provided by the user, perform safe token replacement
    if (customTemplate && customTemplate.trim()) {
      const firstName = candidate.name ? (candidate.name.split(" ")[0] || "there") : "there";
      let formatted = customTemplate
        .replace(/\{name\}/gi, candidate.name || "")
        .replace(/\{firstName\}/gi, firstName || "")
        .replace(/\{company\}/gi, candidate.company || "your company")
        .replace(/\{headline\}/gi, candidate.designation || "your work");

      if (formatted.length > 295) {
        formatted = formatted.slice(0, 292) + "...";
      }
      return formatted;
    }

    try {
      const model = getGeminiChatModel({ temperature: 0.2 });
      const firstName = candidate.name ? (candidate.name.split(" ")[0] || "there") : "there";

      const prompt = `You are a professional LinkedIn outreach copywriter crafting high-converting, authentic connection notes.

SENDER CONTEXT:
- Headline: ${userContext.userHeadline || "Tech Founder / Builder"}
- About/Focus: ${userContext.userAbout?.slice(0, 200) || "Building innovative software products"}
- Stated Networking Goal: ${userContext.networkingGoal || "Connect with peers and leaders in this space"}

RECIPIENT CONTEXT (RETRIEVED GROUND TRUTH ONLY):
- Full Name: ${candidate.name}
- First Name: ${firstName}
- Designation/Role: ${candidate.designation || "Professional"}
- Company: ${candidate.company || "their company"}
- Location: ${candidate.location || "Global"}
- Overlap/Why Connecting: ${matchReason || "Shared focus in this industry"}

CRITICAL RULES:
1. MAX LENGTH: Under 280 characters strictly (no exceptions!).
2. NEVER say "Hi, I saw your profile and wanted to connect" or "I'd love to add you to my network".
3. Establish a genuine, natural professional reason for connecting (e.g. noticing their work in ${candidate.company || "their field"} and your shared focus).
4. NEVER INVENT OR HALLUCINATE: do not make up specific posts, fake shared acquaintances, fake awards, or fake articles.
5. Keep tone peer-to-peer, warm, concise, and humble.

Output ONLY the text of the note. No quotes, no intro, no markdown.`;

      const res = await model.invoke([new HumanMessage(prompt)]);
      let note =
        typeof res.content === "string"
          ? res.content.trim()
          : Array.isArray(res.content)
            ? res.content.map((c: any) => (typeof c === "string" ? c : c.text || "")).join("").trim()
            : "";

      // Remove surrounding quotes or markdown
      note = note.replace(/^["']|["']$/g, "").trim();

      if (note.length > 295) {
        note = note.slice(0, 292) + "...";
      }

      // If the generated note is still too generic or empty, fall back to heuristic note
      if (!note || note.length < 20 || /I'd love to add you/i.test(note)) {
        return this.generateTruthfulFallbackNote(candidate);
      }

      return note;
    } catch {
      return this.generateTruthfulFallbackNote(candidate);
    }
  }

  /**
   * Deterministic, truthful fallback note if LLM fails or context is concise.
   */
  public generateTruthfulFallbackNote(candidate: ProspectCandidate): string {
    const firstName = candidate.name ? (candidate.name.split(" ")[0] || "there") : "there";
    const company = candidate.company ? ` at ${candidate.company}` : "";
    const roleParts = candidate.designation ? candidate.designation.split("|") : [];
    const role = roleParts.length > 0 && roleParts[0] ? roleParts[0].trim() : "";

    if (company && role) {
      const note = `Hi ${firstName}, saw your role as ${role}${company}. Working in this domain as well and thought it'd be great to connect and stay in touch.`;
      return note.length <= 295 ? note : `Hi ${firstName}, following your work${company}. Would be great to connect here on LinkedIn.`;
    }

    if (company) {
      return `Hi ${firstName}, came across your work${company}. As someone also in this space, would love to connect.`;
    }

    return `Hi ${firstName}, noticed your background in ${candidate.industry || "the space"}. Would be glad to connect here.`;
  }
}

export const outreachPersonalizationService = new OutreachPersonalizationService();
