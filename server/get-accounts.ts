import { db } from "./src/db/index.js";
import { linkedinAccounts } from "./src/db/schema.js";

async function run() {
  const accounts = await db.select().from(linkedinAccounts);
  console.log(JSON.stringify(accounts, null, 2));
  process.exit(0);
}
run();
