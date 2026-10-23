import "../config/dotenv.config.js";
import { db, client } from "../db/index.js";
import { users, contacts, linkedinAccounts } from "../db/schema.js";
import { crmService } from "../services/crm/crm.service.js";
import { accountSafetyService } from "../services/safety/safety.service.js";
import { dashboardController } from "../controllers/dashboard.controller.js";
import { eq } from "drizzle-orm";

interface Phase5TestReport {
  testNumber: number;
  name: string;
  passed: boolean;
  output?: any;
}

const reports: Phase5TestReport[] = [];

const record = (testNumber: number, name: string, passed: boolean, output?: any) => {
  reports.push({ testNumber, name, passed, output });
  const badge = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${badge}] Test ${testNumber}: ${name}`);
  if (output) {
    console.log("   Details:", typeof output === "string" ? output : JSON.stringify(output, null, 2));
  }
};

const runPhase5TestSuite = async () => {
  console.log("\n==================================================================");
  console.log("🚀 WORKPILOT PHASE 5 VALIDATION: CRM, HEALTH & PRODUCTION SUITE");
  console.log("==================================================================\n");

  try {
    // 0. Setup User and clean test environment
    const [user] = await db.select().from(users).limit(1);
    if (!user) throw new Error("No user found in database. Run test:auth first.");
    const activeUserId = user.id;

    // Ensure user has a LinkedIn account configured
    let [account] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, activeUserId))
      .limit(1);

    if (!account) {
      const [newAccount] = await db
        .insert(linkedinAccounts)
        .values({
          userId: activeUserId,
          unipileAccountId: `acc_${Date.now()}`,
          linkedinName: "Test Founder",
          isConnected: true,
          healthStatus: "HEALTHY",
          automationStatus: "RUNNING",
          dailyConnectionsLimit: 25,
          dailyMessagesLimit: 50,
        })
        .returning();
      account = newAccount!;
    } else {
      // Reset to HEALTHY and RUNNING
      await db
        .update(linkedinAccounts)
        .set({
          isConnected: true,
          healthStatus: "HEALTHY",
          automationStatus: "RUNNING",
          dailyConnectionsLimit: 25,
          dailyMessagesLimit: 50,
        })
        .where(eq(linkedinAccounts.id, account.id));
    }

    // -----------------------------------------------------------------
    // TEST 1: Infrastructure Health Probes (Liveness & Readiness)
    // -----------------------------------------------------------------
    let livenessResponse: any = null;
    let readinessResponse: any = null;

    const mockRes1: any = {
      status: (code: number) => ({
        json: (data: any) => {
          livenessResponse = { code, ...data };
        },
      }),
    };
    dashboardController.liveness({} as any, mockRes1);

    const mockRes2: any = {
      status: (code: number) => ({
        json: (data: any) => {
          readinessResponse = { code, ...data };
        },
      }),
    };
    await dashboardController.readiness({} as any, mockRes2);

    const probesOk =
      livenessResponse?.status === "ok" &&
      readinessResponse?.status === "ready" &&
      readinessResponse?.database === "connected";

    record(1, "Infrastructure Health Probes (Liveness & Database Readiness)", probesOk, {
      liveness: livenessResponse,
      readiness: readinessResponse,
    });

    // -----------------------------------------------------------------
    // TEST 2: Account Health Diagnostic State Machine & Daily Quotas
    // -----------------------------------------------------------------
    const healthSummary = await accountSafetyService.getAccountHealth(activeUserId);
    const healthOk =
      healthSummary.hasAccount &&
      healthSummary.isConnected &&
      healthSummary.healthStatus === "HEALTHY" &&
      healthSummary.automationStatus === "RUNNING" &&
      healthSummary.dailyLimits.connections.limit === 25 &&
      healthSummary.dailyLimits.messages.limit === 50;

    record(2, "Account Health State Machine & Daily Quota Diagnostics", healthOk, healthSummary);

    // -----------------------------------------------------------------
    // TEST 3: 8-Point Preflight Verification & Circuit Breaker
    // -----------------------------------------------------------------
    // Part A: Healthy verification passes
    const preflightHealthy = await accountSafetyService.verifyPreFlight(activeUserId, "CONNECT");

    // Part B: Degraded health triggers circuit breaker
    await db
      .update(linkedinAccounts)
      .set({ healthStatus: "CHALLENGED" })
      .where(eq(linkedinAccounts.id, account.id));

    const preflightChallenged = await accountSafetyService.verifyPreFlight(activeUserId, "CONNECT");

    // Verify account was automatically set to PAUSED by circuit breaker
    const [accountAfterBreak] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.id, account.id))
      .limit(1);

    const circuitBreakerOk =
      preflightHealthy.allowed === true &&
      preflightChallenged.allowed === false &&
      preflightChallenged.circuitBreakerTriggered === true &&
      accountAfterBreak?.automationStatus === "PAUSED";

    // Restore to HEALTHY
    await db
      .update(linkedinAccounts)
      .set({ healthStatus: "HEALTHY", automationStatus: "RUNNING" })
      .where(eq(linkedinAccounts.id, account.id));

    record(3, "8-Point Preflight Verification & Auto-Pause Circuit Breaker", circuitBreakerOk, {
      healthyCheck: preflightHealthy,
      degradedCheck: preflightChallenged,
      postBreakerStatus: accountAfterBreak?.automationStatus,
    });

    // -----------------------------------------------------------------
    // TEST 4: One-Click Emergency Safety Killswitch (Pause & Resume)
    // -----------------------------------------------------------------
    // 1. Trigger Pause
    await accountSafetyService.pauseAutomation(activeUserId, "User emergency pause test");
    const [pausedAccount] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, activeUserId))
      .limit(1);

    const preflightWhilePaused = await accountSafetyService.verifyPreFlight(activeUserId, "CONNECT");

    // 2. Trigger Resume
    await accountSafetyService.resumeAutomation(activeUserId);
    const [resumedAccount] = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, activeUserId))
      .limit(1);

    const pauseResumeOk =
      pausedAccount?.automationStatus === "PAUSED" &&
      preflightWhilePaused.allowed === false &&
      Boolean(preflightWhilePaused.reason?.includes("PAUSED")) &&
      resumedAccount?.automationStatus === "RUNNING";

    record(4, "One-Click Emergency Safety Killswitch (Pause & Resume)", pauseResumeOk, {
      pausedStatus: pausedAccount?.automationStatus,
      blockedActionReason: preflightWhilePaused.reason,
      resumedStatus: resumedAccount?.automationStatus,
    });

    // -----------------------------------------------------------------
    // TEST 5: WorkPilot 10-Stage Pipeline Transitions & Filtering
    // -----------------------------------------------------------------
    const testContactId = `crm_test_${Date.now()}`;
    const [lead] = await db
      .insert(contacts)
      .values({
        userId: activeUserId,
        name: "Vikram Malhotra",
        linkedinId: testContactId,
        company: "Apex Ventures",
        designation: "Managing Partner",
        status: "NEW",
      })
      .returning();

    if (!lead) throw new Error("Failed to create test lead.");

    // Advance through multiple stages
    const movedToMeeting = await crmService.updateContactStage(activeUserId, lead.id, "MEETING");
    const movedToProposal = await crmService.updateContactStage(activeUserId, lead.id, "PROPOSAL");
    const movedToWon = await crmService.updateContactStage(activeUserId, lead.id, "WON");

    // Query contacts filtered by WON
    const wonContacts = await crmService.getContactsByStage(activeUserId, "WON");
    const isLeadInWon = wonContacts.some((c) => c.id === lead.id);

    const pipelineTransitionOk =
      movedToMeeting.status === "MEETING" &&
      movedToProposal.status === "PROPOSAL" &&
      movedToWon.status === "WON" &&
      isLeadInWon;

    record(5, "10-Stage Pipeline Progression & Category Filtering", pipelineTransitionOk, {
      finalStage: movedToWon.status,
      filterResultCount: wonContacts.length,
      leadFoundInWon: isLeadInWon,
    });

    // -----------------------------------------------------------------
    // TEST 6: Real-time Funnel Conversion Metrics Aggregation
    // -----------------------------------------------------------------
    // Seed diverse contacts across funnel to test percentages & rates
    const now = new Date();
    const mockFunnelBatch = [
      {
        userId: activeUserId,
        name: "Lead 1 (Connected)",
        linkedinId: `lead_1_${Date.now()}`,
        status: "CONNECTED" as const,
        connectionSentAt: now,
      },
      {
        userId: activeUserId,
        name: "Lead 2 (Replied / Hot Lead)",
        linkedinId: `lead_2_${Date.now()}`,
        status: "HOT_LEAD" as const,
        connectionSentAt: now,
        lastMessageReceivedAt: now,
        isHotLead: true,
      },
      {
        userId: activeUserId,
        name: "Lead 3 (Meeting Booked)",
        linkedinId: `lead_3_${Date.now()}`,
        status: "MEETING" as const,
        connectionSentAt: now,
        lastMessageReceivedAt: now,
      },
      {
        userId: activeUserId,
        name: "Lead 4 (Contacted, pending)",
        linkedinId: `lead_4_${Date.now()}`,
        status: "CONTACTED" as const,
        connectionSentAt: now,
      },
    ];

    await db.insert(contacts).values(mockFunnelBatch);

    const funnelStats = await crmService.getFunnelAnalytics(activeUserId);

    const metricsValid =
      funnelStats.totalLeads >= 5 &&
      funnelStats.connectionsSent >= 4 &&
      funnelStats.connectionsAccepted >= 3 &&
      funnelStats.acceptanceRate > 0 &&
      funnelStats.totalReplies >= 2 &&
      funnelStats.replyRate > 0 &&
      funnelStats.hotLeads >= 1 &&
      funnelStats.dealsWon >= 1 &&
      typeof funnelStats.stageBreakdown === "object";

    record(6, "Real-time Funnel Analytics & Conversion Ratios", metricsValid, funnelStats);

    // -----------------------------------------------------------------
    // Summary Gate
    // -----------------------------------------------------------------
    console.log("\n==================================================================");
    const allPassed = reports.every((r) => r.passed);
    if (allPassed) {
      console.log("🎉 ALL 6 PHASE 5 TESTS PASSED SUCCESSFULLY! GATES VERIFIED.");
      console.log("==================================================================\n");
    } else {
      console.error("❌ PHASE 5 VALIDATION FAILED:");
      reports.filter((r) => !r.passed).forEach((r) => console.error(` - Test ${r.testNumber}: ${r.name}`));
      console.log("==================================================================\n");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Fatal Phase 5 Test Suite Error:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
};

runPhase5TestSuite();
