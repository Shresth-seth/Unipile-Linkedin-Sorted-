import { chatWithWORKPILOTAgent } from "./src/agent/WORKPILOT-connect-agent.js";
import { db } from "./src/db/index.js";
import { users } from "./src/db/schema.js";
import { eq } from "drizzle-orm";
import { taskManager } from "./src/agent/WORKPILOT-task-manager.js";

async function main() {
  const user = await db.query.users.findFirst({
    where: eq(users.email, "admin@example.com")
  });
  if (!user) throw new Error("No user found");
  
  console.log("Starting test chat instruction for Engagement...");

  const result = await chatWithWORKPILOTAgent({
    messages: [{ role: "user", content: "Search 8 AI Engineers in India, send 4 with note, 4 blank" }],
    userId: user.id,
    threadId: "test_thread_" + Date.now(),
    agentSettings: {
      dailyQuota: 10,
      campaignType: "ENGAGEMENT",
      companyKnowledge: "",
      faq: ""
    }
  });
  
  console.log("LLM Tool Calls Executed:");
  console.dir(result.toolCallsExecuted, { depth: null });
  
  const taskId = result.toolCallsExecuted?.[0]?.input?.taskId;
  if (!taskId) {
      console.log("No background task ID found.");
      return;
  }
  
  console.log(`\nMonitoring Task ID: ${taskId}`);

  // Monitor logs for 60 seconds
  let printedLogs = 0;
  for (let i = 0; i < 60; i++) {
      const task = taskManager.getUserTasks(user.id).find(t => t.id === taskId);
      const logs = task?.logs || [];
      
      if (logs.length > printedLogs) {
          for (let j = printedLogs; j < logs.length; j++) {
              console.log(`[${logs[j].type.toUpperCase()}] ${logs[j].message}`);
          }
          printedLogs = logs.length;
      }
      
      if (task && task.status === "completed") {
          console.log("\nTask completed successfully!");
          break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

main().catch(console.error);
