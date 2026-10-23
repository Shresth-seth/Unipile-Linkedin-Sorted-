import "./../config/dotenv.config.js";
import { unipileClient } from "../services/unipile/unipile.client.js";

async function test() {
  const accountId = "5kTKn5v4TWKk7RbXeaC0iA";
  const r: any = await unipileClient.request(`/api/v1/chats?account_id=${accountId}&limit=5`);
  const items = r.items || r.data || r;
  console.log("FIRST CHAT KEYS:", Object.keys(items[0]));
  console.log("FIRST CHAT OBJECT:", items[0]);
  process.exit(0);
}

test().catch(console.error);
