import { unipileClient } from "../unipile/unipile.client.js";

export interface WebhookRegistrationResult {
  source: string;
  url: string;
  status: "ALREADY_EXISTS" | "CREATED" | "FAILED";
  id?: string;
  error?: string;
}

export class WebhookSetupService {
  /**
   * Idempotently configures required Unipile webhooks (messaging & users).
   * Safe to run repeatedly without creating duplicate registrations.
   */
  public async ensureWebhooksConfigured(webhookBaseUrl?: string): Promise<{
    success: boolean;
    results: WebhookRegistrationResult[];
  }> {
    if (!unipileClient.isConfigured()) {
      return {
        success: false,
        results: [
          {
            source: "all",
            url: "",
            status: "FAILED",
            error: "Unipile client is not configured in server/.env",
          },
        ],
      };
    }

    const baseUrl = (
      webhookBaseUrl ||
      process.env.WEBHOOK_BASE_URL ||
      process.env.API_BASE_URL ||
      "http://13.53.169.49"
    )
      .trim()
      .replace(/\/+$/, "");

    const targetUrl = `${baseUrl}/api/webhooks/unipile`;
    const secret = process.env.UNIPILE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new Error("UNIPILE_WEBHOOK_SECRET is required before registering webhooks.");
    }

    const headers = [
      { key: "Content-Type", value: "application/json" },
      { key: "Unipile-Auth", value: secret },
    ];

    const results: WebhookRegistrationResult[] = [];

    const messagingDataKeys = [
      "account_id", "account_type", "account_info", "webhook_name", "chat_id",
      "attendees", "sender", "subject", "message", "mentions", "message_id",
      "timestamp", "attachments", "reaction", "reaction_sender", "read_by",
      "is_sender", "provider_chat_id", "provider_message_id", "is_event",
      "chat_pinned", "quoted", "reply_to", "is_forwarded", "is_view_once",
      "chat_content_type", "message_type", "is_group", "folder", "event_type"
    ].map(k => ({ key: k, name: k }));

    const relationDataKeys = [
      "account_id", "account_type", "webhook_name", "timestamp",
      "user_full_name", "user_provider_id", "user_public_identifier",
      "user_profile_url", "user_picture_url"
    ].map(k => ({ key: k, name: k }));

    try {
      // 1. Fetch current webhooks list from Unipile
      const existingWebhooks = await unipileClient.listWebhooks().catch(() => []);
      console.log(`[webhook-setup] Discovered ${existingWebhooks.length} existing Unipile webhook(s).`);

      const sourcesToRegister = [
        { source: "messaging", name: "WorkPilot New Messages Webhook", events: ["message_received"], data: messagingDataKeys },
        { source: "users", name: "WorkPilot New Relations Webhook", events: ["new_relation"], data: relationDataKeys },
      ];

      for (const item of sourcesToRegister) {
        // Check if an existing webhook matches source and targetUrl
        const alreadyExists = existingWebhooks.find(
          (w: any) =>
            (w.source === item.source || w.event === item.source) &&
            (w.request_url === targetUrl || w.url === targetUrl),
        );

        if (alreadyExists) {
          console.log(`[webhook-setup] Webhook for source '${item.source}' already registered (ID: ${alreadyExists.id}).`);
          results.push({
            source: item.source,
            url: targetUrl,
            status: "ALREADY_EXISTS",
            id: alreadyExists.id,
          });
          continue;
        }

        // Register new webhook
        try {
          console.log(`[webhook-setup] Registering webhook for '${item.source}' to ${targetUrl}...`);
          const createRes = await unipileClient.request<any>("/api/v1/webhooks", {
            method: "POST",
            body: JSON.stringify({
              request_url: targetUrl,
              source: item.source,
              name: item.name,
              events: item.events,
              headers,
              data: item.data,
            }),
          });

          console.log(`✅ [webhook-setup] Successfully created webhook for '${item.source}' (ID: ${createRes?.id || "ok"}).`);
          results.push({
            source: item.source,
            url: targetUrl,
            status: "CREATED",
            id: createRes?.id,
          });
        } catch (createErr: any) {
          console.error(`❌ [webhook-setup] Failed to register webhook for '${item.source}':`, createErr?.message || createErr);
          results.push({
            source: item.source,
            url: targetUrl,
            status: "FAILED",
            error: createErr?.message || String(createErr),
          });
        }
      }

      return {
        success: results.every((r) => r.status !== "FAILED"),
        results,
      };
    } catch (err: any) {
      console.error("[webhook-setup] Fatal error during webhook setup:", err?.message || err);
      return {
        success: false,
        results: [
          {
            source: "all",
            url: targetUrl,
            status: "FAILED",
            error: err?.message || String(err),
          },
        ],
      };
    }
  }
}

export const webhookSetupService = new WebhookSetupService();
