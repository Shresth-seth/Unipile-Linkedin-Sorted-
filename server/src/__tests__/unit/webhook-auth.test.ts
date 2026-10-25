import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { webhookAuthService } from "../../services/webhook/webhook-auth.service.js";
import { Request } from "express";

function createMockWebhookRequest(headers: Record<string, string | string[] | undefined>): Request {
  return {
    headers,
  } as unknown as Request;
}

describe("Webhook Authentication & Fail-Closed Guardrails", () => {
  const originalSecret = process.env.UNIPILE_WEBHOOK_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.UNIPILE_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.UNIPILE_WEBHOOK_SECRET;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("Fail-Closed on Missing UNIPILE_WEBHOOK_SECRET across all environments", () => {
    it("fails closed in development environment when secret is unset", () => {
      delete process.env.UNIPILE_WEBHOOK_SECRET;
      process.env.NODE_ENV = "development";

      const req = createMockWebhookRequest({});
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Webhook authentication is not configured.");
    });

    it("fails closed in test environment when secret is unset", () => {
      delete process.env.UNIPILE_WEBHOOK_SECRET;
      process.env.NODE_ENV = "test";

      const req = createMockWebhookRequest({ "unipile-auth": "some-token" });
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Webhook authentication is not configured.");
    });

    it("fails closed in production environment when secret is unset", () => {
      delete process.env.UNIPILE_WEBHOOK_SECRET;
      process.env.NODE_ENV = "production";

      const req = createMockWebhookRequest({});
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Webhook authentication is not configured.");
    });
  });

  describe("Secret Verification when UNIPILE_WEBHOOK_SECRET is configured", () => {
    const TEST_SECRET = "test-webhook-secret-strictly-32-chars-long";

    beforeEach(() => {
      process.env.UNIPILE_WEBHOOK_SECRET = TEST_SECRET;
    });

    it("rejects request when no authentication headers are provided", () => {
      const req = createMockWebhookRequest({});
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Missing webhook authentication header (Unipile-Auth).");
    });

    it("rejects request with wrong secret value", () => {
      const req = createMockWebhookRequest({
        "unipile-auth": "wrong-secret-token-value-mismatch",
      });
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Invalid webhook secret.");
    });

    it("rejects request with secret length mismatch", () => {
      const req = createMockWebhookRequest({
        "unipile-auth": "short",
      });
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Invalid webhook secret.");
    });

    it("accepts request with valid 'unipile-auth' header", () => {
      const req = createMockWebhookRequest({
        "unipile-auth": TEST_SECRET,
      });
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("accepts request with valid 'x-unipile-secret' header", () => {
      const req = createMockWebhookRequest({
        "x-unipile-secret": TEST_SECRET,
      });
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(true);
    });

    it("accepts request with valid 'authorization: Bearer <secret>' header", () => {
      const req = createMockWebhookRequest({
        authorization: `Bearer ${TEST_SECRET}`,
      });
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(true);
    });

    it("accepts request with valid 'x-webhook-secret' header", () => {
      const req = createMockWebhookRequest({
        "x-webhook-secret": TEST_SECRET,
      });
      const result = webhookAuthService.verifyWebhookRequest(req);

      expect(result.valid).toBe(true);
    });
  });
});
