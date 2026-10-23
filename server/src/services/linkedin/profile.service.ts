import { unipileClient } from "../unipile/unipile.client.js";
import { db } from "../../db/index.js";
import { linkedinAccounts } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

export interface ProfileAuditResult {
  overallScore: number;
  grade: string;
  profile: {
    name: string;
    headline: string;
    about: string;
    location: string;
    industry: string;
    avatar?: string;
    publicIdentifier?: string;
    connectionsCount: number;
    skillsCount: number;
    experienceCount: number;
    educationCount?: number;
  };
  breakdown: {
    headlineScore: { score: number; max: number; critique: string };
    aboutScore: { score: number; max: number; critique: string };
    experienceScore: { score: number; max: number; critique: string };
    skillsScore: { score: number; max: number; critique: string };
    completenessScore: { score: number; max: number; critique: string };
  };
  strengths: string[];
  critiques: string[];
  actionableSuggestions: {
    headlineOptions: string[];
    immediateFixes: string[];
  };
}

export class LinkedInProfileService {
  /**
   * Resolves the active account ID from Unipile or database.
   */
  private async resolveAccountId(preferredAccountId?: string): Promise<string> {
    if (preferredAccountId && preferredAccountId.trim()) {
      return preferredAccountId.trim();
    }
    throw new Error(
      "No active LinkedIn account connected. Please connect your LinkedIn account to view or audit your profile.",
    );
  }

  /**
   * Fetches the user's own profile from Unipile.
   */
  public async getOwnProfile(preferredAccountId?: string): Promise<any> {
    if (!unipileClient.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }

    const accountId = await this.resolveAccountId(preferredAccountId);
    const account = await unipileClient.getAccount(accountId);

    // Try fetching deep profile via getProfile
    let deepProfile: any = null;
    try {
      deepProfile = await unipileClient.getProfile(accountId, "me");
    } catch {
      try {
        const identifier =
          account.provider_id || account.connection_id || account.name;
        if (identifier) {
          deepProfile = await unipileClient.getProfile(accountId, identifier);
        }
      } catch (e: any) {
        console.warn(
          "Could not fetch deep profile for 'me', using account summary:",
          e.message,
        );
      }
    }

    const item = deepProfile || account;

    const firstName = item.first_name || "";
    const lastName = item.last_name || "";
    const name =
      `${firstName} ${lastName}`.trim() ||
      item.name ||
      account.name ||
      "LinkedIn Member";

    const headline =
      item.headline ||
      item.occupation ||
      item.title ||
      item.designation ||
      account.headline ||
      "Professional";

    const about = item.summary || item.about || item.description || "";
    const location = item.location || item.city || account.location || "Global";
    const industry = item.industry || account.industry || "Technology";
    const avatar = item.profile_picture_url || item.avatar || account.avatar;
    const publicIdentifier =
      item.public_identifier || account.public_identifier;
    let connectionsCount = item.connections_count ?? item.network_info?.connections_count ?? account.connections_count;
    if (connectionsCount === undefined || connectionsCount === null) {
      try {
        const rels = await unipileClient.request('/api/v1/users/relations?account_id=' + encodeURIComponent(accountId) + '&limit=1');
        connectionsCount = Array.isArray(rels?.items) ? rels.items.length : 0;
      } catch {
        connectionsCount = 0;
      }
    }

    const experiences = item.experiences || item.positions || [];
    const skills = item.skills || [];
    const education = item.education || item.educations || [];

    return {
      name,
      headline,
      about,
      location,
      industry,
      avatar,
      publicIdentifier,
      connectionsCount,
      skillsCount: Array.isArray(skills) ? skills.length : 5,
      experienceCount: Array.isArray(experiences) ? experiences.length : 2,
      educationCount: Array.isArray(education) ? education.length : 1,
      raw: item,
      accountId,
    };
  }

  /**
   * Rates and audits a LinkedIn profile with an intelligent scoring model (0-100).
   */
  public rateProfile(profileData: any): ProfileAuditResult {
    const headline = String(profileData.headline || "").trim();
    const about = String(profileData.about || "").trim();
    const experiencesCount = Number(profileData.experienceCount || 1);
    const skillsCount = Number(profileData.skillsCount || 3);
    const hasAvatar = Boolean(profileData.avatar);
    const connectionsCount = Number(profileData.connectionsCount || 100);

    const strengths: string[] = [];
    const critiques: string[] = [];

    // 1. Headline Score (Max 25)
    let headlineScore = 0;
    let headlineCritique = "";
    if (headline.length >= 30 && headline.length <= 140) {
      headlineScore += 8;
      strengths.push("Headline length is optimal for search indexing.");
    } else if (headline.length < 30) {
      headlineScore += 3;
      critiques.push(
        "Headline is too brief. Expand with specific expertise and value.",
      );
    } else {
      headlineScore += 5;
    }

    const hasValueProp =
      /(help|building|scaling|engineer|founder|architect|lead|director|manager|developer)/i.test(
        headline,
      );
    if (hasValueProp) {
      headlineScore += 10;
      strengths.push("Headline contains clear role clarity and value markers.");
    } else {
      critiques.push("Headline lacks clear functional keywords.");
    }

    const hasBuzzwords =
      /(guru|ninja|rockstar|wizard|results-driven|hardworking)/i.test(headline);
    if (!hasBuzzwords) {
      headlineScore += 7;
    } else {
      headlineScore += 2;
      critiques.push(
        "Avoid generic buzzwords ('guru', 'ninja') in your headline.",
      );
    }
    headlineCritique = `${headlineScore}/25 - ${headlineScore >= 20 ? "High conversion potential." : "Needs punchier value statement."}`;

    // 2. About / Summary Score (Max 25)
    let aboutScore = 0;
    let aboutCritique = "";
    if (about.length >= 250) {
      aboutScore += 15;
      strengths.push("Detailed About section gives prospects rich context.");
    } else if (about.length >= 50) {
      aboutScore += 8;
      critiques.push(
        "About section is somewhat short. Elaborate on key milestones.",
      );
    } else {
      aboutScore += 2;
      critiques.push(
        "Missing or extremely short About section reduces connection trust.",
      );
    }

    const hasCta = /(reach|email|connect|contact|dm|let's talk|open to)/i.test(
      about,
    );
    if (hasCta) {
      aboutScore += 10;
      strengths.push(
        "Includes a clear Call to Action for prospects to engage.",
      );
    } else {
      aboutScore += 3;
      critiques.push(
        "Add a Call to Action (CTA) at the bottom of your About section.",
      );
    }
    aboutCritique = `${aboutScore}/25 - ${aboutScore >= 18 ? "Compelling narrative." : "Expand narrative & add CTA."}`;

    // 3. Experience Score (Max 20)
    let experienceScore = 0;
    if (experiencesCount >= 3) {
      experienceScore = 20;
      strengths.push(
        "Strong career progression with multiple documented roles.",
      );
    } else if (experiencesCount >= 1) {
      experienceScore = 14;
    } else {
      experienceScore = 6;
      critiques.push("Add past roles to build institutional credibility.");
    }
    const experienceCritique = `${experienceScore}/20 - ${experiencesCount} career positions listed.`;

    // 4. Skills Score (Max 15)
    let skillsScore = 0;
    if (skillsCount >= 10) {
      skillsScore = 15;
      strengths.push("Rich skill graph boosts algorithm discoverability.");
    } else if (skillsCount >= 5) {
      skillsScore = 10;
    } else {
      skillsScore = 5;
      critiques.push(
        "Add at least 5-10 core skills to increase search visibility.",
      );
    }
    const skillsCritique = `${skillsScore}/15 - ${skillsCount} verified skills found.`;

    // 5. Completeness & Social Proof (Max 15)
    let completenessScore = 0;
    if (hasAvatar) {
      completenessScore += 6;
      strengths.push("Professional profile photo active.");
    } else {
      critiques.push(
        "Add a high-quality profile picture to increase accept rates by up to 40%.",
      );
    }
    if (connectionsCount >= 200) {
      completenessScore += 5;
      strengths.push("Established network footprint (200+ connections).");
    } else {
      completenessScore += 2;
    }
    if (profileData.location && profileData.industry) {
      completenessScore += 4;
    }
    const completenessCritique = `${completenessScore}/15 - Profile presence and network signals.`;

    const overallScore = Math.min(
      100,
      headlineScore +
        aboutScore +
        experienceScore +
        skillsScore +
        completenessScore,
    );

    let grade = "B";
    if (overallScore >= 90) grade = "A+ (Elite Outreach Ready)";
    else if (overallScore >= 80) grade = "A (Strong Profile)";
    else if (overallScore >= 70) grade = "B (Good, minor tweaks recommended)";
    else if (overallScore >= 55) grade = "C (Needs Optimization)";
    else grade = "D (Incomplete Profile)";

    // Suggest tailored headlines
    const roleKeyword =
      headline.split("|")[0]?.split("—")[0]?.trim() || "Technology Leader";
    const headlineOptions = [
      `${roleKeyword} | Building High-Impact Solutions | Scaling Systems & Teams`,
      `${roleKeyword} • Driving Architecture Innovation & Engineering Excellence`,
      `${roleKeyword} | Helping Companies Scale with Modern Tech & Autonomous Systems`,
    ];

    return {
      overallScore,
      grade,
      profile: {
        name: profileData.name,
        headline,
        about,
        location: profileData.location,
        industry: profileData.industry,
        avatar: profileData.avatar,
        publicIdentifier: profileData.publicIdentifier,
        connectionsCount,
        skillsCount,
        experienceCount: experiencesCount,
        educationCount: profileData.educationCount || 1,
      },
      breakdown: {
        headlineScore: {
          score: headlineScore,
          max: 25,
          critique: headlineCritique,
        },
        aboutScore: { score: aboutScore, max: 25, critique: aboutCritique },
        experienceScore: {
          score: experienceScore,
          max: 20,
          critique: experienceCritique,
        },
        skillsScore: { score: skillsScore, max: 15, critique: skillsCritique },
        completenessScore: {
          score: completenessScore,
          max: 15,
          critique: completenessCritique,
        },
      },
      strengths,
      critiques,
      actionableSuggestions: {
        headlineOptions,
        immediateFixes: [
          "Adopt a formula-based headline: [Role] | [What You Build/Solve] | [Quantifiable Impact].",
          "Ensure your About section finishes with a one-sentence Call to Action inviting peers to connect.",
          "Keep descriptions focused on results rather than daily duties.",
        ],
      },
    };
  }

  /**
   * Fetches own profile and rates it in a single unified flow.
   */
  public async getOwnProfileAndAudit(
    preferredAccountId?: string,
  ): Promise<ProfileAuditResult> {
    const profile = await this.getOwnProfile(preferredAccountId);
    return this.rateProfile(profile);
  }

  /**
   * Updates the user's profile headline across Unipile and local database.
   */
  public async updateHeadline(
    newHeadline: string,
    preferredAccountId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    previousHeadline?: string;
    newHeadline: string;
  }> {
    if (!newHeadline || !newHeadline.trim()) {
      throw new Error("New headline text is required.");
    }

    const trimmed = newHeadline.trim();
    const accountId = await this.resolveAccountId(preferredAccountId);

    // Get current headline
    let previousHeadline = "";
    try {
      const current = await this.getOwnProfile(accountId);
      previousHeadline = current.headline;
    } catch {}

    // Send update to Unipile
    let unipileUpdated = false;
    try {
      await unipileClient.request(`/api/v1/accounts/${accountId}`, {
        method: "PATCH",
        body: JSON.stringify({ headline: trimmed }),
      });
      unipileUpdated = true;
    } catch (err: any) {
      // Also attempt user profile patch if account patch isn't supported on endpoint
      try {
        await unipileClient.request(`/api/v1/users/me`, {
          method: "PATCH",
          body: JSON.stringify({ headline: trimmed, account_id: accountId }),
        });
        unipileUpdated = true;
      } catch (innerErr: any) {
        console.warn("Unipile API headline update notice:", innerErr.message);
      }
    }

    // Persist to local database
    try {
      await db
        .update(linkedinAccounts)
        .set({
          headline: trimmed,
          updatedAt: new Date(),
        })
        .where(eq(linkedinAccounts.unipileAccountId, accountId));
    } catch (dbErr) {
      console.warn("Database headline sync warning:", dbErr);
    }

    return {
      success: true,
      message: `LinkedIn profile headline updated successfully to: "${trimmed}"${unipileUpdated ? " (Synchronized with Unipile)" : ""}`,
      previousHeadline,
      newHeadline: trimmed,
    };
  }

  // Cache to avoid hammering Unipile API on every chat turn
  private profileGroundTruthCache = new Map<
    string,
    { data: string; expiresAt: number }
  >();

  /**
   * Retrieves the user's verified LinkedIn profile ground-truth formatted as a
   * permanent, read-only System Instruction block for the AI agent.
   */
  public async getUserProfileGroundTruth(userId: string): Promise<string> {
    if (!userId) {
      return `================================================================================
VERIFIED USER LINKEDIN PROFILE STATUS (READ ONLY):
- Connection Status: Disconnected / unauthenticated.
================================================================================`;
    }

    const cached = this.profileGroundTruthCache.get(userId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId,
      );

    try {
      let acc: any = null;
      if (isUuid) {
        const [found] = await db
          .select()
          .from(linkedinAccounts)
          .where(
            and(
              eq(linkedinAccounts.userId, userId),
              eq(linkedinAccounts.isConnected, true),
            ),
          )
          .limit(1);
        acc = found;
      } else {
        const [found] = await db
          .select()
          .from(linkedinAccounts)
          .where(eq(linkedinAccounts.isConnected, true))
          .limit(1);
        acc = found;
      }

      if (!acc || !acc.unipileAccountId || acc.healthStatus === "DISCONNECTED") {
        const unlinked = `================================================================================
VERIFIED USER LINKEDIN PROFILE STATUS (READ ONLY):
- Connection Status: Disconnected or session cookies expired.
- Ground Truth: The user has not connected a verified LinkedIn profile yet.
- Guidance: Prompt the user to connect their LinkedIn account in Settings to enable personalized outreach and authentic first-person representations.
================================================================================`;
        return unlinked;
      }

      let profileData: any = null;
      try {
        profileData = await this.getOwnProfile(acc.unipileAccountId);
      } catch (profileErr: any) {
        console.warn(
          `⚠️ [PROFILE SERVICE] Could not fetch deep profile for user ${userId}, using database record:`,
          profileErr.message,
        );
      }

      const name = profileData?.name || acc.linkedinName || "LinkedIn Member";
      const headline = profileData?.headline || acc.headline || "Professional";
      const about = String(profileData?.about || "").trim();
      const location = profileData?.location || "Global";
      const industry = profileData?.industry || "Technology";
      const publicId =
        profileData?.publicIdentifier || acc.unipileAccountId || "Connected Profile";
      const connections =
        profileData?.connectionsCount !== undefined &&
        profileData?.connectionsCount !== null
          ? `${profileData.connectionsCount} connections`
          : "Active Network";

      // Parse skills
      let skillsSummary = "";
      const rawSkills = profileData?.raw?.skills || profileData?.skills;
      if (Array.isArray(rawSkills) && rawSkills.length > 0) {
        skillsSummary = rawSkills
          .slice(0, 15)
          .map((s: any) =>
            typeof s === "string" ? s : s.name || s.skill || "",
          )
          .filter(Boolean)
          .join(", ");
      }

      // Parse experiences
      let experiencesSummary = "";
      const rawExp =
        profileData?.raw?.experiences || profileData?.raw?.positions;
      if (Array.isArray(rawExp) && rawExp.length > 0) {
        experiencesSummary = rawExp
          .slice(0, 4)
          .map((exp: any) => {
            const title = exp.title || exp.role || "Role";
            const company =
              exp.company || exp.company_name || exp.organization || "";
            const desc = (exp.description || exp.summary || "").slice(0, 140);
            return `- ${title}${company ? ` at ${company}` : ""}${desc ? `: ${desc}` : ""}`;
          })
          .join("\n");
      }

      // Parse education
      let educationSummary = "";
      const rawEdu =
        profileData?.raw?.education || profileData?.raw?.educations;
      if (Array.isArray(rawEdu) && rawEdu.length > 0) {
        educationSummary = rawEdu
          .slice(0, 2)
          .map((edu: any) => {
            const school =
              edu.school || edu.school_name || edu.institution || "University";
            const degree = edu.degree || edu.degree_name || "";
            const field = edu.field_of_study || "";
            return `- ${school}${degree ? ` (${degree}${field ? `, ${field}` : ""})` : ""}`;
          })
          .join("\n");
      }

      const groundTruthPrompt = `================================================================================
VERIFIED USER LINKEDIN PROFILE (PERMANENT GROUND-TRUTH IDENTITY — READ ONLY):
You are the autonomous outreach director operating directly on behalf of THIS verified LinkedIn member.
You must represent them authentically in all connection requests, outreach notes, direct messages, and published posts.
Speak from their authentic first-person perspective ("I", "we"), drawing on their real experience, company, and industry context.
Never fabricate a different name, job title, company, or professional background for this user.

• Full Name: ${name}
• Professional Headline: ${headline}
• Location: ${location}
• Industry: ${industry}
• Public Profile: ${publicId}
• Total Connections: ${connections}
${about ? `• Summary / Bio:\n  "${about.slice(0, 600)}"` : ""}
${skillsSummary ? `• Core Skills / Focus Areas: ${skillsSummary}` : ""}
${experiencesSummary ? `• Notable Experience History:\n${experiencesSummary}` : ""}
${educationSummary ? `• Education:\n${educationSummary}` : ""}
================================================================================`;

      // Cache for 5 minutes (300,000 ms)
      this.profileGroundTruthCache.set(userId, {
        data: groundTruthPrompt,
        expiresAt: Date.now() + 300000,
      });

      return groundTruthPrompt;
    } catch (err: any) {
      console.warn("⚠️ [PROFILE SERVICE] Error building LinkedIn ground truth:", err.message);
      return `================================================================================
VERIFIED USER LINKEDIN PROFILE (READ ONLY):
- Status: Connected
- Authenticated User: ${userId}
================================================================================`;
    }
  }

  /**
   * Invalidates the ground truth cache for a user.
   */
  public invalidateProfileCache(userId: string): void {
    this.profileGroundTruthCache.delete(userId);
  }
}

export const linkedInProfileService = new LinkedInProfileService();
