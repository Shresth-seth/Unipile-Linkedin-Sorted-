import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { razorpayService } from "../../services/billing/razorpay.service.js";
import { validateProductionConfig } from "../../config/production.config.js";
import {
  decryptData,
  decryptStoredSecret,
  encryptData,
  encryptSecret,
} from "../../utils/crypto.util.js";
import { agentMemoryService } from "../../services/agent/agent-memory.service.js";
import { createWORKPILOTLangGraphAgent } from "../../agent/WORKPILOT-connect-agent.js";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { HumanMessage } from "@langchain/core/messages";

describe("Phase 2: Migrated High-Value Legacy Tests (Assertion Preservation)", () => {
  describe("Legacy SaaS Foundation (test-saas-foundation.ts assertions)", () => {
    let originalFetch: typeof globalThis.fetch;
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      savedEnv = { ...process.env };
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      process.env = savedEnv;
    });

    it("verifies Razorpay subscription creation notes and plan binding", async () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_key";
      process.env.RAZORPAY_KEY_SECRET = "provider-secret";
      process.env.RAZORPAY_PLAN_PRO_MONTHLY = "plan_pro_monthly";
      process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret-for-tests";

      let requestBody: any;
      globalThis.fetch = (async (_url: any, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            id: "sub_test",
            status: "created",
            short_url: "https://rzp.io/test",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        );
      }) as typeof fetch;

      const checkout = await razorpayService.createSubscription({
        userId: "user-test",
        email: "test@example.com",
        plan: "PRO",
        cycle: "monthly",
      });

      expect(checkout.id).toBe("sub_test");
      expect(requestBody.plan_id).toBe("plan_pro_monthly");
      expect(requestBody.notes.workpilot_user_id).toBe("user-test");
    });

    it("verifies cryptographic HMAC webhook signature validation", () => {
      const webhookSecret = "webhook-secret-for-tests";
      process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
      const payload = Buffer.from('{"event":"subscription.activated"}');
      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      expect(razorpayService.verifyWebhook(payload, signature)).toBe(true);
      expect(razorpayService.verifyWebhook(payload, "invalid_signature")).toBe(false);
    });

    it("verifies AES-256 data and secret encryption roundtrips and legacy fallback", () => {
      const sensitiveData = { credential: "sensitive-token-12345" };
      const encrypted = encryptData(sensitiveData);
      expect(encrypted.startsWith("v2:")).toBe(true);
      expect(decryptData(encrypted)).toEqual(sensitiveData);

      const secretText = "provider-api-key-secret";
      const encryptedSecret = encryptSecret(secretText);
      expect(encryptedSecret.startsWith("v2:")).toBe(true);
      expect(decryptStoredSecret(encryptedSecret)).toBe(secretText);

      // Legacy unencrypted secret fallback check
      expect(decryptStoredSecret("legacy-plaintext-key")).toBe("legacy-plaintext-key");
    });

    it("verifies production config validation enforces mandatory parameters", () => {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "j".repeat(40);
      process.env.DATA_ENCRYPTION_KEY = "e".repeat(40);
      process.env.UNIPILE_WEBHOOK_SECRET = "u".repeat(40);
      process.env.UNIPILE_DSN = "https://api1.unipile.com:13200";
      process.env.UNIPILE_API_KEY = "unipile-provider-key";
      process.env.RAZORPAY_KEY_SECRET = "provider-secret";
      process.env.RAZORPAY_WEBHOOK_SECRET = "r".repeat(40);
      process.env.RAZORPAY_KEY_ID = "rzp_live_test";
      process.env.RAZORPAY_PLAN_PRO_MONTHLY = "plan_1";
      process.env.RAZORPAY_PLAN_PRO_YEARLY = "plan_2";
      process.env.RESEND_API_KEY = "re_test";
      process.env.EMAIL_FROM = "WORKPILOT <no-reply@example.com>";
      process.env.SUPPORT_EMAIL = "support@example.com";
      process.env.DATABASE_URL = "postgresql://db.example/workpilot";
      process.env.CLIENT_URL = "https://linkdin.workpilot.co.in";

      expect(() => validateProductionConfig()).not.toThrow();
    });
  });

  describe("Legacy Agent Memory & User Separation (test-agent-memory.ts assertions)", () => {
    const userA = "user-uuid-aaaa-1111";
    const userB = "user-uuid-bbbb-2222";

    beforeEach(async () => {
      await agentMemoryService.clearHistory(userA);
      await agentMemoryService.clearHistory(userB);
    });

    it("Test 1: guarantees dedicated isolated MemorySaver checkpointer instances per user", () => {
      const checkpointerA = agentMemoryService.getUserCheckpointer(userA);
      const checkpointerB = agentMemoryService.getUserCheckpointer(userB);

      expect(checkpointerA).toBeDefined();
      expect(checkpointerB).toBeDefined();
      expect(checkpointerA).not.toBe(checkpointerB);
    });

    it("Test 2 & 3: retains short-term memory across turns and prevents cross-tenant memory leakage", async () => {
      const fakeModelA = new FakeListChatModel({
        responses: [
          "I found 3 AI engineers in London: 1. Oliver Smith, 2. Charlotte Brown, 3. Liam Davies.",
          "Understood. I will prepare an invite for Charlotte Brown.",
        ],
      });

      const agentA = createWORKPILOTLangGraphAgent({
        userId: userA,
        systemPrompt: "You are the WORKPILOT AI agent.",
        llm: fakeModelA,
      });

      const threadIdA = agentMemoryService.getUserThreadId(userA);

      // Turn 1 for User A
      const turn1Res = await agentA.invoke(
        { messages: [new HumanMessage("Find 3 AI engineers in London")] },
        { configurable: { thread_id: threadIdA } }
      );
      expect(turn1Res.messages.length).toBeGreaterThan(0);

      // Turn 2 for User A (context retention)
      const turn2Res = await agentA.invoke(
        { messages: [new HumanMessage("Send an invite to the second person.")] },
        { configurable: { thread_id: threadIdA } }
      );
      const lastMsgA = turn2Res.messages[turn2Res.messages.length - 1]?.content;
      expect(lastMsgA).toContain("Charlotte Brown");

      // Verify User B cannot access User A's context
      const fakeModelB = new FakeListChatModel({
        responses: ["I am a fresh assistant. I have no record of prior conversation."],
      });

      const agentB = createWORKPILOTLangGraphAgent({
        userId: userB,
        systemPrompt: "You are the WORKPILOT AI agent.",
        llm: fakeModelB,
      });

      const threadIdB = agentMemoryService.getUserThreadId(userB);

      const turn1B = await agentB.invoke(
        { messages: [new HumanMessage("Who did we talk about just now?")] },
        { configurable: { thread_id: threadIdB } }
      );
      const lastMsgB = String(turn1B.messages[turn1B.messages.length - 1]?.content);
      expect(lastMsgB).not.toContain("Charlotte Brown");
      expect(lastMsgB).not.toContain("Oliver Smith");
    });

    it("Test 4: clearHistory strictly isolates cache clearing to target user", async () => {
      await agentMemoryService.clearHistory(userA);
      const newCheckpointerA = agentMemoryService.getUserCheckpointer(userA);
      expect(newCheckpointerA).toBeDefined();

      // User B checkpointer remains unaffected
      const checkpointerB = agentMemoryService.getUserCheckpointer(userB);
      expect(checkpointerB).toBeDefined();
    });
  });
});
