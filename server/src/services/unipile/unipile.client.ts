import "../../config/dotenv.config.js";
import { db } from "../../db/index.js";
import { systemSettings } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { decryptStoredSecret, encryptSecret } from "../../utils/crypto.util.js";

export class UnipileClient {
  private dsn: string;
  private apiKey: string;
  private lastSettingsFetch: number = 0;
  private cachedDynamicSettings: {
    dsn?: string | undefined;
    apiKey?: string | undefined;
  } | null = null;

  constructor() {
    let rawDsn = (process.env.UNIPILE_DSN || "").trim().replace(/\/$/, "");
    if (
      rawDsn &&
      !rawDsn.startsWith("http://") &&
      !rawDsn.startsWith("https://")
    ) {
      rawDsn = `https://${rawDsn}`;
    }
    this.dsn = rawDsn;
    this.apiKey = (process.env.UNIPILE_API_KEY || "").trim();
  }

  public async getActiveCredentials(): Promise<{
    dsn: string;
    apiKey: string;
  }> {
    const now = Date.now();
    if (this.cachedDynamicSettings && now - this.lastSettingsFetch < 10000) {
      return {
        dsn: this.cachedDynamicSettings.dsn || this.dsn,
        apiKey: this.cachedDynamicSettings.apiKey || this.apiKey,
      };
    }

    try {
      const rows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "unipile_dsn"));
      const [dsnRow] = rows;

      const [keyRow] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "unipile_api_key"));

      let dynamicDsn = dsnRow?.value
        ? dsnRow.value.trim().replace(/\/$/, "")
        : undefined;
      if (
        dynamicDsn &&
        !dynamicDsn.startsWith("http://") &&
        !dynamicDsn.startsWith("https://")
      ) {
        dynamicDsn = `https://${dynamicDsn}`;
      }
      if (dynamicDsn && process.env.NODE_ENV === "production") {
        const parsed = new URL(dynamicDsn);
        if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".unipile.com")) {
          throw new Error("Stored Unipile DSN is not an approved production endpoint.");
        }
      }

      const dynamicApiKey = decryptStoredSecret(keyRow?.value);
      if (keyRow?.value && !keyRow.value.startsWith("v2:") && dynamicApiKey) {
        await db.update(systemSettings).set({ value: encryptSecret(dynamicApiKey), updatedAt: new Date() })
          .where(eq(systemSettings.key, "unipile_api_key"));
      }

      this.cachedDynamicSettings = {
        dsn: dynamicDsn,
        apiKey: dynamicApiKey || undefined,
      };
      if (dynamicDsn) this.dsn = dynamicDsn;
      if (dynamicApiKey) this.apiKey = dynamicApiKey;
      this.lastSettingsFetch = now;
    } catch {}

    return {
      dsn: this.cachedDynamicSettings?.dsn || this.dsn,
      apiKey: this.cachedDynamicSettings?.apiKey || this.apiKey,
    };
  }

  public setCredentials(dsn?: string, apiKey?: string): void {
    if (dsn) {
      let cleanDsn = dsn.trim().replace(/\/$/, "");
      if (!cleanDsn.startsWith("http://") && !cleanDsn.startsWith("https://")) {
        cleanDsn = `https://${cleanDsn}`;
      }
      this.dsn = cleanDsn;
    }
    if (apiKey) {
      this.apiKey = apiKey.trim();
    }
    this.cachedDynamicSettings = {
      dsn: this.dsn,
      apiKey: this.apiKey,
    };
    this.lastSettingsFetch = Date.now();
  }

  public isConfigured(): boolean {
    return Boolean(
      (this.cachedDynamicSettings?.dsn || this.dsn) &&
      (this.cachedDynamicSettings?.apiKey || this.apiKey),
    );
  }

  public static extractStatus(unipileAcc: any): {
    isConnected: boolean;
    healthStatus:
      | "HEALTHY"
      | "RECONNECT_REQUIRED"
      | "CHALLENGED"
      | "DISCONNECTED";
  } {
    if (!unipileAcc) {
      return { isConnected: false, healthStatus: "DISCONNECTED" };
    }

    let rawStatus = "";
    if (Array.isArray(unipileAcc.sources) && unipileAcc.sources.length > 0) {
      const primary =
        unipileAcc.sources.find((s: any) => s.status) || unipileAcc.sources[0];
      rawStatus = (primary?.status || "").toString().toUpperCase();
    }

    if (!rawStatus && unipileAcc.status) {
      rawStatus = unipileAcc.status.toString().toUpperCase();
    }
    if (!rawStatus && unipileAcc.connection_status) {
      rawStatus = unipileAcc.connection_status.toString().toUpperCase();
    }

    if (!rawStatus && (unipileAcc.object === "Account" || unipileAcc.id)) {
      rawStatus = "OK";
    }

    if (
      rawStatus === "OK" ||
      rawStatus === "CONNECTED" ||
      rawStatus === "ACTIVE"
    ) {
      return { isConnected: true, healthStatus: "HEALTHY" };
    }
    if (
      rawStatus === "CHALLENGED" ||
      rawStatus === "CHECKPOINT" ||
      rawStatus === "RESTRICTED"
    ) {
      return { isConnected: false, healthStatus: "CHALLENGED" };
    }
    if (
      rawStatus === "RECONNECT_REQUIRED" ||
      rawStatus === "EXPIRED" ||
      rawStatus === "INVALID"
    ) {
      return { isConnected: false, healthStatus: "RECONNECT_REQUIRED" };
    }
    if (
      rawStatus === "DISCONNECTED" ||
      rawStatus === "DELETED" ||
      rawStatus === "ERROR"
    ) {
      return { isConnected: false, healthStatus: "DISCONNECTED" };
    }

    return { isConnected: true, healthStatus: "HEALTHY" };
  }

  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const creds = await this.getActiveCredentials();
    if (!creds.dsn || !creds.apiKey) {
      throw new Error(
        "Unipile is not configured. Please set UNIPILE_DSN and UNIPILE_API_KEY in server/.env or Admin Panel.",
      );
    }

    const url = `${creds.dsn}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      "X-API-KEY": creds.apiKey,
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMsg = errorBody;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMsg =
          errorJson.detail ||
          errorJson.message ||
          errorJson.title ||
          errorJson.error ||
          errorBody;
      } catch {}
      throw new Error(`Unipile error (${response.status}): ${errorMsg}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Sends a message directly into an existing chat thread.
   * Reference: https://developer.unipile.com/docs/send-messages
   */
  public async sendChatMessage(
    chatId: string,
    text: string,
    accountId?: string,
  ): Promise<any> {
    const payload: Record<string, any> = { text };
    if (accountId) {
      payload.account_id = accountId;
    }
    return this.request<any>(`/api/v1/chats/${chatId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  public async connectWithCredentials(
    username: string,
    password: string,
    options?: {
      country?: string | undefined;
      ip?: string | undefined;
      userAgent?: string | undefined;
    },
  ): Promise<any> {
    const creds = await this.getActiveCredentials();
    if (!creds.dsn || !creds.apiKey) {
      throw new Error(
        "Unipile is not configured. Please set UNIPILE_DSN and UNIPILE_API_KEY in server/.env or Admin Panel.",
      );
    }

    const payload: any = {
      provider: "LINKEDIN",
      username,
      password,
    };
    if (options?.country) payload.country = options.country;
    if (options?.ip) payload.ip = options.ip;
    if (options?.userAgent) payload.user_agent = options.userAgent;

    return this.request<any>("/api/v1/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  public async connectWithCookie(
    accessToken: string,
    options?: {
      premiumToken?: string | undefined;
      userAgent?: string | undefined;
      country?: string | undefined;
      ip?: string | undefined;
    },
  ): Promise<any> {
    const creds = await this.getActiveCredentials();
    if (!creds.dsn || !creds.apiKey) {
      throw new Error(
        "Unipile is not configured. Please set UNIPILE_DSN and UNIPILE_API_KEY in server/.env or Admin Panel.",
      );
    }

    const payload: any = {
      provider: "LINKEDIN",
      access_token: accessToken,
    };
    if (options?.premiumToken) payload.premium_token = options.premiumToken;
    if (options?.userAgent) payload.user_agent = options.userAgent;
    if (options?.country) payload.country = options.country;
    if (options?.ip) payload.ip = options.ip;

    return this.request<any>("/api/v1/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  public async solveCheckpoint(accountId: string, code: string): Promise<any> {
    const creds = await this.getActiveCredentials();
    if (!creds.dsn || !creds.apiKey) {
      throw new Error("Unipile is not configured in server/.env or Admin Panel.");
    }

    return this.request<any>("/api/v1/accounts/checkpoint", {
      method: "POST",
      body: JSON.stringify({
        provider: "LINKEDIN",
        account_id: accountId,
        code,
      }),
    });
  }

  public async resendCheckpoint(accountId: string): Promise<any> {
    const creds = await this.getActiveCredentials();
    if (!creds.dsn || !creds.apiKey) {
      throw new Error("Unipile is not configured in server/.env or Admin Panel.");
    }

    return this.request<any>("/api/v1/accounts/checkpoint/resend", {
      method: "POST",
      body: JSON.stringify({
        provider: "LINKEDIN",
        account_id: accountId,
      }),
    });
  }

  public async createHostedAuthLink(params?: {
    successRedirectUrl?: string;
    failureRedirectUrl?: string;
    notifyUrl?: string;
  }): Promise<{ url: string }> {
    const creds = await this.getActiveCredentials();
    if (!creds.dsn || !creds.apiKey) {
      throw new Error(
        "Unipile is not configured. Please set UNIPILE_DSN and UNIPILE_API_KEY in server/.env or Admin Panel.",
      );
    }

    const clientBase = (
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.CLIENT_URL ||
      "http://localhost:3000"
    )
      .split(",")[0]!
      .trim()
      .replace(/\/+$/, "");

    const expiresOn = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    return this.request<{ url: string }>("/api/v1/hosted/accounts/link", {
      method: "POST",
      body: JSON.stringify({
        type: "create",
        providers: ["LINKEDIN"],
        api_url: creds.dsn,
        expiresOn,
        success_redirect_url:
          params?.successRedirectUrl ||
          `${clientBase}/linkedin/callback?status=success`,
        failure_redirect_url:
          params?.failureRedirectUrl ||
          `${clientBase}/linkedin/callback?status=error`,
        notify_url: params?.notifyUrl,
      }),
    });
  }

  public async getAccount(accountId: string): Promise<any> {
    const creds = await this.getActiveCredentials();
    if (!creds.dsn || !creds.apiKey) {
      throw new Error("Unipile is not configured in server/.env or Admin Panel.");
    }

    return this.request(`/api/v1/accounts/${accountId}`);
  }

  public async listAccounts(): Promise<any[]> {
    const creds = await this.getActiveCredentials();
    if (!creds.dsn || !creds.apiKey) {
      return [];
    }

    const res = await this.request<{ items: any[] }>("/api/v1/accounts");
    return res.items || [];
  }

  public async disconnectAccount(accountId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return true;
    }

    await this.request(`/api/v1/accounts/${accountId}`, {
      method: "DELETE",
    });
    return true;
  }

  public async getLinkedInAccount(
    preferredAccountId?: string | undefined,
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }

    if (preferredAccountId && preferredAccountId.trim()) {
      const cleanId = preferredAccountId.trim();
      const account = await this.getAccount(cleanId);
      if (account) return account;
      throw new Error(`LinkedIn account '${cleanId}' not found in Unipile.`);
    }

    throw new Error(
      "No connected LinkedIn account specified. Please connect your LinkedIn account first.",
    );
  }

  public async getProfile(
    accountId: string,
    identifier: string,
    linkedinSections: string = "*",
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }

    let cleanId = identifier.trim();
    if (cleanId.includes("linkedin.com/in/")) {
      const parts = cleanId
        .split("linkedin.com/in/")[1]
        ?.split("/")[0]
        ?.split("?")[0];
      if (parts) cleanId = parts;
    }

    const query = new URLSearchParams({
      account_id: accountId,
      linkedin_sections: linkedinSections,
    });

    return this.request<any>(
      `/api/v1/users/${encodeURIComponent(cleanId)}?${query.toString()}`,
    );
  }

  public async searchLinkedIn(
    accountId: string,
    options: {
      keywords?: string | undefined;
      url?: string | undefined;
      limit?: number | undefined;
      cursor?: string | undefined;
      networkDepth?: "F" | "S" | "O" | undefined;
    },
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }

    const limit = options.limit || 10;
    const queryParams = new URLSearchParams({
      account_id: accountId,
      limit: String(limit),
    });
    if (options.cursor) {
      queryParams.append("cursor", options.cursor);
    }

    try {
      const bodyPayload: any = options.url
        ? { url: options.url }
        : {
            api: "classic",
            category: "people",
            keywords: options.keywords || "",
          };

      if (options.networkDepth) {
        bodyPayload.network_depth = options.networkDepth;
      }

      const result = await this.request<any>(
        `/api/v1/linkedin/search?${queryParams.toString()}`,
        {
          method: "POST",
          body: JSON.stringify(bodyPayload),
        },
      );
      if (result) return result;
    } catch {}

    const fallbackParams = new URLSearchParams({
      account_id: accountId,
      query: options.keywords || "",
      limit: String(limit),
    });
    return this.request<any>(
      `/api/v1/users/search?${fallbackParams.toString()}`,
    );
  }

  public async sendConnectionRequest(
    accountId: string,
    providerId: string,
    message?: string | undefined,
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }

    const payload: any = {
      account_id: accountId,
      provider_id: providerId,
    };

    if (message && message.trim()) {
      payload.message = message.trim();
    }

    return this.request<any>("/api/v1/users/invite", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  public async cancelSentInvitation(
    invitationId: string,
    accountId?: string,
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }
    const query = accountId
      ? `?account_id=${encodeURIComponent(accountId)}`
      : "";
    try {
      return await this.request<any>(
        `/api/v1/users/invite/sent/${invitationId}${query}`,
        {
          method: "DELETE",
        },
      );
    } catch {
      return this.request<any>(
        `/api/v1/users/invitations/sent/${invitationId}${query}`,
        {
          method: "DELETE",
        },
      );
    }
  }

  public async getSentInvitations(
    accountId?: string,
    limit = 50,
    cursor?: string,
  ): Promise<any> {
    if (!this.isConfigured()) return { items: [] };
    const query = new URLSearchParams();
    if (accountId) query.set("account_id", accountId);
    if (limit) query.set("limit", String(limit));
    if (cursor) query.set("cursor", cursor);
    try {
      return await this.request<any>(
        `/api/v1/users/invite/sent?${query.toString()}`,
      );
    } catch (err: any) {
      return this.request<any>(
        `/api/v1/users/invitations/sent?${query.toString()}`,
      );
    }
  }

  public async getReceivedInvitations(
    accountId?: string,
    limit = 50,
    cursor?: string,
  ): Promise<any> {
    if (!this.isConfigured()) return { items: [] };
    const query = new URLSearchParams();
    if (accountId) query.set("account_id", accountId);
    query.set("status", "PENDING");
    if (limit) query.set("limit", String(limit));
    if (cursor) query.set("cursor", cursor);
    try {
      return await this.request<any>(
        `/api/v1/users/relations?${query.toString()}`,
      );
    } catch (err: any) {
      return this.request<any>(
        `/api/v1/users/invitations/received?${query.toString()}`,
      );
    }
  }

  public async sendRichMessage(params: {
    accountId?: string | undefined;
    recipientId: string;
    text?: string | undefined;
    attachments?:
      | Array<{ url?: string; name?: string; type?: string; data?: string }>
      | undefined;
    voiceNoteUrl?: string | undefined;
  }): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }
    const payload: any = {
      attendees_ids: [params.recipientId],
      text: params.text || "",
    };
    if (params.accountId) payload.account_id = params.accountId;
    if (params.attachments && params.attachments.length > 0) {
      payload.attachments = params.attachments;
    }
    if (params.voiceNoteUrl) {
      payload.attachments = payload.attachments || [];
      payload.attachments.push({
        url: params.voiceNoteUrl,
        type: "audio/mp4",
        name: "voice_note.mp4",
      });
    }
    return this.request<any>("/api/v1/chats", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  public async markChatRead(
    chatId: string,
    unread: boolean = false,
  ): Promise<any> {
    if (!this.isConfigured()) return;
    return this.request<any>(`/api/v1/chats/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify({ unread }),
    });
  }

  public async createPost(
    accountId: string,
    text: string,
    attachments?: any[],
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }
    return this.request<any>("/api/v1/posts", {
      method: "POST",
      body: JSON.stringify({
        account_id: accountId,
        text,
        attachments,
      }),
    });
  }

  public async deletePost(postId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }
    return this.request<any>(`/api/v1/posts/${postId}`, {
      method: "DELETE",
    });
  }

  public async getCompany(
    identifier: string,
    accountId?: string,
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }
    const query = new URLSearchParams();
    if (accountId) query.set("account_id", accountId);
    return this.request<any>(
      `/api/v1/companies/${encodeURIComponent(identifier)}?${query.toString()}`,
    );
  }

  public async searchCompanies(
    accountId: string,
    options: { keywords?: string | undefined; limit?: number | undefined },
  ): Promise<any> {
    if (!this.isConfigured()) return { items: [] };
    const query = new URLSearchParams();
    query.set("account_id", accountId);
    if (options.keywords) query.set("keywords", options.keywords);
    if (options.limit) query.set("limit", String(options.limit));
    return this.request<any>(`/api/v1/companies/search?${query.toString()}`);
  }

  public async searchJobs(
    accountId: string,
    options: {
      keywords?: string | undefined;
      location?: string | undefined;
      limit?: number | undefined;
    },
  ): Promise<any> {
    if (!this.isConfigured()) return { items: [] };
    const query = new URLSearchParams();
    query.set("account_id", accountId);
    if (options.keywords) query.set("keywords", options.keywords);
    if (options.location) query.set("location", options.location);
    if (options.limit) query.set("limit", String(options.limit));
    return this.request<any>(`/api/v1/jobs/search?${query.toString()}`);
  }

  public async getJob(jobId: string, accountId?: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }
    const query = new URLSearchParams();
    if (accountId) query.set("account_id", accountId);
    return this.request<any>(
      `/api/v1/jobs/${encodeURIComponent(jobId)}?${query.toString()}`,
    );
  }

  /**
   * Fetches the user's actual 1st-degree LinkedIn connections (relations).
   * Returns an array of connection objects with member_urn (provider_id), names, headlines.
   */
  public async getConnections(
    accountId: string,
    limit = 50,
    cursor?: string,
    filters?: { keywords?: string; location?: string; company?: string; role?: string },
  ): Promise<{ items: any[]; cursor?: string | undefined }> {
    if (!this.isConfigured()) return { items: [] };
    const query = new URLSearchParams({ account_id: accountId, limit: String(limit) });
    if (cursor) query.set("cursor", cursor);

    let items: any[] = [];
    try {
      const res = await this.request<any>(`/api/v1/users/relations?${query.toString()}`);
      items = res.items || [];
      cursor = res.cursor;
    } catch {
      return { items: [] };
    }

    // Client-side filtering
    if (filters) {
      const { keywords, location, company, role } = filters;
      const kw = (keywords || "").toLowerCase();
      const loc = (location || "").toLowerCase();
      const co = (company || "").toLowerCase();
      const ro = (role || "").toLowerCase();
      items = items.filter((c: any) => {
        const headline = (c.headline || "").toLowerCase();
        const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
        if (kw && !headline.includes(kw) && !name.includes(kw)) return false;
        if (ro && !headline.includes(ro)) return false;
        if (loc && !headline.includes(loc) && !(c.location || "").toLowerCase().includes(loc)) return false;
        if (co && !headline.includes(co) && !(c.company || "").toLowerCase().includes(co)) return false;
        return true;
      });
    }

    return { items, cursor };
  }

  public async listWebhooks(): Promise<any[]> {
    if (!this.isConfigured()) return [];
    const res = await this.request<any>("/api/v1/webhooks");
    return res.items || [];
  }

  public async createWebhook(
    targetUrl: string,
    events: string[],
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Unipile is not configured in server/.env");
    }
    return this.request<any>("/api/v1/webhooks", {
      method: "POST",
      body: JSON.stringify({
        url: targetUrl,
        events,
      }),
    });
  }
}

export const unipileClient = new UnipileClient();

export function isUnipileAccountConnected(acc: any): boolean {
  if (!acc) return false;

  const directStatus = String(
    acc.status || acc.connection_status || "",
  ).toUpperCase();
  if (
    directStatus === "OK" ||
    directStatus === "CONNECTED" ||
    directStatus === "ACTIVE"
  ) {
    return true;
  }

  if (Array.isArray(acc.sources) && acc.sources.length > 0) {
    const hasActiveSource = acc.sources.some((s: any) => {
      const st = String(s?.status || "").toUpperCase();
      return st === "OK" || st === "CONNECTED" || st === "ACTIVE";
    });
    if (hasActiveSource) return true;
  }

  if (acc.object === "Account" && (acc.id || acc.account_id)) {
    if (
      acc.checkpoint ||
      acc.error ||
      directStatus === "CHALLENGED" ||
      directStatus === "RESTRICTED"
    ) {
      return false;
    }
    if (Array.isArray(acc.sources) && acc.sources.length > 0) {
      const allErrored = acc.sources.every((s: any) => {
        const st = String(s?.status || "").toUpperCase();
        return (
          st === "ERROR" ||
          st === "STOPPED" ||
          st === "CHALLENGED" ||
          st === "DELETED"
        );
      });
      if (allErrored) return false;
    }
    return true;
  }

  return false;
}
