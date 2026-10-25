import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { resolveUserId } from "../utils/resolve-user.js";
import {
  chatWithWORKPILOTAgent,
  executeAutonomousCampaignWorkflow,
  stopAgentExecution,
} from "../agent/WORKPILOT-connect-agent.js";
import { WORKPILOTConnectTools } from "../tools/tools.js";
import { agentMemoryService } from "../services/agent/agent-memory.service.js";
import { taskManager } from "../agent/WORKPILOT-task-manager.js";
import { dailyAgentService } from "../agent/daily/daily-agent.service.js";
import { db } from "../db/index.js";
import { contacts, messages, linkedinAccounts } from "../db/schema.js";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { linkedInMessageService } from "../services/linkedin/message.service.js";

/**
 * Constant Server-Sent Events (SSE) Stream Endpoint
 * Production-ready for AWS EC2 and Nginx reverse proxy.
 * GET /api/agent/stream
 */
export const streamAgentEvents = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = (await resolveUserId(req)) || "default";

    // Set production-ready SSE headers for AWS EC2 and Nginx
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disables Nginx buffering on EC2!
    res.flushHeaders?.();

    // Register SSE client with task manager
    taskManager.registerSseClient(userId, res);

    console.log(`📡 [SSE STREAM] Client connected for user ${userId}.`);
  } catch (error: any) {
    console.error("SSE stream controller error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to establish SSE stream.",
      });
    }
  }
};

/**
 * List Active Background Subagent Tasks
 * GET /api/agent/tasks
 */
export const getAgentTasks = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    const tasks = taskManager.getUserTasks(userId || "default");
    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    console.error("Get agent tasks controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch agent tasks.",
    });
  }
};

/**
 * Stop a Specific Subagent Task
 * POST /api/agent/tasks/:taskId/stop
 */
export const stopAgentTask = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    const rawTaskId = req.params.taskId;
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;

    if (!taskId) {
      res.status(400).json({ success: false, message: "taskId parameter is required." });
      return;
    }

    const stopped = taskManager.stopTask(taskId, userId || undefined);

    res.status(200).json({
      success: true,
      stopped,
      message: stopped
        ? `Task ${taskId} stopped successfully.`
        : `Task ${taskId} not found or already completed.`,
    });
  } catch (error: any) {
    console.error("Stop agent task controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to stop agent task.",
    });
  }
};

export const stopAgent = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    const threadId =
      req.body?.threadId || (userId ? `thread_${userId}` : "default");

    const stoppedThread = stopAgentExecution(threadId);
    const stoppedTasksCount = taskManager.stopAllUserTasks(userId || "default");

    res.status(200).json({
      success: true,
      stopped: stoppedThread || stoppedTasksCount > 0,
      stoppedTasksCount,
      message:
        stoppedThread || stoppedTasksCount > 0
          ? "Agent execution and all active subagents halted successfully."
          : "No active execution was running on this thread.",
      threadId,
    });
  } catch (error: any) {
    console.error("Stop agent controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to stop agent execution.",
    });
  }
};

export const chatWithAgent = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }
    const { messages, threadId, modelName, apiKey, resume, agentSettings } =
      req.body;

    if (resume === undefined && (!messages || !Array.isArray(messages))) {
      res.status(400).json({
        success: false,
        message:
          "messages array is required (e.g. [{ role: 'user', content: '...' }]) or resume payload.",
      });
      return;
    }

    const result = await chatWithWORKPILOTAgent({
      messages: messages || [],
      userId: userId || undefined,
      threadId: threadId || (userId ? `thread_${userId}` : undefined),
      modelName,
      apiKey,
      resume,
      agentSettings,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Agent chat controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process agent chat.",
    });
  }
};

export const launchAutonomousCampaign = async (
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

    const { goal, targetRole, location, industry, limit, personalizedNote, campaignType } =
      req.body;

    if (!goal && !targetRole) {
      res.status(400).json({
        success: false,
        message:
          "goal or targetRole is required to initiate an autonomous campaign.",
      });
      return;
    }

    const result = await executeAutonomousCampaignWorkflow({
      goal: goal || targetRole,
      targetRole,
      location,
      industry,
      limit: limit ? Number(limit) : 10,
      personalizedNote,
      userId,
      campaignType,
    });

    res.status(200).json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    console.error("Agent campaign controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to launch autonomous campaign.",
    });
  }
};

export const listAgentTools = async (
  _req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tools = WORKPILOTConnectTools.map((t) => ({
      name: t.name,
      description: t.description,
      schema: (t as any).schema ? (t as any).schema.shape : undefined,
    }));

    res.status(200).json({
      success: true,
      count: tools.length,
      tools,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to list agent tools.",
    });
  }
};

export const getAgentMessages = async (
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

    const messages = await agentMemoryService.getHistory(userId);

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error("Get agent messages controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve agent messages.",
    });
  }
};

/**
 * Clear Short-Term Agent Conversation History
 * DELETE /api/agent/messages
 */
export const clearAgentMessages = async (
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

    await agentMemoryService.clearHistory(userId);

    res.status(200).json({
      success: true,
      message: "Conversation history cleared successfully.",
    });
  } catch (error: any) {
    console.error("Clear agent messages controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to clear agent messages.",
    });
  }
};

/**
 * Retrieve User Agent Settings & Custom Personality
 * GET /api/agent/settings
 */
export const getAgentSettings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    const key = userId || "default";

    // Load persistent DB settings
    const dbConfig = await dailyAgentService.getDailyAgentConfig(key);
    const inMemorySettings = agentMemoryService.getUserSettings(key);
    const isOutreachRunning = taskManager.isOutreachActive(key);

    res.status(200).json({
      success: true,
      data: {
        ...inMemorySettings,
        ...dbConfig,
        isOutreachRunning,
        isLocked: isOutreachRunning,
      },
    });
  } catch (error: any) {
    console.error("Get agent settings controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch agent settings.",
    });
  }
};

/**
 * Update User Agent Settings & Custom Personality
 * POST /api/agent/settings
 */
export const updateAgentSettings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    const key = userId || "default";

    // Strictly enforce lock if an outreach campaign is active
    if (taskManager.isOutreachActive(key)) {
      res.status(400).json({
        success: false,
        message:
          "Daily outreach quota is locked while an autonomous outreach campaign is active. Please stop or wait for the campaign to complete before modifying limits.",
      });
      return;
    }

    // Save persistent settings in DB
    const savedDb = await dailyAgentService.saveDailyAgentConfig(key, req.body);
    // Keep in-memory cache synchronized
    agentMemoryService.saveUserSettings(key, {
      personality: savedDb.personality || "Professional peer.",
      dailyQuota: savedDb.dailyQuota,
    });


    res.status(200).json({
      success: true,
      data: savedDb,
      message: "Agent settings and daily preferences updated successfully.",
    });
  } catch (error: any) {
    console.error("Update agent settings controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update agent settings.",
    });
  }
};

/**
 * Retrieve User's Past Daily Agent Runs
 * GET /api/agent/daily/runs
 */
export const getDailyAgentRuns = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const runs = await dailyAgentService.getUserRunHistory(userId, 20);
    res.status(200).json({
      success: true,
      data: runs,
    });
  } catch (error: any) {
    console.error("Get daily agent runs error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch daily agent runs.",
    });
  }
};

/**
 * Manually Trigger Daily Autonomous Agent Right Now
 * POST /api/agent/daily/run-now
 */
export const triggerDailyAgentRunNow = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    // Execute daily agent run with isManualTrigger = true
    const result = await dailyAgentService.runForUser(userId, true);
    res.status(200).json({
      success: result.status !== "FAILED",
      data: result,
    });
  } catch (error: any) {
    console.error("Manual daily agent run error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to execute daily agent.",
    });
  }
};

/**
 * Get Draft Replies Waiting for Human Approval
 * GET /api/agent/drafts
 */
export const getDraftReplies = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const drafts = await db
      .select({
        contactId: contacts.id,
        contactName: contacts.name,
        company: contacts.company,
        designation: contacts.designation,
        linkedinId: contacts.linkedinId,
        draftReply: contacts.draftReply,
        draftReplyReason: contacts.draftReplyReason,
        draftReplyAt: contacts.draftReplyAt,
        lastMessageReceivedAt: contacts.lastMessageReceivedAt,
      })
      .from(contacts)
      .where(and(eq(contacts.userId, userId), isNotNull(contacts.draftReply)))
      .orderBy(desc(contacts.draftReplyAt));

    res.status(200).json({
      success: true,
      data: drafts,
    });
  } catch (error: any) {
    console.error("Get draft replies error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch draft replies.",
    });
  }
};

/**
 * Approve and Send a Drafted Reply
 * POST /api/agent/drafts/:contactId/approve
 */
export const approveDraftReply = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    const rawContactId = req.params.contactId;
    const contactId = Array.isArray(rawContactId) ? rawContactId[0] : rawContactId;
    const customText = req.body?.text;

    if (!userId || !contactId) {
      res.status(400).json({ success: false, message: "Authentication and contactId are required." });
      return;
    }

    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.id, contactId)))
      .limit(1);

    if (!contact || !contact.draftReply) {
      res.status(404).json({ success: false, message: "Draft reply not found for this contact." });
      return;
    }

    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(and(eq(linkedinAccounts.userId, userId), eq(linkedinAccounts.isConnected, true)))
      .limit(1);

    const replyText = customText && typeof customText === "string" && customText.trim()
      ? customText.trim()
      : contact.draftReply;

    const sendRes = await linkedInMessageService.sendMessage(
      contact.linkedinId,
      replyText,
      account?.unipileAccountId || undefined,
    );

    if (!sendRes.success) {
      res.status(500).json({ success: false, message: sendRes.message });
      return;
    }

    // Save message to messages table
    await db.insert(messages).values({
      userId,
      contactId: contact.id,
      conversationId: `chat_${contact.linkedinId}`,
      senderId: account?.unipileAccountId || "self",
      senderName: account?.linkedinName || "Me",
      direction: "OUTBOUND",
      content: replyText,
      sentAt: new Date(),
    });

    // Clear draft on contact
    await db
      .update(contacts)
      .set({
        draftReply: null,
        draftReplyReason: null,
        lastMessageSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, contact.id), eq(contacts.userId, userId)));

    res.status(200).json({
      success: true,
      message: "Draft reply approved and sent successfully.",
    });
  } catch (error: any) {
    console.error("Approve draft reply error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to approve draft reply.",
    });
  }
};

/**
 * Dismiss / Reject a Drafted Reply
 * DELETE /api/agent/drafts/:contactId
 */
export const rejectDraftReply = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    const rawContactId = req.params.contactId;
    const contactId = Array.isArray(rawContactId) ? rawContactId[0] : rawContactId;

    if (!userId || !contactId) {
      res.status(400).json({ success: false, message: "Authentication and contactId are required." });
      return;
    }

    await db
      .update(contacts)
      .set({
        draftReply: null,
        draftReplyReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.userId, userId), eq(contacts.id, contactId)));

    res.status(200).json({
      success: true,
      message: "Draft reply dismissed.",
    });
  } catch (error: any) {
    console.error("Reject draft reply error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to reject draft reply.",
    });
  }
};

/**
 * Launch Outreach to Existing Connections by Niche
 * POST /api/agent/outreach-connections
 * Fetches live connections from Unipile (not just local DB) and sends personalized messages.
 */
export const outreachConnections = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const { niche, count = 10, messageTemplate } = req.body as {
      niche: string;
      count?: number;
      messageTemplate?: string;
    };

    if (!niche || typeof niche !== "string") {
      res.status(400).json({ success: false, message: "niche is required." });
      return;
    }

    const safeCount = Math.min(Math.max(1, Math.floor(Number(count) || 10)), 100);

    // Strictly scoped: only use the authenticated user's own connected account
    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(
        and(
          eq(linkedinAccounts.userId, userId),
          eq(linkedinAccounts.isConnected, true),
        ),
      )
      .limit(1);

    if (!account?.unipileAccountId) {
      res.status(400).json({
        success: false,
        message: "No LinkedIn account connected. Please connect your LinkedIn first.",
      });
      return;
    }

    // Import unipileClient dynamically (already a singleton)
    const { unipileClient } = await import("../services/unipile/unipile.client.js");

    // ── Build comprehensive keywords for niche matching ────────────────────
    const NICHE_EXPANSIONS: Record<string, string[]> = {
      founders: [
        "founder",
        "co-founder",
        "ceo",
        "chief executive",
        "owner",
        "partner",
        "founding",
        "entrepreneur",
        "director",
      ],
      developers: [
        "developer",
        "dev",
        "engineer",
        "software",
        "frontend",
        "backend",
        "fullstack",
        "full stack",
        "programmer",
        "coder",
        "architect",
        "tech",
        "web",
        "ai",
        "ml",
        "data",
        "python",
        "react",
        "node",
        "java",
        "cloud",
      ],
      marketers: [
        "marketing",
        "marketer",
        "growth",
        "seo",
        "sem",
        "content",
        "brand",
        "social media",
        "copywriter",
        "demand gen",
      ],
      sales: [
        "sales",
        "business development",
        "bdr",
        "sdr",
        "account executive",
        "account manager",
        "closing",
        "revenue",
      ],
      hr: [
        "hr",
        "human resources",
        "recruiter",
        "recruitment",
        "talent",
        "people ops",
        "headhunter",
      ],
      product: [
        "product manager",
        "product owner",
        "product lead",
        "head of product",
        "vp product",
        "cpo",
        "product",
      ],
      educators: [
        "educator",
        "teacher",
        "coach",
        "professor",
        "instructor",
        "trainer",
        "academic",
        "faculty",
      ],
      consultants: [
        "consultant",
        "consulting",
        "advisor",
        "adviser",
        "strategy",
        "analyst",
      ],
    };

    const cleanNiche = niche.trim().toLowerCase();
    const expandedKeywords: string[] = [];

    if (NICHE_EXPANSIONS[cleanNiche]) {
      expandedKeywords.push(...NICHE_EXPANSIONS[cleanNiche]);
    }

    const rawKeywords = cleanNiche.split(/[\s,&/]+/).filter(Boolean);
    for (const kw of rawKeywords) {
      expandedKeywords.push(kw);
      if (kw.endsWith("s") && kw.length > 3) expandedKeywords.push(kw.slice(0, -1));
      if (kw.endsWith("es") && kw.length > 4) expandedKeywords.push(kw.slice(0, -2));
      if (kw.endsWith("ers") && kw.length > 5) expandedKeywords.push(kw.slice(0, -3));
      if (kw.endsWith("ing") && kw.length > 5) expandedKeywords.push(kw.slice(0, -3));
      if (NICHE_EXPANSIONS[kw]) {
        expandedKeywords.push(...NICHE_EXPANSIONS[kw]);
      }
    }
    const nicheKeywords = Array.from(
      new Set(expandedKeywords.filter((k) => k.length >= 2)),
    );

    // ── Fetch connections from Unipile API (paginate) ──────────────────────
    const matchedRelations: Array<{ providerId: string; name: string; headline: string }> = [];

    let cursor: string | undefined;
    let pagesFetched = 0;
    let totalConnectionsScanned = 0;

    while (matchedRelations.length < safeCount && pagesFetched < 25) {
      const params = new URLSearchParams({
        account_id: account.unipileAccountId,
        limit: "100",
      });
      if (cursor) params.set("cursor", cursor);

      const page = await unipileClient.request<{
        items: Array<{
          member_id?: string;
          member_urn?: string;
          public_identifier?: string;
          provider_id?: string;
          name?: string;
          first_name?: string;
          last_name?: string;
          headline?: string;
          current_company?: string;
        }>;
        cursor?: string;
      }>(`/api/v1/users/relations?${params.toString()}`);

      if (!page?.items?.length) break;
      totalConnectionsScanned += page.items.length;

      for (const rel of page.items) {
        const name = rel.name || `${rel.first_name || ""} ${rel.last_name || ""}`.trim();
        const headline = (rel.headline || rel.current_company || "").toLowerCase();
        const fullName = name.toLowerCase();

        const matches = nicheKeywords.some((kw) => headline.includes(kw) || fullName.includes(kw));
        if (matches) {
          const rawId = rel.member_id || rel.provider_id || rel.public_identifier;
          const providerId = rawId
            ? (rawId.startsWith("urn:li:fsd_profile:") ? rawId.replace("urn:li:fsd_profile:", "") : rawId)
            : (rel.member_urn ? rel.member_urn.replace(/^urn:li:(fsd_profile|fs_miniProfile|member):/, "") : undefined);

          if (providerId) {
            matchedRelations.push({
              providerId,
              name: name || "Connection",
              headline: rel.headline || rel.current_company || "",
            });
            if (matchedRelations.length >= safeCount) break;
          }
        }
      }

      cursor = page.cursor;
      pagesFetched++;
      if (!cursor) break;
    }

    if (matchedRelations.length === 0) {
      // Return how many total we scanned so user understands the situation
      res.status(200).json({
        success: true,
        sent: 0,
        message: `Scanned ${totalConnectionsScanned} of your LinkedIn connections, but found no one matching "${niche}". Try a broader keyword like "engineer", "founder", or "developer".`,
      });
      return;
    }

    // Load agent settings for goal context
    const agentConfig = await dailyAgentService.getDailyAgentConfig(userId);
    const goal = agentConfig.networkingGoal || "book_meeting";

    // ── Send messages ──────────────────────────────────────────────────────
    let sent = 0;
    const errors: string[] = [];

    for (const rel of matchedRelations) {
      try {
        const firstName = rel.name.split(" ")[0] || "there";
        const baseMsg = messageTemplate
          ? messageTemplate.replace(/\{name\}/gi, firstName).replace(/\{niche\}/gi, niche)
          : `Hi ${firstName}, I noticed we're connected on LinkedIn${
              rel.headline ? ` — great seeing your work in ${rel.headline}` : ""
            }. I'd love to connect more deeply. Are you open to a quick chat about ${
              goal === "book_meeting" ? "a quick demo call" :
              goal === "generate_leads" ? "potential collaboration" :
              goal === "partnerships" ? "a potential partnership" :
              goal === "recruitment" ? "an exciting opportunity" :
              "something I think you'd find valuable"
            }?`;

        // Send direct message (recipientId, text, accountId)
        const sendResult = await linkedInMessageService.sendMessage(
          rel.providerId,
          baseMsg,
          account.unipileAccountId,
        );

        if (sendResult.success) {
          sent++;
        } else {
          errors.push(`${rel.name}: ${sendResult.message}`);
        }
      } catch (err: any) {
        errors.push(`${rel.name}: ${err?.message || "send failed"}`);
      }
    }

    res.status(200).json({
      success: true,
      sent,
      total: matchedRelations.length,
      scanned: totalConnectionsScanned,
      message: `✅ Outreach sent to ${sent} of ${matchedRelations.length} "${niche}" connections! (Scanned ${totalConnectionsScanned} total connections)${
        errors.length > 0 ? ` (${errors.length} failed — ${errors[0]})` : ""
      }`,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (error: any) {
    console.error("Outreach connections controller error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to launch outreach.",
    });
  }
};
