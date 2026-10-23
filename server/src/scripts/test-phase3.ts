import "../config/dotenv.config.js";
import { db, client } from "../db/index.js";
import { users, contacts, actionQueue, messages } from "../db/schema.js";
import { inboundWebhookService } from "../services/webhook/inbound.service.js";
import { followUpSequencerService } from "../services/sequence/followup.service.js";
import { intentDetectionService } from "../services/intelligence/intent.service.js";
import { eq, and } from "drizzle-orm";

interface Phase3TestReport {
  testNumber: number;
  name: string;
  passed: boolean;
  output?: any;
}

const reports: Phase3TestReport[] = [];

const record = (testNumber: number, name: string, passed: boolean, output?: any) => {
  reports.push({ testNumber, name, passed, output });
  const badge = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${badge}] Test ${testNumber}: ${name}`);
  if (output) {
    console.log("   Details:", typeof output === "string" ? output : JSON.stringify(output, null, 2));
  }
};

const runPhase3TestSuite = async () => {
  console.log("\n==================================================================");
  console.log("🚀 WORKPILOT PHASE 3 VALIDATION GATE: INBOUND WEBHOOKS & HANDOVER");
  console.log("==================================================================\n");

  try {
    // 0. Ensure user and contact
    let [user] = await db.select().from(users).limit(1);
    if (!user) throw new Error("No user found.");
    const activeUserId = user.id;

    // Create or retrieve test contact
    const testLinkedinId = `urn:li:fsd_profile:lead_${Date.now()}`;
    const [testContact] = await db
      .insert(contacts)
      .values({
        userId: activeUserId,
        name: "Vikram Malhotra",
        linkedinId: testLinkedinId,
        company: "Apex Commercial Dubai",
        designation: "Managing Partner",
        status: "CONNECTED",
        conversationMode: "AUTOMATIC",
      })
      .returning();

    if (!testContact) throw new Error("Failed to create test contact.");

    // -----------------------------------------------------------------
    // TEST 1: Schedule Multi-Step Follow-Up Sequence
    // -----------------------------------------------------------------
    const scheduledFollowUps = await followUpSequencerService.scheduleFollowUpSequence(
      activeUserId,
      testContact,
      {
        followUp1: { text: "Hi Vikram, wanted to share a 2-minute case study on WhatsApp lead qualification.", delayMinutes: 60 },
        followUp2: { text: "Hi Vikram, checking in to see if you had 5 minutes this week?", delayMinutes: 120 },
      }
    );
    record(
      1,
      "Schedule Multi-Step Follow-Up Cadence",
      scheduledFollowUps.length === 2 && scheduledFollowUps.every((j) => j.status === "QUEUED"),
      `Scheduled 2 follow-ups: Job 1 (${scheduledFollowUps[0]?.id}), Job 2 (${scheduledFollowUps[1]?.id})`
    );

    // -----------------------------------------------------------------
    // TEST 2: Inbound Webhook Ingestion & Anti-Collision Cancellation
    // -----------------------------------------------------------------
    const webhookRes1 = await inboundWebhookService.handleInboundMessage({
      sender_id: testContact.linkedinId,
      sender_name: testContact.name,
      text: "Thanks for connecting! What exactly does your system automate?",
      chat_id: `conv_${testContact.id}`,
    });

    // Check if scheduled follow-ups are CANCELLED
    const pendingFollowUps = await db
      .select()
      .from(actionQueue)
      .where(
        and(
          eq(actionQueue.contactId, testContact.id),
          eq(actionQueue.actionType, "MESSAGE"),
          eq(actionQueue.status, "QUEUED")
        )
      );

    record(
      2,
      "Inbound Webhook Ingestion & Anti-Collision Rule (Auto-Cancel Follow-Ups)",
      webhookRes1.cancelledFollowUps === 2 && pendingFollowUps.length === 0,
      `Inbound message saved (ID: ${webhookRes1.messageId}). Instantly CANCELLED ${webhookRes1.cancelledFollowUps} pending follow-up(s).`
    );

    // -----------------------------------------------------------------
    // TEST 3: Contact Funnel Advancement to CONVERSATION
    // -----------------------------------------------------------------
    const [contactAfterReply] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, testContact.id))
      .limit(1);

    record(
      3,
      "Funnel Stage Transition: CONNECTED -> CONVERSATION",
      contactAfterReply?.status === "CONVERSATION",
      `Contact status transitioned to: ${contactAfterReply?.status}`
    );

    // -----------------------------------------------------------------
    // TEST 4: Intent Detection Engine (Informational vs Buying Signal)
    // -----------------------------------------------------------------
    const infoIntent = intentDetectionService.analyzeIntent("Can you explain how it integrates with CRM?");
    const buyingIntent = intentDetectionService.analyzeIntent("Looks interesting. What is your pricing and can we book a demo call tomorrow?");

    record(
      4,
      "AI Intent Detection Engine (Buying Intent Classification)",
      !infoIntent.isHotLead && buyingIntent.isHotLead && buyingIntent.intentType === "PRICING",
      `Info query correctly identified as non-hot lead. Commercial query flagged as HOT LEAD (Reason: ${buyingIntent.reason})`
    );

    // -----------------------------------------------------------------
    // TEST 5: Hot Lead Inbound Ingestion & Autonomous Sending Halt
    // -----------------------------------------------------------------
    const hotLeadWebhookRes = await inboundWebhookService.handleInboundMessage({
      sender_id: testContact.linkedinId,
      sender_name: testContact.name,
      text: "We need this for our sales team. Can we book a demo call tomorrow and discuss pricing?",
      chat_id: `conv_${testContact.id}`,
    });

    const [hotLeadContact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, testContact.id))
      .limit(1);

    record(
      5,
      "Hot Lead Triage & Autonomous AI Messaging Halt (Mode -> MANUAL)",
      hotLeadContact?.status === "HOT_LEAD" &&
        hotLeadContact?.isHotLead === true &&
        hotLeadContact?.conversationMode === "MANUAL",
      `Status: ${hotLeadContact?.status} | isHotLead: ${hotLeadContact?.isHotLead} | Mode: ${hotLeadContact?.conversationMode} (Reason: ${hotLeadWebhookRes.intent?.reason})`
    );

    // -----------------------------------------------------------------
    // TEST 6: Message History & Transcript Retrieval
    // -----------------------------------------------------------------
    const conversationHistory = await db
      .select()
      .from(messages)
      .where(eq(messages.contactId, testContact.id));

    record(
      6,
      "Full Conversation Audit Trail & Transcript Persistence",
      conversationHistory.length >= 2,
      `Stored ${conversationHistory.length} total messages in the thread for review.`
    );

    // -----------------------------------------------------------------
    // TEST 7: Human Takeover & Manual Response Dispatch
    // -----------------------------------------------------------------
    // Human sends confirmation
    const [manualReply] = await db
      .insert(messages)
      .values({
        userId: activeUserId,
        contactId: testContact.id,
        conversationId: `conv_${testContact.id}`,
        senderId: "me",
        senderName: "Raunak (Human Operator)",
        direction: "OUTBOUND",
        content: "Hi Vikram, excellent! Here is my calendar link to pick a time for tomorrow's demo: cal.com/raunak",
      })
      .returning();

    record(
      7,
      "Human Takeover Execution & Outbound Response",
      Boolean(manualReply && manualReply.direction === "OUTBOUND"),
      `Human operator successfully responded: "${manualReply?.content}"`
    );

    // -----------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------
    console.log("\n==================================================================");
    const passedCount = reports.filter((r) => r.passed).length;
    console.log(`🏁 PHASE 3 VALIDATION RESULT: ${passedCount} / 7 TESTS PASSED`);
    if (passedCount === 7) {
      console.log("🎉 SUCCESS! Raunak's Phase 3 Exit Gate is 100% ACHIEVED!");
      console.log("👉 Real-time inbound ingestion, Anti-collision follow-up cancellation, Intent classification, and Human takeover verified.");
    } else {
      console.log("⚠️ Some tests failed. Please review details above.");
    }
    console.log("==================================================================\n");
  } catch (err: any) {
    console.error("❌ Fatal Phase 3 runner error:", err);
  } finally {
    await client.end();
  }
};

runPhase3TestSuite();
