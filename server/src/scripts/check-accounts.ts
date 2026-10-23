import "./../config/dotenv.config.js";
import { db } from "../db/index.js";
import { linkedinAccounts, users, dailyAgentSettings } from "../db/schema.js";
import { unipileClient } from "../services/unipile/unipile.client.js";

async function main() {
  const u = await db.select().from(users);
  const a = await db.select().from(linkedinAccounts);
  const s = await db.select().from(dailyAgentSettings);

  console.log("=== USERS ===");
  console.log(u.map(x => ({ id: x.id, email: x.email, name: x.name })));

  console.log("\n=== LINKEDIN ACCOUNTS IN DB ===");
  console.log(a.map(x => ({
    id: x.id,
    userId: x.userId,
    unipileAccountId: x.unipileAccountId,
    name: x.linkedinName,
    isConnected: x.isConnected,
    healthStatus: x.healthStatus,
    automationStatus: x.automationStatus,
  })));

  console.log("\n=== DAILY AGENT SETTINGS ===");
  console.log(s.map(x => ({
    userId: x.userId,
    dailyAgentEnabled: x.dailyAgentEnabled,
    replyMode: x.replyMode,
    personality: x.personality?.slice(0, 100),
    companyKnowledge: x.companyKnowledge?.slice(0, 100),
  })));

  console.log("\n=== UNIPILE STATUS ===");
  console.log("Configured:", unipileClient.isConfigured());
  const creds = await unipileClient.getActiveCredentials();
  console.log("DSN:", creds.dsn);
  console.log("API Key set:", Boolean(creds.apiKey));

  if (unipileClient.isConfigured()) {
    try {
      const accounts = await unipileClient.listAccounts();
      console.log("\n=== LIVE UNIPILE ACCOUNTS ===");
      console.log(accounts.map((acc: any) => ({
        id: acc.id,
        name: acc.name || acc.account_name,
        type: acc.type || acc.provider,
        status: acc.status,
        sources: acc.sources,
      })));

      // If any accounts exist, test getting chats
      if (accounts.length > 0) {
        const first = accounts[0];
        console.log(`\n=== TESTING CHATS FOR ACCOUNT ${first.id} ===`);
        try {
          const chatsRes = await unipileClient.request<any>(`/api/v1/chats?account_id=${first.id}&limit=5`);
          console.log("Chats count:", (chatsRes.items || chatsRes.data || chatsRes || []).length);
          console.log("Sample chat:", (chatsRes.items || chatsRes.data || chatsRes || [])[0]);
        } catch (chatErr: any) {
          console.error("Failed to fetch chats:", chatErr.message);
        }
      }
    } catch (e: any) {
      console.error("Unipile listAccounts error:", e.message);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
