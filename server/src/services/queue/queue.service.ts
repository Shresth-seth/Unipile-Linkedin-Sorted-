import { eq, and, lte, desc, lt, gte } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "../../db/index.js";
import {
  actionQueue,
  contacts,
  linkedinAccounts,
  QueuedAction,
} from "../../db/schema.js";
import { accountSafetyService } from "../safety/safety.service.js";
import { linkedInConnectionService } from "../linkedin/connection.service.js";
import { linkedInMessageService } from "../linkedin/message.service.js";
import { linkedInPostService } from "../linkedin/post.service.js";

export interface EnqueueOptions {
  contactId?: string;
  delayMinutes?: number;
  jitterMinutes?: number;
  timezone?: string;
}

export class ActionQueueService {
  public async enqueue(
    userId: string,
    actionType: "CONNECT" | "MESSAGE" | "VIEW" | "REACT" | "COMMENT",
    payload: any,
    options: EnqueueOptions = {},
  ): Promise<QueuedAction> {
    const minDelay =
      options.delayMinutes !== undefined ? options.delayMinutes : 10;
    const jitter =
      options.jitterMinutes !== undefined
        ? Math.floor(Math.random() * options.jitterMinutes)
        : minDelay === 0
          ? 0
          : Math.floor(Math.random() * 6);
    const totalDelayMs = (minDelay + jitter) * 60 * 1000;

    const [latestJob] = await db
      .select()
      .from(actionQueue)
      .where(
        and(eq(actionQueue.userId, userId), eq(actionQueue.status, "QUEUED")),
      )
      .orderBy(desc(actionQueue.scheduledFor))
      .limit(1);

    const baseTime =
      latestJob && latestJob.scheduledFor.getTime() > Date.now()
        ? latestJob.scheduledFor.getTime()
        : Date.now();

    let scheduledFor = new Date(baseTime + totalDelayMs);

    if (minDelay > 0) {
      const tz = options.timezone && DateTime.now().setZone(options.timezone).isValid ? options.timezone : undefined;
      if (tz) {
        const luxonScheduled = DateTime.fromJSDate(scheduledFor).setZone(tz);
        const scheduledHour = luxonScheduled.hour;
        if (scheduledHour >= 19 || scheduledHour < 8) {
          let adjusted = luxonScheduled;
          if (scheduledHour >= 19) {
            adjusted = adjusted.plus({ days: 1 });
          }
          adjusted = adjusted.set({
            hour: 9,
            minute: Math.floor(Math.random() * 20) + 5,
            second: 0,
            millisecond: 0,
          });
          scheduledFor = adjusted.toJSDate();
        }
      } else {
        const scheduledHour = scheduledFor.getHours();
        if (scheduledHour >= 19 || scheduledHour < 8) {
          if (scheduledHour >= 19) {
            scheduledFor.setDate(scheduledFor.getDate() + 1);
          }
          scheduledFor.setHours(9, Math.floor(Math.random() * 20) + 5, 0, 0);
        }
      }
    }

    const [job] = await db
      .insert(actionQueue)
      .values({
        userId,
        contactId: options.contactId,
        actionType,
        payload,
        status: "QUEUED",
        scheduledFor,
      })
      .returning();

    if (!job) {
      throw new Error("Failed to enqueue action.");
    }

    return job;
  }

  public async processDueActions(userId?: string): Promise<{
    processed: number;
    results: Array<{
      jobId: string;
      action: string;
      status: string;
      reason?: string;
    }>;
  }> {
    const now = new Date();
    // Reclaim transient stale locks
    await db.update(actionQueue).set({ status: "QUEUED", lockedAt: null })
      .where(and(
        eq(actionQueue.status, "PROCESSING"),
        lt(actionQueue.lockedAt, new Date(now.getTime() - 5 * 60 * 1000)),
        lt(actionQueue.attempts, 3),
      ));

    // Mark exhausted stale locks as FAILED to prevent orphaned PROCESSING jobs
    await db.update(actionQueue).set({
      status: "FAILED",
      lockedAt: null,
      errorMessage: "Job execution timed out after maximum retry attempts.",
    })
      .where(and(
        eq(actionQueue.status, "PROCESSING"),
        lt(actionQueue.lockedAt, new Date(now.getTime() - 5 * 60 * 1000)),
        gte(actionQueue.attempts, 3),
      ));
    const condition = userId
      ? and(
          eq(actionQueue.status, "QUEUED"),
          lte(actionQueue.scheduledFor, now),
          eq(actionQueue.userId, userId),
        )
      : and(
          eq(actionQueue.status, "QUEUED"),
          lte(actionQueue.scheduledFor, now),
        );

    const dueJobs = await db
      .select()
      .from(actionQueue)
      .where(condition)
      .limit(10);

    const results: Array<{
      jobId: string;
      action: string;
      status: string;
      reason?: string;
    }> = [];

    for (const job of dueJobs) {
      const [claimed] = await db.update(actionQueue)
        .set({ status: "PROCESSING", lockedAt: new Date(), attempts: job.attempts + 1 })
        .where(and(eq(actionQueue.id, job.id), eq(actionQueue.status, "QUEUED")))
        .returning({ id: actionQueue.id });
      if (!claimed) continue;

      const payload: any = job.payload;
      const safety = await accountSafetyService.verifyPreFlight(
        job.userId,
        job.actionType as any,
        job.contactId || undefined,
        payload?.person?.linkedin_id || payload?.recipientId,
        payload?.message || payload?.note,
      );

      if (!safety.allowed) {
        const newStatus = safety.circuitBreakerTriggered ? "PAUSED" : "SKIPPED";
        await db
          .update(actionQueue)
          .set({
            status: newStatus,
            errorMessage: safety.reason,
            lockedAt: null,
          })
          .where(eq(actionQueue.id, job.id));

        const resultItem: {
          jobId: string;
          action: string;
          status: string;
          reason?: string;
        } = {
          jobId: job.id,
          action: job.actionType,
          status: newStatus,
        };
        if (safety.reason) {
          resultItem.reason = safety.reason;
        }
        results.push(resultItem);
        continue;
      }

      let providerSuccess = false;
      try {
        const [userAccount] = await db
          .select()
          .from(linkedinAccounts)
          .where(
            and(
              eq(linkedinAccounts.userId, job.userId),
              eq(linkedinAccounts.isConnected, true),
            ),
          );
        const activeAccountId = userAccount?.unipileAccountId || undefined;
        if (!activeAccountId || userAccount?.healthStatus === "DISCONNECTED") {
          throw new Error(
            "User LinkedIn account is not connected or cookies were purged.",
          );
        }

        // Validate that target contact belongs to the job owner before provider side effects
        if (job.contactId) {
          const [ownedContact] = await db
            .select({ id: contacts.id })
            .from(contacts)
            .where(
              and(
                eq(contacts.id, job.contactId),
                eq(contacts.userId, job.userId),
              ),
            )
            .limit(1);

          if (!ownedContact) {
            throw new Error(
              `Target contact ${job.contactId} not found or does not belong to user ${job.userId}.`,
            );
          }
        }

        if (job.actionType === "CONNECT") {
          const result = await linkedInConnectionService.sendConnectionRequest(
            payload.person,
            payload.note,
            activeAccountId,
          );
          if (!result.success) {
            throw new Error(result.message || "Failed to send connection request");
          }
          providerSuccess = true;
          if (job.contactId) {
            await db
              .update(contacts)
              .set({
                status: "CONTACTED",
                connectionSentAt: new Date(),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(contacts.id, job.contactId),
                  eq(contacts.userId, job.userId),
                ),
              );
          }
        } else if (job.actionType === "MESSAGE") {
          const recipientId = payload.recipientId || payload.person?.linkedin_id || payload.person?.profile_url || payload.person?.name;
          const messageText = payload.message || payload.note || "";
          
          if (!recipientId) {
            throw new Error("Missing recipient ID for message action");
          }
          
          const result = await linkedInMessageService.sendMessage(
            recipientId,
            messageText,
            activeAccountId,
          );
          if (!result.success) {
            throw new Error(result.message || "Failed to send direct message");
          }
          providerSuccess = true;
          if (job.contactId) {
            await db
              .update(contacts)
              .set({ lastMessageSentAt: new Date(), updatedAt: new Date() })
              .where(
                and(
                  eq(contacts.id, job.contactId),
                  eq(contacts.userId, job.userId),
                ),
              );
          }
        } else if (job.actionType === "REACT") {
          await linkedInPostService.reactToPost(
            payload.postId,
            payload.reactionType,
            activeAccountId,
          );
          providerSuccess = true;
        } else if (job.actionType === "COMMENT") {
          await linkedInPostService.commentOnPost(
            payload.postId,
            payload.comment,
            activeAccountId,
          );
          providerSuccess = true;
        }

        await db
          .update(actionQueue)
          .set({ status: "COMPLETED", executedAt: new Date(), lockedAt: null })
          .where(eq(actionQueue.id, job.id));

        results.push({
          jobId: job.id,
          action: job.actionType,
          status: "COMPLETED",
        });
      } catch (err: any) {
        const isAmbiguousProviderOutcome = providerSuccess;
        await db
          .update(actionQueue)
          .set({
            status: isAmbiguousProviderOutcome ? "COMPLETED" : "FAILED",
            errorMessage: isAmbiguousProviderOutcome
              ? `Provider action succeeded, but secondary record update failed: ${err.message}`
              : err.message,
            attempts: job.attempts + 1,
            lockedAt: null,
            executedAt: isAmbiguousProviderOutcome ? new Date() : null,
          })
          .where(eq(actionQueue.id, job.id));

        results.push({
          jobId: job.id,
          action: job.actionType,
          status: isAmbiguousProviderOutcome ? "COMPLETED" : "FAILED",
          reason: isAmbiguousProviderOutcome
            ? `Provider action succeeded, but secondary record update failed: ${err.message}`
            : err.message,
        });
      }
    }

    return {
      processed: results.length,
      results,
    };
  }

  public async getQueueStats(userId: string) {
    const jobs = await db
      .select()
      .from(actionQueue)
      .where(eq(actionQueue.userId, userId));

    return {
      total: jobs.length,
      queued: jobs.filter((j) => j.status === "QUEUED").length,
      completed: jobs.filter((j) => j.status === "COMPLETED").length,
      paused: jobs.filter((j) => j.status === "PAUSED").length,
      failed: jobs.filter((j) => j.status === "FAILED").length,
      skipped: jobs.filter((j) => j.status === "SKIPPED").length,
    };
  }
}

export const actionQueueService = new ActionQueueService();
