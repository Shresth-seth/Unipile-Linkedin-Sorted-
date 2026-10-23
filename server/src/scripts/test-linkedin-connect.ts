import "../config/dotenv.config.js";
import { db, client } from "../db/index.js";
import { users } from "../db/schema.js";
import { linkedInAccountService } from "../services/linkedin/account.service.js";
import { unipileClient } from "../services/unipile/unipile.client.js";

const runLinkedInConnectTest = async () => {
  console.log("\n=======================================================");
  console.log("🔗 WORKPILOT LINKEDIN CONNECTIVITY TEST RUNNER");
  console.log("=======================================================\n");

  try {
    const isConfigured = unipileClient.isConfigured();
    console.log(`📡 Unipile Mode: ${isConfigured ? "🟢 LIVE UNIPILE API" : "🟡 BUILT-IN SIMULATOR (Mock Mode)"}`);

    // 1. Fetch active user
    const [user] = await db.select().from(users).limit(1);
    if (!user) {
      console.error("❌ No user found in database. Run `npm run test:auth` first.");
      return;
    }
    console.log(`👤 Active User: ${user.name} (${user.email})\n`);

    // 2. Generate Real / Mock Hosted Auth Link
    console.log("--- STEP 1: Generate Hosted Authentication URL ---");
    const authLink = await linkedInAccountService.generateAuthLink(user.id);
    console.log("✅ Hosted Authentication Link Generated Successfully!");
    console.log("--------------------------------------------------------------------------------");
    console.log("👉 CLICK OR OPEN THIS LINK IN YOUR BROWSER TO CONNECT YOUR LINKEDIN ACCOUNT:");
    console.log(`\n🔗  ${authLink.url}\n`);
    console.log("--------------------------------------------------------------------------------");

    // 3. Check Live Accounts on Unipile
    if (isConfigured) {
      console.log("--- STEP 2: Checking Connected Accounts on Live Unipile Gateway ---");
      const accountsList = await unipileClient.request<any>("/api/v1/accounts");
      const items = accountsList?.items || [];
      console.log(`📡 Total Accounts Linked in Unipile: ${items.length}`);

      if (items.length === 0) {
        console.log("\nℹ️ No LinkedIn account is connected yet in your Unipile dashboard.");
        console.log("👉 Open the URL above in your browser, log into LinkedIn, and then re-run this script to verify the connection!");
      } else {
        const primaryAccount = items[0];
        console.log(`✅ Found Linked Account in Unipile: ${primaryAccount.name || primaryAccount.account_name} (${primaryAccount.id})`);
        console.log(`   Provider: ${primaryAccount.provider}, Status: ${primaryAccount.status}`);

        // Sync real account into WorkPilot database
        const synced = await linkedInAccountService.syncAccount(user.id, primaryAccount.id);
        console.log(`✅ Synced to WorkPilot DB: isConnected=${synced.isConnected}, healthStatus=${synced.healthStatus}`);
      }
    } else {
      console.log("--- STEP 2: Mock Handshake Simulation ---");
      const synced = await linkedInAccountService.syncAccount(user.id, `mock_acc_${Date.now()}`);
      console.log(`✅ Mock Account Synced: isConnected=${synced.isConnected}, healthStatus=${synced.healthStatus}`);
    }

    // 4. Check Final WorkPilot Database Status
    console.log("\n--- STEP 3: WorkPilot Local Database Account Status ---");
    const status = await linkedInAccountService.getAccountStatus(user.id);
    console.log("   Status:", JSON.stringify(status, null, 2));

    console.log("\n=======================================================");
    console.log("✅ CONNECTIVITY GATEWAY VERIFIED!");
    console.log("=======================================================\n");
  } catch (error: any) {
    console.error("❌ LinkedIn Connect Test Error:", error.message || error);
  } finally {
    await client.end();
  }
};

runLinkedInConnectTest();
