import { db } from "./src/db/index.js";
import { linkedinAccounts } from "./src/db/schema.js";

async function run() {
  const accounts = await db.select().from(linkedinAccounts);
  const sanitized = accounts.map((acc) => ({
    id: acc.id,
    userId: acc.userId,
    linkedinName: acc.linkedinName,
    isConnected: acc.isConnected,
    healthStatus: acc.healthStatus,
    unipileAccountId: acc.unipileAccountId ? `${acc.unipileAccountId.substring(0, 4)}...` : null,
    encryptedCredentials: acc.encryptedCredentials ? "[ENCRYPTED]" : null,
  }));
  console.log(JSON.stringify(sanitized, null, 2));
  process.exit(0);
}
run();
