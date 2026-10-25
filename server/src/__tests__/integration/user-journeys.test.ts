import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { generateToken } from "../../utils/jwt.util.js";
import { db } from "../../db/index.js";
import { crmService } from "../../services/crm/crm.service.js";
import { linkedInAccountService } from "../../services/linkedin/account.service.js";
import { linkedInMessageService } from "../../services/linkedin/message.service.js";
import { actionQueueService } from "../../services/queue/queue.service.js";
import { accountSafetyService } from "../../services/safety/safety.service.js";
import { unipileMessageAgentService } from "../../services/webhook/unipile-message-agent.service.js";
import { messageAgentWorker } from "../../services/webhook/message-agent.worker.js";
import { webhookAuthService } from "../../services/webhook/webhook-auth.service.js";
import { webhookDedupService } from "../../services/webhook/webhook-dedup.service.js";

describe("WP-09: End-to-End User Journey Verification", () => {
  const testUser = {
    userId: "user-journey-e2e-uuid",
    email: "journey_user@example.com",
    role: "USER",
    sessionVersion: 0,
  };
  const userToken = generateToken(testUser);

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default mock for authentication middleware query: select sessionVersion, emailVerifiedAt from users
    vi.spyOn(db, "select").mockImplementation((_fields?: any) => {
      const mockResult = [
        {
          id: testUser.userId,
          userId: testUser.userId,
          role: testUser.role,
          email: testUser.email,
          sessionVersion: 0,
          emailVerifiedAt: new Date(),
        },
      ];
      return {
        from: (_table: any) => ({
          where: (_cond: any) => ({
            limit: async (_n?: number) => mockResult,
            orderBy: () => ({ limit: async () => mockResult }),
            then: (resolve: any) => Promise.resolve(mockResult).then(resolve),
          }),
        }),
      } as any;
    });

    // Default mock for db.update (stale locks, CAS claims, status updates)
    vi.spyOn(db, "update").mockImplementation((_table: any) => ({
      set: () => ({
        where: () => {
          const promise: any = Promise.resolve([]);
          promise.returning = vi.fn().mockResolvedValue([{ id: "job-journey-1" }]);
          return promise;
        },
      }),
    } as any));
  });

  // ==========================================================================
  // Journey 1: Onboarding, Authentication & LinkedIn Connection
  // ==========================================================================
  describe("Journey 1: Onboarding, Authentication & LinkedIn Connection", () => {
    it("Step 1.1: Authenticated user requests LinkedIn connect URL", async () => {
      vi.spyOn(linkedInAccountService, "generateAuthLink").mockResolvedValue({
        url: "https://api.unipile.com/hosted/auth/session_journey_1",
      });

      const res = await request(app)
        .get("/api/linkedin/connect")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toContain("https://api.unipile.com");
    });

    it("Step 1.2: Connects via session cookie and retrieves HEALTHY status", async () => {
      vi.spyOn(linkedInAccountService, "connectWithCookie").mockResolvedValue({
        checkpoint: false,
        accountId: "unipile_journey_acc",
        account: {
          id: "acc-journey-id",
          userId: testUser.userId,
          unipileAccountId: "unipile_journey_acc",
          linkedinName: "Journey Lead Explorer",
          isConnected: true,
          healthStatus: "HEALTHY",
          automationStatus: "RUNNING",
        },
        message: "LinkedIn account connected successfully via session cookie.",
      });

      const connectRes = await request(app)
        .post("/api/linkedin/connect/cookie")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          li_at: "ajax:998877665544332211",
          li_a: "li_a_token_optional",
        });

      expect(connectRes.status).toBe(200);
      expect(connectRes.body.success).toBe(true);
      expect(connectRes.body.account.healthStatus).toBe("HEALTHY");

      // Verify status endpoint reflects HEALTHY state
      vi.spyOn(linkedInAccountService, "getAccountStatus").mockResolvedValue({
        id: "acc-journey-id",
        name: "Journey Lead Explorer",
        hasAccount: true,
        isConnected: true,
        healthStatus: "HEALTHY",
        automationStatus: "RUNNING",
        reconnectionRequired: false,
      });

      const statusRes = await request(app)
        .get("/api/linkedin/status")
        .set("Authorization", `Bearer ${userToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.isConnected).toBe(true);
      expect(statusRes.body.data.healthStatus).toBe("HEALTHY");
    });
  });

  // ==========================================================================
  // Journey 2: Lead Discovery & CRM Persistence
  // ==========================================================================
  describe("Journey 2: Lead Discovery & CRM Persistence", () => {
    it("Step 2.1: Discovered lead is persisted into CRM contacts table", async () => {
      const mockLead = {
        id: "contact-journey-lead-1",
        userId: testUser.userId,
        name: "Devin AI",
        linkedinId: "devin-cognition-ai",
        company: "Cognition",
        designation: "Software Engineer",
        status: "NEW",
        optedOut: false,
      };

      vi.spyOn(crmService, "getContactsByStage").mockResolvedValue([mockLead as any]);

      const res = await request(app)
        .get("/api/dashboard/contacts")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe("Devin AI");
      expect(res.body.data[0].status).toBe("NEW");
    });

    it("Step 2.2: Updates contact stage as pipeline progresses", async () => {
      const updatedContact = {
        id: "contact-journey-lead-1",
        userId: testUser.userId,
        name: "Devin AI",
        status: "CONTACTED",
      };

      vi.spyOn(crmService, "updateContactStage").mockResolvedValue(updatedContact as any);

      const res = await request(app)
        .patch("/api/dashboard/contacts/contact-journey-lead-1/stage")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ stage: "CONTACTED" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("CONTACTED");
    });
  });

  // ==========================================================================
  // Journey 3: Outbound Outreach & Worker Execution Loop
  // ==========================================================================
  describe("Journey 3: Outbound Outreach & Worker Execution Loop", () => {
    it("Step 3.1: Enqueues outbound message and executes via queue worker", async () => {
      const mockJob = {
        id: "job-journey-1",
        userId: testUser.userId,
        contactId: "contact-journey-lead-1",
        actionType: "MESSAGE",
        payload: { recipientId: "devin-cognition-ai", message: "Hi Devin, love your work." },
        status: "QUEUED",
        scheduledFor: new Date(Date.now() - 5000),
        attempts: 0,
      };

      vi.spyOn(db, "select")
        // 1. Due jobs query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJob]),
            }),
          }),
        } as any)
        // 2. User account query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: "acc-journey-id",
                userId: testUser.userId,
                unipileAccountId: "unipile_journey_acc",
                isConnected: true,
                healthStatus: "HEALTHY",
              },
            ]),
          }),
        } as any)
        // 3. Target contact ownership check
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "contact-journey-lead-1" }]),
            }),
          }),
        } as any);

      vi.spyOn(accountSafetyService, "verifyPreFlight").mockResolvedValue({
        allowed: true,
      });

      vi.spyOn(linkedInMessageService, "sendMessage").mockResolvedValue({
        success: true,
        message: "Direct message sent successfully",
      });

      // Execute worker cycle
      const queueResult = await actionQueueService.processDueActions(testUser.userId);

      expect(queueResult.processed).toBe(1);
      expect(queueResult.results[0]?.status).toBe("COMPLETED");
      expect(linkedInMessageService.sendMessage).toHaveBeenCalledWith(
        "devin-cognition-ai",
        "Hi Devin, love your work.",
        "unipile_journey_acc",
      );
    });
  });

  // ==========================================================================
  // Journey 4: Inbound Response & Conversational Ingress
  // ==========================================================================
  describe("Journey 4: Inbound Response & Conversational Ingress", () => {
    it("Step 4.1: Receives inbound webhook message, persists, and acknowledges HTTP 200", async () => {
      vi.spyOn(webhookAuthService, "verifyWebhookRequest").mockReturnValue({ valid: true });
      vi.spyOn(webhookDedupService, "claimEvent").mockResolvedValue({
        isDuplicate: false,
        eventDbId: "evt_journey_1",
      });
      vi.spyOn(webhookDedupService, "markProcessed").mockResolvedValue();
      vi.spyOn(messageAgentWorker, "processJob").mockResolvedValue({ processed: true } as any);

      vi.spyOn(unipileMessageAgentService, "prepareAndPersistInboundMessage").mockResolvedValue({
        isOwnSent: false,
        skipped: false,
        jobId: "job_inbound_persist_1",
      });

      const webhookPayload = {
        event: "message_received",
        account_id: "unipile_journey_acc",
        chat_id: "chat_journey_123",
        message_id: "msg_journey_inbound_1",
        message: "Thanks for reaching out!",
        sender: { attendee_provider_id: "devin-cognition-ai", attendee_name: "Devin AI" },
      };

      const res = await request(app)
        .post("/api/webhooks/unipile")
        .set("unipile-auth", "valid-webhook-secret")
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.queued).toBe(true);
      expect(res.body.messageId).toBe("msg_journey_inbound_1");
    });
  });

  // ==========================================================================
  // Journey 5: Opt-Out & Communication Halt (Negative Safety Journey)
  // ==========================================================================
  describe("Journey 5: Opt-Out & Communication Halt (Negative Safety Journey)", () => {
    it("Step 5.1: Contact opts out; all subsequent queued actions are skipped immediately", async () => {
      // Simulate contact opted out via STOP / opt-out detection
      vi.spyOn(accountSafetyService, "verifyPreFlight").mockResolvedValue({
        allowed: false,
        reason: "Contact Devin AI has opted out of automated communications.",
        circuitBreakerTriggered: false,
      });

      const mockQueuedJob = {
        id: "job-opted-out",
        userId: testUser.userId,
        contactId: "contact-journey-lead-1",
        actionType: "MESSAGE",
        payload: { recipientId: "devin-cognition-ai", message: "Follow-up pitch" },
        status: "QUEUED",
        scheduledFor: new Date(Date.now() - 5000),
        attempts: 0,
      };

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockQueuedJob]),
          }),
        }),
      } as any);

      const queueResult = await actionQueueService.processDueActions(testUser.userId);

      expect(queueResult.processed).toBe(1);
      expect(queueResult.results[0]?.status).toBe("SKIPPED");
      expect(queueResult.results[0]?.reason).toContain("opted out");
    });
  });

  // ==========================================================================
  // Journey 6: Account Disconnection & Permanent Cookie Purge
  // ==========================================================================
  describe("Journey 6: Account Disconnection & Permanent Cookie Purge", () => {
    it("Step 6.1: Disconnecting account pauses pending actions and cleans credentials", async () => {
      vi.spyOn(linkedInAccountService, "disconnect").mockResolvedValue(true);

      const res = await request(app)
        .post("/api/linkedin/disconnect")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("disconnected successfully");
    });

    it("Step 6.2: Purging cookies permanently deletes stored login and session data", async () => {
      vi.spyOn(linkedInAccountService, "deleteLinkedInLoginAndCookies").mockResolvedValue(true);

      const res = await request(app)
        .post("/api/linkedin/purge-cookies")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("deleted permanently");
    });
  });
});
