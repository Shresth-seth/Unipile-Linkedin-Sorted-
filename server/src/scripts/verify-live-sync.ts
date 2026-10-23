import "./../config/dotenv.config.js";
import { inboundSyncService } from "../services/linkedin/inbound-sync.service.js";
import { db } from "../db/index.js";
import { contacts, messages } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function run() {
  const userId = "81b7747a-f8c5-4d95-8a26-8a4b4b87f705";
  const accountId = "5kTKn5v4TWKk7RbXeaC0iA";

  console.log("=== 1. TRIGGERING LIVE INBOUND SYNC ===");
  const syncResult = await inboundSyncService.syncAccount(userId, accountId, { limit: 15 });
  console.log("Sync Result:", syncResult);

  console.log("\n=== 2. VERIFYING SEJAL'S CONTACT IN DB ===");
  const sejalContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.linkedinId, "ACoAAFbl79wBoDoMcOUb8oKAncNYyw-ccyzzwpM"));
  console.log("Sejal Contacts Count:", sejalContacts.length);
  if (sejalContacts.length > 0 && sejalContacts[0]) {
    const c = sejalContacts[0];
    console.log("Contact Name:", c.name);
    console.log("Designation:", c.designation);
    console.log("Profile URL:", c.profileUrl?.slice(0, 60));
    console.log("Status:", c.status);
    console.log("Conversation Mode:", c.conversationMode);
    console.log("Draft Reply:", c.draftReply);
    console.log("Draft Reason:", c.draftReplyReason);

    console.log("\n=== 3. VERIFYING MESSAGES IN DB ===");
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.contactId, c.id));
    console.log("Messages Count:", msgs.length);
    for (const m of msgs) {
      console.log(`- [${m.direction}] (${m.senderName}): "${m.content}"`);
    }
  }

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
