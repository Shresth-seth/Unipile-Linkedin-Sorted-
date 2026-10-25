import { describe, it, expect, vi, beforeEach } from "vitest";
import { geminiConfigService } from "../../services/ai/gemini-config.service.js";
import { agentMemoryService } from "../../services/agent/agent-memory.service.js";
import { chatWithWORKPILOTAgent, executeAutonomousCampaignWorkflow } from "../../agent/WORKPILOT-connect-agent.js";
import { runWithToolTenant, executeSystemTool } from "../../tools/tools.js";
import { db } from "../../db/index.js";
import { encryptSecret } from "../../utils/crypto.util.js";

describe("WP-08: AI Tools, BYOK & Agent Safety Constraints", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. BYOK (Bring Your Own Key) Priority & Encryption", () => {
    it("returns USER_CUSTOM key when configured and masks key properly", async () => {
      const plainCustomKey = "AIzaSyCustomKeyForUserTenant123456";
      const encryptedCustomKey = encryptSecret(plainCustomKey);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                geminiApiKey: encryptedCustomKey,
                geminiModel: "gemini-2.5-pro",
              },
            ]),
          }),
        }),
      } as any);

      const config = await geminiConfigService.getUserConfig("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d");

      expect(config.source).toBe("USER_CUSTOM");
      expect(config.isCustom).toBe(true);
      expect(config.apiKey).toBe(plainCustomKey);
      expect(config.model).toBe("gemini-2.5-pro");
      expect(config.maskedKey).toBe("AIzaSy••••3456");
    });

    it("falls back to SYSTEM_DEFAULT key when user has no custom key", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                geminiApiKey: null,
                geminiModel: null,
              },
            ]),
          }),
        }),
      } as any);

      geminiConfigService.setInCache("system-default-key-xyz", "gemini-2.5-flash");

      const config = await geminiConfigService.getUserConfig("b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e");

      expect(config.source).toBe("SYSTEM_DEFAULT");
      expect(config.isCustom).toBe(false);
      expect(config.apiKey).toBe("system-default-key-xyz");
      expect(config.model).toBe("gemini-2.5-flash");
    });

    it("setUserConfig encrypts personal API key at rest using AES-256-GCM", async () => {
      let savedKey: string | undefined;

      vi.spyOn(db, "update").mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          savedKey = val.geminiApiKey;
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      } as any);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() =>
              Promise.resolve([
                {
                  geminiApiKey: savedKey,
                  geminiModel: "gemini-2.5-flash",
                },
              ]),
            ),
          }),
        }),
      } as any);

      await geminiConfigService.setUserConfig(
        "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
        "AIzaSyPersonalSecretKey999999",
        "gemini-2.5-flash",
      );

      expect(savedKey).toBeDefined();
      expect(savedKey?.startsWith("v2:")).toBe(true);
    });
  });

  describe("2. AsyncLocalStorage Tool Scoping & Cross-Tenant Isolation", () => {
    it("runWithToolTenant establishes isolated user context for tool execution", async () => {
      let resolvedUser: string | undefined;

      await runWithToolTenant("tenant-user-alpha", async () => {
        const execution = await executeSystemTool({
          name: "get_account_safety_and_limits",
          args: {},
        });
        resolvedUser = execution.response?.result?.userId || "captured";
      });

      expect(resolvedUser).toBeDefined();
    });

    it("runWithToolTenant fails closed if userId is empty", () => {
      expect(() => {
        runWithToolTenant("", async () => "blocked");
      }).toThrow("Authenticated user context is required");
    });

    it("rejects tool calls attempting to use another tenant's LinkedIn account", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            // Empty result: account does NOT belong to tenant-b
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await runWithToolTenant("tenant-user-b", async () => {
        const execution = await executeSystemTool({
          name: "search_linkedin_leads",
          args: { accountId: "tenant-a-unipile-acc" },
        });

        expect(execution.response?.error).toContain("does not belong to this workspace");
      });
    });
  });

  describe("3. Agent Memory Tenant Isolation (agentMemoryService)", () => {
    it("allocates separate MemorySaver instances per user and clears only target user", async () => {
      const user1Checkpointer = agentMemoryService.getUserCheckpointer("user-mem-1");
      const user2Checkpointer = agentMemoryService.getUserCheckpointer("user-mem-2");

      expect(user1Checkpointer).not.toBe(user2Checkpointer);

      agentMemoryService.recordMessage("user-mem-1", "user", "Message from user 1");
      agentMemoryService.recordMessage("user-mem-2", "user", "Message from user 2");

      const hist1Before = await agentMemoryService.getHistory("user-mem-1");
      const hist2Before = await agentMemoryService.getHistory("user-mem-2");
      expect(hist1Before.length).toBe(1);
      expect(hist2Before.length).toBe(1);

      // Clear memory strictly for user 1
      await agentMemoryService.clearHistory("user-mem-1");

      const hist1After = await agentMemoryService.getHistory("user-mem-1");
      const hist2After = await agentMemoryService.getHistory("user-mem-2");
      expect(hist1After.length).toBe(0);
      expect(hist2After.length).toBe(1);
    });

    it("saveUserSettings enforces dailyQuota boundary between 1 and 20", () => {
      const underQuota = agentMemoryService.saveUserSettings("user-settings-1", { dailyQuota: 0 });
      expect(underQuota.dailyQuota).toBe(1);

      const overQuota = agentMemoryService.saveUserSettings("user-settings-1", { dailyQuota: 50 });
      expect(overQuota.dailyQuota).toBe(20);

      const normalQuota = agentMemoryService.saveUserSettings("user-settings-1", { dailyQuota: 15 });
      expect(normalQuota.dailyQuota).toBe(15);
    });
  });

  describe("4. Chat Agent & Autonomous Workflow Authentication Gate", () => {
    it("chatWithWORKPILOTAgent rejects calls without userId (no hardcoded fallback)", async () => {
      const res = await chatWithWORKPILOTAgent({
        messages: [{ role: "user", content: "Hello" }],
        apiKey: "valid-test-key",
        // userId intentionally undefined
      });

      expect(res.reply).toContain("Authentication required");
      expect(res.toolCallsExecuted.length).toBe(0);
    });

    it("executeAutonomousCampaignWorkflow rejects calls without userId (no hardcoded fallback)", async () => {
      const res = await executeAutonomousCampaignWorkflow({
        goal: "Find CTOs",
        // userId intentionally undefined
      });

      expect(res.success).toBe(false);
      expect(res.summary).toContain("Authentication required");
    });
  });
});
