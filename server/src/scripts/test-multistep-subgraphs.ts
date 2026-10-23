import "../config/dotenv.config.js";
import {
  WORKPILOTStore,
  createBatchOutreachSubgraph,
  registerThreadExecution,
  cancelThreadExecution,
  isThreadCancelled,
} from "../agent/WORKPILOT-subgraphs.js";
import { WORKPILOTConnectTools } from "../tools/tools.js";

async function runTests() {
  console.log(
    "🧪 Starting Multi-Step Subgraphs, Stores, HIL, & Stop Control Verification...\n",
  );

  // =========================================================================
  // Test 1: LangGraph InMemoryStore Verification
  // =========================================================================
  console.log("📦 Test 1: LangGraph InMemoryStore Key-Value Storage...");
  const testNamespace = ["test_users", "user_123", "leads"];
  await WORKPILOTStore.put(testNamespace, "lead_1", {
    name: "Aarav Sharma",
    role: "Senior AI Engineer",
    company: "NeuralTech",
  });
  await WORKPILOTStore.put(testNamespace, "lead_2", {
    name: "Priya Patel",
    role: "Staff LLM Researcher",
    company: "DeepVision",
  });

  const lead1 = await WORKPILOTStore.get(testNamespace, "lead_1");
  const lead2 = await WORKPILOTStore.get(testNamespace, "lead_2");

  if (!lead1?.value || lead1.value.name !== "Aarav Sharma") {
    throw new Error("Failed to retrieve lead_1 from LangGraph store.");
  }
  if (!lead2?.value || lead2.value.name !== "Priya Patel") {
    throw new Error("Failed to retrieve lead_2 from LangGraph store.");
  }
  console.log("✅ InMemoryStore successfully stored and retrieved lead data!");

  // =========================================================================
  // Test 2: Multi-Step Batch Outreach Subgraph (5 candidates: 2 with note, 3 blank)
  // =========================================================================
  console.log(
    "\n🚀 Test 2: Batch Outreach Subgraph Execution (5 Candidates: 2 with Note, 3 Blank)...",
  );
  const mockCandidates = [
    {
      name: "Aditya Verma",
      headline: "Lead AI Scientist",
      linkedinId: "ACoAA1",
    },
    {
      name: "Sneha Reddy",
      headline: "Principal ML Engineer",
      linkedinId: "ACoAA2",
    },
    {
      name: "Rohan Gupta",
      headline: "Full Stack Engineer",
      linkedinId: "ACoAA3",
    },
    {
      name: "Ananya Iyer",
      headline: "VP of Engineering",
      linkedinId: "ACoAA4",
    },
    {
      name: "Vikram Malhotra",
      headline: "Founder & CTO",
      linkedinId: "ACoAA5",
    },
  ];

  const batchSubgraph = createBatchOutreachSubgraph();
  const threadId = `test_thread_${Date.now()}`;

  const result = await batchSubgraph.invoke(
    {
      candidates: mockCandidates,
      withNoteCount: 2,
      withoutNoteCount: 3,
      noteTemplate:
        "Hi {firstName}, loved your work as {headline}! Let's connect.",
      userId: "test_user_id",
      threadId,
      skipHIL: true, // test automated dispatch loop
    },
    { configurable: { thread_id: threadId } },
  );

  console.log("Batch Subgraph Queue Length:", result.queue?.length);
  console.log(
    "Queue Allocation:",
    result.queue.map((q: any, i: number) => ({
      index: i + 1,
      name: q.candidate.name,
      withNote: q.withNote,
      note: q.note ? q.note.slice(0, 35) + "..." : "[Blank / No Note]",
    })),
  );

  if (result.queue.length !== 5) {
    throw new Error(
      `Expected 5 candidates in queue, got ${result.queue.length}`,
    );
  }

  const withNoteItems = result.queue.filter((q: any) => q.withNote);
  const withoutNoteItems = result.queue.filter((q: any) => !q.withNote);

  if (withNoteItems.length !== 2) {
    throw new Error(
      `Expected exactly 2 withNote items, got ${withNoteItems.length}`,
    );
  }
  if (withoutNoteItems.length !== 3) {
    throw new Error(
      `Expected exactly 3 withoutNote items, got ${withoutNoteItems.length}`,
    );
  }

  console.log("Generated Summary Table Preview:\n" + result.summary);
  console.log(
    "✅ Batch Outreach Subgraph properly orchestrated all 5 candidates with 2 personalized and 3 blank!",
  );

  // =========================================================================
  // Test 3: Stop / Cancellation Mechanism
  // =========================================================================
  console.log(
    "\n🛑 Test 3: Stop / Interrupt Backend Cancellation Mechanism...",
  );
  const stopThreadId = `stop_thread_${Date.now()}`;
  const { abortController } = registerThreadExecution(stopThreadId);

  if (isThreadCancelled(stopThreadId)) {
    throw new Error("Thread should not be cancelled initially.");
  }

  const stopped = cancelThreadExecution(stopThreadId);
  if (!stopped) {
    throw new Error("cancelThreadExecution returned false.");
  }
  if (!isThreadCancelled(stopThreadId)) {
    throw new Error(
      "isThreadCancelled should return true after cancelThreadExecution.",
    );
  }
  if (!abortController.signal.aborted) {
    throw new Error("AbortController signal should be aborted.");
  }
  console.log("✅ Thread cancellation and AbortSignal stop control verified!");

  // =========================================================================
  // Test 4: Tool Declarations and Exports
  // =========================================================================
  console.log("\n🔧 Test 4: Tool System Declarations & Router Registration...");
  const toolNames = WORKPILOTConnectTools.map((t) => t.name);
  console.log(`Registered Tools (${toolNames.length}):`, toolNames);

  if (!toolNames.includes("batch_send_connection_requests")) {
    throw new Error(
      "batch_send_connection_requests missing from WORKPILOTConnectTools.",
    );
  }
  if (!toolNames.includes("research_and_batch_connect")) {
    throw new Error(
      "research_and_batch_connect missing from WORKPILOTConnectTools.",
    );
  }

  console.log("✅ All new tools verified in router and agent toolkit!");
  console.log(
    "\n🎉 ALL MULTI-STEP LANGGRAPH & STOP CONTROL TESTS PASSED SUCCESSFULLY!\n",
  );
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
