import "../config/dotenv.config.js";
import { agentMemoryService } from "../services/agent/agent-memory.service.js";
import { createWORKPILOTLangGraphAgent } from "../agent/WORKPILOT-connect-agent.js";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { HumanMessage } from "@langchain/core/messages";

async function runTest() {
  console.log("===================================================================");
  console.log("🧪 WORKPILOT Short-Term Memory & User Separation Verification Test");
  console.log("   Reference: https://docs.langchain.com/oss/javascript/langchain/short-term-memory");
  console.log("===================================================================\n");

  const userA = "user-uuid-aaaa-1111";
  const userB = "user-uuid-bbbb-2222";

  // Clean initial state for both test users
  await agentMemoryService.clearHistory(userA);
  await agentMemoryService.clearHistory(userB);

  // =========================================================================
  // Test 1: User-Isolated Checkpointer Instances
  // =========================================================================
  console.log("📦 Test 1: Verifying isolated MemorySaver checkpointers per user...");
  const checkpointerA = agentMemoryService.getUserCheckpointer(userA);
  const checkpointerB = agentMemoryService.getUserCheckpointer(userB);

  if (!checkpointerA || !checkpointerB) {
    throw new Error("Failed to instantiate user checkpointers.");
  }
  if (checkpointerA === checkpointerB) {
    throw new Error("User A and User B MUST NOT share the same MemorySaver instance!");
  }
  console.log("✅ User A and User B have separate, dedicated MemorySaver instances!");

  // =========================================================================
  // Test 2: Multi-Turn Short-Term Memory Retention Across Turns
  // =========================================================================
  console.log("\n🧠 Test 2: Multi-Turn Short-Term Memory Retention (Remember what was done previously)...");
  
  // Create an agent for User A with deterministic responses
  const fakeModelUserA = new FakeListChatModel({
    responses: [
      "I found 3 AI engineers in London: 1. Oliver Smith, 2. Charlotte Brown, 3. Liam Davies.",
      "Understood. I will prepare an invite for Charlotte Brown (the second person).",
    ],
  });

  const agentA = createWORKPILOTLangGraphAgent({
    userId: userA,
    systemPrompt: "You are the WORKPILOT AI agent.",
    llm: fakeModelUserA,
  });

  const threadIdA = agentMemoryService.getUserThreadId(userA);

  // Turn 1: Search for leads
  console.log("  Turn 1: User A sends 'Find 3 AI engineers in London'...");
  const turn1Res = await agentA.invoke(
    { messages: [new HumanMessage("Find 3 AI engineers in London")] },
    { configurable: { thread_id: threadIdA } }
  );

  const turn1Reply = turn1Res.messages.at(-1)?.content;
  console.log(`  Agent Turn 1 Reply: "${turn1Reply}"`);

  // Verify checkpointer state after Turn 1
  const stateA1 = await agentA.getState({ configurable: { thread_id: threadIdA } });
  console.log(`  State message count after Turn 1: ${stateA1.values.messages.length} messages`);
  if (stateA1.values.messages.length !== 2) {
    throw new Error(`Expected 2 messages in state after Turn 1, got ${stateA1.values.messages.length}`);
  }

  // Turn 2: Follow-up relying on short-term memory (Only passing the NEW message!)
  console.log("  Turn 2: User A sends 'Send connection request to the second person' (referencing Turn 1)...");
  const turn2Res = await agentA.invoke(
    { messages: [new HumanMessage("Send connection request to the second person")] },
    { configurable: { thread_id: threadIdA } }
  );

  const turn2Reply = turn2Res.messages.at(-1)?.content;
  console.log(`  Agent Turn 2 Reply: "${turn2Reply}"`);

  // Verify checkpointer state after Turn 2
  const stateA2 = await agentA.getState({ configurable: { thread_id: threadIdA } });
  console.log(`  State message count after Turn 2: ${stateA2.values.messages.length} messages`);
  if (stateA2.values.messages.length !== 4) {
    throw new Error(`Expected 4 messages in state after Turn 2, got ${stateA2.values.messages.length}`);
  }

  console.log("  Short-term conversation history retained for User A:");
  stateA2.values.messages.forEach((msg: any, i: number) => {
    console.log(`    [${i + 1}] ${msg._getType()}: "${typeof msg.content === "string" ? msg.content.slice(0, 70) : "content"}"`);
  });
  console.log("✅ Turn 1 context seamlessly retained into Turn 2 via short-term memory!");

  // =========================================================================
  // Test 3: Strict User Isolation (No Memory Contamination)
  // =========================================================================
  console.log("\n🔒 Test 3: Strict User Isolation (Verifying User B cannot see User A's memory)...");
  const threadIdB = agentMemoryService.getUserThreadId(userB);

  const fakeModelUserB = new FakeListChatModel({
    responses: [
      "I don't have any previous context about leads yet. How can I help you?",
    ],
  });

  const agentB = createWORKPILOTLangGraphAgent({
    userId: userB,
    systemPrompt: "You are the WORKPILOT AI agent.",
    llm: fakeModelUserB,
  });

  console.log("  User B asks: 'Who was the second person?' (testing if User A's data leaks)...");
  const turnBRes = await agentB.invoke(
    { messages: [new HumanMessage("Who was the second person?")] },
    { configurable: { thread_id: threadIdB } }
  );

  const turnBReply = turnBRes.messages.at(-1)?.content;
  console.log(`  Agent User B Reply: "${turnBReply}"`);

  const stateB = await agentB.getState({ configurable: { thread_id: threadIdB } });
  console.log(`  User B state messages count: ${stateB.values.messages.length}`);

  if (stateB.values.messages.length !== 2) {
    throw new Error(`Expected User B to have only 2 messages, got ${stateB.values.messages.length}`);
  }

  // Ensure User A's messages are NOT in User B's state
  const userBContents = stateB.values.messages.map((m: any) => m.content);
  if (userBContents.some((c: string) => c.includes("Charlotte Brown") || c.includes("Oliver Smith"))) {
    throw new Error("❌ CRITICAL: User A's data leaked into User B's short-term memory!");
  }
  console.log("✅ 100% User Isolation verified: User B's short-term memory has ZERO data from User A!");

  // =========================================================================
  // Test 4: In-Memory Message Log & UI Hydration
  // =========================================================================
  console.log("\n📋 Test 4: Verifying In-Memory Session History for UI Hydration...");
  agentMemoryService.recordMessage(userA, "user", "Find 3 AI engineers in London");
  agentMemoryService.recordMessage(userA, "assistant", "I found 3 AI engineers in London: Oliver, Charlotte, Liam");
  agentMemoryService.recordMessage(userB, "user", "Hello from User B");

  const historyA = await agentMemoryService.getHistory(userA);
  const historyB = await agentMemoryService.getHistory(userB);

  console.log(`  User A session history count: ${historyA.length}`);
  console.log(`  User B session history count: ${historyB.length}`);

  if (historyA.length !== 2) {
    throw new Error(`Expected 2 messages in User A history, got ${historyA.length}`);
  }
  if (historyB.length !== 1) {
    throw new Error(`Expected 1 message in User B history, got ${historyB.length}`);
  }
  console.log("✅ Session histories correctly separated per user!");

  // =========================================================================
  // Test 5: Resetting Short-Term Memory
  // =========================================================================
  console.log("\n🧹 Test 5: Resetting User A Short-Term Memory...");
  await agentMemoryService.clearHistory(userA);

  const historyAAfterClear = await agentMemoryService.getHistory(userA);
  const historyBAfterClear = await agentMemoryService.getHistory(userB);

  if (historyAAfterClear.length !== 0) {
    throw new Error("User A history was not cleared.");
  }
  if (historyBAfterClear.length !== 1) {
    throw new Error("User B history was improperly affected when User A cleared memory!");
  }

  // Check that User A gets a fresh checkpointer upon next request
  const newCheckpointerA = agentMemoryService.getUserCheckpointer(userA);
  if (newCheckpointerA === checkpointerA) {
    throw new Error("User A checkpointer should be a fresh instance after clearHistory.");
  }

  console.log("✅ User A short-term memory cleared cleanly, while User B's memory remained intact!");

  console.log("\n🎉 ALL SHORT-TERM MEMORY & USER ISOLATION TESTS PASSED PERFECTLY!\n");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
