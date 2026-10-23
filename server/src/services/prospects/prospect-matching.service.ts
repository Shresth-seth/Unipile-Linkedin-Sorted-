import { db } from "../../db/index.js";
import { contacts } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { ProspectCandidate, ProspectMatchEvaluation } from "../../agent/daily/daily-agent.types.js";
import { getGeminiChatModel } from "../../agent/WORKPILOT-connect-agent.js";
import { HumanMessage } from "@langchain/core/messages";

export interface UserTargetingContext {
  userId: string;
  userHeadline?: string | undefined;
  userAbout?: string | undefined;
  userIndustry?: string | undefined;
  targetRoles?: string[] | undefined;
  targetIndustries?: string[] | undefined;
  targetLocations?: string[] | undefined;
  networkingGoal?: string | undefined;
}

export class ProspectMatchingService {
  /**
   * Evaluates a list of candidates against the user's profile, networking goal, and targeting rules.
   * Discards already connected or contacted candidates, scores relevance from 0 to 100,
   * and provides a short factual explanation.
   */
  public async evaluateCandidates(
    candidates: ProspectCandidate[],
    context: UserTargetingContext,
  ): Promise<ProspectMatchEvaluation[]> {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    const evaluations: ProspectMatchEvaluation[] = [];

    // 1. Batch check existing contacts in database for deduplication
    const existingContacts = await db
      .select({
        linkedinId: contacts.linkedinId,
        status: contacts.status,
        optedOut: contacts.optedOut,
      })
      .from(contacts)
      .where(eq(contacts.userId, context.userId));

    const existingMap = new Map<string, { status: string; optedOut: boolean }>();
    for (const c of existingContacts) {
      if (c.linkedinId) {
        existingMap.set(c.linkedinId, { status: c.status, optedOut: Boolean(c.optedOut) });
      }
    }

    // Filter out candidates that should not be contacted again
    const eligibleCandidates = candidates.filter((cand) => {
      const existing = existingMap.get(cand.linkedinId);
      if (!existing) return true;
      if (existing.optedOut) return false;
      if (existing.status === "CONTACTED" || existing.status === "CONNECTED" || existing.status === "LOST") {
        return false;
      }
      return true;
    });

    if (eligibleCandidates.length === 0) {
      return [];
    }

    // 2. Hard pre-filter: remove obviously irrelevant / spam profiles before sending to LLM
    const SPAM_KEYWORDS = [
      "call center", "telecaller", "bpo", "data entry", "helpdesk", "customer care agent",
      "peon", "security guard", "housekeeping", "driver", "sweeper", "labourer",
      "student", "fresher", "intern", "looking for job", "seeking opportunities",
      "unemployed", "n/a", "linkedin member",
    ];
    const filteredCandidates = eligibleCandidates.filter((cand) => {
      const roleAndCompany = `${cand.designation || ""} ${cand.company || ""}`.toLowerCase();
      const isSpam = SPAM_KEYWORDS.some((kw) => roleAndCompany.includes(kw));
      if (isSpam) {
        console.log(`[prospect-matching] Pre-filter blocked spam/irrelevant profile: ${cand.name} (${cand.designation})`);
      }
      return !isSpam;
    });

    if (filteredCandidates.length === 0) {
      return [];
    }

    // 3. Evaluate candidates in batches using Gemini LLM for deep relevance scoring
    for (const cand of filteredCandidates) {
      const evaluation = await this.evaluateSingleCandidate(cand, context);
      evaluations.push(evaluation);
    }

    // Sort evaluations descending by matchScore
    evaluations.sort((a, b) => b.matchScore - a.matchScore);

    return evaluations;
  }

  /**
   * Evaluates a single candidate using LLM with deterministic heuristic fallback.
   */
  public async evaluateSingleCandidate(
    candidate: ProspectCandidate,
    context: UserTargetingContext,
  ): Promise<ProspectMatchEvaluation> {
    try {
      const model = getGeminiChatModel({ temperature: 0.1 });

      const prompt = `You are a professional LinkedIn prospect evaluator for an autonomous networking agent.
Evaluate how well the candidate matches the user's professional background and networking goals.

USER PROFILE & GOALS:
- Headline: ${context.userHeadline || "Not specified"}
- About/Focus: ${context.userAbout?.slice(0, 250) || "Not specified"}
- Stated Networking Goal: ${context.networkingGoal || "Connect with relevant peers and leaders in relevant domain"}
- Target Roles: ${context.targetRoles?.join(", ") || "Relevant professionals"}
- Target Industries: ${context.targetIndustries?.join(", ") || "Any relevant"}
- Target Locations: ${context.targetLocations?.join(", ") || "Global"}

CANDIDATE:
- Name: ${candidate.name}
- Headline/Role: ${candidate.designation || "Professional"}
- Company: ${candidate.company || "Not specified"}
- Location: ${candidate.location || "Not specified"}
- Industry: ${candidate.industry || "Not specified"}

TASK:
1. Calculate a match score between 0 and 100 based strictly on verified overlap (role relevance, company domain, industry synergy, shared professional value).
2. Give a score of 0-20 if the candidate is a student, intern, call center agent, BPO worker, data entry operator, housekeeping staff, security guard, unemployed, or any other irrelevant/spam profile.
3. Formulate a single, concise sentence explaining the specific match rationale (e.g. "Founder building AI developer infrastructure, closely aligned with the user's AI product work.").
4. Do NOT hallucinate achievements or mutual connections. Base reasoning only on the provided details.

Respond ONLY with valid JSON:
{
  "matchScore": number,
  "reason": "1 concise sentence explanation"
}`;

      const res = await model.invoke([new HumanMessage(prompt)]);
      const rawText =
        typeof res.content === "string"
          ? res.content
          : Array.isArray(res.content)
            ? res.content.map((c: any) => (typeof c === "string" ? c : c.text || "")).join("")
            : "";

      const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      const score = Math.max(0, Math.min(100, Number(parsed.matchScore) || 50));
      const reason = (typeof parsed.reason === "string" && parsed.reason.trim())
        ? parsed.reason.trim()
        : this.generateHeuristicReason(candidate, score);

      return {
        candidate,
        matchScore: score,
        reason,
        isStrongMatch: score >= 70,
      };
    } catch {
      // Deterministic heuristic fallback if LLM is unavailable or offline
      return this.heuristicMatch(candidate, context);
    }
  }

  /**
   * Deterministic heuristic scoring based on role, industry, company, and location keyword matching.
   */
  private heuristicMatch(
    candidate: ProspectCandidate,
    context: UserTargetingContext,
  ): ProspectMatchEvaluation {
    let score = 50; // baseline

    const candidateRole = (candidate.designation || "").toLowerCase();
    const candidateLoc = (candidate.location || "").toLowerCase();

    // Check target roles
    if (context.targetRoles && context.targetRoles.length > 0) {
      const matchesRole = context.targetRoles.some((r) =>
        candidateRole.includes(r.toLowerCase()),
      );
      if (matchesRole) score += 25;
    } else if (context.userHeadline) {
      const userTerms = context.userHeadline.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const hasOverlap = userTerms.some((term) => candidateRole.includes(term));
      if (hasOverlap) score += 20;
    }

    // Check company/seniority signals
    if (/(founder|ceo|cto|head|lead|director|vp|principal)/i.test(candidateRole)) {
      score += 15;
    }

    // Check target locations
    if (context.targetLocations && context.targetLocations.length > 0) {
      const matchesLoc = context.targetLocations.some((l) =>
        candidateLoc.includes(l.toLowerCase()),
      );
      if (matchesLoc) score += 10;
    }

    score = Math.min(95, Math.max(20, score));
    const reason = this.generateHeuristicReason(candidate, score);

    return {
      candidate,
      matchScore: score,
      reason,
      isStrongMatch: score >= 70,
    };
  }

  private generateHeuristicReason(
    candidate: ProspectCandidate,
    score: number,
  ): string {
    const role = candidate.designation || "Professional";
    const company = candidate.company ? ` at ${candidate.company}` : "";
    if (score >= 80) {
      return `High relevance: ${role}${company} directly aligns with targeting criteria and networking objectives.`;
    } else if (score >= 65) {
      return `Moderate relevance: ${role}${company} shares professional overlap with your focus area.`;
    }
    return `Potential connection: ${role}${company} in related industry.`;
  }
}

export const prospectMatchingService = new ProspectMatchingService();
