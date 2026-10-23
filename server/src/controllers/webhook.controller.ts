import { Request, Response } from "express";
import { webhookAuthService } from "../services/webhook/webhook-auth.service.js";
import { webhookDedupService } from "../services/webhook/webhook-dedup.service.js";
import { unipileMessageAgentService } from "../services/webhook/unipile-message-agent.service.js";
import { messageAgentWorker } from "../services/webhook/message-agent.worker.js";
import {
  unipileRelationAgentService,
  UnipileRelationWebhookPayload,
} from "../services/webhook/unipile-relation-agent.service.js";
import { normalizeUnipileMessageWebhook } from "../services/webhook/unipile-normalizer.js";

/**
 * High-performance Canonical Unipile Webhook Handler
 * 
 * Responsibilities:
 * 1. Constant-time secret authentication (Unipile-Auth).
 * 2. Strict normalization via normalizeUnipileMessageWebhook.
 * 3. Own outgoing message detection to prevent infinite loops.
 * 4. Idempotency deduplication check.
 * 5. Immediate HTTP 200 acknowledgement (<100ms) to satisfy Unipile's SLA.
 * 6. Asynchronous non-blocking dispatch to intelligent AI subagents.
 */
export const handleUnipileWebhook = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  console.log(`[WEBHOOK] received`);

  // 1. Authenticate webhook secret (if configured)
  const authResult = webhookAuthService.verifyWebhookRequest(req);
  if (!authResult.valid) {
    console.warn(`🔒 [WEBHOOK] Rejected unauthorized webhook request: ${authResult.reason}`);
    res.status(401).json({
      success: false,
      message: authResult.reason || "Unauthorized webhook request.",
    });
    return;
  }

  // 2. Safe normalization of incoming payload
  const norm = normalizeUnipileMessageWebhook(req.body);

  // 3. Own outgoing message detection (prevent feedback loops)
  if (norm.isOwnMessage) {
    console.log(`[WEBHOOK] direction=OUTBOUND`);
    console.log(`[WEBHOOK] own message ignored`);
    res.status(200).json({
      success: true,
      direction: "OUTBOUND",
      ignored: true,
      message: "Own message ignored.",
    });
    setImmediate(async () => {
      try {
        await unipileMessageAgentService.prepareAndPersistInboundMessage(norm);
      } catch (err: any) {
        console.warn("[WEBHOOK] Outbound record error:", err?.message);
      }
    });
    return;
  }

  // 4. Handle relations/invitations webhook if received
  if (norm.event.includes("relation") || req.body?.user_provider_id) {
    const eventId = `rel_${norm.accountId || "unknown"}_${req.body?.user_provider_id || Date.now()}`;
    const dedup = await webhookDedupService.claimEvent(eventId, "new_relation", req.body, norm.accountId);
    if (dedup.isDuplicate) {
      console.log(`⚡ [WEBHOOK] Duplicate relation event '${eventId}' ignored.`);
      res.status(200).json({ success: true, duplicate: true });
      return;
    }

    res.status(200).json({ success: true, event: "new_relation", queued: true });
    setImmediate(async () => {
      try {
        await unipileRelationAgentService.handleRelationWebhook(req.body as UnipileRelationWebhookPayload);
        await webhookDedupService.markProcessed(eventId, "PROCESSED");
      } catch (err: any) {
        await webhookDedupService.markProcessed(eventId, "FAILED", err?.message);
      }
    });
    return;
  }

  // 5. For v1, only message_received triggers conversational inbound processing
  if (norm.event !== "message_received") {
    console.log(`[WEBHOOK] Ignored event '${norm.event}' (only message_received triggers conversational processing).`);
    res.status(200).json({
      success: true,
      event: norm.event,
      ignored: true,
      message: `Event type ${norm.event} ignored.`,
    });
    return;
  }

  // 6. Validate mandatory fields before touching database
  if (!norm.isValid) {
    console.warn(`[WEBHOOK] Invalid payload: ${norm.validationError}`);
    res.status(200).json({
      success: false,
      message: norm.validationError,
    });
    return;
  }

  // Log exact canonical trace required
  console.log(`[WEBHOOK] event=${norm.event}`);
  console.log(`[WEBHOOK] accountId=${norm.accountId}`);
  console.log(`[WEBHOOK] chatId=${norm.chatId}`);
  console.log(`[WEBHOOK] messageId=${norm.messageId}`);
  console.log(`[WEBHOOK] senderName=${norm.senderName}`);
  console.log(`[WEBHOOK] senderProviderId=${norm.senderProviderId}`);
  console.log(`[WEBHOOK] direction=INBOUND`);

  // 7. Deduplication / Idempotency check
  const dedup = await webhookDedupService.claimEvent(norm.messageId, norm.event, req.body, norm.accountId);
  if (dedup.isDuplicate) {
    console.log(`⚡ [WEBHOOK] Duplicate messageId=${norm.messageId} recognized. Returning HTTP 200 safely.`);
    res.status(200).json({
      success: true,
      duplicate: true,
      message: "Event already processed.",
    });
    return;
  }

  // 8. Persistence before HTTP 200: Validate and store message job atomically
  let persistedJobId: string | undefined;
  try {
    const prep = await unipileMessageAgentService.prepareAndPersistInboundMessage(norm);
    if (prep.isOwnSent) {
      res.status(200).json({
        success: true,
        messageId: norm.messageId,
        ownMessage: true,
      });
      return;
    }
    persistedJobId = prep.jobId;
  } catch (persistErr: any) {
    console.error(`❌ [WEBHOOK] Error during validation/persistence for message '${norm.messageId}':`, persistErr?.message || persistErr);
  }

  // Return HTTP 200 immediately (<100ms) after validation/persistence
  res.status(200).json({
    success: true,
    messageId: norm.messageId,
    jobId: persistedJobId,
    queued: true,
  });

  const responseDurationMs = Date.now() - startTime;
  console.log(`[WEBHOOK] Message '${norm.messageId}' acknowledged in ${responseDurationMs}ms. Processing async...`);

  // 9. Asynchronous Background Execution (Non-blocking worker dispatch)
  if (persistedJobId) {
    const jobIdToRun = persistedJobId;
    setImmediate(async () => {
      try {
        await messageAgentWorker.processJob(jobIdToRun);
        await webhookDedupService.markProcessed(norm.messageId, "PROCESSED");
      } catch (asyncErr: any) {
        console.error(`❌ [WEBHOOK] Asynchronous processing error for message '${norm.messageId}':`, asyncErr?.message || asyncErr);
        await webhookDedupService.markProcessed(norm.messageId, "FAILED", asyncErr?.message || String(asyncErr));
      }
    });
  }
};
