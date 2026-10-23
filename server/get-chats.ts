import "./src/config/dotenv.config.js";
import { db, client } from "./src/db/index.js";
import { users, linkedinAccounts } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function listChats() {
  try {
    const [user] = await db.select().from(users).limit(1);
    if (!user) {
      console.log("No user found in DB.");
      return;
    }

    const [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, user.id))
      .limit(1);

    if (!account) {
      console.log("No LinkedIn account linked for user in DB.");
      return;
    }

    console.log(`User: ${user.email} | LinkedIn Name: ${account.linkedinName}`);
    console.log(`Unipile Account ID: ${account.unipileAccountId}`);

    const UNIPILE_DSN = process.env.UNIPILE_DSN;
    if (!UNIPILE_DSN) {
      console.log("Missing UNIPILE_DSN in .env");
      return;
    }

    // Fetch chats from Unipile
    const res = await fetch(`${UNIPILE_DSN}/api/v1/chats?account_id=${account.unipileAccountId}&limit=5`, {
      headers: {
        "X-API-KEY": process.env.UNIPILE_API_KEY || ""
      }
    });

    if (!res.ok) {
      console.log(`Failed to fetch chats: ${res.statusText}`);
      console.log(await res.text());
      return;
    }

    const data = await res.json();
    console.log("\n=== RECENT LINKEDIN CHATS ===");
    for (const chat of data.items || []) {
      console.log(`Chat ID: ${chat.id}`);
      const attendees = chat.attendees.map((a: any) => a.name).join(", ");
      console.log(`Attendees: ${attendees}`);
      console.log(`Last Message: ${chat.last_message?.text || "N/A"}`);
      console.log("------------------------");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

listChats();
