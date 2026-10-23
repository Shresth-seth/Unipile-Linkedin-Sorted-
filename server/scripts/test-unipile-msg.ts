import { UnipileClient } from "../src/services/unipile/unipile.client";

async function run() {
  const client = new UnipileClient();
  // We need to fetch the real account ID from system_settings or just fetch it via unipile client.
  try {
    const accRes = await client.request("/api/v1/accounts");
    const accounts = (accRes as any).accounts || [];
    console.log("Accounts:", accounts.map((a: any) => ({ id: a.id, provider: a.provider })));
    
    const accountId = accounts.find((a: any) => a.provider === "LINKEDIN")?.id;
    if (!accountId) return console.log("No linkedin account found");
    
    console.log("Using accountId:", accountId);
    
    // First let's get existing connections
    const conns = await client.getConnections(accountId, 1);
    if (!conns.items.length) return console.log("No connections");
    const conn = conns.items[0];
    
    console.log("Sending to connection:", conn.first_name, conn.last_name, "member_id:", conn.member_id, "provider_id:", conn.provider_id);
    
    const res = await client.request("/api/v1/chats", {
      method: "POST",
      body: JSON.stringify({
        account_id: accountId,
        attendees_ids: [conn.provider_id || conn.member_id], // let's see which one exists
        text: "Hi " + conn.first_name + ", just a test from WORKPILOT."
      })
    });
    console.log("SUCCESS:", res);
  } catch(e: any) {
    console.error("FAILED:", e.message);
  }
}
run();
