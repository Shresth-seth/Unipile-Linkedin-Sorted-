import { db } from "./src/db/index.js";
import { dailyAgentSettings } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function run() {
  const userId = '90ab6334-7bcd-4671-bd50-41a3fc400c9d';
  
  let [settings] = await db.select().from(dailyAgentSettings).where(eq(dailyAgentSettings.userId, userId));
  
  if (!settings) {
    await db.insert(dailyAgentSettings).values({
      userId,
      replyMode: 'AUTO',
    });
    console.log("Created AUTO settings");
  } else {
    await db.update(dailyAgentSettings).set({ replyMode: 'AUTO' }).where(eq(dailyAgentSettings.userId, userId));
    console.log("Updated to AUTO settings");
  }
  process.exit(0);
}
run();
