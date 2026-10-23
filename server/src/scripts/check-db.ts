import "./../config/dotenv.config.js";
import { db } from "../db/index.js";
import { users, linkedinAccounts, dailyAgentSettings } from "../db/schema.js";

async function q() {
  const u = await db.select().from(users);
  const a = await db.select().from(linkedinAccounts);
  const s = await db.select().from(dailyAgentSettings);
  console.log("USERS:", u.map(x => ({ id: x.id, name: x.name, email: x.email })));
  console.log("ACCOUNTS:", a.map(x => ({ id: x.id, userId: x.userId, unipileAccountId: x.unipileAccountId, name: x.linkedinName })));
  console.log("SETTINGS:", s);
}
q().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
