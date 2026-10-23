import "./../config/dotenv.config.js";
import { unipileClient } from "../services/unipile/unipile.client.js";

async function checkWebhooks() {
  const res: any = await unipileClient.request("/api/v1/webhooks");
  console.log("REGISTERED WEBHOOKS IN UNIPILE:", JSON.stringify(res, null, 2));
}

checkWebhooks().catch(console.error);
