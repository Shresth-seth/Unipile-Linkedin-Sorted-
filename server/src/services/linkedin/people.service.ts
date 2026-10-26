import { unipileClient } from "../unipile/unipile.client.js";
import { db } from "../../db/index.js";
import { linkedinAccounts } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import {
  Person,
  ProfileDetails,
  SearchFilters,
  SearchPeopleResult,
} from "../../types/linkedin.types.js";

export class LinkedInPeopleService {
  /**
   * Helper to resolve an active LinkedIn account ID from parameters or database.
   */
  private async resolveAccountId(
    preferredAccountId?: string | undefined,
    userId?: string | undefined,
  ): Promise<string> {
    if (preferredAccountId && preferredAccountId.trim()) {
      const cleanPref = preferredAccountId.trim();
      if (userId) {
        const [acc] = await db
          .select({ unipileAccountId: linkedinAccounts.unipileAccountId })
          .from(linkedinAccounts)
          .where(
            and(
              eq(linkedinAccounts.userId, userId),
              eq(linkedinAccounts.unipileAccountId, cleanPref),
              eq(linkedinAccounts.isConnected, true),
            ),
          )
          .limit(1);
        if (acc?.unipileAccountId) {
          return acc.unipileAccountId;
        }
        throw new Error("The requested LinkedIn account does not belong to this user or is not connected.");
      }
      return cleanPref;
    }

    if (userId) {
      const [acc] = await db
        .select({
          unipileAccountId: linkedinAccounts.unipileAccountId,
          healthStatus: linkedinAccounts.healthStatus,
        })
        .from(linkedinAccounts)
        .where(
          and(
            eq(linkedinAccounts.userId, userId),
            eq(linkedinAccounts.isConnected, true),
          ),
        )
        .limit(1);
      if (acc?.unipileAccountId && acc.healthStatus !== "DISCONNECTED") {
        return acc.unipileAccountId;
      }
    }

    throw new Error(
      "No active LinkedIn account connected. Please connect your LinkedIn account to search or view profiles.",
    );
  }

  /**
   * Search for people on LinkedIn with live transparency metadata.
   */
  public async searchPeopleWithMetadata(
    filters: SearchFilters,
    preferredAccountId?: string | undefined,
  ): Promise<SearchPeopleResult> {
    if (!unipileClient.isConfigured()) {
      return {
        isLive: false,
        source: "LIVE_LINKEDIN",
        notice:
          "Unipile is not configured in server/.env. Please set UNIPILE_DSN and UNIPILE_API_KEY.",
        results: [],
      };
    }

    try {
      const accountId = await this.resolveAccountId(
        filters.accountId || preferredAccountId,
        filters.userId,
      );
      const keywords = filters.keywords || filters.query || filters.role || "";

      const res = await unipileClient.searchLinkedIn(accountId, {
        keywords: keywords || undefined,
        url: filters.url || undefined,
        limit: filters.limit || 10,
        cursor: filters.cursor || undefined,
        networkDepth: filters.networkDepth || undefined,
      });

      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      const liveResults: Person[] = items.map((item: any) => {
        const firstName = item.first_name || "";
        const lastName = item.last_name || "";
        const fullName =
          `${firstName} ${lastName}`.trim() || item.name || "LinkedIn Member";
        const publicId =
          item.public_identifier || item.publicIdentifier || item.id;
        const providerId =
          item.provider_id || item.providerId || item.id || publicId;

        return {
          name: fullName,
          linkedin_id: providerId,
          profile_url:
            item.public_profile_url ||
            item.profile_url ||
            (publicId
              ? `https://www.linkedin.com/in/${publicId}`
              : `https://www.linkedin.com/in/${providerId}`),
          company: item.company || item.current_company || "Professional",
          designation:
            item.headline ||
            item.title ||
            item.designation ||
            "LinkedIn Member",
          location: item.location || "Not specified",
          industry: item.industry || "General",
        };
      });

      return {
        isLive: true,
        source: "LIVE_LINKEDIN",
        results: liveResults,
      };
    } catch (err: any) {
      return {
        isLive: false,
        source: "LIVE_LINKEDIN",
        notice:
          err.message || "Failed to search LinkedIn profiles via Unipile API",
        results: [],
      };
    }
  }

  /**
   * Search for people on LinkedIn by title, location, company, or keywords.
   */
  public async searchPeople(
    filters: SearchFilters,
    preferredAccountId?: string | undefined,
    userId?: string | undefined,
  ): Promise<Person[]> {
    const searchResult = await this.searchPeopleWithMetadata(
      { ...filters, ...(userId ? { userId } : {}) },
      preferredAccountId,
    );
    if (
      !searchResult.isLive &&
      searchResult.notice?.includes("No active LinkedIn account")
    ) {
      throw new Error(searchResult.notice);
    }
    return searchResult.results;
  }

  /**
   * Retrieves summary profile of a person by public identifier, URL, or provider ID.
   * Matches Unipile GET /api/v1/users/{identifier}?account_id={accountId}
   */
  public async getProfile(
    identifier: string,
    preferredAccountId?: string | undefined,
    userId?: string | undefined,
  ): Promise<Person & { provider_id: string; public_identifier?: string }> {
    if (!unipileClient.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }

    const accountId = await this.resolveAccountId(preferredAccountId, userId);
    const item = await unipileClient.getProfile(accountId, identifier, "*");

    if (!item) {
      throw new Error(`Profile not found for identifier: ${identifier}`);
    }

    const firstName = item.first_name || "";
    const lastName = item.last_name || "";
    const fullName =
      `${firstName} ${lastName}`.trim() || item.name || "LinkedIn Member";
    const publicId = item.public_identifier || item.publicIdentifier;
    const providerId = item.provider_id || item.providerId || item.id;

    return {
      name: fullName,
      linkedin_id: providerId,
      provider_id: providerId,
      public_identifier: publicId,
      profile_url:
        item.public_profile_url ||
        (publicId
          ? `https://www.linkedin.com/in/${publicId}`
          : `https://www.linkedin.com/in/${providerId}`),
      company: item.company || item.current_company || "Unknown",
      designation: item.headline || item.title || "Professional",
      location: item.location || "Not specified",
      industry: item.industry || "General",
    };
  }

  /**
   * Retrieves full profile details (experience, about section, follower counts, skills).
   */
  public async getProfileDetails(
    identifier: string,
    preferredAccountId?: string | undefined,
  ): Promise<
    ProfileDetails & { provider_id: string; public_identifier?: string }
  > {
    if (!unipileClient.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }

    const accountId = await this.resolveAccountId(preferredAccountId);
    const item = await unipileClient.getProfile(accountId, identifier, "*");

    if (!item) {
      throw new Error(`Profile details not found for: ${identifier}`);
    }

    const firstName = item.first_name || "";
    const lastName = item.last_name || "";
    const fullName =
      `${firstName} ${lastName}`.trim() || item.name || "LinkedIn Member";
    const publicId = item.public_identifier || item.publicIdentifier;
    const providerId = item.provider_id || item.providerId || item.id;

    return {
      name: fullName,
      linkedin_id: providerId,
      provider_id: providerId,
      public_identifier: publicId,
      profile_url:
        item.public_profile_url ||
        (publicId
          ? `https://www.linkedin.com/in/${publicId}`
          : `https://www.linkedin.com/in/${providerId}`),
      company: item.company || item.current_company || "Unknown",
      designation: item.headline || item.title || "Professional",
      location: item.location || "Not specified",
      industry: item.industry || "General",
      headline: item.headline,
      about: item.summary || item.about,
      follower_count: item.follower_count,
      connection_count: item.connections_count ?? item.connection_count,
      skills: Array.isArray(item.skills)
        ? item.skills.map((s: any) =>
            typeof s === "string" ? s : s.name || "",
          )
        : [],
      experience: Array.isArray(item.experience)
        ? item.experience.map((e: any) => ({
            title: e.title || e.role || "",
            company: e.company || e.company_name || "",
            duration: e.duration || "",
            description: e.description || "",
          }))
        : [],
    };
  }

  /**
   * Retrieves company profile by LinkedIn identifier or vanity URL name.
   */
  public async getCompanyProfile(
    identifier: string,
    preferredAccountId?: string,
  ): Promise<any> {
    if (!unipileClient.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }
    const accountId = await this.resolveAccountId(preferredAccountId);
    return unipileClient.getCompany(identifier, accountId);
  }

  /**
   * Searches LinkedIn company directory.
   */
  public async searchCompanies(
    keywords: string,
    preferredAccountId?: string,
    limit = 10,
  ): Promise<any[]> {
    if (!unipileClient.isConfigured()) return [];
    try {
      const accountId = await this.resolveAccountId(preferredAccountId);
      const res = await unipileClient.searchCompanies(accountId, {
        keywords,
        limit,
      });
      return res.items || (Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.warn(`LinkedIn company search failed: ${err.message || err}`);
      return [];
    }
  }
}

export const linkedInPeopleService = new LinkedInPeopleService();
