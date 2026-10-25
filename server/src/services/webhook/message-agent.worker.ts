import { db } from "../../db/index.js";
import { messageAgentJobs } from "../../db/schema.js";
import { eq, and, lt, desc, gte } from "drizzle-orm";
import { unipileMessageAgentService } from "./unipile-message-agent.service.js";

export interface MessageJobTelemetry {
  lastWebhookReceivedAt: Date | null;
  lastInboundMessageAt: Date | null;
  lastMessageJobCompletedAt: Date | null;
  lastMessageJobFailedAt: Date | null;
}

export class MessageAgentWorker {
  private isScanning: boolean = false;
  private telemetry: MessageJobTelemetry = {
    lastWebhookReceivedAt: null,
    lastInboundMessageAt: null,
    lastMessageJobCompletedAt: null,
    lastMessageJobFailedAt: null,
  };

  public recordWebhookReceived(): void {
    this.telemetry.lastWebhookReceivedAt = new Date();
  }

  public recordInboundMessageReceived(): void {
    this.telemetry.lastInboundMessageAt = new Date();
  }

  public getTelemetry(): MessageJobTelemetry {
    return { ...this.telemetry };
  }

  /**
   * Enqueues an incoming message job atomically into the PostgreSQL database.
   */
  public async enqueueJob(params: {
    userId: string;
    accountId: string;
    chatId: string;
    messageId: string;
    payload: any;
  }): Promise<string> {
    this.recordInboundMessageReceived();

    // Check if job with this messageId already exists (idempotency)
    const [existing] = await db
      .select({ id: messageAgentJobs.id, status: messageAgentJobs.status })
      .from(messageAgentJobs)
      .where(eq(messageAgentJobs.messageId, params.messageId))
      .limit(1);

    if (existing) {
      console.log(`⚡ [message-worker] Job for message '${params.messageId}' already exists (ID: ${existing.id}, Status: ${existing.status}).`);
      return existing.id;
    }

    const [created] = await db
      .insert(messageAgentJobs)
      .values({
        userId: params.userId,
        accountId: params.accountId,
        chatId: params.chatId,
        messageId: params.messageId,
        payload: params.payload,
        status: "PENDING",
        attemptCount: 0,
      })
      .returning({ id: messageAgentJobs.id });

    if (!created) {
      throw new Error(`Failed to insert message job for messageId: ${params.messageId}`);
    }

    console.log(`[message-job] Queued job ID ${created.id} for message ${params.messageId}`);
    return created.id;
  }

  /**
   * Atomically claims and processes a specific message agent job.
   */
  public async processJob(jobId: string): Promise<{
    success: boolean;
    status: string;
    reply?: string | undefined;
    error?: string | undefined;
  }> {
    // 1. Atomic claim: transition from PENDING -> PROCESSING
    const [claimed] = await db
      .update(messageAgentJobs)
      .set({
        status: "PROCESSING",
        attemptCount: 1, // incremented
      })
      .where(and(eq(messageAgentJobs.id, jobId), eq(messageAgentJobs.status, "PENDING")))
      .returning();

    if (!claimed) {
      // Job might already be processing or completed
      const [current] = await db
        .select()
        .from(messageAgentJobs)
        .where(eq(messageAgentJobs.id, jobId))
        .limit(1);
      return {
        success: current?.status === "COMPLETED",
        status: current?.status || "NOT_CLAIMED",
      };
    }

    console.log(`[message-worker] Picked job ID: ${jobId} for message ${claimed.messageId}`);

    try {
      // 2. Delegate execution to UnipileMessageAgentService
      const result = await unipileMessageAgentService.processMessageJob(claimed);

      // 3. Mark job as final state
      await db
        .update(messageAgentJobs)
        .set({
          status: result.status,
          suggestedReply: result.suggestedReply || null,
          sentReply: result.sentReply || null,
          reasoning: result.reasoning || null,
          error: result.error || null,
          processedAt: new Date(),
        })
        .where(eq(messageAgentJobs.id, jobId));

      this.telemetry.lastMessageJobCompletedAt = new Date();
      console.log(`[message-job] Completed job ${jobId}: ${result.status}`);

      return {
        success: result.status === "COMPLETED" || result.status === "SKIPPED",
        status: result.status,
        reply: result.sentReply || result.suggestedReply,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`❌ [message-worker] Error processing job ${jobId}:`, errMsg);

      await db
        .update(messageAgentJobs)
        .set({
          status: "FAILED",
          error: errMsg,
          processedAt: new Date(),
        })
        .where(eq(messageAgentJobs.id, jobId));

      this.telemetry.lastMessageJobFailedAt = new Date();
      return {
        success: false,
        status: "FAILED",
        error: errMsg,
      };
    }
  }

  /**
   * Scans for any pending message jobs that haven't been picked up
   * (e.g. following process restarts or temporary outages).
   */
  public async processPendingJobs(): Promise<{ checked: number; processed: number }> {
    if (this.isScanning) {
      return { checked: 0, processed: 0 };
    }

    this.isScanning = true;
    let processed = 0;

    try {
      // Reclaim stale PROCESSING jobs (stuck for more than 2 minutes due to worker restarts/timeouts)
      const staleCutoff = new Date(Date.now() - 2 * 60 * 1000);
      await db
        .update(messageAgentJobs)
        .set({
          status: "PENDING",
        })
        .where(
          and(
            eq(messageAgentJobs.status, "PROCESSING"),
            lt(messageAgentJobs.createdAt, staleCutoff),
            lt(messageAgentJobs.attemptCount, 3),
          ),
        )
        .catch(() => {});

      // Mark exhausted stale PROCESSING jobs as FAILED to prevent orphans
      await db
        .update(messageAgentJobs)
        .set({
          status: "FAILED",
          error: "Message processing timed out after max attempts",
          processedAt: new Date(),
        })
        .where(
          and(
            eq(messageAgentJobs.status, "PROCESSING"),
            lt(messageAgentJobs.createdAt, staleCutoff),
            gte(messageAgentJobs.attemptCount, 3),
          ),
        )
        .catch(() => {});

      const pendingJobs = await db
        .select({ id: messageAgentJobs.id })
        .from(messageAgentJobs)
        .where(
          and(
            eq(messageAgentJobs.status, "PENDING"),
            lt(messageAgentJobs.attemptCount, 3),
          ),
        )
        .orderBy(desc(messageAgentJobs.createdAt))
        .limit(10);

      for (const job of pendingJobs) {
        try {
          await this.processJob(job.id);
          processed++;
        } catch (jobErr: any) {
          console.error(`[message-worker] Error in pending job ${job.id}:`, jobErr?.message || jobErr);
        }
      }

      return { checked: pendingJobs.length, processed };
    } catch (err: any) {
      console.error("[message-worker] Failed to poll pending jobs:", err?.message || err);
      return { checked: 0, processed: 0 };
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Retrieves queue counts for admin telemetry.
   */
  public async getQueueCounts(): Promise<{ pending: number; processing: number; failed: number; completed: number }> {
    try {
      const rows = await db
        .select({
          status: messageAgentJobs.status,
        })
        .from(messageAgentJobs);

      let pending = 0;
      let processing = 0;
      let failed = 0;
      let completed = 0;

      for (const r of rows) {
        if (r.status === "PENDING") pending++;
        else if (r.status === "PROCESSING") processing++;
        else if (r.status === "FAILED") failed++;
        else if (r.status === "COMPLETED") completed++;
      }

      return { pending, processing, failed, completed };
    } catch {
      return { pending: 0, processing: 0, failed: 0, completed: 0 };
    }
  }
}

export const messageAgentWorker = new MessageAgentWorker();
