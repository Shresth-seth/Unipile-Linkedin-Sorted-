import crypto from "node:crypto";
import { Request } from "express";

export class WebhookAuthService {
  /**
   * Verifies the incoming webhook request using a constant-time comparison against UNIPILE_WEBHOOK_SECRET.
   * Checks headers: 'Unipile-Auth', 'x-unipile-secret', or 'authorization'.
   */
  public verifyWebhookRequest(req: Request): { valid: boolean; reason?: string } {
    const configuredSecret = process.env.UNIPILE_WEBHOOK_SECRET?.trim();

    // Missing webhook secret must fail closed in every environment
    if (!configuredSecret) {
      return { valid: false, reason: "Webhook authentication is not configured." };
    }

    const providedHeader =
      req.headers["unipile-auth"] ||
      req.headers["x-unipile-secret"] ||
      req.headers["authorization"] ||
      req.headers["x-webhook-secret"];

    if (!providedHeader) {
      return { valid: false, reason: "Missing webhook authentication header (Unipile-Auth)." };
    }

    const headerValue = Array.isArray(providedHeader) ? providedHeader[0] : providedHeader;
    const cleanProvided = String(headerValue || "").replace(/^Bearer\s+/i, "").trim();

    try {
      const a = Buffer.from(cleanProvided, "utf-8");
      const b = Buffer.from(configuredSecret, "utf-8");

      if (a.length !== b.length) {
        return { valid: false, reason: "Invalid webhook secret." };
      }

      const isMatch = crypto.timingSafeEqual(a, b);
      if (!isMatch) {
        return { valid: false, reason: "Invalid webhook secret." };
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, reason: `Authentication verification error: ${err?.message}` };
    }
  }
}

export const webhookAuthService = new WebhookAuthService();
