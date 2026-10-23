import "../config/dotenv.config.js";
import { db, client } from "../db/index.js";
import { users, contacts, actionQueue } from "../db/schema.js";
import { engagementService } from "../services/engagement/engagement.service.js";
import { actionQueueService } from "../services/queue/queue.service.js";
import { eq } from "drizzle-orm";

interface Phase4TestReport {
  testNumber: number;
  name: string;
  passed: boolean;
  output?: any;
}

const reports: Phase4TestReport[] = [];

const record = (testNumber: number, name: string, passed: boolean, output?: any) => {
  reports.push({ testNumber, name, passed, output });
  const badge = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${badge}] Test ${testNumber}: ${name}`);
  if (output) {
    console.log("   Details:", typeof output === "string" ? output : JSON.stringify(output, null, 2));
  }
};

const runPhase4TestSuite = async () => {
  console.log("\n==================================================================");
  console.log("🚀 WORKPILOT PHASE 4 VALIDATION GATE: SOCIAL WARMUP & ENGAGEMENT");
  console.log("==================================================================\n");

  try {
    // 0. Ensure user and test contact
    let [user] = await db.select().from(users).limit(1);
    if (!user) throw new Error("No user found.");
    const activeUserId = user.id;

    // Clear stale queue jobs for clean test execution
    await db.delete(actionQueue).where(eq(actionQueue.userId, activeUserId));

    const testLinkedinId = `urn:li:fsd_profile:warmup_${Date.now()}`;
    const [testContact] = await db
      .insert(contacts)
      .values({
        userId: activeUserId,
        name: "Omar Al-Fassi",
        linkedinId: testLinkedinId,
        company: "Emirates Realty Group",
        designation: "Chief Executive Officer",
        status: "NEW",
      })
      .returning();

    if (!testContact) throw new Error("Failed to create test contact.");

    // -----------------------------------------------------------------
    // TEST 1: Post Discovery & Candidate Selection
    // -----------------------------------------------------------------
    const targetPost = await engagementService.getTargetPostForWarmup(testContact.linkedinId);
    record(
      1,
      "Target Post Discovery for Warmup",
      Boolean(targetPost && targetPost.content),
      `Post ID: ${targetPost?.id} | Author: ${targetPost?.author_name} | Content: "${targetPost?.content.slice(0, 50)}..."`
    );

    // -----------------------------------------------------------------
    // TEST 2: Contextual Non-Robotic Comment Generation
    // -----------------------------------------------------------------
    const generatedComment = engagementService.generateInsightfulComment(targetPost!);
    const qualityCheck = engagementService.validateCommentQuality(generatedComment);
    record(
      2,
      "Contextual AI Comment Generation (High-Value Insight)",
      qualityCheck.isValid && generatedComment.length > 50,
      `Generated draft: "${generatedComment}"`
    );

    // -----------------------------------------------------------------
    // TEST 3: Anti-Spam Guardrail (Reject Generic Clichés)
    // -----------------------------------------------------------------
    const badComment1 = engagementService.validateCommentQuality("Great post!");
    const badComment2 = engagementService.validateCommentQuality("Agree 100%");
    const badComment3 = engagementService.validateCommentQuality("Awesome share");

    const allRejected = !badComment1.isValid && !badComment2.isValid && !badComment3.isValid;
    record(
      3,
      "Anti-Spam Guardrail (Rejection of Generic Clichés)",
      allRejected,
      `Successfully rejected robotic comments: "${badComment1.reason}"`
    );

    // -----------------------------------------------------------------
    // TEST 4: Orchestrate 3-Step Social Warmup Cadence
    // -----------------------------------------------------------------
    // For test, use 0 delay so jobs can be executed immediately
    const warmupPlan = await engagementService.orchestrateWarmupSequence(
      activeUserId,
      {
        id: testContact.id,
        name: testContact.name,
        linkedinId: testContact.linkedinId,
        company: testContact.company || undefined,
        designation: testContact.designation || undefined,
      },
      {
        postDelayMinutes: 0,
        commentDelayMinutes: 0,
        connectDelayMinutes: 0,
      }
    );

    record(
      4,
      "Orchestrate 3-Step Social Warmup Workflow (React -> Comment -> Connect)",
      Boolean(warmupPlan.reactJobId && warmupPlan.commentJobId && warmupPlan.connectJobId),
      `Queued 3 Jobs: React (${warmupPlan.reactJobId}) -> Comment (${warmupPlan.commentJobId}) -> Connect (${warmupPlan.connectJobId})`
    );

    // -----------------------------------------------------------------
    // TEST 5: Verify Jobs in Action Queue with Correct Payloads
    // -----------------------------------------------------------------
    const queuedJobs = await db
      .select()
      .from(actionQueue)
      .where(eq(actionQueue.contactId, testContact.id));

    const hasReact = queuedJobs.some((j) => j.actionType === "REACT");
    const hasComment = queuedJobs.some((j) => j.actionType === "COMMENT");
    const hasConnect = queuedJobs.some((j) => j.actionType === "CONNECT");

    record(
      5,
      "Action Queue Verification for Social Pre-Outreach",
      hasReact && hasComment && hasConnect && queuedJobs.length === 3,
      `All 3 warmup actions confirmed in database queue with statuses: ${queuedJobs.map((j) => j.status).join(", ")}`
    );

    // -----------------------------------------------------------------
    // TEST 6: Background Dispatch of Social Warmup Actions
    // -----------------------------------------------------------------
    const dispatchResult = await actionQueueService.processDueActions(activeUserId);

    record(
      6,
      "Dispatch Social Warmup Actions through Pre-Flight Safety",
      dispatchResult.processed >= 2,
      `Successfully executed ${dispatchResult.processed} social actions through safety circuit breakers.`
    );

    // -----------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------
    console.log("\n==================================================================");
    const passedCount = reports.filter((r) => r.passed).length;
    console.log(`🏁 PHASE 4 VALIDATION RESULT: ${passedCount} / 6 TESTS PASSED`);
    if (passedCount === 6) {
      console.log("🎉 SUCCESS! Raunak's Phase 4 Exit Gate is 100% ACHIEVED!");
      console.log("👉 Social Warmup, Contextual Non-Robotic Commenting, and 3-Step Engagement Workflow verified.");
    } else {
      console.log("⚠️ Some tests failed. Please review details above.");
    }
    console.log("==================================================================\n");
  } catch (err: any) {
    console.error("❌ Fatal Phase 4 runner error:", err);
  } finally {
    await client.end();
  }
};

runPhase4TestSuite();
