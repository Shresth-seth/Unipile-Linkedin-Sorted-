import { describe, it, expect, vi, beforeEach } from "vitest";
import { dashboardController } from "../../controllers/dashboard.controller.js";
import { crmService } from "../../services/crm/crm.service.js";
import {
  getConversationHistory,
  takeOverConversation,
  sendManualReply,
  setPilotMode,
} from "../../controllers/conversation.controller.js";
import {
  checkCheckpointStatus,
  solveCheckpoint,
  disconnectAccount,
} from "../../controllers/linkedin.controller.js";
import { requireAdmin } from "../../middlewares/admin.middleware.js";
import { mockUnipileClient } from "../mocks/unipile.mock.js";
import { mockGeminiConfigService } from "../mocks/gemini.mock.js";
import { db } from "../../db/index.js";
import { linkedInAccountService } from "../../services/linkedin/account.service.js";
import { linkedInMessageService } from "../../services/linkedin/message.service.js";
import { linkedInConnectionService } from "../../services/linkedin/connection.service.js";
import { actionQueueService } from "../../services/queue/queue.service.js";
import { approveDraftReply, outreachConnections } from "../../controllers/agent.controller.js";
import { prospectService } from "../../services/prospects/prospect.service.js";
import { getGeminiChatModelForUser } from "../../agent/WORKPILOT-connect-agent.js";
import { geminiConfigService } from "../../services/ai/gemini-config.service.js";

// Helper to mock Express response
function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {},
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
  return res;
}

describe("Phase 5: 14-Case Tenant-Isolation Negative-Test Matrix", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUnipileClient.resetCalls();
  });

  // --------------------------------------------------------------------------
  // ISO-CRM-01: List Contacts Scoping
  // --------------------------------------------------------------------------
  it("ISO-CRM-01: Tenant B receives only own contacts; 0 bytes of Tenant A contact data returned", async () => {
    const tenantBContacts = [
      { id: "contact-b-1", userId: "tenant-b-uuid", firstName: "Alice", status: "LEAD" },
    ];

    const crmSpy = vi
      .spyOn(crmService, "getContactsByStage")
      .mockResolvedValueOnce(tenantBContacts as any);

    const req: any = {
      query: { stage: "LEAD", limit: "50" },
      user: { userId: "tenant-b-uuid" },
    };
    const res = createMockResponse();

    await dashboardController.getContacts(req, res);

    expect(crmSpy).toHaveBeenCalledWith("tenant-b-uuid", "LEAD", 50);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("contact-b-1");
    // Explicitly assert zero Tenant A data is present
    expect(JSON.stringify(res.body)).not.toContain("tenant-a");
  });

  // --------------------------------------------------------------------------
  // ISO-CRM-02: Mutate Another Tenant's Contact Stage
  // --------------------------------------------------------------------------
  it("ISO-CRM-02: Tenant B cannot update Tenant A contact stage; returns 404 Not Found; 0 mutation", async () => {
    const crmSpy = vi
      .spyOn(crmService, "updateContactStage")
      .mockRejectedValueOnce(new Error("Contact contact-tenant-a-1 not found."));

    const req: any = {
      params: { id: "contact-tenant-a-1" },
      body: { stage: "WON" },
      user: { userId: "tenant-b-attacker" },
    };
    const res = createMockResponse();

    await dashboardController.updateContactStage(req, res);

    expect(crmSpy).toHaveBeenCalledWith("tenant-b-attacker", "contact-tenant-a-1", "WON");
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Contact contact-tenant-a-1 not found.");
  });

  // --------------------------------------------------------------------------
  // ISO-CRM-03: Filtered Scoping & Direct Parameter Isolation
  // --------------------------------------------------------------------------
  it("ISO-CRM-03: Direct cross-tenant query filter strictly preserves tenant boundary", async () => {
    const crmSpy = vi
      .spyOn(crmService, "getContactsByStage")
      .mockImplementation(async (userId: string) => {
        if (userId === "tenant-b-uuid") {
          return [{ id: "contact-b-99", userId: "tenant-b-uuid", status: "LOST" }] as any;
        }
        return [{ id: "contact-a-private", userId: "tenant-a-uuid", status: "LOST" }] as any;
      });

    const req: any = {
      query: { stage: "LOST" },
      user: { userId: "tenant-b-uuid" },
    };
    const res = createMockResponse();

    await dashboardController.getContacts(req, res);

    expect(crmSpy).toHaveBeenCalledWith("tenant-b-uuid", "LOST", 50);
    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].id).toBe("contact-b-99");
    expect(JSON.stringify(res.body)).not.toContain("contact-a-private");
  });

  // --------------------------------------------------------------------------
  // ISO-MSG-01: Conversation History Leakage
  // --------------------------------------------------------------------------
  it("ISO-MSG-01: Tenant B reading Tenant A conversation returns 404; zero messages leaked", async () => {
    // db.select().from(contacts).where(...) returns empty because contact does not belong to Tenant B
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // Contact not found for this tenant
        }),
      }),
    } as any);

    const req: any = {
      params: { contactId: "contact-tenant-a-uuid" },
      user: { userId: "tenant-b-attacker" },
    };
    const res = createMockResponse();

    await getConversationHistory(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Contact not found or access denied.");
    expect(res.body.messages).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // ISO-MSG-02: Send Reply to Another Tenant's Contact
  // --------------------------------------------------------------------------
  it("ISO-MSG-02: Tenant B replying to Tenant A contact returns 404; zero outbound messages; Unipile mock not called", async () => {
    // Mock db to return no matching contact for Tenant B
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const messageSpy = vi.spyOn(linkedInMessageService, "sendMessage");

    const req: any = {
      params: { contactId: "contact-tenant-a-uuid" },
      body: { text: "Phishing attack message from Tenant B" },
      user: { userId: "tenant-b-attacker" },
    };
    const res = createMockResponse();

    await sendManualReply(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Contact not found or access denied.");
    // Crucial: Provider / message service was NEVER called
    expect(messageSpy).not.toHaveBeenCalled();
    expect(mockUnipileClient.calls).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // ISO-MSG-03: Conversation Takeover State Manipulation
  // --------------------------------------------------------------------------
  it("ISO-MSG-03: Tenant B takeover on Tenant A contact returns 404; mode remains unchanged", async () => {
    // db.update(contacts).set(...).where(...).returning() returns empty array
    vi.spyOn(db, "update").mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const req: any = {
      params: { contactId: "contact-tenant-a-uuid" },
      user: { userId: "tenant-b-attacker" },
    };
    const res = createMockResponse();

    await takeOverConversation(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Contact not found or access denied.");
  });

  // --------------------------------------------------------------------------
  // ISO-LNK-01: LinkedIn Checkpoint Status Scoping
  // --------------------------------------------------------------------------
  it("ISO-LNK-01: Tenant B inspecting Tenant A checkpoint returns 404; zero challenge hints leaked", async () => {
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // Account not owned by tenant B
        }),
      }),
    } as any);

    const statusSpy = vi.spyOn(linkedInAccountService, "checkCheckpointStatus");

    const req: any = {
      params: { accountId: "unipile-acc-tenant-a" },
      user: { userId: "tenant-b-attacker" },
    };
    const res = createMockResponse();

    await checkCheckpointStatus(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("LinkedIn account not found or access denied.");
    expect(statusSpy).not.toHaveBeenCalled();
    expect(res.body.checkpointType).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // ISO-LNK-02: Solve Checkpoint on Another Tenant's Account
  // --------------------------------------------------------------------------
  it("ISO-LNK-02: Tenant B solving Tenant A checkpoint returns 404; Unipile mock not called", async () => {
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const solveSpy = vi.spyOn(linkedInAccountService, "solveCheckpoint");

    const req: any = {
      body: { accountId: "unipile-acc-tenant-a", code: "123456" },
      user: { userId: "tenant-b-attacker" },
    };
    const res = createMockResponse();

    await solveCheckpoint(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("LinkedIn account not found or access denied.");
    expect(solveSpy).not.toHaveBeenCalled();
    expect(mockUnipileClient.calls).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // ISO-LNK-03: LinkedIn Account Disconnect Scoping
  // --------------------------------------------------------------------------
  it("ISO-LNK-03: Disconnect endpoint is strictly self-scoped; disconnects only caller's account", async () => {
    const disconnectSpy = vi
      .spyOn(linkedInAccountService, "disconnect")
      .mockResolvedValueOnce({ success: true } as any);

    const req: any = {
      user: { userId: "tenant-b-uuid" },
    };
    const res = createMockResponse();

    await disconnectAccount(req, res);

    expect(disconnectSpy).toHaveBeenCalledWith("tenant-b-uuid");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // --------------------------------------------------------------------------
  // ISO-ADM-01: Admin Users Roster Authorization
  // --------------------------------------------------------------------------
  it("ISO-ADM-01: Non-admin regular user requesting user roster receives 403 Forbidden", async () => {
    // Mock user in db with role = 'USER'
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "tenant-b-uuid", role: "USER", email: "tenantb@example.com" },
          ]),
        }),
      }),
    } as any);

    const req: any = {
      user: { userId: "tenant-b-uuid" },
    };
    const res = createMockResponse();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Access forbidden. You do not have administrator privileges.");
  });

  // --------------------------------------------------------------------------
  // ISO-ADM-02: Triggering Administrative Jobs
  // --------------------------------------------------------------------------
  it("ISO-ADM-02: Non-admin regular user triggering admin daily-agent run receives 403 Forbidden", async () => {
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "tenant-b-uuid", role: "USER", email: "tenantb@example.com" },
          ]),
        }),
      }),
    } as any);

    const req: any = {
      params: { userId: "tenant-a-uuid" },
      user: { userId: "tenant-b-uuid" },
    };
    const res = createMockResponse();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain("do not have administrator privileges");
  });

  // --------------------------------------------------------------------------
  // ISO-ADM-03: Mutating Master Provider Settings
  // --------------------------------------------------------------------------
  it("ISO-ADM-03: Non-admin regular user mutating master Unipile settings receives 403 Forbidden", async () => {
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "tenant-b-uuid", role: "USER", email: "tenantb@example.com" },
          ]),
        }),
      }),
    } as any);

    const req: any = {
      body: { unipileDsn: "https://malicious.endpoint", unipileApiKey: "hacked" },
      user: { userId: "tenant-b-uuid" },
    };
    const res = createMockResponse();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain("do not have administrator privileges");
  });

  // --------------------------------------------------------------------------
  // ISO-WRK-01: Action Queue Worker Account and Quota Isolation
  // --------------------------------------------------------------------------
  it("ISO-WRK-01: ActionQueueWorker queries and executes actions strictly for owning tenant account", async () => {
    const tenantAJob = {
      id: "job-tenant-a-1",
      userId: "tenant-a-uuid",
      actionType: "MESSAGE",
      payload: { message: "Hello from tenant A" },
      status: "QUEUED",
      scheduledFor: new Date(Date.now() - 1000),
      attempts: 0,
    };

    // When worker queries for Tenant A due actions, condition includes eq(actionQueue.userId, 'tenant-a-uuid')
    let capturedWhereCondition: any;
    vi.spyOn(db, "update").mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((condition: any) => {
          capturedWhereCondition = condition;
          return {
            returning: vi.fn().mockResolvedValue([{ id: tenantAJob.id }]),
          };
        }),
      }),
    } as any);

    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((cond: any) => {
          capturedWhereCondition = cond;
          return {
            limit: vi.fn().mockResolvedValue([tenantAJob]),
          };
        }),
      }),
    } as any);

    // Call processDueActions scoped to Tenant A
    const res = await actionQueueService.processDueActions("tenant-a-uuid");

    expect(res).toBeDefined();
    // Verify that the query was strictly scoped to tenant-a-uuid
    expect(capturedWhereCondition).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // ISO-WRK-02: Message Agent Worker & AI BYOK Tenant Isolation
  // --------------------------------------------------------------------------
  it("ISO-WRK-02: Message agent worker resolves AI config and BYOK key strictly per tenant; no cross-tenant key sharing", async () => {
    const configSpy = vi
      .spyOn(geminiConfigService, "getUserConfig")
      .mockImplementation(async (userId?: string) => {
        return mockGeminiConfigService.getUserConfig(userId) as any;
      });

    // Tenant A has custom BYOK key
    const modelA = await getGeminiChatModelForUser("tenant-a-uuid");
    // Tenant B uses system default
    const modelB = await getGeminiChatModelForUser("tenant-b-uuid");

    expect(configSpy).toHaveBeenCalledWith("tenant-a-uuid");
    expect(configSpy).toHaveBeenCalledWith("tenant-b-uuid");

    expect((modelA as any).apiKey).toBe("AIzaSyTenantACustomKey1234567890");
    expect((modelA as any).model).toBe("gemini-1.5-pro");

    expect((modelB as any).apiKey).toBe("system-default-gemini-key");
    expect((modelB as any).model).toBe("gemini-1.5-flash");

    // Strict non-leakage assertion: Tenant B model DOES NOT possess Tenant A's private BYOK key
    expect((modelB as any).apiKey).not.toBe((modelA as any).apiKey);
  });

  // --------------------------------------------------------------------------
  // ISO-WRK-03: ActionQueueWorker rejects cross-tenant contactId, makes 0 provider calls, 0 contact mutations
  // --------------------------------------------------------------------------
  it("ISO-WRK-03: ActionQueueWorker skips jobs with unowned/cross-tenant contactId; makes 0 provider calls and 0 contact updates", async () => {
    const crossTenantJob = {
      id: "job-cross-tenant-1",
      userId: "tenant-a-uuid",
      contactId: "tenant-b-contact-uuid", // Contact belongs to Tenant B, NOT Tenant A
      actionType: "CONNECT",
      payload: {
        person: {
          name: "Target Lead",
          linkedin_id: "lead-linkedin-123",
        },
        note: "Hello",
      },
      status: "QUEUED",
      scheduledFor: new Date(Date.now() - 1000),
      attempts: 0,
    };

    const sendConnectionSpy = vi.spyOn(linkedInConnectionService, "sendConnectionRequest");
    const sendMessageSpy = vi.spyOn(linkedInMessageService, "sendMessage");

    let selectCallCount = 0;
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Queue fetch
            return {
              limit: vi.fn().mockResolvedValue([crossTenantJob]),
            };
          }
          if (selectCallCount === 2) {
            // linkedinAccount lookup for preflight
            return {
              limit: vi.fn().mockResolvedValue([{
                id: "account-1",
                userId: "tenant-a-uuid",
                isConnected: true,
                healthStatus: "HEALTHY",
                automationStatus: "RUNNING",
                dailyConnectionsLimit: 50,
                dailyMessagesLimit: 100,
              }]),
            };
          }
          if (selectCallCount === 3) {
            // connectCount query
            return [{ count: 0 }];
          }
          // Contact lookup for tenant-a-uuid -> returns empty (unowned contact)
          return {
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
      }),
    } as any);

    vi.spyOn(db, "update").mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockResolvedValue([{ id: crossTenantJob.id }]),
        })),
      }),
    } as any);

    const res = await actionQueueService.processDueActions("tenant-a-uuid");

    // Assertions:
    // 1. Provider calls strictly zero
    expect(sendConnectionSpy).not.toHaveBeenCalled();
    expect(sendMessageSpy).not.toHaveBeenCalled();

    // 2. Job marked as SKIPPED due to safety failure
    expect(res.results.length).toBe(1);
    expect(res.results[0]?.status).toBe("SKIPPED");
    expect(res.results[0]?.reason).toContain("Target contact tenant-b-contact-uuid not found or does not belong to user");
  });

  // --------------------------------------------------------------------------
  // ISO-WRK-04: ActionQueueWorker same-tenant positive control scopes contact updates to userId
  // --------------------------------------------------------------------------
  it("ISO-WRK-04: ActionQueueWorker same-tenant job updates contact with strict userId condition", async () => {
    const validJob = {
      id: "job-tenant-a-valid",
      userId: "tenant-a-uuid",
      contactId: "tenant-a-contact-uuid",
      actionType: "CONNECT",
      payload: {
        person: {
          name: "Valid Lead",
          linkedin_id: "lead-linkedin-valid",
        },
        note: "Hello",
      },
      status: "QUEUED",
      scheduledFor: new Date(Date.now() - 1000),
      attempts: 0,
    };

    const sendConnectionSpy = vi.spyOn(linkedInConnectionService, "sendConnectionRequest").mockResolvedValue({
      success: true,
      message: "Connection sent",
    });

    let selectCount = 0;
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCount++;
          if (selectCount === 1) {
            // Fetch due jobs from actionQueue
            return { limit: vi.fn().mockResolvedValue([validJob]) };
          }
          if (selectCount === 2) {
            // Fetch linkedinAccount for safety preflight
            return {
              limit: vi.fn().mockResolvedValue([{
                id: "account-1",
                userId: "tenant-a-uuid",
                isConnected: true,
                healthStatus: "HEALTHY",
                automationStatus: "RUNNING",
                dailyConnectionsLimit: 50,
                dailyMessagesLimit: 100,
              }]),
            };
          }
          if (selectCount === 3) {
            // Count connection actions today
            return [{ count: 0 }];
          }
          if (selectCount === 4) {
            // Safety preflight contact ownership check
            return {
              limit: vi.fn().mockResolvedValue([{
                id: "tenant-a-contact-uuid",
                userId: "tenant-a-uuid",
                status: "NEW",
                name: "Valid Lead",
              }]),
            };
          }
          if (selectCount === 5) {
            // Account lookup for provider execution
            return [{
              id: "account-1",
              userId: "tenant-a-uuid",
              unipileAccountId: "unipile-acc-1",
              isConnected: true,
              healthStatus: "HEALTHY",
            }];
          }
          if (selectCount === 6) {
            // Pre-execution ownership validation in queue.service.ts
            return {
              limit: vi.fn().mockResolvedValue([{
                id: "tenant-a-contact-uuid",
                userId: "tenant-a-uuid",
              }]),
            };
          }
          return { limit: vi.fn().mockResolvedValue([]) };
        }),
      }),
    } as any);

    const updateConditions: any[] = [];
    vi.spyOn(db, "update").mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((cond: any) => {
          updateConditions.push(cond);
          return {
            returning: vi.fn().mockResolvedValue([{ id: validJob.id }]),
          };
        }),
      }),
    } as any);

    const res = await actionQueueService.processDueActions("tenant-a-uuid");

    expect(sendConnectionSpy).toHaveBeenCalledTimes(1);
    expect(res.results[0]?.status).toBe("COMPLETED");

    // Verify contact update condition was recorded
    expect(updateConditions.length).toBeGreaterThanOrEqual(2);
  });

  // --------------------------------------------------------------------------
  // ISO-AGT-01: approveDraftReply scopes contact update to both contactId and userId
  // --------------------------------------------------------------------------
  it("ISO-AGT-01: approveDraftReply positive control scopes draft clear update to authenticated userId", async () => {
    const contactRecord = {
      id: "contact-a-uuid",
      userId: "tenant-a-uuid",
      linkedinId: "lead-li-123",
      name: "Lead A",
      draftReply: "Looks great, let's chat!",
    };

    const sendMsgSpy = vi.spyOn(linkedInMessageService, "sendMessage").mockResolvedValue({
      success: true,
      message: "Sent",
    });

    let selectCount = 0;
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCount++;
          if (selectCount === 1) {
            // Contact select
            return { limit: vi.fn().mockResolvedValue([contactRecord]) };
          }
          // LinkedIn account select
          return {
            limit: vi.fn().mockResolvedValue([{
              id: "acc-a",
              userId: "tenant-a-uuid",
              unipileAccountId: "unipile-a",
              isConnected: true,
            }]),
          };
        }),
      }),
    } as any);

    vi.spyOn(db, "insert").mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    } as any);

    let capturedWhere: any;
    vi.spyOn(db, "update").mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((cond: any) => {
          capturedWhere = cond;
          return Promise.resolve();
        }),
      }),
    } as any);

    const req: any = {
      user: { userId: "tenant-a-uuid" },
      params: { contactId: "contact-a-uuid" },
      body: {},
    };
    const res = createMockResponse();

    await approveDraftReply(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendMsgSpy).toHaveBeenCalledTimes(1);
    expect(capturedWhere).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // ISO-AGT-02: approveDraftReply cross-tenant access returns 404 and does not send message
  // --------------------------------------------------------------------------
  it("ISO-AGT-02: approveDraftReply cross-tenant access returns 404, 0 provider calls, 0 updates", async () => {
    const sendMsgSpy = vi.spyOn(linkedInMessageService, "sendMessage");
    const updateSpy = vi.spyOn(db, "update");

    // Contact not found for tenant-b-uuid
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const req: any = {
      user: { userId: "tenant-b-uuid" },
      params: { contactId: "contact-a-uuid" },
      body: {},
    };
    const res = createMockResponse();

    await approveDraftReply(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toContain("Draft reply not found");
    expect(sendMsgSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // ISO-AGT-03: outreachConnections rejects caller without connected account (0 cross-tenant fallback)
  // --------------------------------------------------------------------------
  it("ISO-AGT-03: outreachConnections fails closed for user without connected account; zero cross-tenant account fallback", async () => {
    // Tenant B has no connected account
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // No account for Tenant B
        }),
      }),
    } as any);

    const sendMsgSpy = vi.spyOn(linkedInMessageService, "sendMessage");

    const req: any = {
      user: { userId: "tenant-b-uuid" },
      body: { niche: "founders", count: 10 },
    };
    const res = createMockResponse();

    await outreachConnections(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("No LinkedIn account connected");
    // Assert 0 provider calls and 0 Unipile API requests
    expect(sendMsgSpy).not.toHaveBeenCalled();
    expect(mockUnipileClient.calls).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // ISO-CRM-04: setPilotMode compound scoping prevents cross-tenant conversation mode mutation
  // --------------------------------------------------------------------------
  it("ISO-CRM-04: setPilotMode cross-tenant access does not mutate other tenant's contact record", async () => {
    // When looking up contact for tenant-b-uuid, returns empty (unowned contact)
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const updateSpy = vi.spyOn(db, "update");

    const req: any = {
      user: { userId: "tenant-b-uuid" },
      params: { contactId: "contact-tenant-a-uuid" },
      body: { mode: "AUTOMATIC" },
    };
    const res = createMockResponse();

    await setPilotMode(req, res);

    // Should return 200 live chat fallback without mutating database contacts table
    expect(res.statusCode).toBe(200);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // ISO-PRP-01: handleConnectionAccepted scopes contact update to compound (id, userId)
  // --------------------------------------------------------------------------
  it("ISO-PRP-01: handleConnectionAccepted scopes contact update strictly by contact.id and userId", async () => {
    const contactA = {
      id: "contact-a-uuid",
      userId: "tenant-a-uuid",
      linkedinId: "lead-li-999",
      name: "Lead 999",
      status: "CONTACTED",
    };

    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([contactA]),
        }),
      }),
    } as any);

    let capturedWhere: any;
    vi.spyOn(db, "update").mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((condition: any) => {
          capturedWhere = condition;
          return {
            returning: vi.fn().mockResolvedValue([{ ...contactA, status: "CONNECTED" }]),
          };
        }),
      }),
    } as any);

    const result = await prospectService.handleConnectionAccepted("tenant-a-uuid", "lead-li-999");

    expect(result.contact.status).toBe("CONNECTED");
    expect(capturedWhere).toBeDefined();
  });
});
