import { db } from "../../db/index.js";
import {
  dailyAgentSettings,
  dailyAgentRuns,
  contacts,
  users,
} from "../../db/schema.js";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { DateTime } from "luxon";
import { accountSafetyService } from "../../services/safety/safety.service.js";
import { linkedInConnectionService } from "../../services/linkedin/connection.service.js";
import { linkedInMessageService } from "../../services/linkedin/message.service.js";
import { dailyAgentPlanner } from "./daily-agent-planner.js";
import {
  DailyAgentConfig,
  DailyRunSummary,
  DailyAgentMode,
  DailyReplyMode,
  DailyRunStatus,
} from "./daily-agent.types.js";
import { taskManager } from "../WORKPILOT-task-manager.js";

export class DailyAgentService {
  /**
   * Initializes timezone and scheduled 04:00 AM run for new or returning users on login/signup.
   */
  public async ensureUserInitialized(userId: string, incomingTz?: string): Promise<void> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return;

      const effectiveTz = (incomingTz && incomingTz.trim() !== "") ? incomingTz.trim() : (user.timezone || "UTC");

      if (incomingTz && incomingTz.trim() !== "" && (!user.timezone || user.timezone === "UTC") && incomingTz !== "UTC") {
        await db.update(users).set({ timezone: incomingTz.trim() }).where(eq(users.id, userId));
      }

      const [existingSettings] = await db
        .select()
        .from(dailyAgentSettings)
        .where(eq(dailyAgentSettings.userId, userId))
        .limit(1);

      if (!existingSettings) {
        await db
          .insert(dailyAgentSettings)
          .values({
            userId,
            dailyAgentEnabled: false,
            dailyAgentMode: "AUTONOMOUS",
            targetRoles: [],
            targetIndustries: [],
            targetLocations: [],
            autoConnectionRequests: false,
            autoFollowUps: true,
            autoMessageReplies: true,
            replyMode: "AUTO",
            preferredDailyStartTime: "04:00",
            timezone: effectiveTz,
            dailyQuota: 10,
            nextDailyRunAt: null,
          })
          .onConflictDoNothing();
      } else {
        await db
          .update(dailyAgentSettings)
          .set({
            timezone: effectiveTz,
            nextDailyRunAt: null,
            autoConnectionRequests: false,
            updatedAt: new Date(),
          })
          .where(eq(dailyAgentSettings.userId, userId));
      }
    } catch (err: any) {
      console.warn(`[daily-agent] Failed to ensure user initialization for ${userId}:`, err?.message || err);
    }
  }

  /**
   * Loads or provisions default daily agent settings for a user.
   */
  public async getDailyAgentConfig(userId: string): Promise<DailyAgentConfig> {
    const [existing] = await db
      .select()
      .from(dailyAgentSettings)
      .where(eq(dailyAgentSettings.userId, userId))
      .limit(1);

    if (existing) {
      return {
        userId: existing.userId,
        dailyAgentEnabled: existing.dailyAgentEnabled,
        dailyAgentMode: existing.dailyAgentMode as DailyAgentMode,
        targetRoles: (existing.targetRoles as string[]) || [],
        targetIndustries: (existing.targetIndustries as string[]) || [],
        targetLocations: (existing.targetLocations as string[]) || [],
        networkingGoal: existing.networkingGoal || undefined,
        autoConnectionRequests: existing.autoConnectionRequests,
        autoFollowUps: existing.autoFollowUps,
        autoMessageReplies: existing.autoMessageReplies,
        replyMode: existing.replyMode as DailyReplyMode,
        preferredDailyStartTime: existing.preferredDailyStartTime,
        timezone: existing.timezone,
        dailyQuota: existing.dailyQuota,
        personality: existing.personality || undefined,
        companyKnowledge: existing.companyKnowledge || undefined,
        faq: existing.faq || undefined,
        autoNewConnectionMessage: existing.autoNewConnectionMessage ?? true,
        newConnectionMessageTemplate: existing.newConnectionMessageTemplate || undefined,
        nextDailyRunAt: existing.nextDailyRunAt,
        lastDailyRunAt: existing.lastDailyRunAt,
      };
    }

    // Default configuration if not yet set by user: query users table for timezone
    let userTz = "UTC";
    try {
      const [u] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
      if (u?.timezone) {
        userTz = u.timezone;
      }
    } catch {}

    const defaultStartTime = "04:00";
    const nextRun = this.calculateNextDailyRun(defaultStartTime, userTz);

    const [created] = await db
      .insert(dailyAgentSettings)
      .values({
        userId,
        dailyAgentEnabled: false,
        dailyAgentMode: "AUTONOMOUS",
        targetRoles: [],
        targetIndustries: [],
        targetLocations: [],
        autoConnectionRequests: true,
        autoFollowUps: true,
        autoMessageReplies: true,
        replyMode: "AUTO",
        preferredDailyStartTime: defaultStartTime,
        timezone: userTz,
        dailyQuota: 10,
        nextDailyRunAt: nextRun,
      })
      .onConflictDoNothing()
      .returning();

    const record = created || {
      userId,
      dailyAgentEnabled: false,
      dailyAgentMode: "AUTONOMOUS",
      targetRoles: [],
      targetIndustries: [],
      targetLocations: [],
      networkingGoal: null,
      autoConnectionRequests: true,
      autoFollowUps: true,
      autoMessageReplies: true,
      replyMode: "AUTO",
      preferredDailyStartTime: defaultStartTime,
      timezone: userTz,
      dailyQuota: 10,
      personality: null,
      companyKnowledge: null,
      faq: null,
      autoNewConnectionMessage: true,
      newConnectionMessageTemplate: null,
      nextDailyRunAt: nextRun,
      lastDailyRunAt: null,
    };

    return {
      userId: record.userId,
      dailyAgentEnabled: record.dailyAgentEnabled,
      dailyAgentMode: record.dailyAgentMode as DailyAgentMode,
      targetRoles: (record.targetRoles as string[]) || [],
      targetIndustries: (record.targetIndustries as string[]) || [],
      targetLocations: (record.targetLocations as string[]) || [],
      networkingGoal: record.networkingGoal || undefined,
      autoConnectionRequests: record.autoConnectionRequests,
      autoFollowUps: record.autoFollowUps,
      autoMessageReplies: record.autoMessageReplies,
      replyMode: record.replyMode as DailyReplyMode,
      preferredDailyStartTime: record.preferredDailyStartTime,
      timezone: record.timezone,
      dailyQuota: record.dailyQuota,
      personality: record.personality || undefined,
      companyKnowledge: record.companyKnowledge || undefined,
      faq: record.faq || undefined,
      autoNewConnectionMessage: record.autoNewConnectionMessage ?? true,
      newConnectionMessageTemplate: record.newConnectionMessageTemplate || undefined,
      nextDailyRunAt: record.nextDailyRunAt || undefined,
      lastDailyRunAt: record.lastDailyRunAt || undefined,
    };
  }

  /**
   * Saves or updates persistent user automation settings.
   */
  public async saveDailyAgentConfig(
    userId: string,
    updates: Partial<DailyAgentConfig>,
  ): Promise<DailyAgentConfig> {
    const current = await this.getDailyAgentConfig(userId);
    const updatedQuota =
      updates.dailyQuota !== undefined
        ? Math.max(1, Math.min(20, Number(updates.dailyQuota)))
        : current.dailyQuota;

    const valuesToStore = {
      userId,
      dailyAgentEnabled: updates.dailyAgentEnabled ?? current.dailyAgentEnabled,
      dailyAgentMode: updates.dailyAgentMode ?? current.dailyAgentMode,
      targetRoles: updates.targetRoles ?? current.targetRoles,
      targetIndustries: updates.targetIndustries ?? current.targetIndustries,
      targetLocations: updates.targetLocations ?? current.targetLocations,
      networkingGoal: updates.networkingGoal ?? current.networkingGoal,
      autoConnectionRequests: updates.autoConnectionRequests ?? current.autoConnectionRequests,
      autoFollowUps: updates.autoFollowUps ?? current.autoFollowUps,
      autoMessageReplies: updates.autoMessageReplies ?? current.autoMessageReplies,
      replyMode: updates.replyMode ?? current.replyMode,
      preferredDailyStartTime: updates.preferredDailyStartTime ?? current.preferredDailyStartTime,
      timezone: updates.timezone ?? current.timezone,
      dailyQuota: updatedQuota,
      personality: updates.personality ?? current.personality,
      companyKnowledge: updates.companyKnowledge ?? current.companyKnowledge,
      faq: updates.faq ?? current.faq,
      autoNewConnectionMessage: updates.autoNewConnectionMessage ?? current.autoNewConnectionMessage ?? true,
      newConnectionMessageTemplate: updates.newConnectionMessageTemplate ?? current.newConnectionMessageTemplate,
      updatedAt: new Date(),
    };

    const nextRun = this.calculateNextDailyRun(
      valuesToStore.preferredDailyStartTime,
      valuesToStore.timezone,
    );

    const fullValuesToStore = {
      ...valuesToStore,
      nextDailyRunAt: nextRun,
    };

    const [saved] = await db
      .insert(dailyAgentSettings)
      .values(fullValuesToStore)
      .onConflictDoUpdate({
        target: dailyAgentSettings.userId,
        set: fullValuesToStore,
      })
      .returning();

    if (!saved) {
      throw new Error("Failed to save or update daily agent settings");
    }

    if (updates.timezone) {
      try {
        await db.update(users).set({ timezone: updates.timezone }).where(eq(users.id, userId));
      } catch {}
    }

    return {
      userId: saved.userId,
      dailyAgentEnabled: saved.dailyAgentEnabled,
      dailyAgentMode: saved.dailyAgentMode as DailyAgentMode,
      targetRoles: (saved.targetRoles as string[]) || [],
      targetIndustries: (saved.targetIndustries as string[]) || [],
      targetLocations: (saved.targetLocations as string[]) || [],
      networkingGoal: saved.networkingGoal || undefined,
      autoConnectionRequests: saved.autoConnectionRequests,
      autoFollowUps: saved.autoFollowUps,
      autoMessageReplies: saved.autoMessageReplies,
      replyMode: saved.replyMode as DailyReplyMode,
      preferredDailyStartTime: saved.preferredDailyStartTime,
      timezone: saved.timezone,
      dailyQuota: saved.dailyQuota,
      personality: saved.personality || undefined,
      companyKnowledge: saved.companyKnowledge || undefined,
      faq: saved.faq || undefined,
      autoNewConnectionMessage: saved.autoNewConnectionMessage ?? true,
      newConnectionMessageTemplate: saved.newConnectionMessageTemplate || undefined,
      nextDailyRunAt: saved.nextDailyRunAt || undefined,
      lastDailyRunAt: saved.lastDailyRunAt || undefined,
    };
  }


  /**
   * Executes the autonomous daily workflow for a specific user.
   * Completely resilient, idempotent, and non-blocking.
   */
  public async runForUser(
    userId: string,
    isManualTrigger: boolean = false,
  ): Promise<DailyRunSummary> {
    const startedAt = new Date();
    const logs: Array<{ timestamp: string; level: "info" | "warn" | "error"; message: string }> = [];

    const log = (level: "info" | "warn" | "error", message: string) => {
      logs.push({ timestamp: new Date().toISOString(), level, message });
      console.log(`[daily-agent] [${userId.slice(0, 8)}] ${message}`);
    };

    log("info", "Starting daily autonomous agent run...");

    // 1. Load User Configuration & compute local calendar day in user's timezone
    const config = await this.getDailyAgentConfig(userId);
    const userTimezone = config.timezone || "UTC";
    const safeZone = userTimezone && DateTime.now().setZone(userTimezone).isValid ? userTimezone : "UTC";
    const nowInZone = DateTime.now().setZone(safeZone);
    const localDateStr = nowInZone.toFormat("yyyy-MM-dd");
    const localDayStartUtc = nowInZone.startOf("day").toJSDate();
    const runKey = `daily:${userId}:${localDateStr}`;

    // 2. Check for duplicate run for today (Idempotency)
    if (!isManualTrigger) {
      const [existingCompletedRun] = await db
        .select()
        .from(dailyAgentRuns)
        .where(eq(dailyAgentRuns.runKey, runKey))
        .limit(1);

      if (
        existingCompletedRun &&
        (existingCompletedRun.status === "COMPLETED" ||
          existingCompletedRun.status === "DAILY_LIMIT_REACHED" ||
          existingCompletedRun.status === "PARTIAL")
      ) {
        log("info", `Daily run for ${localDateStr} already exists (Status: ${existingCompletedRun.status}). Skipping duplicate execution.`);
        const nextRun = this.calculateNextDailyRun(config.preferredDailyStartTime, config.timezone);
        await db
          .update(dailyAgentSettings)
          .set({ nextDailyRunAt: nextRun, updatedAt: new Date() })
          .where(eq(dailyAgentSettings.userId, userId));

        return {
          runId: existingCompletedRun.id,
          userId,
          runKey,
          scheduledFor: existingCompletedRun.scheduledFor,
          status: "SKIPPED",
          startedAt,
          completedAt: new Date(),
          remainingCapacityAtStart: 0,
          prospectsDiscovered: 0,
          prospectsQualified: 0,
          prospectsReviewed: 0,
          strongMatchesFound: 0,
          connectionRequestsSent: 0,
          connectionRequestsFailed: 0,
          followUpsSent: 0,
          repliesHandled: 0,
          skippedCount: 1,
          errorsCount: 0,
          summary: `Skipped: daily run for ${localDateStr} was already executed (${existingCompletedRun.status}).`,
          logDetails: logs,
          nextDailyRunAt: nextRun,
        };
      }
    }

    // 3. Concurrency Lock: Prevent simultaneous executions for the same user
    const STALE_LOCK_MINUTES = 30;
    const staleLockThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000);

    const [activeRun] = await db
      .select()
      .from(dailyAgentRuns)
      .where(
        and(
          eq(dailyAgentRuns.userId, userId),
          eq(dailyAgentRuns.status, "RUNNING"),
          gte(dailyAgentRuns.startedAt, staleLockThreshold),
        ),
      )
      .limit(1);

    if (activeRun && !isManualTrigger) {
      log("warn", `A daily agent job is already running (Job ID: ${activeRun.id}). Skipping duplicate execution.`);
      return {
        runId: activeRun.id,
        userId,
        runKey,
        status: "SKIPPED",
        startedAt: activeRun.startedAt,
        completedAt: new Date(),
        remainingCapacityAtStart: 0,
        prospectsDiscovered: 0,
        prospectsQualified: 0,
        prospectsReviewed: 0,
        strongMatchesFound: 0,
        connectionRequestsSent: 0,
        connectionRequestsFailed: 0,
        followUpsSent: 0,
        repliesHandled: 0,
        skippedCount: 1,
        errorsCount: 0,
        summary: "Execution skipped: another daily agent run is already active.",
        logDetails: logs,
      };
    }

    // Insert atomic run record into daily_agent_runs
    const activeRunKey = isManualTrigger ? `manual:${userId}:${Date.now()}` : runKey;
    let currentRun: any;

    if (isManualTrigger) {
      [currentRun] = await db
        .insert(dailyAgentRuns)
        .values({
          userId,
          runKey: activeRunKey,
          scheduledFor: startedAt,
          status: "RUNNING",
          startedAt,
        })
        .returning();
    } else {
      const [claimed] = await db
        .insert(dailyAgentRuns)
        .values({
          userId,
          runKey: activeRunKey,
          scheduledFor: startedAt,
          status: "RUNNING",
          startedAt,
        })
        .onConflictDoNothing()
        .returning();

      if (!claimed) {
        // Run key already exists in database; inspect its active status
        const [existing] = await db
          .select()
          .from(dailyAgentRuns)
          .where(eq(dailyAgentRuns.runKey, activeRunKey))
          .limit(1);

        if (
          existing &&
          (existing.status === "COMPLETED" ||
            existing.status === "DAILY_LIMIT_REACHED" ||
            existing.status === "PARTIAL" ||
            (existing.status === "RUNNING" && existing.startedAt >= staleLockThreshold))
        ) {
          log("info", `Daily run for ${localDateStr} is already claimed/active (Status: ${existing?.status}). Skipping duplicate execution.`);
          return {
            runId: existing.id,
            userId,
            runKey: activeRunKey,
            scheduledFor: existing.scheduledFor,
            status: "SKIPPED",
            startedAt,
            completedAt: new Date(),
            remainingCapacityAtStart: 0,
            prospectsDiscovered: 0,
            prospectsQualified: 0,
            prospectsReviewed: 0,
            strongMatchesFound: 0,
            connectionRequestsSent: 0,
            connectionRequestsFailed: 0,
            followUpsSent: 0,
            repliesHandled: 0,
            skippedCount: 1,
            errorsCount: 0,
            summary: `Skipped: daily run for ${localDateStr} was already claimed (${existing?.status}).`,
            logDetails: logs,
          };
        }

        // Stale run recovery: atomic CAS claim on the stale record
        if (existing) {
          const [reclaimed] = await db
            .update(dailyAgentRuns)
            .set({
              status: "RUNNING",
              startedAt,
              errorMessage: null,
            })
            .where(
              and(
                eq(dailyAgentRuns.id, existing.id),
                eq(dailyAgentRuns.status, existing.status),
              ),
            )
            .returning();
          currentRun = reclaimed;
        }

        if (!currentRun) {
          log("warn", `Could not acquire atomic daily run lock for ${activeRunKey}. Another worker claimed it.`);
          return {
            runId: existing?.id || "run_" + Date.now(),
            userId,
            runKey: activeRunKey,
            status: "SKIPPED",
            startedAt,
            completedAt: new Date(),
            remainingCapacityAtStart: 0,
            prospectsDiscovered: 0,
            prospectsQualified: 0,
            prospectsReviewed: 0,
            strongMatchesFound: 0,
            connectionRequestsSent: 0,
            connectionRequestsFailed: 0,
            followUpsSent: 0,
            repliesHandled: 0,
            skippedCount: 1,
            errorsCount: 0,
            summary: "Execution skipped: another daily agent run claimed the lock.",
            logDetails: logs,
          };
        }
      } else {
        currentRun = claimed;
      }
    }

    const runId = currentRun?.id || "run_" + Date.now();

    try {
      if (!config.dailyAgentEnabled && !isManualTrigger) {
        log("info", "Daily agent is disabled in user settings. Skipping run.");
        return await this.finalizeRun(runId, userId, "SKIPPED", {
          runKey: activeRunKey,
          scheduledFor: startedAt,
          remainingCapacityAtStart: 0,
          prospectsDiscovered: 0,
          prospectsQualified: 0,
          prospectsReviewed: 0,
          strongMatchesFound: 0,
          connectionRequestsSent: 0,
          connectionRequestsFailed: 0,
          followUpsSent: 0,
          repliesHandled: 0,
          skippedCount: 1,
          errorsCount: 0,
          summary: "Daily agent is disabled for this account.",
          logs,
        });
      }

      const accountHealth = await accountSafetyService.getAccountHealth(userId);
      if (!accountHealth?.isConnected || accountHealth.healthStatus !== "HEALTHY") {
        const errorReason = `LinkedIn account is ${accountHealth?.healthStatus || "DISCONNECTED"}. Outreach cannot proceed safely.`;
        log("error", errorReason);
        return await this.finalizeRun(runId, userId, "FAILED", {
          runKey: activeRunKey,
          scheduledFor: startedAt,
          remainingCapacityAtStart: 0,
          prospectsDiscovered: 0,
          prospectsQualified: 0,
          prospectsReviewed: 0,
          strongMatchesFound: 0,
          connectionRequestsSent: 0,
          connectionRequestsFailed: 0,
          followUpsSent: 0,
          repliesHandled: 0,
          skippedCount: 0,
          errorsCount: 1,
          summary: `Run failed: ${errorReason}`,
          logs,
          error: errorReason,
        });
      }

      if (accountHealth.automationStatus === "PAUSED") {
        log("warn", "Automation is currently PAUSED for this account. Skipping outbound work.");
        return await this.finalizeRun(runId, userId, "SKIPPED", {
          runKey: activeRunKey,
          scheduledFor: startedAt,
          remainingCapacityAtStart: 0,
          prospectsDiscovered: 0,
          prospectsQualified: 0,
          prospectsReviewed: 0,
          strongMatchesFound: 0,
          connectionRequestsSent: 0,
          connectionRequestsFailed: 0,
          followUpsSent: 0,
          repliesHandled: 0,
          skippedCount: 1,
          errorsCount: 0,
          summary: "Automation is paused by user or safety trigger.",
          logs,
        });
      }

      // 4. Calculate WorkPilot Daily Sent Cap based on Local Calendar Day
      const configuredLimit = Math.max(1, Math.min(20, Number(config.dailyQuota || 10)));
      const sentTodayRecords = await db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(
          and(
            eq(contacts.userId, userId),
            gte(contacts.connectionSentAt, localDayStartUtc),
          ),
        );

      const alreadySentToday = Number(sentTodayRecords[0]?.count || 0);
      const remainingConnections = Math.max(0, configuredLimit - alreadySentToday);

      const remainingMessages = Math.max(
        0,
        (accountHealth.dailyLimits?.messages?.limit || 50) - (accountHealth.dailyLimits?.messages?.usedToday || 0),
      );

      log(
        "info",
        `Capacity verified for ${localDateStr}: ${alreadySentToday}/${configuredLimit} sent today (${remainingConnections} remaining capacity). Messages allowed: ${remainingMessages}.`,
      );

      // 5. Enforce Daily Limit: If capacity is 0, do not search or send
      if (remainingConnections === 0) {
        log("info", `Daily connection limit already reached (${alreadySentToday}/${configuredLimit} sent today). Marking run as DAILY_LIMIT_REACHED.`);
        const nextRun = this.calculateNextDailyRun(config.preferredDailyStartTime, config.timezone);
        return await this.finalizeRun(runId, userId, "DAILY_LIMIT_REACHED", {
          runKey: activeRunKey,
          scheduledFor: startedAt,
          remainingCapacityAtStart: 0,
          prospectsDiscovered: 0,
          prospectsQualified: 0,
          prospectsReviewed: 0,
          strongMatchesFound: 0,
          connectionRequestsSent: 0,
          connectionRequestsFailed: 0,
          followUpsSent: 0,
          repliesHandled: 0,
          skippedCount: 1,
          errorsCount: 0,
          summary: `Daily connection cap reached (${alreadySentToday}/${configuredLimit} sent on ${localDateStr}). Next run scheduled for tomorrow at ${config.preferredDailyStartTime} (${config.timezone}).`,
          logs,
          nextDailyRunAt: nextRun,
        });
      }

      let connectionRequestsSent = 0;
      let connectionRequestsFailed = 0;
      let followUpsSent = 0;
      let strongMatchesFound = 0;
      let prospectsReviewed = 0;
      let skippedCount = 0;
      let errorsCount = 0;
      let providerErrorReason: string | undefined = undefined;

      // 6. Prospect Discovery & Matching
      log("info", `Planning prospect outreach for up to ${remainingConnections} candidate(s)...`);
      const plan = await dailyAgentPlanner.planDailyWork(userId, config, remainingConnections);
      prospectsReviewed = plan.prospectsReviewed;
      strongMatchesFound = plan.strongMatches.length;

      log(
        "info",
        `Evaluated ${plan.prospectsReviewed} candidate(s). Found ${plan.strongMatches.length} strong match(es).`,
      );

      // 7. Ingest Candidates & Execute Connection Requests
      for (const item of plan.strongMatches) {
        if (connectionRequestsSent >= remainingConnections) {
          log("info", `Daily capacity target reached (${connectionRequestsSent} invites sent).`);
          break;
        }

        try {
          // Check if contact already exists
          const [existing] = await db
            .select()
            .from(contacts)
            .where(and(eq(contacts.userId, userId), eq(contacts.linkedinId, item.candidate.linkedinId)))
            .limit(1);

          let contactRecord = existing;

          if (!contactRecord) {
            const [inserted] = await db
              .insert(contacts)
              .values({
                userId,
                name: item.candidate.name,
                linkedinId: item.candidate.linkedinId,
                profileUrl: item.candidate.profileUrl,
                company: item.candidate.company,
                designation: item.candidate.designation,
                location: item.candidate.location,
                industry: item.candidate.industry,
                status: "NEW",
                matchScore: item.matchScore,
                matchReason: item.reason,
              })
              .returning();
            contactRecord = inserted;
          } else {
            // Update match score & reason
            await db
              .update(contacts)
              .set({
                matchScore: item.matchScore,
                matchReason: item.reason,
                updatedAt: new Date(),
              })
              .where(eq(contacts.id, contactRecord.id));
          }

          // In AUTONOMOUS mode with autoConnectionRequests enabled, dispatch invitation
          if (
            config.dailyAgentMode === "AUTONOMOUS" &&
            config.autoConnectionRequests &&
            contactRecord &&
            contactRecord.status === "NEW" &&
            !contactRecord.optedOut
          ) {
            const preflight = await accountSafetyService.verifyPreFlight(
              userId,
              "CONNECT",
              contactRecord.id,
              contactRecord.linkedinId,
            );

            if (!preflight.allowed) {
              log("warn", `Preflight denied for ${item.candidate.name}: ${preflight.reason}`);
              skippedCount++;
              continue;
            }

            // Send connection request via Unipile
            const sendRes = await linkedInConnectionService.sendConnectionRequest(
              item.candidate.linkedinId,
              item.personalizedNote,
              undefined,
              userId,
            );

            if (sendRes.success) {
              connectionRequestsSent++;
              await db
                .update(contacts)
                .set({
                  status: "CONTACTED",
                  connectionSentAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(contacts.id, contactRecord.id));

              log(
                "info",
                `✅ Connection request sent to ${item.candidate.name} (${item.matchScore}% Match). Note: ${item.personalizedNote ? "Yes" : "Blank"}`,
              );
            } else {
              connectionRequestsFailed++;
              errorsCount++;
              const errMsg = sendRes.message || "Failed to send invitation";
              log("warn", `Failed to send invite to ${item.candidate.name}: ${errMsg}`);

              // Check for Unipile / LinkedIn provider limits or restrictions
              const isProviderLimit =
                errMsg.includes("restricted") ||
                errMsg.includes("limit") ||
                errMsg.includes("403") ||
                errMsg.includes("429") ||
                errMsg.includes("quota") ||
                errMsg.includes("weekly");

              if (isProviderLimit) {
                log("error", `🚨 Provider limit/restriction detected: "${errMsg}". Halting further invitations for this run.`);
                providerErrorReason = errMsg;
                break; // Stop immediately as per provider safety rule
              }
            }
          } else {
            log("info", `Candidate ${item.candidate.name} staged as strong match for user review.`);
          }
        } catch (candErr: any) {
          connectionRequestsFailed++;
          errorsCount++;
          log("error", `Error processing candidate ${item.candidate.name}: ${candErr?.message || candErr}`);
        }
      }

      // 8. Review Existing Connections for Eligible Follow-ups
      if (config.autoFollowUps && remainingMessages > 0 && !providerErrorReason) {
        log("info", "Checking existing connections for eligible follow-ups...");
        try {
          const eligibleContacts = await db
            .select()
            .from(contacts)
            .where(
              and(
                eq(contacts.userId, userId),
                eq(contacts.status, "CONNECTED"),
                eq(contacts.optedOut, false),
                sql`${contacts.lastMessageSentAt} IS NULL`,
                sql`${contacts.lastMessageReceivedAt} IS NULL`,
              ),
            )
            .limit(Math.min(remainingMessages, 5));

          for (const contact of eligibleContacts) {
            try {
              const followUpText = `Hi ${contact.name.split(" ")[0]}, thanks for connecting! Looking forward to staying in touch and following your updates.`;

              const preflight = await accountSafetyService.verifyPreFlight(
                userId,
                "MESSAGE",
                contact.id,
                contact.linkedinId,
                followUpText,
              );

              if (preflight.allowed) {
                const sendResult = await linkedInMessageService.sendMessage(
                  contact.linkedinId,
                  followUpText,
                  accountHealth.accountId,
                );

                if (sendResult.success) {
                  followUpsSent++;
                  await db
                    .update(contacts)
                    .set({
                      lastMessageSentAt: new Date(),
                      updatedAt: new Date(),
                    })
                    .where(eq(contacts.id, contact.id));

                  log("info", `💬 Sent initial connection follow-up to ${contact.name}`);
                }
              }
            } catch (fuErr) {
              console.warn(`[DAILY-AGENT] Follow-up error for ${contact.name}:`, fuErr);
            }
          }
        } catch (followUpQueryErr) {
          console.warn("[DAILY-AGENT] Follow-up query error:", followUpQueryErr);
        }
      }

      // 9. Format Clean Summary
      const summaryText = `Daily Agent — ${localDateStr} | Capacity: ${remainingConnections} | Prospects reviewed: ${prospectsReviewed}, Strong matches found: ${strongMatchesFound}, Connection requests sent: ${connectionRequestsSent}, Failed: ${connectionRequestsFailed}, Follow-ups sent: ${followUpsSent}, Skipped: ${skippedCount}, Errors: ${errorsCount}${providerErrorReason ? ` (Provider restricted: ${providerErrorReason})` : ""}`;

      log("info", `Completed daily agent run: ${summaryText}`);

      const finalStatus: DailyRunStatus = providerErrorReason
        ? connectionRequestsSent > 0
          ? "PARTIAL"
          : "FAILED"
        : connectionRequestsFailed > 0 && connectionRequestsSent > 0
          ? "PARTIAL"
          : "COMPLETED";

      return await this.finalizeRun(runId, userId, finalStatus, {
        runKey: activeRunKey,
        scheduledFor: startedAt,
        remainingCapacityAtStart: remainingConnections,
        prospectsDiscovered: prospectsReviewed,
        prospectsQualified: strongMatchesFound,
        prospectsReviewed,
        strongMatchesFound,
        connectionRequestsSent,
        connectionRequestsFailed,
        followUpsSent,
        repliesHandled: 0,
        skippedCount,
        errorsCount,
        summary: summaryText,
        logs,
        error: providerErrorReason,
      });
    } catch (fatalErr: any) {
      log("error", `Fatal daily agent error: ${fatalErr?.message || fatalErr}`);
      return await this.finalizeRun(runId, userId, "FAILED", {
        runKey: activeRunKey,
        scheduledFor: startedAt,
        remainingCapacityAtStart: 0,
        prospectsDiscovered: 0,
        prospectsQualified: 0,
        prospectsReviewed: 0,
        strongMatchesFound: 0,
        connectionRequestsSent: 0,
        connectionRequestsFailed: 0,
        followUpsSent: 0,
        repliesHandled: 0,
        skippedCount: 0,
        errorsCount: 1,
        summary: `Execution encountered fatal error: ${fatalErr?.message || fatalErr}`,
        logs,
        error: fatalErr?.message || String(fatalErr),
      });
    }
  }

  /**
   * Finalizes the run record in DB, updates nextDailyRunAt, and emits SSE notifications.
   */
  private async finalizeRun(
    runId: string,
    userId: string,
    status: DailyRunStatus,
    data: {
      runKey?: string | undefined;
      scheduledFor?: Date | null | undefined;
      remainingCapacityAtStart?: number | undefined;
      prospectsDiscovered?: number | undefined;
      prospectsQualified?: number | undefined;
      prospectsReviewed: number;
      strongMatchesFound: number;
      connectionRequestsSent: number;
      connectionRequestsFailed?: number | undefined;
      followUpsSent: number;
      repliesHandled: number;
      skippedCount: number;
      errorsCount: number;
      summary: string;
      logs: any[];
      nextDailyRunAt?: Date | null | undefined;
      error?: string | undefined;
    },
  ): Promise<DailyRunSummary> {
    const completedAt = new Date();

    // 1. Compute nextDailyRunAt
    const [settings] = await db
      .select()
      .from(dailyAgentSettings)
      .where(eq(dailyAgentSettings.userId, userId))
      .limit(1);

    const nextRun =
      data.nextDailyRunAt ||
      this.calculateNextDailyRun(
        settings?.preferredDailyStartTime || "04:00",
        settings?.timezone || "UTC",
      );

    // 2. Update daily_agent_runs row
    await db
      .update(dailyAgentRuns)
      .set({
        status,
        completedAt,
        runKey: data.runKey || null,
        scheduledFor: data.scheduledFor || null,
        remainingCapacityAtStart: data.remainingCapacityAtStart ?? 10,
        prospectsDiscovered: data.prospectsDiscovered ?? data.prospectsReviewed,
        prospectsQualified: data.prospectsQualified ?? data.strongMatchesFound,
        prospectsReviewed: data.prospectsReviewed,
        strongMatchesFound: data.strongMatchesFound,
        connectionRequestsSent: data.connectionRequestsSent,
        connectionRequestsFailed: data.connectionRequestsFailed ?? 0,
        followUpsSent: data.followUpsSent,
        repliesHandled: data.repliesHandled,
        skippedCount: data.skippedCount,
        errorsCount: data.errorsCount,
        summary: data.summary,
        logDetails: data.logs,
        errorMessage: data.error || null,
        nextRunAt: nextRun,
      })
      .where(eq(dailyAgentRuns.id, runId));

    // 3. Update dailyAgentSettings with nextDailyRunAt
    await db
      .update(dailyAgentSettings)
      .set({
        lastDailyRunAt: completedAt,
        nextDailyRunAt: nextRun,
        updatedAt: new Date(),
      })
      .where(eq(dailyAgentSettings.userId, userId));

    // 4. Emit SSE Event to active dashboard clients
    try {
      taskManager.broadcastToUser(userId, "daily_agent_completed", {
        runId,
        status,
        summary: data.summary,
        completedAt: completedAt.toISOString(),
      });
    } catch {}

    return {
      runId,
      userId,
      runKey: data.runKey,
      scheduledFor: data.scheduledFor,
      status,
      startedAt: new Date(),
      completedAt,
      remainingCapacityAtStart: data.remainingCapacityAtStart,
      prospectsDiscovered: data.prospectsDiscovered,
      prospectsQualified: data.prospectsQualified,
      prospectsReviewed: data.prospectsReviewed,
      strongMatchesFound: data.strongMatchesFound,
      connectionRequestsSent: data.connectionRequestsSent,
      connectionRequestsFailed: data.connectionRequestsFailed,
      followUpsSent: data.followUpsSent,
      repliesHandled: data.repliesHandled,
      skippedCount: data.skippedCount,
      errorsCount: data.errorsCount,
      summary: data.summary,
      logDetails: data.logs,
      nextDailyRunAt: nextRun,
      error: data.error || undefined,
    };
  }

  /**
   * Calculates next daily run time based on user preferred time (default: "04:00") and user's IANA timezone.
   * Accurately converts to UTC Date for persistence.
   */
  public calculateNextDailyRun(preferredTime: string = "04:00", timezone: string = "UTC"): Date {
    const safeZone = timezone && DateTime.now().setZone(timezone).isValid ? timezone : "UTC";
    const nowInZone = DateTime.now().setZone(safeZone);

    const [hoursStr, minutesStr] = (preferredTime || "04:00").split(":");
    let targetHours = parseInt(hoursStr || "4", 10);
    let targetMinutes = parseInt(minutesStr || "0", 10);

    if (isNaN(targetHours) || targetHours < 0 || targetHours > 23) {
      targetHours = 4;
    }
    if (isNaN(targetMinutes) || targetMinutes < 0 || targetMinutes > 59) {
      targetMinutes = 0;
    }

    let candidate = nowInZone.set({
      hour: targetHours,
      minute: targetMinutes,
      second: 0,
      millisecond: 0,
    });

    // If target time in user's timezone has already passed today, schedule for tomorrow in that timezone
    if (candidate.toMillis() <= nowInZone.toMillis()) {
      candidate = candidate.plus({ days: 1 });
    }

    return candidate.toJSDate();
  }

  /**
   * Retrieves past daily agent run summaries for a user's dashboard.
   */
  public async getUserRunHistory(userId: string, limit: number = 10): Promise<any[]> {
    return db
      .select()
      .from(dailyAgentRuns)
      .where(eq(dailyAgentRuns.userId, userId))
      .orderBy(desc(dailyAgentRuns.startedAt))
      .limit(limit);
  }
}

export const dailyAgentService = new DailyAgentService();
