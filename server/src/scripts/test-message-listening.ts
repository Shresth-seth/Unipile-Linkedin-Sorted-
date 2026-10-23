import "../config/dotenv.config.js";
import { unipileMessageAgentService } from "../services/webhook/unipile-message-agent.service.js";

async function runListeningVerification() {
  console.log("================================================================================");
  console.log("🧪 TESTING ACTIVE LISTENING, HUMAN TONE & COMPACTNESS");
  console.log("================================================================================");

  const mockContact = {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Sarah Chen",
    designation: "VP of Engineering",
    company: "Acme Data",
    matchReason: "Shared domain in data engineering",
  };

  const testCases = [
    {
      title: "Scenario 1: Specific Technical Question",
      message: "Hey! Saw your tool. Does it integrate with PostgreSQL directly or do we need Snowflake?",
    },
    {
      title: "Scenario 2: Milestone Compliment",
      message: "Hey! Just saw your team hit #1 on Product Hunt, congratulations on the launch!",
    },
    {
      title: "Scenario 3: Timing Pushback / Busy with Sprint",
      message: "Looks interesting, but we are totally slammed with our sprint this week. Maybe next month?",
    },
  ];

  for (const tc of testCases) {
    console.log(`\n--- ${tc.title} ---`);
    console.log(`📥 Incoming Message: "${tc.message}"`);

    // Call private analyzeMessageIntelligence method via any cast
    const analysis = await (unipileMessageAgentService as any).analyzeMessageIntelligence(
      "00000000-0000-0000-0000-000000000002",
      mockContact,
      tc.message,
    );

    console.log(`💡 Intent: ${analysis.intent}`);
    console.log(`🧠 Rationale: ${analysis.rationale}`);
    console.log(`💬 Generated Reply: "${analysis.suggestedReply}"`);

    // Verification checks
    const reply = analysis.suggestedReply;
    const sentences = reply.split(/[.!?]+/).filter(Boolean);
    const sentenceCount = sentences.length;

    console.log(`📏 Sentence Count: ${sentenceCount}`);

    // Check anti-AI rules
    const roboticOpeners = [
      /hope this (?:message|email) finds you well/i,
      /thank you for reaching out/i,
      /thanks for reaching out/i,
      /thanks for connecting/i,
      /i appreciate your message/i,
      /hope all is well/i,
    ];
    const aiBuzzwords = [
      /\bsynergy\b/i,
      /\bgame-changer\b/i,
      /\btransformative\b/i,
      /\bdelve\b/i,
      /\bstreamline\b/i,
      /\bleverage\b/i,
      /\bcutting-edge\b/i,
    ];

    const hasRoboticOpener = roboticOpeners.some((r) => r.test(reply));
    const hasAiBuzzwords = aiBuzzwords.some((r) => r.test(reply));
    const isCompact = sentenceCount <= 3 && reply.length < 280;

    console.log(`✅ Robotic Opener Avoided: ${!hasRoboticOpener}`);
    console.log(`✅ AI Buzzwords Avoided: ${!hasAiBuzzwords}`);
    console.log(`✅ Compact Length (<3 sentences, <280 chars): ${isCompact}`);
  }

  console.log("\n================================================================================");
  console.log("🏁 VERIFICATION COMPLETED");
  console.log("================================================================================");
  process.exit(0);
}

runListeningVerification();
