import "dotenv/config";
import { db } from "../db/index.js";
import { linkedinAccounts, dailyAgentSettings } from "../db/schema.js";
import { unipileClient } from "../services/unipile/unipile.client.js";

async function diagnose() {
  console.log("==================================================");
  console.log("🔍 WORKPILOT SYNC & SETTINGS DIAGNOSTIC");
  console.log("==================================================");

  // 1. Live Unipile Accounts
  const unipileAccountsRes = await unipileClient.request<any>("/api/v1/accounts");
  const liveAccounts = unipileAccountsRes.items || unipileAccountsRes.data || unipileAccountsRes || [];
  console.log(`\n[1] Found ${liveAccounts.length} account(s) on Unipile:`);
  for (const acc of liveAccounts) {
    console.log(`  - ID: ${acc.id} | Name: ${acc.name || acc.account_name} | Status: ${acc.status}`);
  }

  // 2. Daily Agent Settings
  console.log("\n[2] Daily Agent Settings in DB:");
  const settings = await db.select().from(dailyAgentSettings);
  for (const s of settings) {
    console.log(`  - User: ${s.userId} | ReplyMode: ${s.replyMode} | Enabled: ${s.dailyAgentEnabled} | AutoReplies: ${s.autoMessageReplies}`);
    if (s.replyMode === "OFF") {
      const { eq } = await import("drizzle-orm");
      await db.update(dailyAgentSettings)
        .set({
          replyMode: "AUTO",
          autoMessageReplies: true,
          dailyAgentEnabled: true,
          updatedAt: new Date()
        })
        .where(eq(dailyAgentSettings.userId, s.userId));
      console.log(`    ✅ Updated user ${s.userId} replyMode to AUTO, autoMessageReplies: true, dailyAgentEnabled: true.`);
    }
  }

  // 3. Inspect raw chat fields from Unipile
  const [dbAcc] = await db.select().from(linkedinAccounts);
  if (dbAcc?.unipileAccountId) {
    console.log(`\n[3] Inspecting Chat structure for ${dbAcc.unipileAccountId}:`);
    const rawChatsRes = await unipileClient.request<any>(`/api/v1/chats?account_id=${dbAcc.unipileAccountId}&limit=2`);
    const rawChats = rawChatsRes.items || rawChatsRes.data || rawChatsRes || [];
    if (rawChats.length > 0) {
      console.log("  Chat keys:", Object.keys(rawChats[0]));
      console.log("  Chat[0] snippet/text:", {
        id: rawChats[0].id,
        name: rawChats[0].name,
        unread: rawChats[0].unread,
        unread_count: rawChats[0].unread_count,
        timestamp: rawChats[0].timestamp,
        text: rawChats[0].text,
        snippet: rawChats[0].snippet,
        last_message: rawChats[0].last_message,
        last_message_text: rawChats[0].last_message_text,
      });
    }
  }

  // 4. Test optimized live sync
  if (dbAcc?.unipileAccountId && dbAcc?.userId) {
    console.log(`\n[4] Benchmarking Optimized Live Sync for ${dbAcc.unipileAccountId}:`);
    const { inboundSyncService } = await import("../services/linkedin/inbound-sync.service.js");
    const t0 = Date.now();
    const syncRes = await inboundSyncService.syncAccount(dbAcc.userId, dbAcc.unipileAccountId, { limit: 15 });
    const duration = Date.now() - t0;
    console.log(`  ⚡ Sync completed in ${duration}ms! Result:`, syncRes);
  }

  console.log("\n==================================================");
  process.exit(0);
}

diagnose().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
