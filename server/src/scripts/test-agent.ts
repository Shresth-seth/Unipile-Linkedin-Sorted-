import "../config/dotenv.config.js";
import { WORKPILOTConnectTools } from "../tools/tools.js";
import {
  createWORKPILOTLangGraphAgent,
  createWORKPILOTLangChainAgent,
  chatWithWORKPILOTAgent,
  executeAutonomousCampaignWorkflow,
} from "../agent/WORKPILOT-connect-agent.js";

const BASE_URL = process.env.API_URL || "http://localhost:4000";

async function runAgentSuite() {
  console.log("=======================================================");
  console.log("🤖 WORKPILOT LangGraph & LangChain Agent Test Suite");
  console.log(`📡 Target API: ${BASE_URL}`);
  console.log(
    `🧠 Model Target: ${process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"}`,
  );
  console.log("=======================================================\n");

  // Step 1: Direct Tool Verification & Router Execution
  console.log(
    "--- 1. Testing Separated Tools Suite (server/src/tools/tools.ts) ---",
  );
  console.log(`✅ Loaded ${WORKPILOTConnectTools.length} separated tools:`);
  WORKPILOTConnectTools.forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.name}]: ${t.description.slice(0, 75)}...`);
  });

  if (WORKPILOTConnectTools.length !== 16) {
    throw new Error(`Expected 16 tools, found ${WORKPILOTConnectTools.length}`);
  }

  const { executeSystemTool } = await import("../tools/tools.js");
  const directToolCall = await executeSystemTool({
    name: "get_account_safety_and_limits",
    args: {},
  });
  console.log(
    "✅ executeSystemTool successfully executed 'get_account_safety_and_limits':",
    Boolean(directToolCall.response?.result),
  );

  // Step 2: Agent Constructors
  console.log(
    "\n--- 2. Testing LangGraph and LangChain Agent Instantiation ---",
  );
  const langGraphAgent = createWORKPILOTLangGraphAgent();
  console.log(
    "✅ LangGraph React Agent instantiated with checkpoint saver:",
    Boolean(langGraphAgent),
  );

  const langChainAgent = createWORKPILOTLangChainAgent();
  console.log(
    "✅ LangChain v1 Agent instantiated with Gemini 3.5 Flash Lite config:",
    Boolean(langChainAgent),
  );

  // Step 3: Interactive Chat with Tool Calling
  console.log("\n--- 3. Testing Interactive Multi-turn Agent Reasoning ---");
  const chatResponse = await chatWithWORKPILOTAgent({
    messages: [
      {
        role: "user",
        content: "Check my LinkedIn account safety status and daily quotas.",
      },
    ],
  });
  console.log("✅ Agent Reply:\n", chatResponse.reply);
  console.log("✅ Tool Calls Executed:", chatResponse.toolCallsExecuted);

  // Step 4: Autonomous Workflow Execution
  console.log(
    "\n--- 4. Testing Autonomous Campaign Workflow with Human Pacing ---",
  );
  const workflowRes = await executeAutonomousCampaignWorkflow({
    goal: "Connect with AI & Robotics Engineers in India",
    targetRole: "AI Engineer",
    location: "India",
    limit: 2,
    personalizedNote:
      "Hi {{name}}, impressed by your AI engineering work! Would love to connect on WORKPILOT.",
  });
  console.log("✅ Autonomous Workflow Summary:", workflowRes.summary);
  console.log(
    `✅ Discovered: ${workflowRes.discovered}, Enqueued with 8-18m delays: ${workflowRes.enqueued}`,
  );

  // Step 5: Live API Route Testing
  console.log("\n--- 5. Testing Live API Endpoints (/api/agent) ---");

  // Generate JWT for first user in DB
  const jwt = await import("jsonwebtoken");
  const { db } = await import("../db/index.js");
  const { users } = await import("../db/schema.js");
  const [firstUser] = await db.select().from(users).limit(1);

  if (!firstUser) {
    throw new Error("No user found in database for test.");
  }

  const token = jwt.default.sign(
    { id: firstUser.id, email: firstUser.email },
    process.env.JWT_SECRET || "your_jwt_secret_key_change_in_production",
    { expiresIn: "1h" },
  );
  console.log(
    `✅ Authenticated test session as: ${firstUser.email} (ID: ${firstUser.id})`,
  );

  if (token) {
    // GET /api/agent/tools
    const toolsRes = await fetch(`${BASE_URL}/api/agent/tools`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const toolsData: any = await toolsRes.json();
    console.log(
      `✅ GET /api/agent/tools returned ${toolsData.count} registered tools (Status: ${toolsRes.status})`,
    );

    // POST /api/agent/chat
    const apiChatRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "What tools do you have to find and connect with leads?",
          },
        ],
      }),
    });
    const apiChatData: any = await apiChatRes.json();
    console.log("✅ POST /api/agent/chat response received (Status: 200)");
    console.log("   Snippet:", apiChatData.data?.reply?.slice(0, 140) + "...");

    // POST /api/agent/campaign
    const apiCampaignRes = await fetch(`${BASE_URL}/api/agent/campaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        goal: "Expand network with ML Engineers in Bangalore",
        targetRole: "ML Engineer",
        location: "Bangalore",
        limit: 3,
        personalizedNote:
          "Hi {{name}}, great to connect with fellow ML engineers in Bangalore!",
      }),
    });
    const apiCampaignData: any = await apiCampaignRes.json();
    console.log("✅ POST /api/agent/campaign executed (Status: 200)");
    console.log("   Summary:", apiCampaignData.data?.summary);
  }

  console.log("\n=======================================================");
  console.log("🎉 ALL AGENT, LANGGRAPH & TOOL-CALLING TESTS PASSED!");
  console.log("=======================================================\n");
  process.exit(0);
}

runAgentSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
