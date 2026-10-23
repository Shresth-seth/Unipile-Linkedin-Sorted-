import { Response } from "express";
import { db } from "../db/index.js";
import {
  users,
  linkedinAccounts,
  actionQueue,
  systemSettings,
  dailyAgentRuns,
  messageAgentJobs,
} from "../db/schema.js";
import { eq, count, sql, and, like, or, desc, gte } from "drizzle-orm";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { unipileClient, isUnipileAccountConnected } from "../services/unipile/unipile.client.js";
import { dailyAgentWorker } from "../agent/daily/daily-agent.worker.js";
import { messageAgentWorker } from "../services/webhook/message-agent.worker.js";
import { unipileMessageAgentService } from "../services/webhook/unipile-message-agent.service.js";
import { geminiConfigService } from "../services/ai/gemini-config.service.js";
import { decryptStoredSecret, encryptSecret } from "../utils/crypto.util.js";

function normalizeUnipileDsn(value: string): string {
  let normalized = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  const parsed = new URL(normalized);
  if (process.env.NODE_ENV === "production" && (
    parsed.protocol !== "https:" || !parsed.hostname.endsWith(".unipile.com")
  )) {
    throw new Error("Unipile DSN must be an HTTPS endpoint on unipile.com.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

// ─────────────────────────────────────────────
// 1. GET /api/admin/overview
// ─────────────────────────────────────────────
export const getAdminOverview = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Total users
    const [userCount] = await db
      .select({ count: count() })
      .from(users);

    // LinkedIn account health breakdown
    const healthBreakdown = await db
      .select({
        healthStatus: linkedinAccounts.healthStatus,
        count: count(),
      })
      .from(linkedinAccounts)
      .groupBy(linkedinAccounts.healthStatus);

    // Automation status breakdown
    const automationBreakdown = await db
      .select({
        automationStatus: linkedinAccounts.automationStatus,
        count: count(),
      })
      .from(linkedinAccounts)
      .groupBy(linkedinAccounts.automationStatus);

    // Connected vs disconnected counts
    const [connectedCount] = await db
      .select({ count: count() })
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.isConnected, true));

    const [disconnectedCount] = await db
      .select({ count: count() })
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.isConnected, false));

    // Get cost per account from system_settings or default to 8.00
    let costPerAccount = 8.0;
    try {
      const [costSetting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "unipile_cost_per_account"))
        .limit(1);
      if (costSetting) {
        costPerAccount = parseFloat(costSetting.value) || 8.0;
      }
    } catch {
      // Table may not exist yet; use default
    }

    const totalConnected = connectedCount?.count || 0;
    const totalDisconnected = disconnectedCount?.count || 0;
    const estimatedMonthlyBill = totalConnected * costPerAccount;

    // Build health map
    const healthMap: Record<string, number> = {
      healthy: 0,
      reconnectRequired: 0,
      challenged: 0,
      disconnected: 0,
    };
    for (const row of healthBreakdown) {
      const status = (row.healthStatus || "").toUpperCase();
      if (status === "HEALTHY") healthMap.healthy = row.count;
      else if (status === "RECONNECT_REQUIRED")
        healthMap.reconnectRequired = row.count;
      else if (status === "CHALLENGED") healthMap.challenged = row.count;
      else if (status === "DISCONNECTED") healthMap.disconnected = row.count;
    }

    // Build automation map
    const automationMap: Record<string, number> = {
      running: 0,
      paused: 0,
    };
    for (const row of automationBreakdown) {
      const status = (row.automationStatus || "").toUpperCase();
      if (status === "RUNNING") automationMap.running = row.count;
      else if (status === "PAUSED") automationMap.paused = row.count;
    }

    // Recent account connections (last 10)
    const recentAccounts = await db
      .select({
        id: linkedinAccounts.id,
        linkedinName: linkedinAccounts.linkedinName,
        linkedinEmail: linkedinAccounts.linkedinEmail,
        isConnected: linkedinAccounts.isConnected,
        healthStatus: linkedinAccounts.healthStatus,
        createdAt: linkedinAccounts.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(linkedinAccounts)
      .leftJoin(users, eq(linkedinAccounts.userId, users.id))
      .orderBy(desc(linkedinAccounts.createdAt))
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalUsers: userCount?.count || 0,
          totalConnectedAccounts: totalConnected,
          totalDisconnectedAccounts: totalDisconnected,
          estimatedMonthlyBillUSD: estimatedMonthlyBill,
          costPerAccountUSD: costPerAccount,
        },
        healthBreakdown: healthMap,
        automationBreakdown: automationMap,
        recentActivity: recentAccounts.map((a) => ({
          userName: a.userName || "Unknown",
          userEmail: a.userEmail || "Unknown",
          linkedinName: a.linkedinName || "Unnamed",
          isConnected: a.isConnected,
          healthStatus: a.healthStatus,
          timestamp: a.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("Admin overview error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch admin overview.",
    });
  }
};

// ─────────────────────────────────────────────
// 2. GET /api/admin/linkedin-accounts
// ─────────────────────────────────────────────
export const getAdminLinkedinAccounts = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      status = "ALL",
      search = "",
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Build conditions
    const conditions: any[] = [];

    if (status && status !== "ALL") {
      const statusUpper = status.toUpperCase();
      if (statusUpper === "NEEDS_ACTION") {
        // CHALLENGED + RECONNECT_REQUIRED
        conditions.push(
          or(
            eq(linkedinAccounts.healthStatus, "CHALLENGED"),
            eq(linkedinAccounts.healthStatus, "RECONNECT_REQUIRED")
          )
        );
      } else {
        conditions.push(eq(linkedinAccounts.healthStatus, statusUpper));
      }
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          like(linkedinAccounts.linkedinName, searchPattern),
          like(linkedinAccounts.linkedinEmail, searchPattern),
          like(users.name, searchPattern),
          like(users.email, searchPattern)
        )
      );
    }

    // Get total count
    const countQuery = db
      .select({ count: count() })
      .from(linkedinAccounts)
      .leftJoin(users, eq(linkedinAccounts.userId, users.id));

    const dataQuery = db
      .select({
        id: linkedinAccounts.id,
        userId: linkedinAccounts.userId,
        unipileAccountId: linkedinAccounts.unipileAccountId,
        linkedinName: linkedinAccounts.linkedinName,
        linkedinEmail: linkedinAccounts.linkedinEmail,
        isConnected: linkedinAccounts.isConnected,
        healthStatus: linkedinAccounts.healthStatus,
        automationStatus: linkedinAccounts.automationStatus,
        dailyConnectionsLimit: linkedinAccounts.dailyConnectionsLimit,
        dailyMessagesLimit: linkedinAccounts.dailyMessagesLimit,
        createdAt: linkedinAccounts.createdAt,
        updatedAt: linkedinAccounts.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(linkedinAccounts)
      .leftJoin(users, eq(linkedinAccounts.userId, users.id))
      .orderBy(desc(linkedinAccounts.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Apply conditions if any
    let totalResult: any[];
    let accountsResult: any[];

    if (conditions.length > 0) {
      const whereClause =
        conditions.length === 1 ? conditions[0] : and(...conditions);
      totalResult = await (countQuery as any).where(whereClause);
      accountsResult = await (dataQuery as any).where(whereClause);
    } else {
      totalResult = await countQuery;
      accountsResult = await dataQuery;
    }

    const total = totalResult[0]?.count || 0;

    res.status(200).json({
      success: true,
      data: {
        accounts: accountsResult.map((a: any) => ({
          id: a.id,
          userId: a.userId,
          userName: a.userName || "Unknown",
          userEmail: a.userEmail || "Unknown",
          unipileAccountId: a.unipileAccountId,
          linkedinName: a.linkedinName,
          linkedinEmail: a.linkedinEmail,
          isConnected: a.isConnected,
          healthStatus: a.healthStatus,
          automationStatus: a.automationStatus,
          dailyConnectionsLimit: a.dailyConnectionsLimit,
          dailyMessagesLimit: a.dailyMessagesLimit,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          billableThisMonth: a.isConnected,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      },
    });
  } catch (error: any) {
    console.error("Admin linkedin accounts error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch LinkedIn accounts.",
    });
  }
};

// ─────────────────────────────────────────────
// 3. POST /api/admin/linkedin-accounts/:id/disconnect
// ─────────────────────────────────────────────
export const adminDisconnectAccount = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Find the account in our database
    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(sql`${linkedinAccounts.id} = ${id}`)
      .limit(1);

    if (!account) {
      res.status(404).json({
        success: false,
        message: "LinkedIn account not found.",
      });
      return;
    }

    // Try to delete from Unipile to stop billing
    if (account.unipileAccountId) {
      try {
        await unipileClient.disconnectAccount(account.unipileAccountId);
        console.log(
          `[ADMIN] Disconnected Unipile account ${account.unipileAccountId} (DB id: ${id}) by admin ${req.user?.userId}`
        );
      } catch (unipileError: any) {
        console.error(`[ADMIN] Failed to disconnect from Unipile: ${unipileError.message}`);
        res.status(502).json({
          success: false,
          message: "The hosted provider did not confirm disconnection. No local status was changed.",
        });
        return;
      }
    }

    // Update database record
    await db
      .update(linkedinAccounts)
      .set({
        isConnected: false,
        healthStatus: "DISCONNECTED",
        automationStatus: "PAUSED",
        updatedAt: new Date(),
      })
      .where(sql`${linkedinAccounts.id} = ${id}`);

    res.status(200).json({
      success: true,
      message: `LinkedIn account "${account.linkedinName || id}" has been disconnected. Unipile billing for this account will stop.`,
    });
  } catch (error: any) {
    console.error("Admin disconnect account error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to disconnect account.",
    });
  }
};

// ─────────────────────────────────────────────
// 4. POST /api/admin/linkedin-accounts/:id/check-health
// ─────────────────────────────────────────────
export const adminCheckAccountHealth = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Find the account in our database
    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(sql`${linkedinAccounts.id} = ${id}`)
      .limit(1);

    if (!account) {
      res.status(404).json({
        success: false,
        message: "LinkedIn account not found.",
      });
      return;
    }

    if (!account.unipileAccountId) {
      res.status(400).json({
        success: false,
        message: "Account has no associated Unipile account ID.",
      });
      return;
    }

    // Check live status from Unipile
    let unipileStatus: any;
    let newHealthStatus = account.healthStatus;

    try {
      unipileStatus = await unipileClient.getAccount(
        account.unipileAccountId
      );

      // Map Unipile status to our health status
      const status = (
        unipileStatus?.status ||
        unipileStatus?.connection_status ||
        ""
      )
        .toString()
        .toUpperCase();

      if (isUnipileAccountConnected(unipileStatus)) {
        newHealthStatus = "HEALTHY";
      } else if (
        status === "CHALLENGED" ||
        status === "CHECKPOINT" ||
        status === "RESTRICTED" ||
        unipileStatus?.checkpoint
      ) {
        newHealthStatus = "CHALLENGED";
      } else if (
        status === "RECONNECT_REQUIRED" ||
        status === "EXPIRED" ||
        status === "INVALID"
      ) {
        newHealthStatus = "RECONNECT_REQUIRED";
      } else if (
        status === "DISCONNECTED" ||
        status === "DELETED" ||
        status === "ERROR"
      ) {
        newHealthStatus = "DISCONNECTED";
      }
    } catch (unipileError: any) {
      // If Unipile can't find the account, it's likely disconnected
      newHealthStatus = "DISCONNECTED";
      unipileStatus = { error: unipileError.message };
    }

    // Update database with fresh health status
    await db
      .update(linkedinAccounts)
      .set({
        healthStatus: newHealthStatus,
        isConnected: newHealthStatus !== "DISCONNECTED",
        updatedAt: new Date(),
      })
      .where(sql`${linkedinAccounts.id} = ${id}`);

    res.status(200).json({
      success: true,
      data: {
        accountId: id,
        previousHealth: account.healthStatus,
        currentHealth: newHealthStatus,
        unipileResponse: unipileStatus,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Admin check health error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check account health.",
    });
  }
};

// ─────────────────────────────────────────────
// 5. GET /api/admin/users
// ─────────────────────────────────────────────
export const getAdminUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      search = "",
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Build conditions
    const conditions: any[] = [];
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(like(users.name, searchPattern), like(users.email, searchPattern))
      );
    }

    // Get total count
    let totalResult: any[];
    if (conditions.length > 0) {
      totalResult = await db
        .select({ count: count() })
        .from(users)
        .where(conditions[0]);
    } else {
      totalResult = await db.select({ count: count() }).from(users);
    }

    const total = totalResult[0]?.count || 0;

    // Fetch users with their connected accounts count
    // Use a subquery approach for linked account count
    const allUsers = conditions.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(conditions[0])
          .orderBy(desc(users.createdAt))
          .limit(limitNum)
          .offset(offset)
      : await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(desc(users.createdAt))
          .limit(limitNum)
          .offset(offset);

    // For each user, get their connected accounts count
    const usersWithAccounts = await Promise.all(
      allUsers.map(async (user) => {
        const [accountCount] = await db
          .select({ count: count() })
          .from(linkedinAccounts)
          .where(eq(linkedinAccounts.userId, user.id));

        const [connectedCount] = await db
          .select({ count: count() })
          .from(linkedinAccounts)
          .where(
            and(
              eq(linkedinAccounts.userId, user.id),
              eq(linkedinAccounts.isConnected, true)
            )
          );

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          totalAccounts: accountCount?.count || 0,
          connectedAccounts: connectedCount?.count || 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        users: usersWithAccounts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      },
    });
  } catch (error: any) {
    console.error("Admin users error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch users.",
    });
  }
};

// ─────────────────────────────────────────────
// 6. GET /api/admin/settings/unipile
// ─────────────────────────────────────────────
export const getUnipileSettings = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Try reading from system_settings table first
    let dsn = "";
    let apiKey = "";
    let costPerAccount = "8.00";
    let source = "ENV_VARIABLE";

    try {
      const settings = await db.select().from(systemSettings);
      const settingsMap: Record<string, string> = {};
      for (const s of settings) {
        settingsMap[s.key] = s.value;
      }

      if (settingsMap["unipile_dsn"]) {
        dsn = settingsMap["unipile_dsn"];
        source = "DATABASE";
      }
      if (settingsMap["unipile_api_key"]) {
        apiKey = decryptStoredSecret(settingsMap["unipile_api_key"]);
        source = "DATABASE";
      }
      if (settingsMap["unipile_cost_per_account"]) {
        costPerAccount = settingsMap["unipile_cost_per_account"];
      }
    } catch {
      // systemSettings table may not exist yet
    }

    // Fallback to .env values if not in database
    if (!dsn) dsn = (process.env.UNIPILE_DSN || "").trim();
    if (!apiKey) apiKey = (process.env.UNIPILE_API_KEY || "").trim();

    // Mask the API key for frontend display
    let apiKeyMasked = "";
    if (apiKey.length > 8) {
      apiKeyMasked =
        apiKey.substring(0, 4) +
        "*".repeat(Math.max(4, apiKey.length - 8)) +
        apiKey.substring(apiKey.length - 4);
    } else if (apiKey.length > 0) {
      apiKeyMasked = "****" + apiKey.substring(apiKey.length - 2);
    }

    res.status(200).json({
      success: true,
      data: {
        dsn,
        apiKeyMasked,
        isConfigured: Boolean(dsn && apiKey),
        source,
        estimatedCostPerAccount: parseFloat(costPerAccount) || 8.0,
      },
    });
  } catch (error: any) {
    console.error("Admin get unipile settings error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch Unipile settings.",
    });
  }
};

// ─────────────────────────────────────────────
// 7. POST /api/admin/settings/unipile
// ─────────────────────────────────────────────
export const updateUnipileSettings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { dsn, apiKey, estimatedCostPerAccount } = req.body;
    const adminUserId = req.user?.userId;

    if (!dsn && !apiKey && estimatedCostPerAccount === undefined) {
      res.status(400).json({
        success: false,
        message: "Please provide at least one field to update (dsn, apiKey, or estimatedCostPerAccount).",
      });
      return;
    }

    const now = new Date();

    // Upsert each setting
    if (dsn !== undefined) {
      const normalizedDsn = normalizeUnipileDsn(dsn);
      await db
        .insert(systemSettings)
        .values({
          key: "unipile_dsn",
          value: normalizedDsn,
          description: "Unipile API DSN endpoint",
          updatedAt: now,
          updatedBy: adminUserId || null,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: normalizedDsn,
            updatedAt: now,
            updatedBy: adminUserId || null,
          },
        });
    }

    if (apiKey !== undefined) {
      await db
        .insert(systemSettings)
        .values({
          key: "unipile_api_key",
          value: encryptSecret(apiKey),
          description: "Unipile API Key (Master)",
          updatedAt: now,
          updatedBy: adminUserId || null,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: encryptSecret(apiKey),
            updatedAt: now,
            updatedBy: adminUserId || null,
          },
        });
    }

    if (estimatedCostPerAccount !== undefined) {
      await db
        .insert(systemSettings)
        .values({
          key: "unipile_cost_per_account",
          value: String(estimatedCostPerAccount),
          description: "Estimated monthly cost per connected Unipile account (USD)",
          updatedAt: now,
          updatedBy: adminUserId || null,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: String(estimatedCostPerAccount),
            updatedAt: now,
            updatedBy: adminUserId || null,
          },
        });
    }

    // Immediately sync in-memory Unipile client with new credentials
    unipileClient.setCredentials(dsn ? normalizeUnipileDsn(dsn) : undefined, apiKey);

    console.log(
      `[ADMIN AUDIT] Unipile settings updated by admin ${adminUserId} at ${now.toISOString()}`
    );

    res.status(200).json({
      success: true,
      message: "Unipile settings updated successfully. Changes take effect immediately.",
    });
  } catch (error: any) {
    console.error("Admin update unipile settings error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update Unipile settings.",
    });
  }
};

// ─────────────────────────────────────────────
// 8. POST /api/admin/settings/unipile/test
// ─────────────────────────────────────────────
export const testUnipileConnection = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { dsn: testDsn, apiKey: testApiKey } = req.body || {};

    // Use provided values, or fall back to stored/env values
    let dsn = testDsn?.trim();
    let apiKey = testApiKey?.trim();

    if (!dsn || !apiKey) {
      // Try reading from DB first
      try {
        const settings = await db.select().from(systemSettings);
        const settingsMap: Record<string, string> = {};
        for (const s of settings) {
          settingsMap[s.key] = s.value;
        }
        if (!dsn) dsn = settingsMap["unipile_dsn"] || "";
        if (!apiKey) apiKey = decryptStoredSecret(settingsMap["unipile_api_key"]);
      } catch {
        // Fall through to env
      }

      // Fall back to env
      if (!dsn) dsn = (process.env.UNIPILE_DSN || "").trim();
      if (!apiKey) apiKey = (process.env.UNIPILE_API_KEY || "").trim();
    }

    if (!dsn || !apiKey) {
      res.status(400).json({
        success: false,
        message: "No Unipile credentials available. Please provide DSN and API Key.",
      });
      return;
    }

    // Normalize DSN
    const normalizedDsn = normalizeUnipileDsn(dsn);

    // Make a test request to Unipile
    const testUrl = `${normalizedDsn}/api/v1/accounts?limit=1`;
    const testResponse = await fetch(testUrl, {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!testResponse.ok) {
      const errorBody = await testResponse.text();
      res.status(200).json({
        success: false,
        message: `Unipile connection failed: HTTP ${testResponse.status}`,
        unipileStatus: testResponse.status,
        error: errorBody,
      });
      return;
    }

    const responseData = await testResponse.json() as any;

    // Try to get total account count with a larger limit
    let remoteAccountCount = 0;
    try {
      const countUrl = `${normalizedDsn}/api/v1/accounts?limit=100`;
      const countResponse = await fetch(countUrl, {
        method: "GET",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
      });
      if (countResponse.ok) {
        const countData = await countResponse.json() as any;
        remoteAccountCount =
          countData?.items?.length || countData?.length || 0;
      }
    } catch {
      remoteAccountCount = responseData?.items?.length || 0;
    }

    res.status(200).json({
      success: true,
      message: "Connection to Unipile established successfully.",
      unipileStatus: testResponse.status,
      remoteAccountCount,
    });
  } catch (error: any) {
    console.error("Admin test unipile connection error:", error);
    res.status(200).json({
      success: false,
      message: `Connection test failed: ${error.message}`,
      unipileStatus: 0,
    });
  }
};

// ─────────────────────────────────────────────
// 9. GET /api/admin/queue/stats
// ─────────────────────────────────────────────
export const getAdminQueueStats = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Queue status breakdown
    const statusBreakdown = await db
      .select({
        status: actionQueue.status,
        count: count(),
      })
      .from(actionQueue)
      .groupBy(actionQueue.status);

    // Build stats map
    const statsMap: Record<string, number> = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      paused: 0,
      skipped: 0,
    };
    let totalActions = 0;
    for (const row of statusBreakdown) {
      const status = (row.status || "").toLowerCase();
      if (statsMap.hasOwnProperty(status)) {
        statsMap[status] = row.count;
      }
      totalActions += row.count;
    }

    // Actions today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayCompleted] = await db
      .select({ count: count() })
      .from(actionQueue)
      .where(
        and(
          eq(actionQueue.status, "COMPLETED"),
          gte(actionQueue.executedAt, todayStart)
        )
      );

    const [todayFailed] = await db
      .select({ count: count() })
      .from(actionQueue)
      .where(
        and(
          eq(actionQueue.status, "FAILED"),
          gte(actionQueue.createdAt, todayStart)
        )
      );

    // Recent failed actions (last 10)
    const recentFailed = await db
      .select({
        id: actionQueue.id,
        userId: actionQueue.userId,
        actionType: actionQueue.actionType,
        status: actionQueue.status,
        errorMessage: actionQueue.errorMessage,
        attempts: actionQueue.attempts,
        createdAt: actionQueue.createdAt,
      })
      .from(actionQueue)
      .where(eq(actionQueue.status, "FAILED"))
      .orderBy(desc(actionQueue.createdAt))
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        totalActions,
        statusBreakdown: statsMap,
        today: {
          completed: todayCompleted?.count || 0,
          failed: todayFailed?.count || 0,
        },
        recentFailed,
      },
    });
  } catch (error: any) {
    console.error("Admin queue stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch queue stats.",
    });
  }
};

// ─────────────────────────────────────────────
// 10. POST /api/admin/daily-agent/run/:userId
// ─────────────────────────────────────────────
export const adminRunDailyAgent = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const rawUserId = req.params.userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    if (!userId) {
      res.status(400).json({ success: false, message: "userId parameter is required." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "The 4:00 AM daily auto-connect system has been permanently removed in favor of user-created campaigns.",
    });
  } catch (error: any) {
    console.error("Admin run daily agent error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to execute daily agent for user.",
    });
  }
};

// ─────────────────────────────────────────────
// 11. POST /api/admin/message-agent/simulate-webhook
// ─────────────────────────────────────────────
export const adminSimulateMessageWebhook = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const payload = req.body?.payload || req.body;
    if (!payload || !payload.account_id) {
      res.status(400).json({
        success: false,
        message: "Valid Unipile message webhook payload with account_id is required.",
      });
      return;
    }

    console.log(`⚡ [admin] Simulating Unipile message webhook via admin trigger.`);
    await unipileMessageAgentService.handleMessageWebhook(payload);

    res.status(200).json({
      success: true,
      message: "Webhook simulated and job enqueued/processed successfully.",
    });
  } catch (error: any) {
    console.error("Admin simulate webhook error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to simulate message webhook.",
    });
  }
};

// ─────────────────────────────────────────────
// 12. POST /api/admin/message-agent/process-job/:jobId
// ─────────────────────────────────────────────
export const adminProcessMessageJob = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const rawJobId = req.params.jobId;
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
    if (!jobId) {
      res.status(400).json({ success: false, message: "jobId parameter is required." });
      return;
    }

    console.log(`⚡ [admin] Manually processing message job: ${jobId}`);
    const result = await messageAgentWorker.processJob(jobId);

    res.status(200).json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    console.error("Admin process message job error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process message job.",
    });
  }
};

// ─────────────────────────────────────────────
// 13. GET /api/admin/automation/health
// ─────────────────────────────────────────────
export const getAutomationHealth = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const schedulerTelemetry = dailyAgentWorker.getTelemetry();
    const messageTelemetry = messageAgentWorker.getTelemetry();

    // Query DB for latest successful and failed daily runs
    const [latestSuccessfulRun] = await db
      .select({ completedAt: dailyAgentRuns.completedAt })
      .from(dailyAgentRuns)
      .where(eq(dailyAgentRuns.status, "COMPLETED"))
      .orderBy(desc(dailyAgentRuns.completedAt))
      .limit(1);

    const [latestFailedRun] = await db
      .select({ completedAt: dailyAgentRuns.completedAt })
      .from(dailyAgentRuns)
      .where(or(eq(dailyAgentRuns.status, "FAILED"), eq(dailyAgentRuns.status, "PARTIAL")))
      .orderBy(desc(dailyAgentRuns.completedAt))
      .limit(1);

    // Query DB for pending and failed message jobs
    const [pendingJobsCount] = await db
      .select({ count: count() })
      .from(messageAgentJobs)
      .where(eq(messageAgentJobs.status, "PENDING"));

    const [failedJobsCount] = await db
      .select({ count: count() })
      .from(messageAgentJobs)
      .where(eq(messageAgentJobs.status, "FAILED"));

    const recentJobs = await db
      .select({
        id: messageAgentJobs.id,
        userId: messageAgentJobs.userId,
        chatId: messageAgentJobs.chatId,
        messageId: messageAgentJobs.messageId,
        status: messageAgentJobs.status,
        attemptCount: messageAgentJobs.attemptCount,
        suggestedReply: messageAgentJobs.suggestedReply,
        sentReply: messageAgentJobs.sentReply,
        error: messageAgentJobs.error,
        createdAt: messageAgentJobs.createdAt,
        processedAt: messageAgentJobs.processedAt,
      })
      .from(messageAgentJobs)
      .orderBy(desc(messageAgentJobs.createdAt))
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        dailyScheduler: {
          lastSchedulerTick: schedulerTelemetry.lastSchedulerTick,
          numberDue: schedulerTelemetry.lastDueCount,
          numberRunning: schedulerTelemetry.numberRunning,
          lastSuccessfulRun: schedulerTelemetry.lastSuccessfulRun || latestSuccessfulRun?.completedAt || null,
          lastFailedRun: schedulerTelemetry.lastFailedRun || latestFailedRun?.completedAt || null,
        },
        messageWebhook: {
          lastWebhookReceivedAt: messageTelemetry.lastWebhookReceivedAt,
          lastInboundMessageAt: messageTelemetry.lastInboundMessageAt,
          lastMessageJobCompletedAt: messageTelemetry.lastMessageJobCompletedAt,
          pendingJobs: pendingJobsCount?.count || 0,
          failedJobs: failedJobsCount?.count || 0,
        },
        recentJobs,
      },
    });
  } catch (error: any) {
    console.error("Get automation health error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve automation health telemetry.",
    });
  }
};

// ─────────────────────────────────────────────
// 14. GET /api/admin/settings/gemini
// ─────────────────────────────────────────────
export const getGeminiSettings = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    let apiKey = "";
    let model = "";
    let source = "ENV_VARIABLE";

    try {
      const settings = await db.select().from(systemSettings);
      const settingsMap: Record<string, string> = {};
      for (const s of settings) {
        settingsMap[s.key] = s.value;
      }

      if (settingsMap["gemini_api_key"]) {
        apiKey = decryptStoredSecret(settingsMap["gemini_api_key"]);
        source = "DATABASE";
      }
      if (settingsMap["gemini_model"]) {
        model = settingsMap["gemini_model"];
      }
    } catch {}

    if (!apiKey) {
      apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
    }
    if (!model) {
      model = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
    }

    let apiKeyMasked = "";
    if (apiKey.length > 8) {
      apiKeyMasked =
        apiKey.substring(0, 4) +
        "*".repeat(Math.max(4, apiKey.length - 8)) +
        apiKey.substring(apiKey.length - 4);
    } else if (apiKey.length > 0) {
      apiKeyMasked = "****" + apiKey.substring(apiKey.length - 2);
    }

    res.status(200).json({
      success: true,
      data: {
        apiKeyMasked,
        model,
        isConfigured: Boolean(apiKey),
        source,
      },
    });
  } catch (error: any) {
    console.error("Admin get gemini settings error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch Gemini settings.",
    });
  }
};

// ─────────────────────────────────────────────
// 15. POST /api/admin/settings/gemini
// ─────────────────────────────────────────────
export const updateGeminiSettings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { apiKey, model } = req.body;
    const adminUserId = req.user?.userId;

    if (!apiKey && !model) {
      res.status(400).json({
        success: false,
        message: "Please provide apiKey or model to update.",
      });
      return;
    }

    const now = new Date();

    if (apiKey !== undefined && apiKey.trim() !== "") {
      await db
        .insert(systemSettings)
        .values({
          key: "gemini_api_key",
          value: encryptSecret(apiKey),
          description: "Google Gemini API Key (Master)",
          updatedAt: now,
          updatedBy: adminUserId || null,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: encryptSecret(apiKey),
            updatedAt: now,
            updatedBy: adminUserId || null,
          },
        });
      geminiConfigService.setInCache(apiKey.trim());
    }

    if (model !== undefined && model.trim() !== "") {
      await db
        .insert(systemSettings)
        .values({
          key: "gemini_model",
          value: model.trim(),
          description: "Google Gemini Default Model",
          updatedAt: now,
          updatedBy: adminUserId || null,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: model.trim(),
            updatedAt: now,
            updatedBy: adminUserId || null,
          },
        });
      geminiConfigService.setInCache(undefined, model.trim());
    }

    console.log(
      `[ADMIN AUDIT] Gemini settings updated by admin ${adminUserId} at ${now.toISOString()}`
    );

    res.status(200).json({
      success: true,
      message: "Gemini configuration updated successfully. Changes take effect immediately.",
    });
  } catch (error: any) {
    console.error("Admin update gemini settings error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update Gemini settings.",
    });
  }
};

// ─────────────────────────────────────────────
// 16. POST /api/admin/settings/gemini/test
// ─────────────────────────────────────────────
export const testGeminiConnection = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { apiKey, model } = req.body || {};
    const result = await geminiConfigService.testConnection(apiKey, model);
    res.status(200).json({
      success: true,
      message: result.message,
      model: result.model,
    });
  } catch (error: any) {
    console.error("Admin test gemini connection error:", error);
    res.status(200).json({
      success: false,
      message: `Gemini connection test failed: ${error.message}`,
    });
  }
};
