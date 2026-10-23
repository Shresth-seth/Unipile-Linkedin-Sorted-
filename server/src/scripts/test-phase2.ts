import "../config/dotenv.config.js";
import { db, client } from "../db/index.js";
import { users, linkedinAccounts, contacts, actionQueue } from "../db/schema.js";
import { prospectService } from "../services/prospects/prospect.service.js";
import { actionQueueService } from "../services/queue/queue.service.js";
import { accountSafetyService } from "../services/safety/safety.service.js";
import { eq } from "drizzle-orm";

interface Phase2TestReport {
  testNumber: number;
  name: string;
  passed: boolean;
  output?: any;
}

const reports: Phase2TestReport[] = [];

const record = (testNumber: number, name: string, passed: boolean, output?: any) => {
  reports.push({ testNumber, name, passed, output });
  const badge = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${badge}] Test ${testNumber}: ${name}`);
  if (output) {
    console.log("   Details:", typeof output === "string" ? output : JSON.stringify(output, null, 2));
  }
};

const runPhase2TestSuite = async () => {
  console.log("\n==================================================================");
  console.log("🚀 WORKPILOT PHASE 2 VALIDATION GATE: OUTBOUND QUEUE & PROSPECTING");
  console.log("==================================================================\n");

  try {
    // 0. Ensure an active user and connected account exist
    let [user] = await db.select().from(users).limit(1);
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          name: "Raunak Sharma",
          email: `raunak_p2_${Date.now()}@workpilot.io`,
          password: "hashedPassword123",
        })
        .returning();
    }
    if (!user) throw new Error("Failed to ensure user.");
    const activeUserId = user.id;

    // Ensure LinkedIn account is setup and HEALTHY
    let [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, activeUserId))
      .limit(1);

    if (!account) {
      [account] = await db
        .insert(linkedinAccounts)
        .values({
          userId: activeUserId,
          unipileAccountId: "acc_p2_mock_123",
          linkedinName: "Raunak Sharma",
          isConnected: true,
          healthStatus: "HEALTHY",
          automationStatus: "RUNNING",
          dailyConnectionsLimit: 25,
          dailyMessagesLimit: 50,
        })
        .returning();
    } else {
      await db
        .update(linkedinAccounts)
        .set({
          isConnected: true,
          healthStatus: "HEALTHY",
          automationStatus: "RUNNING",
        })
        .where(eq(linkedinAccounts.id, account.id));
    }
    if (!account) throw new Error("Failed to ensure account.");
    const activeAccountId = account.id;

    // -----------------------------------------------------------------
    // TEST 1: Prospect Discovery & Contact Table Ingestion
    // -----------------------------------------------------------------
    const ingestedResult = await prospectService.discoverAndIngest(activeUserId, {
      role: "Sales Director",
      location: "Dubai",
      industry: "Real Estate",
    }, false);
    const ingestedContacts = ingestedResult.contacts;
    const testLead = ingestedContacts[0];
    record(
      1,
      "Discover & Ingest Prospects into Contacts Table",
      ingestedContacts.length > 0 && Boolean(testLead),
      `Ingested ${ingestedContacts.length} prospects. Primary Lead: ${testLead?.name} (${testLead?.designation})`
    );

    // -----------------------------------------------------------------
    // TEST 2: Ingestion Deduplication (No duplicate rows)
    // -----------------------------------------------------------------
    const reIngestedResult = await prospectService.discoverAndIngest(activeUserId, {
      role: "Sales Director",
      location: "Dubai",
    }, false);
    record(
      2,
      "Prospect Deduplication Guard",
      reIngestedResult.contacts.length === ingestedContacts.length,
      "Re-ingesting existing candidates returned existing records without duplicates."
    );

    // Reset lead and queue state for clean isolated test run
    await db.delete(actionQueue).where(eq(actionQueue.userId, activeUserId));
    await db
      .update(contacts)
      .set({ status: "NEW", connectionSentAt: null, connectedAt: null })
      .where(eq(contacts.id, testLead!.id));

    // -----------------------------------------------------------------
    // TEST 3: Enqueue Outbound Connection with Anti-Burst Spacing
    // -----------------------------------------------------------------
    const queuedJob = await prospectService.queueConnectionRequest(
      activeUserId,
      testLead!.id,
      "Hi Rahul, noticed you lead sales at XYZ Realty. Let's connect!",
      0 // 0 delay for instant processing test
    );
    record(
      3,
      "Enqueue Outbound Connection with Human Spacing",
      Boolean(queuedJob && queuedJob.status === "QUEUED"),
      `Job enqueued: ${queuedJob.id} scheduled for ${queuedJob.scheduledFor.toISOString()}`
    );

    // -----------------------------------------------------------------
    // TEST 4: Pre-Flight Safety Verification (All 8 Checks Pass)
    // -----------------------------------------------------------------
    const preFlightCheck = await accountSafetyService.verifyPreFlight(
      activeUserId,
      "CONNECT",
      testLead!.id
    );
    record(
      4,
      "8-Point Pre-Flight Verification Engine",
      preFlightCheck.allowed,
      preFlightCheck.allowed ? "All 8 pre-flight safety checks PASSED." : preFlightCheck.reason
    );

    // -----------------------------------------------------------------
    // TEST 5: Queue Dispatch Worker Execution
    // -----------------------------------------------------------------
    const dispatchResult = await actionQueueService.processDueActions(activeUserId);
    const [updatedContact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, testLead!.id))
      .limit(1);

    record(
      5,
      "Queue Dispatch Worker & Funnel Advancement",
      dispatchResult.processed > 0 && updatedContact?.status === "CONTACTED",
      `Dispatched ${dispatchResult.processed} action. Contact stage advanced to: ${updatedContact?.status}`
    );

    // -----------------------------------------------------------------
    // TEST 6: Deduplication Check: Prevent Resending Invite
    // -----------------------------------------------------------------
    const duplicateSafety = await accountSafetyService.verifyPreFlight(
      activeUserId,
      "CONNECT",
      testLead!.id
    );
    record(
      6,
      "Anti-Spam Deduplication Guard (Prevent Re-invite)",
      Boolean(!duplicateSafety.allowed && duplicateSafety.reason?.includes("already sent")),
      duplicateSafety.reason
    );

    // -----------------------------------------------------------------
    // TEST 7: Circuit Breaker Auto-Pause on Error / Degradation
    // -----------------------------------------------------------------
    await accountSafetyService.triggerCircuitBreaker(activeAccountId, "LinkedIn challenge detected");
    const pausedCheck = await accountSafetyService.verifyPreFlight(activeUserId, "CONNECT");
    record(
      7,
      "Circuit Breaker Auto-Pause Safety Verification",
      Boolean(!pausedCheck.allowed && pausedCheck.reason?.includes("PAUSED")),
      pausedCheck.reason
    );

    // Resume for subsequent tests
    await accountSafetyService.resumeAutomation(activeUserId);

    // -----------------------------------------------------------------
    // TEST 8: Connection Accepted Event & First Message Auto-Enqueue
    // -----------------------------------------------------------------
    const acceptanceResult = await prospectService.handleConnectionAccepted(
      activeUserId,
      testLead!.linkedinId,
      "Hi Rahul, thanks for connecting! Here is how our AI handles lead qualification."
    );
    record(
      8,
      "Connection Accepted Webhook & Follow-Up Message Enqueue",
      acceptanceResult.contact.status === "CONNECTED" && Boolean(acceptanceResult.nextActionQueued),
      `Contact status updated to: ${acceptanceResult.contact.status}. Next Welcome Message queued: ${acceptanceResult.nextActionQueued?.id}`
    );

    // -----------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------
    console.log("\n==================================================================");
    const passedCount = reports.filter((r) => r.passed).length;
    console.log(`🏁 PHASE 2 VALIDATION RESULT: ${passedCount} / 8 TESTS PASSED`);
    if (passedCount === 8) {
      console.log("🎉 SUCCESS! Raunak's Phase 2 Exit Gate is 100% ACHIEVED!");
      console.log("👉 Outbound pipeline, Anti-burst queue, Pre-flight safety, and Handover workflows verified.");
    } else {
      console.log("⚠️ Some tests failed. Please check output details above.");
    }
    console.log("==================================================================\n");
  } catch (err: any) {
    console.error("❌ Fatal runner error:", err);
  } finally {
    await client.end();
  }
};

runPhase2TestSuite();
