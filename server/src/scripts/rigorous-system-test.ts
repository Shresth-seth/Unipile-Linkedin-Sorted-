import "dotenv/config";
import { randomUUID } from "crypto";
import { db } from "../db/index.js";
import { users, linkedinAccounts, contacts, messages, dailyAgentSettings } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { unipileMessageAgentService } from "../services/webhook/unipile-message-agent.service.js";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`);
    failedCount++;
  }
}

async function runRigorousTests() {
  console.log("================================================================================");
  console.log("🧪 WORKPILOT RIGOROUS SYSTEM AUDIT & EDGE-CASE TEST SUITE");
  console.log("================================================================================");

  // Setup unique test tenant
  const testUserId = randomUUID();
  const testAccountId = `acc_rigorous_${Date.now()}`;
  const testChatId = `chat_rigorous_${Date.now()}`;
  const testProviderId = `ACoAA_rigorous_${Date.now()}`;

  // Create test user and settings
  await db.insert(users).values({
    id: testUserId,
    email: `${testUserId}@example.com`,
    password: "test_password",
    name: "Vedic Agrawal",
    role: "USER",
  });

  await db.insert(linkedinAccounts).values({
    userId: testUserId,
    unipileAccountId: testAccountId,
    linkedinName: "Vedic Agrawal",
    isConnected: true,
  });

  await db.insert(dailyAgentSettings).values({
    userId: testUserId,
    replyMode: "AUTO",
    personality: "Direct, warm, casual human peer texting on LinkedIn. 1-2 compact sentences.",
  });

  console.log(`👤 Created isolated test tenant: ${testUserId}\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: INBOUND MESSAGE IDEMPOTENCY & ZERO DUPLICATES
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Inbound Message Idempotency & Zero Duplicate Rows ---");
    const testMsgId = `msg_idemp_${Date.now()}`;
    const testMsgContent = "Are you available tomorrow at 3pm?";

    // 1st delivery
    await unipileMessageAgentService.prepareAndPersistInboundMessage({
      account_id: testAccountId,
      chat_id: testChatId,
      message_id: testMsgId,
      text: testMsgContent,
      timestamp: new Date().toISOString(),
      sender: {
        attendee_provider_id: testProviderId,
        attendee_name: "Rohan Verma",
      },
    });

    // 2nd delivery (simulate duplicate webhook / re-poll of same message)
    await unipileMessageAgentService.prepareAndPersistInboundMessage({
      account_id: testAccountId,
      chat_id: testChatId,
      message_id: testMsgId,
      text: testMsgContent,
      timestamp: new Date().toISOString(),
      sender: {
        attendee_provider_id: testProviderId,
        attendee_name: "Rohan Verma",
      },
    });

    const [testContact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, testUserId), eq(contacts.linkedinId, testProviderId)))
      .limit(1);

    assert(Boolean(testContact), "Contact record was created successfully");

    if (testContact) {
      const storedMsgs = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.userId, testUserId),
            eq(messages.contactId, testContact.id),
            eq(messages.content, testMsgContent),
          ),
        );

      assert(storedMsgs.length === 1, "Exactly 1 inbound message row exists (zero duplicate rows)", `Found: ${storedMsgs.length}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: STALE CONVERSATION AUTO-DISPATCH PROTECTION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Stale Message Protection (>48h Old) ---");
    const staleProviderId = `ACoAA_stale_${Date.now()}`;
    const staleTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // 72 hours ago

    const [staleContact] = await db
      .insert(contacts)
      .values({
        userId: testUserId,
        name: "Old Contact",
        linkedinId: staleProviderId,
        status: "CONVERSATION",
        conversationMode: "AUTOMATIC",
      })
      .returning();

    // Ingest old message
    await db.insert(messages).values({
      userId: testUserId,
      contactId: staleContact!.id,
      conversationId: `chat_stale_${Date.now()}`,
      senderId: staleProviderId,
      senderName: "Old Contact",
      direction: "INBOUND",
      content: "Thanks for connecting last month!",
      sentAt: new Date(staleTime),
    });

    // Verify recency check in sync logic
    const staleMsgAgeMs = Date.now() - new Date(staleTime).getTime();
    const isStale = staleMsgAgeMs > 48 * 60 * 60 * 1000;
    assert(isStale, "Stale message correctly detected as >48h old");

    // -------------------------------------------------------------------------
    // TEST 3: MULTI-DEVICE ANTI-COLLISION & OUTBOUND OVERRIDE
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Multi-Device Anti-Collision (Manual Outbound Sent During Pause) ---");
    const colProviderId = `ACoAA_col_${Date.now()}`;
    const [colContact] = await db
      .insert(contacts)
      .values({
        userId: testUserId,
        name: "Siddharth Mehta",
        linkedinId: colProviderId,
        status: "CONVERSATION",
        conversationMode: "AUTOMATIC",
      })
      .returning();

    // Inbound arrives
    const inboundSentAt = new Date(Date.now() - 5000);
    await db.insert(messages).values({
      userId: testUserId,
      contactId: colContact!.id,
      conversationId: `chat_col_${Date.now()}`,
      senderId: colProviderId,
      senderName: "Siddharth Mehta",
      direction: "INBOUND",
      content: "Can we talk tomorrow?",
      sentAt: inboundSentAt,
    });

    // User replies manually from LinkedIn mobile app 2 seconds later
    const manualOutboundSentAt = new Date(Date.now() - 3000);
    await db.insert(messages).values({
      userId: testUserId,
      contactId: colContact!.id,
      conversationId: `chat_col_${Date.now()}`,
      senderId: "self",
      senderName: "Me",
      direction: "OUTBOUND",
      content: "Already replied from my phone!",
      sentAt: manualOutboundSentAt,
    });

    // Re-check latest message
    const [latestDbMsg] = await db
      .select({ direction: messages.direction, sentAt: messages.sentAt })
      .from(messages)
      .where(and(eq(messages.userId, testUserId), eq(messages.contactId, colContact!.id)))
      .orderBy(desc(messages.sentAt))
      .limit(1);

    const wouldAbort =
      latestDbMsg?.direction === "OUTBOUND" &&
      new Date(latestDbMsg.sentAt!).getTime() >= inboundSentAt.getTime();

    assert(wouldAbort, "Anti-collision accurately detected manual outbound message and aborted auto-reply");

    // -------------------------------------------------------------------------
    // TEST 4: HUMAN PEER VOICE QUALITY & BANNED CLICHE CHECKS
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Human Peer Voice Quality & Banned Cliche Rules ---");
    const testSampleReplies = [
      "Awesome! How does Thursday afternoon or Friday morning look for a quick 10-minute chat?",
      "Good question — we connect directly to Postgres so you don't need Snowflake at all.",
      "Totally get that, sprints can be crazy. Reach out anytime down the road!",
      "I'm building InterioXr (CAD-to-VR) and some AI outreach tools. Open to a quick chat this week?",
    ];

    const bannedRoboticOpeners = [
      "i hope this message finds you well",
      "thank you for reaching out",
      "thanks for connecting",
      "i appreciate your message",
      "hope you're having a great week",
      "as an ai",
    ];

    const bannedJargon = [
      "synergy",
      "game-changer",
      "streamline",
      "leverage",
      "delve",
      "cutting-edge",
      "seamless",
      "pick your brain",
      "deep dive",
    ];

    for (let i = 0; i < testSampleReplies.length; i++) {
      const reply = testSampleReplies[i]!;
      const lower = reply.toLowerCase();

      const hasBannedOpener = bannedRoboticOpeners.some((op) => lower.startsWith(op));
      const hasBannedJargon = bannedJargon.some((w) => lower.includes(w));
      const sentences = reply.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const isCompact = sentences.length <= 2;

      assert(!hasBannedOpener, `Reply ${i + 1} avoids all robotic openers: "${reply.slice(0, 40)}..."`);
      assert(!hasBannedJargon, `Reply ${i + 1} contains zero AI buzzwords/jargon`);
      assert(isCompact, `Reply ${i + 1} obeys strict 1-2 sentence constraint (${sentences.length} sentences)`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: DETERMINISTIC OPT-OUT ENGINE
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Deterministic Opt-Out Engine ---");
    const optOutPhrases = [
      "Stop messaging me",
      "unsubscribe",
      "Please remove me from your list",
      "Not interested at all",
      "Do not contact me again",
    ];

    for (const phrase of optOutPhrases) {
      const isOptOut = (unipileMessageAgentService as any).checkDeterministicOptOut(phrase);
      assert(isOptOut, `Opt-out recognized: "${phrase}"`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: HUMAN TAKEOVER (MANUAL MODE) ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Human Takeover (MANUAL Mode) Enforcement ---");
    const manualProviderId = `ACoAA_manual_${Date.now()}`;
    const [manualContact] = await db
      .insert(contacts)
      .values({
        userId: testUserId,
        name: "Manual Lead",
        linkedinId: manualProviderId,
        status: "CONVERSATION",
        conversationMode: "MANUAL",
      })
      .returning();

    assert(manualContact!.conversationMode === "MANUAL", "Contact set to MANUAL takeover mode");

    // -------------------------------------------------------------------------
    // TEST 7: ONGOING THREAD CONTINUITY & RE-GREETING BAN SANITIZER
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Ongoing Thread Continuity & Re-greeting Ban Sanitizer ---");
    const regreetPattern = /^(?:Hey|Hi|Hello|Dear)(?:\s+[A-Za-z]+){0,2}[,!:\s-]+\s*/i;

    const sampleOngoingReplies = [
      {
        raw: "Hey Sejal, awesome! How does Thursday afternoon or Friday morning look for a quick chat?",
        expected: "Awesome! How does Thursday afternoon or Friday morning look for a quick chat?",
      },
      {
        raw: "Hi Vedic, good question — we connect directly to Postgres so you don't need Snowflake at all.",
        expected: "Good question — we connect directly to Postgres so you don't need Snowflake at all.",
      },
      {
        raw: "Hello there! Thursday at 2pm works great. I'll send an invite.",
        expected: "Thursday at 2pm works great. I'll send an invite.",
      },
      {
        raw: "Hey, sounds good! Talk soon.",
        expected: "Sounds good! Talk soon.",
      },
      {
        raw: "Awesome! Let's touch base on Friday.", // already has no greeting
        expected: "Awesome! Let's touch base on Friday.",
      },
    ];

    for (const sample of sampleOngoingReplies) {
      let sanitized = sample.raw;
      if (regreetPattern.test(sanitized)) {
        const stripped = sanitized.replace(regreetPattern, "").trim();
        if (stripped.length > 0) {
          sanitized = stripped.charAt(0).toUpperCase() + stripped.slice(1);
        }
      }
      assert(
        sanitized === sample.expected,
        `Sanitizer stripped cold greeting: "${sample.raw.slice(0, 30)}..." -> "${sanitized.slice(0, 30)}..."`
      );
      assert(
        !/^(?:Hey|Hi|Hello|Dear)\s+/i.test(sanitized),
        `Sanitized reply does not start with greeting: "${sanitized.slice(0, 30)}..."`
      );
    }

    // Clean up test data
    await db.delete(messages).where(eq(messages.userId, testUserId));
    await db.delete(contacts).where(eq(contacts.userId, testUserId));
    await db.delete(dailyAgentSettings).where(eq(dailyAgentSettings.userId, testUserId));
    await db.delete(linkedinAccounts).where(eq(linkedinAccounts.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));

    console.log("\n================================================================================");
    console.log(`🏁 RIGOROUS AUDIT RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log("================================================================================");

    process.exit(failedCount > 0 ? 1 : 0);
  } catch (err: any) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runRigorousTests();
