import "../config/dotenv.config.js";
import { db, client } from "../db/index.js";
import { users, linkedinAccounts, dailyAgentSettings, dailyAgentRuns, contacts } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { prospectMatchingService } from "../services/prospects/prospect-matching.service.js";
import { outreachPersonalizationService } from "../services/prospects/outreach-personalization.service.js";
import { dailyAgentService } from "../agent/daily/daily-agent.service.js";
import { ProspectCandidate } from "../agent/daily/daily-agent.types.js";
import { DateTime } from "luxon";

async function runDailyAgentTests() {
  console.log("================================================================================");
  console.log("🧪 WORKPILOT DAILY AUTONOMOUS AGENT TEST SUITE");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, detail?: any) => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error("   Details:", detail);
      failed++;
    }
  };

  try {
    // Setup test user
    const testEmail = `test_daily_${Date.now()}@workpilot.test`;
    const [testUser] = await db
      .insert(users)
      .values({
        name: "Daily Agent Tester",
        email: testEmail,
        password: "hashed_dummy_password",
      })
      .returning();

    const userId = testUser!.id;

    // Connect dummy LinkedIn account
    const [testAccount] = await db
      .insert(linkedinAccounts)
      .values({
        userId,
        unipileAccountId: `unipile_test_${Date.now()}`,
        linkedinName: "Daily Tester Profile",
        headline: "Founder & CEO at AI DevTools Startup",
        isConnected: true,
        healthStatus: "HEALTHY",
        automationStatus: "RUNNING",
        dailyConnectionsLimit: 15,
        dailyMessagesLimit: 30,
      })
      .returning();

    console.log(`👤 Created test user ${userId} and LinkedIn account ${testAccount!.id}`);


    // TEST 1: Save & Retrieve Daily Agent Configuration
    console.log("\n--- TEST 1: Daily Agent Configuration Persistence ---");
    const savedConfig = await dailyAgentService.saveDailyAgentConfig(userId, {
      dailyAgentEnabled: true,
      dailyAgentMode: "AUTONOMOUS",
      targetRoles: ["AI Founders", "CTOs", "VP of Engineering"],
      targetIndustries: ["Software Development", "Artificial Intelligence"],
      targetLocations: ["United States", "San Francisco"],
      networkingGoal: "Build connections with technical leaders building developer infrastructure.",
      autoConnectionRequests: true,
      autoFollowUps: true,
      dailyQuota: 10,
      preferredDailyStartTime: "09:30",
      timezone: "America/New_York",
    });

    assert(savedConfig.dailyAgentEnabled === true, "Config dailyAgentEnabled saved as true");
    assert(savedConfig.dailyAgentMode === "AUTONOMOUS", "Config mode is AUTONOMOUS");
    assert(savedConfig.targetRoles.length === 3, "Config saved 3 target roles");
    assert(savedConfig.dailyQuota === 10, "Config daily quota saved as 10");
    assert(Boolean(savedConfig.nextDailyRunAt), "nextDailyRunAt scheduled automatically");

    // TEST 2: Prospect Matching Relevance Scoring & Rationale
    console.log("\n--- TEST 2: Prospect Relevance Scoring & Rationale ---");
    const testCandidates: ProspectCandidate[] = [
      {
        name: "Sarah Chen",
        linkedinId: "cand_sarah_111",
        designation: "Founder & CTO at NeuralStack (AI Infrastructure)",
        company: "NeuralStack",
        location: "San Francisco, CA",
        industry: "Artificial Intelligence",
      },
      {
        name: "Bob RealEstate",
        linkedinId: "cand_bob_222",
        designation: "Real Estate Broker & Property Manager",
        company: "City Properties",
        location: "Miami, FL",
        industry: "Real Estate",
      },
    ];

    const matchEvaluations = await prospectMatchingService.evaluateCandidates(testCandidates, {
      userId,
      userHeadline: "Founder & CEO at AI DevTools Startup",
      targetRoles: ["AI Founders", "CTOs"],
      targetIndustries: ["Artificial Intelligence"],
      networkingGoal: "Connect with technical leaders in AI devtools",
    });

    assert(matchEvaluations.length > 0, "Prospect matching returned evaluations");
    const sarahEval = matchEvaluations.find((e) => e.candidate.name === "Sarah Chen");
    const bobEval = matchEvaluations.find((e) => e.candidate.name === "Bob RealEstate");

    assert(Boolean(sarahEval && sarahEval.matchScore >= 70), "Sarah (AI Founder/CTO) scored as strong match (>= 70)", sarahEval?.matchScore);
    assert(Boolean(sarahEval && sarahEval.reason.length > 10), "Sarah evaluation includes factual rationale", sarahEval?.reason);
    assert(Boolean(bobEval && bobEval.matchScore < sarahEval!.matchScore), "Bob (Real Estate) scored significantly lower than Sarah", bobEval?.matchScore);

    // TEST 3: Grounded Personalized Connection Notes (No Hallucinations, <295 chars)
    console.log("\n--- TEST 3: Personalized Outreach Note Generation ---");
    const note = await outreachPersonalizationService.generatePersonalizedNote({
      candidate: testCandidates[0]!,
      userContext: {
        userId,
        userHeadline: "Founder building AI developer tools",
        networkingGoal: "Exchange insights with fellow AI infrastructure builders",
      },
      matchReason: sarahEval?.reason || undefined,
    });

    assert(Boolean(note && note.length > 0), "Generated personalized note is not empty");
    assert(Boolean(note && note.length <= 295), `Generated note conforms to LinkedIn 295-char limit (Actual length: ${note?.length})`);
    assert(Boolean(note && !note.includes("I saw your profile and wanted to connect")), "Does NOT use weak generic template");
    assert(Boolean(note && (note.includes("NeuralStack") || note.includes("Sarah") || note.includes("AI"))), "Grounded in retrieved recipient context");

    // TEST 4: Concurrency / Atomic Run Locking
    console.log("\n--- TEST 4: Concurrency & Atomic Locking ---");
    // Insert an active RUNNING lock
    const [runningLock] = await db
      .insert(dailyAgentRuns)
      .values({
        userId,
        status: "RUNNING",
        startedAt: new Date(),
      })
      .returning();

    // Attempt second run without manual override
    const secondRunResult = await dailyAgentService.runForUser(userId, false);
    assert(secondRunResult.status === "SKIPPED", "Duplicate run was correctly SKIPPED due to active lock");
    assert(secondRunResult.skippedCount === 1, "Skipped count incremented");

    // Clean up lock
    await db.delete(dailyAgentRuns).where(eq(dailyAgentRuns.id, runningLock!.id));

    // TEST 5: Daily Limit & Paused Safety Awareness
    console.log("\n--- TEST 5: Safety Status & Paused Account Awareness ---");
    // Pause the account
    await db
      .update(linkedinAccounts)
      .set({ automationStatus: "PAUSED" })
      .where(eq(linkedinAccounts.id, testAccount!.id));

    const pausedRunResult = await dailyAgentService.runForUser(userId, true);
    assert(pausedRunResult.status === "SKIPPED", "Run SKIPPED because LinkedIn automationStatus is PAUSED");
    assert(pausedRunResult.summary.includes("paused"), "Summary mentions automation is paused");

    // Unpause account
    await db
      .update(linkedinAccounts)
      .set({ automationStatus: "RUNNING" })
      .where(eq(linkedinAccounts.id, testAccount!.id));


    // TEST 6: User Run History Retrieval
    console.log("\n--- TEST 6: Run History Persistence ---");
    const history = await dailyAgentService.getUserRunHistory(userId);
    assert(Array.isArray(history), "Run history returned array");

    // TEST 7: Timezone-Aware 04:00 AM Scheduling
    console.log("\n--- TEST 7: Timezone Scheduling (Asia/Kolkata vs America/New_York) ---");
    const nextKolkata = dailyAgentService.calculateNextDailyRun("04:00", "Asia/Kolkata");
    const kolkataDt = DateTime.fromJSDate(nextKolkata, { zone: "Asia/Kolkata" });
    assert(kolkataDt.hour === 4 && kolkataDt.minute === 0, "Asia/Kolkata next run is exactly 04:00 AM local time");
    assert(nextKolkata.getTime() > Date.now(), "Asia/Kolkata next run is scheduled in the future");

    const nextNy = dailyAgentService.calculateNextDailyRun("04:00", "America/New_York");
    const nyDt = DateTime.fromJSDate(nextNy, { zone: "America/New_York" });
    assert(nyDt.hour === 4 && nyDt.minute === 0, "America/New_York next run is exactly 04:00 AM local time");
    assert(nextNy.getTime() > Date.now(), "America/New_York next run is scheduled in the future");
    assert(nextKolkata.getTime() !== nextNy.getTime(), "Local 04:00 AM in Asia/Kolkata and America/New_York produce distinct UTC timestamps");

    // TEST 8: WorkPilot Default 10/day Limit Enforced per Local Calendar Day
    console.log("\n--- TEST 8: WorkPilot 10/Day Cap Enforced on Local Calendar Day ---");
    // Ensure dailyQuota is 10
    await dailyAgentService.saveDailyAgentConfig(userId, { dailyQuota: 10, timezone: "Asia/Kolkata" });

    // Seed 10 invitations sent today for this user
    for (let i = 1; i <= 10; i++) {
      await db.insert(contacts).values({
        userId,
        name: `Cap Prospect ${i}`,
        linkedinId: `cap_prospect_${userId}_${i}`,
        status: "CONTACTED",
        connectionSentAt: new Date(),
      });
    }

    const capRunResult = await dailyAgentService.runForUser(userId, true);
    assert(capRunResult.status === "DAILY_LIMIT_REACHED", "Run stopped with DAILY_LIMIT_REACHED when 10 invitations already sent today");
    assert(capRunResult.connectionRequestsSent === 0, "Zero connection requests sent when limit is reached");
    assert(capRunResult.remainingCapacityAtStart === 0, "Remaining capacity detected as 0");
    assert(Boolean(capRunResult.runKey), `Run record has idempotency runKey: ${capRunResult.runKey}`);

    // Clean up test records
    await db.delete(dailyAgentSettings).where(eq(dailyAgentSettings.userId, userId));
    await db.delete(dailyAgentRuns).where(eq(dailyAgentRuns.userId, userId));
    await db.delete(contacts).where(eq(contacts.userId, userId));
    await db.delete(linkedinAccounts).where(eq(linkedinAccounts.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    console.log("\n================================================================================");
    console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("================================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Test suite encountered fatal error:", error);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

runDailyAgentTests();
