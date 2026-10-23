import "./../config/dotenv.config.js";
import { unipileClient } from "../services/unipile/unipile.client.js";

async function updateWebhooks() {
  const targetUrl = "http://13.53.169.49/api/webhooks/unipile";
  console.log("Setting webhooks to target URL:", targetUrl);

  const listRes: any = await unipileClient.request("/api/v1/webhooks");
  const items = listRes.items || [];
  console.log(`Found ${items.length} existing webhooks.`);

  for (const item of items) {
    console.log(`\nWebhook ID: ${item.id}, Name: ${item.name}, Source: ${item.source}`);
    console.log(`Current request_url: ${item.request_url}`);

    // If it's our bare test webhook, delete it
    if (item.name === "Test WorkPilot Webhook" || item.name === "Test HTTP Webhook") {
      console.log(`Deleting test webhook ${item.id}...`);
      await unipileClient.request(`/api/v1/webhooks/${item.id}`, { method: "DELETE" });
      continue;
    }

    // Try updating request_url directly
    let updated = false;
    try {
      const putRes = await unipileClient.request(`/api/v1/webhooks/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...item,
          request_url: targetUrl,
        }),
      });
      console.log(`✅ Updated webhook ${item.id} via PUT:`, putRes?.request_url || putRes);
      updated = true;
    } catch (e: any) {
      console.log(`PUT failed (${e.message}), trying PATCH...`);
      try {
        const patchRes = await unipileClient.request(`/api/v1/webhooks/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            request_url: targetUrl,
          }),
        });
        console.log(`✅ Updated webhook ${item.id} via PATCH:`, patchRes?.request_url || patchRes);
        updated = true;
      } catch (e2: any) {
        console.log(`PATCH failed (${e2.message}). Recreating webhook...`);
      }
    }

    if (!updated) {
      // Recreate with exact same headers, data, events, source, format, but new request_url
      const newWebhookPayload = {
        name: item.name,
        source: item.source,
        events: item.events,
        format: item.format || "json",
        request_url: targetUrl,
        headers: item.headers,
        data: item.data,
      };

      await unipileClient.request(`/api/v1/webhooks/${item.id}`, { method: "DELETE" });
      console.log(`Deleted old webhook ${item.id}. Creating new...`);

      const created = await unipileClient.request("/api/v1/webhooks", {
        method: "POST",
        body: JSON.stringify(newWebhookPayload),
      });
      console.log(`✅ Created replacement webhook:`, created);
    }
  }

  console.log("\n=== FINAL WEBHOOKS LIST ===");
  const finalRes: any = await unipileClient.request("/api/v1/webhooks");
  for (const w of finalRes.items || []) {
    console.log(`- [${w.source}] ${w.name} -> ${w.request_url} (events: ${w.events?.join(", ")})`);
  }

  process.exit(0);
}

updateWebhooks().catch(console.error);
