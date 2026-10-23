import { db } from "../../db/index.js";
import { linkedinAccounts } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { linkedInProfileService } from "../../services/linkedin/profile.service.js";
import { linkedInPeopleService } from "../../services/linkedin/people.service.js";
import {
  prospectMatchingService,
  UserTargetingContext,
} from "../../services/prospects/prospect-matching.service.js";
import { outreachPersonalizationService } from "../../services/prospects/outreach-personalization.service.js";
import {
  DailyAgentConfig,
  ProspectCandidate,
  ProspectMatchEvaluation,
} from "./daily-agent.types.js";
import { getGeminiChatModel } from "../WORKPILOT-connect-agent.js";
import { HumanMessage } from "@langchain/core/messages";

export interface PlannedOutreachItem {
  candidate: ProspectCandidate;
  matchScore: number;
  reason: string;
  personalizedNote?: string | undefined;
  action: "CONNECT" | "REVIEW_ONLY";
}

export interface DailyPlanResult {
  userId: string;
  targetingContext: UserTargetingContext;
  prospectsReviewed: number;
  strongMatches: PlannedOutreachItem[];
  searchQueryUsed: string;
  smartGoalInferred: boolean;
}

export class DailyAgentPlanner {
  /**
   * Plans the daily prospecting outreach for a specific user:
   * 1. Resolves custom targeting settings or infers "Smart Default Goal" from user's verified profile.
   * 2. Executes targeted searches via Unipile LinkedIn People API.
   * 3. Evaluates and scores discovered candidates.
   * 4. Prepares factual personalized connection notes for strong matches.
   */
  public async planDailyWork(
    userId: string,
    config: DailyAgentConfig,
    remainingCapacity: number,
  ): Promise<DailyPlanResult> {
    // 1. Fetch user's own connected LinkedIn profile details
    let ownProfile: any = null;
    let ownGroundTruth: string = "";
    try {
      ownGroundTruth = await linkedInProfileService.getUserProfileGroundTruth(userId);
      const [acc] = await db
        .select()
        .from(linkedinAccounts)
        .where(and(eq(linkedinAccounts.userId, userId), eq(linkedinAccounts.isConnected, true)))
        .limit(1);
      if (acc?.unipileAccountId) {
        ownProfile = await linkedInProfileService.getOwnProfile(acc.unipileAccountId).catch(() => null);
      }
    } catch {
      // ignore
    }

    const userHeadline = ownProfile?.headline || ownProfile?.designation || "";
    const userAbout = ownProfile?.about || ownProfile?.summary || "";
    const userIndustry = ownProfile?.industry || "";

    // 2. Resolve Smart Default Goal if targeting is not explicitly configured
    let targetRoles = config.targetRoles || [];
    let targetIndustries = config.targetIndustries || [];
    let targetLocations = config.targetLocations || [];
    let networkingGoal = config.networkingGoal || "";
    let smartGoalInferred = false;

    if (
      targetRoles.length === 0 ||
      !networkingGoal.trim() ||
      targetIndustries.length === 0
    ) {
      smartGoalInferred = true;
      const inferred = await this.inferSmartTargetingFromProfile({
        headline: userHeadline,
        about: userAbout,
        industry: userIndustry,
        groundTruth: ownGroundTruth,
      });

      if (targetRoles.length === 0) targetRoles = inferred.targetRoles;
      if (targetIndustries.length === 0) targetIndustries = inferred.targetIndustries;
      if (!networkingGoal.trim()) networkingGoal = inferred.networkingGoal;
    }

    const targetingContext: UserTargetingContext = {
      userId,
      userHeadline,
      userAbout,
      userIndustry,
      targetRoles,
      targetIndustries,
      targetLocations,
      networkingGoal,
    };

    // 3. Formulate targeted search query
    const primaryRole = targetRoles[0] || "Founders";
    const primaryIndustry = targetIndustries[0] || "";
    const primaryLocation = targetLocations[0] || "";

    // 4. Discover candidate prospects via Unipile
    let rawResults: any[] = [];
    try {
      rawResults = await linkedInPeopleService.searchPeople(
        {
          role: primaryRole,
          keywords: primaryRole,
          industry: primaryIndustry || undefined,
          location: primaryLocation || undefined,
          limit: Math.max(remainingCapacity * 2, 10),
        },
        undefined,
        userId,
      );
    } catch (searchErr) {
      console.warn(`[DAILY-AGENT PLANNER] Primary search error for user ${userId}:`, searchErr);
    }

    // If primary search returned few candidates, attempt keyword query fallback
    if (rawResults.length < 3 && targetRoles.length > 1) {
      try {
        const secondary = await linkedInPeopleService.searchPeople(
          {
            role: targetRoles[1],
            keywords: targetRoles[1],
            limit: 10,
          },
          undefined,
          userId,
        );
        rawResults = [...rawResults, ...secondary];
      } catch {}
    }

    const candidates: ProspectCandidate[] = rawResults.map((p) => ({
      name: p.name,
      linkedinId: p.linkedin_id || (p as any).provider_id,
      profileUrl: p.profile_url,
      company: p.company,
      designation: p.designation,
      location: p.location,
      industry: p.industry,
    }));

    // 5. Evaluate and score candidates with ProspectMatchingService
    const evaluations: ProspectMatchEvaluation[] =
      await prospectMatchingService.evaluateCandidates(candidates, targetingContext);

    // 6. Select top matches up to remaining daily capacity
    const strongEvaluations = evaluations
      .filter((e) => e.isStrongMatch || e.matchScore >= 65)
      .slice(0, remainingCapacity);

    // 7. Generate personalized notes for selected candidates
    const strongMatches: PlannedOutreachItem[] = [];
    for (const item of strongEvaluations) {
      let personalizedNote: string | undefined = undefined;

      // In AUTONOMOUS or ASSISTED mode, craft personalized note
      if (config.dailyAgentMode !== "DISCOVERY_ONLY") {
        personalizedNote = await outreachPersonalizationService.generatePersonalizedNote({
          candidate: item.candidate,
          userContext: targetingContext,
          matchReason: item.reason,
        });
      }

      strongMatches.push({
        candidate: item.candidate,
        matchScore: item.matchScore,
        reason: item.reason,
        personalizedNote,
        action: config.dailyAgentMode === "DISCOVERY_ONLY" ? "REVIEW_ONLY" : "CONNECT",
      });
    }

    return {
      userId,
      targetingContext,
      prospectsReviewed: candidates.length,
      strongMatches,
      searchQueryUsed: primaryRole,
      smartGoalInferred,
    };
  }

  /**
   * Infers smart networking targets when the user has not configured explicit preferences.
   */
  private async inferSmartTargetingFromProfile(profile: {
    headline?: string;
    about?: string;
    industry?: string;
    groundTruth?: string;
  }): Promise<{ targetRoles: string[]; targetIndustries: string[]; networkingGoal: string }> {
    try {
      const model = getGeminiChatModel({ temperature: 0.1 });
      const prompt = `You are an executive networking advisor. Analyze the user's professional profile and infer the optimal target audience for high-value LinkedIn outreach.

USER PROFILE:
- Headline: ${profile.headline || "Not provided"}
- About: ${profile.about?.slice(0, 300) || "Not provided"}
- Industry: ${profile.industry || "Technology"}
- Verified Details: ${profile.groundTruth?.slice(0, 300) || ""}

INSTRUCTIONS:
1. Identify 2-3 specific peer or leadership roles that have meaningful professional overlap with the user (e.g. if user is an AI software founder, targets might be "AI Founders", "CTOs", "VP of Engineering").
2. Identify 1-2 relevant industries.
3. Formulate a 1-sentence networking goal explaining what mutual value a connection offers.

Respond ONLY with valid JSON:
{
  "targetRoles": ["Role 1", "Role 2"],
  "targetIndustries": ["Industry 1"],
  "networkingGoal": "Goal sentence"
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

      return {
        targetRoles: Array.isArray(parsed.targetRoles) && parsed.targetRoles.length > 0
          ? parsed.targetRoles
          : ["Founders", "Engineering Leaders"],
        targetIndustries: Array.isArray(parsed.targetIndustries) && parsed.targetIndustries.length > 0
          ? parsed.targetIndustries
          : ["Software Development", "Technology"],
        networkingGoal: typeof parsed.networkingGoal === "string" && parsed.networkingGoal.trim()
          ? parsed.networkingGoal.trim()
          : "Connect with industry peers and leaders to exchange domain insights.",
      };
    } catch {
      // Deterministic fallback
      return {
        targetRoles: ["Founders", "Software Leaders"],
        targetIndustries: ["Technology", "Software"],
        networkingGoal: "Connect with relevant peers and leaders in software products.",
      };
    }
  }
}

export const dailyAgentPlanner = new DailyAgentPlanner();
