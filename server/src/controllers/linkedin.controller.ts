import { Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { linkedinAccounts } from "../db/schema.js";
import {
  unipileClient,
  isUnipileAccountConnected,
} from "../services/unipile/unipile.client.js";
import { linkedInAccountService } from "../services/linkedin/account.service.js";
import { linkedInPeopleService } from "../services/linkedin/people.service.js";
import { linkedInConnectionService } from "../services/linkedin/connection.service.js";
import { linkedInMessageService } from "../services/linkedin/message.service.js";
import { linkedInPostService } from "../services/linkedin/post.service.js";
import { linkedInProfileService } from "../services/linkedin/profile.service.js";
import { linkedInRecruitingService } from "../services/linkedin/recruiting.service.js";
import { handleUnipileWebhook } from "./webhook.controller.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { resolveUserId } from "../utils/resolve-user.js";
import { SearchFilters } from "../types/linkedin.types.js";
import { inboundSyncService } from "../services/linkedin/inbound-sync.service.js";
import { safeErrorMessage } from "../utils/error.util.js";

export function validateRedirectUrl(url?: string): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const clean = url.trim();
  // Safe relative paths (e.g., /dashboard, /settings, /callback) - must start with / and not // or \
  if (clean.startsWith("/") && !clean.startsWith("//") && !clean.includes("\\")) {
    return clean;
  }
  try {
    const parsed = new URL(clean);
    const rawClientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const allowed = rawClientUrl
      .split(",")
      .map((u) => u.trim().replace(/\/+$/, ""))
      .filter(Boolean);
    if (allowed.includes(parsed.origin)) {
      return clean;
    }
    if (
      process.env.NODE_ENV !== "production" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return clean;
    }
  } catch {}
  return undefined;
}

/**
 * Strict Security Guardrail: Resolves the Unipile account ID belonging exclusively
 * to the authenticated user, preventing cross-tenant account leakage or hijacking.
 */
const resolveUserUnipileAccountId = async (
  userId: string,
): Promise<string | undefined> => {
  if (!userId) return undefined;
  const accounts = await db
    .select()
    .from(linkedinAccounts)
    .where(eq(linkedinAccounts.userId, userId));

  if (!accounts || accounts.length === 0) return undefined;

  // 1. Prefer healthy connected account
  const healthy = accounts.find(
    (a) => a.unipileAccountId && a.isConnected && a.healthStatus === "HEALTHY",
  );
  if (healthy?.unipileAccountId) return healthy.unipileAccountId;

  // 2. Fallback to connected account with non-disconnected status
  const connected = accounts.find(
    (a) => a.unipileAccountId && a.isConnected && a.healthStatus !== "DISCONNECTED",
  );
  if (connected?.unipileAccountId) return connected.unipileAccountId;

  // 3. Fallback to any account with a valid unipileAccountId
  const anyAccount = accounts.find(
    (a) => a.unipileAccountId && a.unipileAccountId.trim().length > 0,
  );
  return anyAccount?.unipileAccountId || undefined;
};

export const getConnectLink = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const rawRedirect = req.query.redirect as string | undefined;
    let validatedRedirect: string | undefined = undefined;
    if (rawRedirect) {
      validatedRedirect = validateRedirectUrl(rawRedirect);
      if (!validatedRedirect) {
        res.status(400).json({
          success: false,
          message: "Invalid or unauthorized redirect URL.",
        });
        return;
      }
    }

    const link = await linkedInAccountService.generateAuthLink(
      userId,
      validatedRedirect,
    );

    // If request accepts html or called directly via browser navigation, redirect directly
    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      res.redirect(link.url);
      return;
    }

    res.status(200).json({
      success: true,
      url: link.url,
      message:
        "Open this link in browser to authenticate your LinkedIn account via Unipile.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to generate LinkedIn connect link."),
    });
  }
};

export const getAccountStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const status = await linkedInAccountService.getAccountStatus(userId);
    res.status(200).json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getConnectedLinkedInAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const activeAccountId = await resolveUserUnipileAccountId(userId);
    if (!activeAccountId) {
      res.status(404).json({
        success: false,
        message: "No connected LinkedIn account found for this user.",
      });
      return;
    }

    const account = await unipileClient.getLinkedInAccount(activeAccountId);
    const isConn = isUnipileAccountConnected(account);
    res.status(200).json({
      success: true,
      data: {
        id: account.id,
        name:
          account.name ||
          account.account_name ||
          account.connection_params?.im?.username ||
          "LinkedIn User",
        type: account.type ?? account.provider,
        provider: account.provider ?? account.type,
        status: isConn ? "OK" : account.status || "DISCONNECTED",
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const rawIdentifier = (req.params.identifier ||
      req.query.identifier) as string;
    const identifier = Array.isArray(rawIdentifier)
      ? rawIdentifier[0]!
      : rawIdentifier;
    const activeAccountId = await resolveUserUnipileAccountId(userId);

    if (!activeAccountId) {
      res.status(400).json({
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account first.",
      });
      return;
    }

    if (!identifier || !identifier.trim()) {
      res.status(400).json({
        success: false,
        message:
          "LinkedIn profile identifier, public URL, or provider_id is required.",
      });
      return;
    }

    const profile = await linkedInPeopleService.getProfile(
      identifier.trim(),
      activeAccountId,
    );
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getOwnProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        connected: false,
        message: "Authentication required.",
      });
      return;
    }

    const activeAccountId = await resolveUserUnipileAccountId(userId);
    if (!activeAccountId) {
      res.status(200).json({
        success: false,
        connected: false,
        message:
          "No connected LinkedIn account found. Please connect your LinkedIn account.",
      });
      return;
    }

    const profile = await linkedInProfileService.getOwnProfile(activeAccountId);
    res.status(200).json({
      success: true,
      connected: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(200).json({
      success: false,
      connected: false,
      message: error.message || "Failed to fetch LinkedIn profile.",
    });
  }
};

export const searchPeople = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const activeAccountId = await resolveUserUnipileAccountId(userId);
    if (!activeAccountId) {
      res.status(200).json({
        success: true,
        isLive: false,
        source: "DISCONNECTED",
        notice:
          "No active LinkedIn account connected. Cookies or session may be purged. Please connect your account in Settings.",
        count: 0,
        data: [],
      });
      return;
    }
    const {
      query,
      keywords,
      role,
      location,
      company,
      industry,
      limit,
      url,
      cursor,
    } = req.query;
    const filters: SearchFilters = {
      query: query ? String(query) : undefined,
      keywords: keywords || query ? String(keywords || query) : undefined,
      role: role ? String(role) : undefined,
      location: location ? String(location) : undefined,
      company: company ? String(company) : undefined,
      industry: industry ? String(industry) : undefined,
      limit: limit ? Number(limit) : 10,
      url: url ? String(url) : undefined,
      accountId: activeAccountId,
      cursor: cursor ? String(cursor) : undefined,
    };

    const searchResult = await linkedInPeopleService.searchPeopleWithMetadata(
      filters,
      activeAccountId,
    );
    res.status(200).json({
      success: true,
      isLive: searchResult.isLive,
      source: searchResult.source,
      notice: searchResult.notice,
      count: searchResult.results.length,
      data: searchResult.results,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendConnection = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const {
      person,
      provider_id,
      providerId,
      identifier,
      publicIdentifier,
      url,
      note,
      message,
    } = req.body;
    const target =
      person ||
      provider_id ||
      providerId ||
      identifier ||
      publicIdentifier ||
      url;

    if (!target) {
      res.status(400).json({
        success: false,
        message:
          "Target recipient is required (provide provider_id, public identifier, profile URL, or person object).",
      });
      return;
    }

    const invitationMessage =
      message || note ? String(message || note) : undefined;
    const activeAccountId = await resolveUserUnipileAccountId(userId);
    if (!activeAccountId) {
      res.status(400).json({
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account first.",
      });
      return;
    }

    const result = await linkedInConnectionService.sendConnectionRequest(
      target,
      invitationMessage,
      activeAccountId,
    );
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const { chatId, recipientId, message } = req.body;
    if (!message || (!recipientId && !chatId)) {
      res.status(400).json({
        success: false,
        message: "chatId or recipientId, and message are required.",
      });
      return;
    }

    const activeAccountId = await resolveUserUnipileAccountId(userId);
    if (!activeAccountId) {
      res.status(400).json({
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account first.",
      });
      return;
    }

    const targetId = recipientId || chatId;
    const result = await linkedInMessageService.sendMessage(
      targetId,
      message,
      activeAccountId,
      userId,
      chatId,
    );
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reactToPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const { postId, reactionType } = req.body;
    if (!postId) {
      res.status(400).json({ success: false, message: "postId is required." });
      return;
    }

    const activeAccountId = await resolveUserUnipileAccountId(userId);
    if (!activeAccountId) {
      res.status(400).json({
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account first.",
      });
      return;
    }
    const result = await linkedInPostService.reactToPost(
      postId,
      reactionType,
      activeAccountId,
    );
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const commentOnPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const { postId, comment } = req.body;
    if (!postId || !comment) {
      res
        .status(400)
        .json({ success: false, message: "postId and comment are required." });
      return;
    }

    const activeAccountId = await resolveUserUnipileAccountId(userId);
    if (!activeAccountId) {
      res.status(400).json({
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account first.",
      });
      return;
    }
    const result = await linkedInPostService.commentOnPost(
      postId,
      comment,
      activeAccountId,
    );
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const disconnectAccount = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    await linkedInAccountService.disconnect(userId);
    res.status(200).json({
      success: true,
      message: "LinkedIn account disconnected successfully.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const purgeLinkedInCookies = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    await linkedInAccountService.deleteLinkedInLoginAndCookies(userId);
    res.status(200).json({
      success: true,
      message:
        "LinkedIn login, saved cookies, and credentials deleted permanently from database.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteLinkedInLogin = purgeLinkedInCookies;

export const syncConnectedAccount = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated or identified.",
      });
      return;
    }
    const { accountId } = req.body;
    const unipileAccountId =
      accountId || (req.query.accountId as string) || undefined;
    const synced = await linkedInAccountService.syncAccount(
      userId,
      unipileAccountId,
    );
    res.status(200).json({
      success: true,
      message: "LinkedIn account synchronized successfully.",
      data: synced,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const connectWithCredentials = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const { username, password, country, userAgent } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message:
          "Both LinkedIn username (email/phone) and password are required.",
      });
      return;
    }

    const result = await linkedInAccountService.connectWithCredentials(
      userId,
      username.trim(),
      password,
      {
        country: country ? String(country).trim().toUpperCase() : undefined,
        userAgent: userAgent || req.headers["user-agent"],
      },
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to authenticate LinkedIn credentials via Unipile.",
    });
  }
};

export const connectWithCookie = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const { li_at, li_a, country, userAgent } = req.body;

    if (!li_at || !li_at.trim()) {
      res.status(400).json({
        success: false,
        message: "LinkedIn session cookie 'li_at' is required.",
      });
      return;
    }

    const result = await linkedInAccountService.connectWithCookie(
      userId,
      li_at.trim(),
      {
        premiumToken: li_a ? String(li_a).trim() : undefined,
        userAgent: userAgent || req.headers["user-agent"],
        country: country ? String(country).trim().toUpperCase() : undefined,
      },
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to authenticate LinkedIn session cookie via Unipile.",
    });
  }
};

export const solveCheckpoint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const { accountId, code } = req.body;

    if (!accountId || !code) {
      res.status(400).json({
        success: false,
        message: "Both accountId and verification code are required.",
      });
      return;
    }

    // Strict Tenant Validation: Ensure this LinkedIn account belongs to the authenticated user
    const [ownedAccount] = await db
      .select()
      .from(linkedinAccounts)
      .where(
        and(
          eq(linkedinAccounts.unipileAccountId, accountId.trim()),
          eq(linkedinAccounts.userId, userId),
        ),
      )
      .limit(1);

    if (!ownedAccount) {
      res.status(404).json({
        success: false,
        message: "LinkedIn account not found or access denied.",
      });
      return;
    }

    const result = await linkedInAccountService.solveCheckpoint(
      userId,
      accountId.trim(),
      code.trim(),
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message:
        error.message || "Failed to verify checkpoint solution with LinkedIn.",
    });
  }
};

export const resendCheckpoint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const { accountId } = req.body;
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: "accountId is required to resend verification code.",
      });
      return;
    }

    // Strict Tenant Validation: Ensure this LinkedIn account belongs to the authenticated user
    const [ownedAccount] = await db
      .select()
      .from(linkedinAccounts)
      .where(
        and(
          eq(linkedinAccounts.unipileAccountId, accountId.trim()),
          eq(linkedinAccounts.userId, userId),
        ),
      )
      .limit(1);

    if (!ownedAccount) {
      res.status(404).json({
        success: false,
        message: "LinkedIn account not found or access denied.",
      });
      return;
    }

    const result = await linkedInAccountService.resendCheckpoint(
      accountId.trim(),
    );
    res.status(200).json({
      success: true,
      message: "Verification code resent successfully.",
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to resend verification code.",
    });
  }
};

export const checkCheckpointStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const rawAccountId = req.params.accountId;
    const accountId = Array.isArray(rawAccountId)
      ? rawAccountId[0]!
      : rawAccountId;

    if (!accountId) {
      res.status(400).json({
        success: false,
        message: "accountId parameter is required.",
      });
      return;
    }

    const [ownedAccount] = await db
      .select()
      .from(linkedinAccounts)
      .where(
        and(
          eq(linkedinAccounts.unipileAccountId, accountId.trim()),
          eq(linkedinAccounts.userId, userId),
        ),
      )
      .limit(1);

    if (!ownedAccount) {
      res.status(404).json({
        success: false,
        message: "LinkedIn account not found or access denied.",
      });
      return;
    }

    const result = await linkedInAccountService.checkCheckpointStatus(
      userId,
      accountId.trim(),
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to check account checkpoint status.",
    });
  }
};

export const cancelSentInvitation = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const rawInvitationId = req.params.invitationId;
    const invitationId = Array.isArray(rawInvitationId)
      ? rawInvitationId[0]
      : rawInvitationId;
    if (!invitationId) {
      res
        .status(400)
        .json({ success: false, message: "invitationId is required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    if (!accountId) {
      res.status(400).json({
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account first.",
      });
      return;
    }
    const result = await linkedInConnectionService.cancelSentRequest(
      invitationId,
      accountId,
    );
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSentInvitations = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    if (!accountId) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    const invitations =
      await linkedInConnectionService.getSentRequests(accountId);
    res.status(200).json({ success: true, data: invitations });
  } catch (error: any) {
    if (
      error?.message?.includes("404") ||
      error?.message?.includes("not found")
    ) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReceivedInvitations = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    if (!accountId) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    const invitations =
      await linkedInConnectionService.getReceivedRequests(accountId);
    res.status(200).json({ success: true, data: invitations });
  } catch (error: any) {
    if (
      error?.message?.includes("404") ||
      error?.message?.includes("not found")
    ) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const acceptInvitation = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const rawInvitationId = req.params.invitationId;
    const invitationId = Array.isArray(rawInvitationId)
      ? rawInvitationId[0]
      : rawInvitationId;
    if (!invitationId) {
      res
        .status(400)
        .json({ success: false, message: "invitationId is required." });
      return;
    }
    const result =
      await linkedInConnectionService.acceptConnectionRequest(invitationId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const declineInvitation = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const rawInvitationId = req.params.invitationId;
    const invitationId = Array.isArray(rawInvitationId)
      ? rawInvitationId[0]
      : rawInvitationId;
    if (!invitationId) {
      res
        .status(400)
        .json({ success: false, message: "invitationId is required." });
      return;
    }
    const result =
      await linkedInConnectionService.declineConnectionRequest(invitationId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listConversations = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    if (!accountId) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const conversations = await linkedInMessageService.getConversations(
      accountId,
      limit,
    );
    res.status(200).json({ success: true, data: conversations });
  } catch (error: any) {
    if (
      error?.message?.includes("404") ||
      error?.message?.includes("not found")
    ) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const syncInbox = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    if (!accountId) {
      res.status(400).json({
        success: false,
        message:
          "No connected LinkedIn account found. Please connect your account first.",
      });
      return;
    }
    const limit = req.body?.limit || (req.query?.limit ? Number(req.query.limit) : 30);
    const result = await inboundSyncService.syncAccount(
      userId,
      accountId,
      { limit },
    );
    res.status(200).json({
      success: true,
      syncedChatsCount: result.syncedChatsCount,
      syncedMessagesCount: result.totalMessagesSynced ?? result.newInboundCount,
      newInboundCount: result.newInboundCount,
      processedJobsCount: result.processedJobsCount,
      message: `Successfully synchronized ${result.syncedChatsCount} conversation(s) and ${result.totalMessagesSynced ?? result.newInboundCount} message(s).`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getConversationMessages = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const rawConversationId = req.params.conversationId;
    const conversationId = Array.isArray(rawConversationId)
      ? rawConversationId[0]
      : rawConversationId;
    if (!conversationId) {
      res
        .status(400)
        .json({ success: false, message: "conversationId is required." });
      return;
    }
    const messages = await linkedInMessageService.getMessages(conversationId);
    res.status(200).json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendRichMessage = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    if (!accountId) {
      res.status(400).json({
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account first.",
      });
      return;
    }
    const { recipientId, messageText, voiceNoteUrl, attachments } = req.body;
    if (!recipientId) {
      res
        .status(400)
        .json({ success: false, message: "recipientId is required." });
      return;
    }
    const result = await linkedInMessageService.sendRichMessage({
      accountId,
      recipientId,
      messageText,
      voiceNoteUrl,
      attachments,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markConversationRead = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const rawConversationId = req.params.conversationId;
    const conversationId = Array.isArray(rawConversationId)
      ? rawConversationId[0]
      : rawConversationId;
    if (!conversationId) {
      res
        .status(400)
        .json({ success: false, message: "conversationId is required." });
      return;
    }
    const unread = Boolean(req.body.unread);
    const result = await linkedInMessageService.markConversationRead(
      conversationId,
      unread,
    );
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    const { content, attachments } = req.body;
    if (!content || !content.trim()) {
      res
        .status(400)
        .json({ success: false, message: "Post content is required." });
      return;
    }
    const result = await linkedInPostService.createPost(content, {
      accountId,
      attachments,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const rawPostId = req.params.postId;
    const postId = Array.isArray(rawPostId) ? rawPostId[0] : rawPostId;
    if (!postId) {
      res.status(400).json({ success: false, message: "postId is required." });
      return;
    }
    const result = await linkedInPostService.deletePost(postId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompany = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    const rawIdentifier = req.params.identifier;
    const identifier = Array.isArray(rawIdentifier)
      ? rawIdentifier[0]
      : rawIdentifier;
    if (!identifier) {
      res
        .status(400)
        .json({ success: false, message: "Company identifier is required." });
      return;
    }
    const company = await linkedInPeopleService.getCompanyProfile(
      identifier,
      accountId,
    );
    res.status(200).json({ success: true, data: company });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const searchCompanies = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    const keywords = (req.query.keywords ||
      req.query.query ||
      req.body.keywords ||
      "") as string;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const companies = await linkedInPeopleService.searchCompanies(
      keywords,
      accountId,
      limit,
    );
    res.status(200).json({ success: true, data: companies });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const searchJobs = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    const keywords = (req.query.keywords ||
      req.query.query ||
      req.body.keywords ||
      "") as string;
    const location = (req.query.location || req.body.location || "") as string;
    const limit = req.query.limit ? Number(req.query.limit) : 15;
    const jobs = await linkedInRecruitingService.searchJobs({
      keywords,
      location,
      limit,
      accountId,
    });
    res.status(200).json({ success: true, data: jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getJob = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    const rawJobId = req.params.jobId;
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
    if (!jobId) {
      res.status(400).json({ success: false, message: "jobId is required." });
      return;
    }
    const job = await linkedInRecruitingService.getJobDetails(jobId, accountId);
    res.status(200).json({ success: true, data: job });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const handleWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await handleUnipileWebhook(req, res);
};

export const getPublishedPosts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const accountId = await resolveUserUnipileAccountId(userId);
    if (!accountId) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const posts = await linkedInPostService.getPublishedPosts(accountId, limit);
    res.status(200).json({ success: true, data: posts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
