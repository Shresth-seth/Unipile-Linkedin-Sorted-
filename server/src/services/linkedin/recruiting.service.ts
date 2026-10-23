import { unipileClient } from "../unipile/unipile.client.js";

export class LinkedInRecruitingService {
  /**
   * Helper to resolve an active LinkedIn account ID.
   */
  private async resolveAccountId(
    preferredAccountId?: string | undefined,
  ): Promise<string> {
    if (preferredAccountId && preferredAccountId.trim()) {
      return preferredAccountId.trim();
    }
    throw new Error(
      "No active LinkedIn account connected. Please connect your LinkedIn account to search jobs.",
    );
  }

  /**
   * Searches LinkedIn for jobs with keyword and location filters.
   */
  public async searchJobs(options: {
    keywords?: string | undefined;
    location?: string | undefined;
    limit?: number | undefined;
    accountId?: string | undefined;
  }): Promise<any[]> {
    if (!unipileClient.isConfigured()) return [];

    try {
      const accountId = await this.resolveAccountId(options.accountId);
      const res = await unipileClient.searchJobs(accountId, {
        keywords: options.keywords,
        location: options.location,
        limit: options.limit || 15,
      });
      return res.items || (Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn("Job search error:", err);
      return [];
    }
  }

  /**
   * Retrieves full details for a LinkedIn job posting.
   */
  public async getJobDetails(
    jobId: string,
    preferredAccountId?: string | undefined,
  ): Promise<any> {
    if (!unipileClient.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }
    const accountId = await this.resolveAccountId(preferredAccountId);
    return unipileClient.getJob(jobId, accountId);
  }
}

export const linkedInRecruitingService = new LinkedInRecruitingService();
