import "../config/dotenv.config.js";
import { webhookSetupService } from "../services/webhook/webhook-setup.service.js";

async function main() {
  console.log("================================================================================");
  console.log("🔌 UNIPILE IDEMPOTENT WEBHOOK SETUP");
  console.log("================================================================================");

  const customUrl = process.argv[2];
  const res = await webhookSetupService.ensureWebhooksConfigured(customUrl);

  console.log("\nResults Summary:");
  console.table(res.results);

  if (!res.success) {
    console.error("\n⚠️ Some webhooks failed to register. Verify your UNIPILE_DSN and UNIPILE_API_KEY.");
    process.exit(1);
  } else {
    console.log("\n✅ All required webhooks are properly configured!");
    process.exit(0);
  }
}

main();
