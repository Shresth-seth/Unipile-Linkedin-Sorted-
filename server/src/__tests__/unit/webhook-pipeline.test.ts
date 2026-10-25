import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUnipileWebhook } from "../../controllers/webhook.controller.js";
import { webhookAuthService } from "../../services/webhook/webhook-auth.service.js";
import { webhookDedupService } from "../../services/webhook/webhook-dedup.service.js";
import { unipileMessageAgentService } from "../../services/webhook/unipile-message-agent.service.js";
import { messageAgentWorker } from "../../services/webhook/message-agent.worker.js";
import { db } from "../../db/index.js";
import { Request, Response } from "express";

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: any };
}

describe("WP-05: Webhook Authentication, Persistence & Idempotency Pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Authentication & Malformed Payload Boundary Verification", () => {
    it("rejected webhook with invalid authentication returns 401 Unauthorized with zero side effects", async () => {
      vi.spyOn(webhookAuthService, "verifyWebhookRequest").mockReturnValue({
        valid: false,
        reason: "Invalid webhook secret.",
      });

      const prepSpy = vi.spyOn(unipileMessageAgentService, "prepareAndPersistInboundMessage");
      const dedupSpy = vi.spyOn(webhookDedupService, "claimEvent");

      const req = {
        headers: { "unipile-auth": "invalid-secret" },
        body: { event: "message_received", message_id: "msg_123" },
      } as unknown as Request;
      const res = createMockResponse();

      await handleUnipileWebhook(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(prepSpy).not.toHaveBeenCalled();
      expect(dedupSpy).not.toHaveBeenCalled();
    });

    it("malformed payload missing required identifiers returns 400 Bad Request with zero persistence", async () => {
      vi.spyOn(webhookAuthService, "verifyWebhookRequest").mockReturnValue({ valid: true });
      const prepSpy = vi.spyOn(unipileMessageAgentService, "prepareAndPersistInboundMessage");
      const dedupSpy = vi.spyOn(webhookDedupService, "claimEvent");

      const req = {
        headers: { "unipile-auth": "valid-secret" },
        body: {
          event: "message_received",
          // missing account_id, chat_id, message_id, senderProviderId
        },
      } as unknown as Request;
      const res = createMockResponse();

      await handleUnipileWebhook(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Missing required");
      expect(prepSpy).not.toHaveBeenCalled();
      expect(dedupSpy).not.toHaveBeenCalled();
    });
  });

  describe("2. Idempotency & Duplicate Delivery Control", () => {
    it("simultaneous duplicate event delivery returns duplicate=true and prevents duplicate job enqueuing", async () => {
      vi.spyOn(webhookAuthService, "verifyWebhookRequest").mockReturnValue({ valid: true });

      // First call claims; second call returns duplicate
      vi.spyOn(webhookDedupService, "claimEvent").mockResolvedValueOnce({
        isDuplicate: true,
      });

      const prepSpy = vi.spyOn(unipileMessageAgentService, "prepareAndPersistInboundMessage");

      const req = {
        headers: { "unipile-auth": "valid-secret" },
        body: {
          event: "message_received",
          account_id: "unipile_acc_1",
          chat_id: "chat_1",
          message_id: "msg_duplicate_1",
          message: "Hello again",
          sender: { attendee_provider_id: "lead_123", attendee_name: "Lead 1" },
        },
      } as unknown as Request;
      const res = createMockResponse();

      await handleUnipileWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBe(true);
      expect(res.body.message).toContain("already processed");
      // Zero persistence or queue calls
      expect(prepSpy).not.toHaveBeenCalled();
    });
  });

  describe("3. Durable Persistence Before Acknowledgment & Fail-Closed Behavior", () => {
    it("returns HTTP 500 if database persistence fails, preventing misleading success acknowledgment", async () => {
      vi.spyOn(webhookAuthService, "verifyWebhookRequest").mockReturnValue({ valid: true });
      vi.spyOn(webhookDedupService, "claimEvent").mockResolvedValue({ isDuplicate: false, eventDbId: "evt_1" });

      // Simulate database crash during persistence
      vi.spyOn(unipileMessageAgentService, "prepareAndPersistInboundMessage").mockRejectedValue(
        new Error("PostgresError: Connection terminated unexpectedly during insert"),
      );

      const req = {
        headers: { "unipile-auth": "valid-secret" },
        body: {
          event: "message_received",
          account_id: "unipile_acc_1",
          chat_id: "chat_1",
          message_id: "msg_persist_fail_1",
          message: "Hello",
          sender: { attendee_provider_id: "lead_123", attendee_name: "Lead 1" },
        },
      } as unknown as Request;
      const res = createMockResponse();

      await handleUnipileWebhook(req, res);

      // Must fail closed with HTTP 500 so provider retries
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Database persistence failed");
    });

    it("unknown account ID returns HTTP 200 with skipped: true and does not create an AI job", async () => {
      vi.spyOn(webhookAuthService, "verifyWebhookRequest").mockReturnValue({ valid: true });
      vi.spyOn(webhookDedupService, "claimEvent").mockResolvedValue({ isDuplicate: false, eventDbId: "evt_2" });

      vi.spyOn(unipileMessageAgentService, "prepareAndPersistInboundMessage").mockResolvedValue({
        isOwnSent: false,
        skipped: true,
        reason: "Account not found locally",
      });

      const workerSpy = vi.spyOn(messageAgentWorker, "processJob");

      const req = {
        headers: { "unipile-auth": "valid-secret" },
        body: {
          event: "message_received",
          account_id: "unknown_acc_999",
          chat_id: "chat_1",
          message_id: "msg_unknown_1",
          message: "Hello",
          sender: { attendee_provider_id: "lead_123", attendee_name: "Lead 1" },
        },
      } as unknown as Request;
      const res = createMockResponse();

      await handleUnipileWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.skipped).toBe(true);
      expect(res.body.reason).toBe("Account not found locally");
      expect(workerSpy).not.toHaveBeenCalled();
    });

    it("own outbound echo returns ownMessage: true and bypasses AI generation", async () => {
      vi.spyOn(webhookAuthService, "verifyWebhookRequest").mockReturnValue({ valid: true });
      vi.spyOn(unipileMessageAgentService, "prepareAndPersistInboundMessage").mockResolvedValue({
        isOwnSent: true,
      });

      const req = {
        headers: { "unipile-auth": "valid-secret" },
        body: {
          event: "message_received",
          account_id: "unipile_acc_1",
          account_info: { user_id: "my_user_id" },
          chat_id: "chat_1",
          message_id: "msg_own_1",
          message: "My outbound message",
          sender: { attendee_provider_id: "my_user_id", attendee_name: "Me" },
        },
      } as unknown as Request;
      const res = createMockResponse();

      await handleUnipileWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.ignored).toBe(true);
      expect(res.body.direction).toBe("OUTBOUND");

      // Flush setImmediate so background persist task executes with active spy
      await new Promise((resolve) => setImmediate(resolve));
    });
  });

  describe("4. Worker Recovery & Restart Resumption (messageAgentWorker)", () => {
    it("processPendingJobs polls unhandled PENDING jobs to resume work after restart", async () => {
      const mockJobs = [
        { id: "job-restart-1", status: "PENDING" },
        { id: "job-restart-2", status: "PENDING" },
      ];

      vi.spyOn(db, "update").mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            catch: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockJobs),
            }),
          }),
        }),
      } as any);

      const processJobSpy = vi.spyOn(messageAgentWorker, "processJob").mockResolvedValue({
        success: true,
        status: "COMPLETED",
      });

      const result = await messageAgentWorker.processPendingJobs();

      expect(result.checked).toBe(2);
      expect(result.processed).toBe(2);
      expect(processJobSpy).toHaveBeenCalledTimes(2);
    });

    it("stale lock query resets transient PROCESSING jobs to PENDING and marks exhausted as FAILED", async () => {
      const updateCalls: any[] = [];
      vi.spyOn(db, "update").mockImplementation(() => {
        return {
          set: vi.fn().mockImplementation((setVals) => {
            updateCalls.push(setVals);
            return {
              where: vi.fn().mockReturnValue({
                catch: vi.fn().mockResolvedValue([]),
              }),
            };
          }),
        } as any;
      });

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      await messageAgentWorker.processPendingJobs();

      expect(updateCalls.some((c) => c.status === "PENDING")).toBe(true);
      expect(updateCalls.some((c) => c.status === "FAILED")).toBe(true);
    });
  });
});
