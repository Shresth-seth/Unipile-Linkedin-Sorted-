import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { linkedinAccounts, actionQueue } from "../../db/schema.js";
import {
  UnipileClient,
  unipileClient,
  isUnipileAccountConnected,
} from "../unipile/unipile.client.js";
import { encryptData, decryptData } from "../../utils/crypto.util.js";

export class LinkedInAccountService {
  public async generateAuthLink(
    _userId: string,
    callbackRedirect?: string,
  ): Promise<{ url: string }> {
    const options = callbackRedirect
      ? { successRedirectUrl: callbackRedirect }
      : undefined;
    const link = await unipileClient.createHostedAuthLink(options);
    return link;
  }

  /**
   * Synchronizes or links a connected Unipile LinkedIn account to a user.
   * Auto-resolves active accounts from Unipile if no ID is passed.
   */
  public async syncAccount(
    userId: string,
    unipileAccountId?: string,
    options?: {
      authMethod?: string;
      encryptedCredentials?: string;
      fallbackName?: string;
      fallbackEmail?: string;
    },
  ): Promise<any> {
    let resolvedAccountId = unipileAccountId;
    let unipileAcc: any = null;

    // Only resolve an account if explicitly provided or already connected on this specific user
    const [existing] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, userId))
      .limit(1);

    if (
      !resolvedAccountId &&
      existing?.unipileAccountId &&
      existing?.isConnected &&
      existing?.healthStatus !== "DISCONNECTED"
    ) {
      resolvedAccountId = existing.unipileAccountId;
    }

    if (!resolvedAccountId) {
      return {
        id: existing?.id,
        name: null,
        email: null,
        hasAccount: false,
        isConnected: false,
        healthStatus: "DISCONNECTED",
        automationStatus: "PAUSED",
        reconnectionRequired: false,
      };
    }

    if (resolvedAccountId && !unipileAcc && unipileClient.isConfigured()) {
      try {
        unipileAcc = await unipileClient.getAccount(resolvedAccountId);
      } catch (err: any) {
        console.warn(
          `Failed to fetch Unipile account ${resolvedAccountId}:`,
          err?.message,
        );
      }
    }

    const isConnected = unipileAcc
      ? isUnipileAccountConnected(unipileAcc)
      : false;
    const healthStatus = isConnected ? "HEALTHY" : "RECONNECT_REQUIRED";

    // existing already fetched above

    const linkedinName =
      unipileAcc?.name ||
      unipileAcc?.account_name ||
      unipileAcc?.connection_params?.im?.username ||
      options?.fallbackName ||
      existing?.linkedinName ||
      "LinkedIn User";

    const linkedinEmail =
      unipileAcc?.email ||
      unipileAcc?.connection_params?.email ||
      options?.fallbackEmail ||
      existing?.linkedinEmail ||
      null;

    const authMethod = options?.authMethod || existing?.authMethod || "HOSTED";
    const encryptedCredentials =
      options?.encryptedCredentials || existing?.encryptedCredentials || null;

    if (existing) {
      const [updated] = await db
        .update(linkedinAccounts)
        .set({
          unipileAccountId: resolvedAccountId || existing.unipileAccountId,
          linkedinName,
          linkedinEmail,
          isConnected,
          healthStatus,
          automationStatus: isConnected ? "RUNNING" : "PAUSED",
          authMethod,
          encryptedCredentials,
          updatedAt: new Date(),
        })
        .where(eq(linkedinAccounts.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(linkedinAccounts)
      .values({
        userId,
        unipileAccountId: resolvedAccountId || null,
        linkedinName,
        linkedinEmail,
        isConnected,
        healthStatus,
        automationStatus: isConnected ? "RUNNING" : "PAUSED",
        authMethod,
        encryptedCredentials,
      })
      .returning();

    return created;
  }

  /**
   * Connects via Username and Password (ID & Password native login).
   * Encrypts credentials to enable auto-reconnect upon server restart or session expiry.
   */
  public async connectWithCredentials(
    userId: string,
    username: string,
    password: string,
    options?: {
      country?: string | undefined;
      ip?: string | undefined;
      userAgent?: string | undefined;
    },
  ): Promise<{
    checkpoint: boolean;
    accountId: string;
    checkpointType?: string;
    message: string;
    account?: any;
  }> {
    const res = await unipileClient.connectWithCredentials(
      username,
      password,
      options,
    );

    if (
      res.object === "Checkpoint" ||
      res.checkpoint ||
      res.status === "CHECKPOINT"
    ) {
      const checkpointAccountId = res.account_id || res.id;
      const encrypted = encryptData({
        username,
        password,
        country: options?.country,
        userAgent: options?.userAgent,
      });
      await this.syncAccount(userId, checkpointAccountId, {
        authMethod: "CREDENTIALS",
        encryptedCredentials: encrypted,
        fallbackEmail: username,
      });

      return {
        checkpoint: true,
        accountId: checkpointAccountId,
        checkpointType: res.checkpoint?.type || res.type || "2FA",
        message: `Security checkpoint triggered (${res.checkpoint?.type || "2FA"}). Please solve to continue.`,
      };
    }

    const accountId = res.account_id || res.id;
    if (!accountId) {
      throw new Error(
        "Account creation succeeded but no account_id was returned by Unipile.",
      );
    }

    const encrypted = encryptData({
      username,
      password,
      country: options?.country,
      userAgent: options?.userAgent,
    });

    const synced = await this.syncAccount(userId, accountId, {
      authMethod: "CREDENTIALS",
      encryptedCredentials: encrypted,
      fallbackEmail: username,
    });

    return {
      checkpoint: false,
      accountId,
      account: synced,
      message: "LinkedIn account connected successfully via credentials.",
    };
  }

  /**
   * Connects via Session Cookie (li_at, and optional li_a).
   * Encrypts cookie to maintain persistent session without user re-authentication.
   */
  public async connectWithCookie(
    userId: string,
    accessToken: string,
    options?: {
      premiumToken?: string | undefined;
      userAgent?: string | undefined;
      country?: string | undefined;
      ip?: string | undefined;
    },
  ): Promise<{
    checkpoint: boolean;
    accountId: string;
    checkpointType?: string;
    message: string;
    account?: any;
  }> {
    const res = await unipileClient.connectWithCookie(accessToken, options);

    if (
      res.object === "Checkpoint" ||
      res.checkpoint ||
      res.status === "CHECKPOINT"
    ) {
      const checkpointAccountId = res.account_id || res.id;
      const encrypted = encryptData({
        li_at: accessToken,
        li_a: options?.premiumToken,
        country: options?.country,
        userAgent: options?.userAgent,
      });
      await this.syncAccount(userId, checkpointAccountId, {
        authMethod: "COOKIE",
        encryptedCredentials: encrypted,
      });

      return {
        checkpoint: true,
        accountId: checkpointAccountId,
        checkpointType: res.checkpoint?.type || res.type || "2FA",
        message: `Security checkpoint triggered (${res.checkpoint?.type || "2FA"}). Please solve to continue.`,
      };
    }

    const accountId = res.account_id || res.id;
    if (!accountId) {
      throw new Error(
        "Cookie authentication succeeded but no account_id was returned by Unipile.",
      );
    }

    const encrypted = encryptData({
      li_at: accessToken,
      li_a: options?.premiumToken,
      country: options?.country,
      userAgent: options?.userAgent,
    });

    const synced = await this.syncAccount(userId, accountId, {
      authMethod: "COOKIE",
      encryptedCredentials: encrypted,
    });

    return {
      checkpoint: false,
      accountId,
      account: synced,
      message: "LinkedIn account connected successfully via session cookie.",
    };
  }

  /**
   * Solves a checkpoint (2FA, OTP, or TRY_ANOTHER_WAY).
   */
  public async solveCheckpoint(
    userId: string,
    accountId: string,
    code: string,
  ): Promise<{
    checkpoint: boolean;
    accountId: string;
    checkpointType?: string;
    message: string;
    account?: any;
  }> {
    const res = await unipileClient.solveCheckpoint(accountId, code);

    if (res.object === "Checkpoint" || res.checkpoint) {
      return {
        checkpoint: true,
        accountId: res.account_id || accountId,
        checkpointType: res.checkpoint?.type || "2FA",
        message: `Next checkpoint required: ${res.checkpoint?.type || "2FA"}.`,
      };
    }

    const finalAccountId = res.account_id || accountId;
    const synced = await this.syncAccount(userId, finalAccountId);
    return {
      checkpoint: false,
      accountId: finalAccountId,
      account: synced,
      message: "Checkpoint verified! LinkedIn account successfully connected.",
    };
  }

  /**
   * Resends verification code.
   */
  public async resendCheckpoint(accountId: string): Promise<any> {
    return unipileClient.resendCheckpoint(accountId);
  }

  /**
   * Checks status of an in-flight native checkpoint (for IN_APP_VALIDATION).
   */
  public async checkCheckpointStatus(
    userId: string,
    accountId: string,
  ): Promise<{
    isConnected: boolean;
    status: string;
    account?: any;
  }> {
    const acc = await unipileClient.getAccount(accountId);
    const { isConnected } = UnipileClient.extractStatus(acc);
    if (isConnected) {
      const synced = await this.syncAccount(userId, accountId);
      return {
        isConnected: true,
        status: "OK",
        account: synced,
      };
    }
    return {
      isConnected: false,
      status: acc.status || (acc.checkpoint ? "CHECKPOINT" : "PENDING"),
    };
  }

  /**
   * Retrieves current account status and health for a user.
   * Auto-recovers if account is active in Unipile or stored credentials can reconnect.
   */
  public async getAccountStatus(userId: string): Promise<any> {
    let [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, userId))
      .limit(1);

    // 1. If user has explicitly disconnected or has no active LinkedIn account in DB
    if (
      !account ||
      !account.unipileAccountId ||
      account.healthStatus === "DISCONNECTED"
    ) {
      return {
        id: account?.id,
        name: null,
        email: null,
        hasAccount: false,
        isConnected: false,
        healthStatus: "DISCONNECTED",
        automationStatus: "PAUSED",
        reconnectionRequired: false,
      };
    }

    // 2. Verify live status with Unipile
    if (unipileClient.isConfigured()) {
      try {
        const liveAcc = await unipileClient.getAccount(
          account.unipileAccountId,
        );
        const isHealthy = isUnipileAccountConnected(liveAcc);
        const activeName =
          liveAcc.name ||
          liveAcc.account_name ||
          liveAcc.connection_params?.im?.username ||
          account.linkedinName;
        const activeEmail =
          liveAcc.email ||
          liveAcc.connection_params?.email ||
          account.linkedinEmail;

        // If not healthy but we have stored encrypted credentials/cookie, attempt silent auto-reconnect
        if (!isHealthy && account.encryptedCredentials && account.authMethod) {
          const creds = decryptData<any>(account.encryptedCredentials);
          if (creds) {
            try {
              if (
                account.authMethod === "CREDENTIALS" &&
                creds.username &&
                creds.password
              ) {
                const reconnectRes = await this.connectWithCredentials(
                  userId,
                  creds.username,
                  creds.password,
                  { country: creds.country, userAgent: creds.userAgent },
                );
                if (!reconnectRes.checkpoint && reconnectRes.accountId) {
                  return {
                    id: account.id,
                    name: account.linkedinName,
                    email: account.linkedinEmail,
                    hasAccount: true,
                    isConnected: true,
                    healthStatus: "HEALTHY",
                    automationStatus: "RUNNING",
                    reconnectionRequired: false,
                  };
                }
              } else if (account.authMethod === "COOKIE" && creds.li_at) {
                const reconnectRes = await this.connectWithCookie(
                  userId,
                  creds.li_at,
                  {
                    premiumToken: creds.li_a,
                    country: creds.country,
                    userAgent: creds.userAgent,
                  },
                );
                if (!reconnectRes.checkpoint && reconnectRes.accountId) {
                  return {
                    id: account.id,
                    name: account.linkedinName,
                    email: account.linkedinEmail,
                    hasAccount: true,
                    isConnected: true,
                    healthStatus: "HEALTHY",
                    automationStatus: "RUNNING",
                    reconnectionRequired: false,
                  };
                }
              }
            } catch (reconnectErr) {
              console.warn(
                "Silent auto-reconnect attempt failed:",
                reconnectErr,
              );
            }
          }
        }

        // Auto-heal DB state if live status differs from DB
        if (
          isHealthy !== account.isConnected ||
          account.healthStatus !==
            (isHealthy ? "HEALTHY" : "RECONNECT_REQUIRED") ||
          (activeName && activeName !== account.linkedinName)
        ) {
          await db
            .update(linkedinAccounts)
            .set({
              isConnected: isHealthy,
              healthStatus: isHealthy ? "HEALTHY" : "RECONNECT_REQUIRED",
              automationStatus: isHealthy ? "RUNNING" : "PAUSED",
              linkedinName: activeName,
              linkedinEmail: activeEmail,
              updatedAt: new Date(),
            })
            .where(eq(linkedinAccounts.id, account.id));
        }

        return {
          id: account.id,
          name: activeName,
          email: activeEmail,
          hasAccount: true,
          isConnected: isHealthy,
          healthStatus: isHealthy ? "HEALTHY" : "RECONNECT_REQUIRED",
          automationStatus: isHealthy ? "RUNNING" : account.automationStatus,
          reconnectionRequired: !isHealthy,
        };
      } catch (err: any) {
        // 3. If Unipile says 404 (ID no longer exists on remote):
        if (
          err?.message?.includes("404") ||
          err?.message?.includes("not found")
        ) {
          // If account was deleted remotely, do NOT hijack another account in Unipile!
          // Proceed to stored credentials auto-reconnect if present

          // If encrypted credentials stored, auto-reconnect silently
          if (account.encryptedCredentials && account.authMethod) {
            const creds = decryptData<any>(account.encryptedCredentials);
            if (creds) {
              try {
                if (
                  account.authMethod === "CREDENTIALS" &&
                  creds.username &&
                  creds.password
                ) {
                  const reconnectRes = await this.connectWithCredentials(
                    userId,
                    creds.username,
                    creds.password,
                    { country: creds.country, userAgent: creds.userAgent },
                  );
                  if (!reconnectRes.checkpoint && reconnectRes.accountId) {
                    return {
                      id: account.id,
                      name: account.linkedinName,
                      email: account.linkedinEmail,
                      hasAccount: true,
                      isConnected: true,
                      healthStatus: "HEALTHY",
                      automationStatus: "RUNNING",
                      reconnectionRequired: false,
                    };
                  }
                } else if (account.authMethod === "COOKIE" && creds.li_at) {
                  const reconnectRes = await this.connectWithCookie(
                    userId,
                    creds.li_at,
                    {
                      premiumToken: creds.li_a,
                      country: creds.country,
                      userAgent: creds.userAgent,
                    },
                  );
                  if (!reconnectRes.checkpoint && reconnectRes.accountId) {
                    return {
                      id: account.id,
                      name: account.linkedinName,
                      email: account.linkedinEmail,
                      hasAccount: true,
                      isConnected: true,
                      healthStatus: "HEALTHY",
                      automationStatus: "RUNNING",
                      reconnectionRequired: false,
                    };
                  }
                }
              } catch (reconnectErr) {
                console.warn("Auto-reconnect failed:", reconnectErr);
              }
            }
          }

          // Mark disconnected if all recovery attempts fail
          await db
            .update(linkedinAccounts)
            .set({
              isConnected: false,
              healthStatus: "DISCONNECTED",
              automationStatus: "PAUSED",
              updatedAt: new Date(),
            })
            .where(eq(linkedinAccounts.id, account.id));

          return {
            id: account.id,
            name: account.linkedinName,
            email: account.linkedinEmail,
            hasAccount: true,
            isConnected: false,
            healthStatus: "RECONNECT_REQUIRED",
            automationStatus: "PAUSED",
            reconnectionRequired: true,
          };
        }

        // For temporary network/server timeouts, retain last known DB status
        return {
          id: account.id,
          name: account.linkedinName,
          email: account.linkedinEmail,
          hasAccount: true,
          isConnected: account.isConnected,
          healthStatus: account.healthStatus,
          automationStatus: account.automationStatus,
          reconnectionRequired: account.healthStatus === "RECONNECT_REQUIRED",
        };
      }
    }

    return {
      id: account.id,
      name: account.linkedinName,
      email: account.linkedinEmail,
      hasAccount: true,
      isConnected: account.isConnected,
      healthStatus: account.healthStatus,
      automationStatus: account.automationStatus,
      reconnectionRequired: account.healthStatus === "RECONNECT_REQUIRED",
    };
  }

  /**
   * Disconnects user's LinkedIn account and clears stored credentials.
   */
  public async disconnect(userId: string): Promise<boolean> {
    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, userId))
      .limit(1);

    if (account) {
      if (account.unipileAccountId) {
        try {
          await unipileClient.disconnectAccount(account.unipileAccountId);
        } catch (err: any) {
          // Safe fallback for dev/test account IDs
        }
      }
      await db
        .update(linkedinAccounts)
        .set({
          unipileAccountId: null,
          linkedinName: null,
          linkedinEmail: null,
          isConnected: false,
          healthStatus: "DISCONNECTED",
          automationStatus: "PAUSED",
          authMethod: null,
          encryptedCredentials: null,
          updatedAt: new Date(),
        })
        .where(eq(linkedinAccounts.id, account.id));
    }
    return true;
  }

  /**
   * Permanently deletes stored LinkedIn session cookies, encrypted credentials,
   * and the LinkedIn account login record from the database, disconnects remote session,
   * and clears pending actions.
   */
  public async deleteLinkedInLoginAndCookies(userId: string): Promise<boolean> {
    const userAccounts = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, userId));

    for (const account of userAccounts) {
      if (account.unipileAccountId) {
        try {
          await unipileClient.disconnectAccount(account.unipileAccountId);
        } catch (err: any) {
          // Ignore if already deleted remotely
        }
      }
    }

    // Permanently DELETE the LinkedIn login & saved cookies from the database
    await db
      .delete(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, userId));

    // Clear any pending queued actions for this user
    try {
      await db.delete(actionQueue).where(eq(actionQueue.userId, userId));
    } catch {
      // Ignore if no queued items
    }

    return true;
  }

  public async purgeSessionAndCookies(userId: string): Promise<boolean> {
    return this.deleteLinkedInLoginAndCookies(userId);
  }
}

export const linkedInAccountService = new LinkedInAccountService();
