import "../config/dotenv.config.js";
import { dailyAgentWorker } from "../agent/daily/daily-agent.worker.js";
import { client } from "../db/index.js";

async function main() {
  console.log("================================================================================");
  console.log("🤖 WORKPILOT AWS DAILY AGENT RUNNER STARTED");
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log("================================================================================");

  try {
    const res = await dailyAgentWorker.processDueUsers();
    console.log(`\n🏁 Daily Agent Worker Cycle Finished.`);
    console.log(`📊 Users Checked: ${res.checkedCount}`);
    console.log(`🚀 Runs Executed: ${res.executedCount}`);
  } catch (error: any) {
    console.error("❌ Unhandled runner error:", error?.message || error);
    process.exitCode = 1;
  } finally {
    // Gracefully disconnect DB client when running as a standalone job
    await client.end().catch(() => {});
    console.log("🔒 DB connection closed cleanly.");
  }
}

main();
