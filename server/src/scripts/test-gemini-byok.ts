process.env.NODE_ENV = "test";
import "../config/dotenv.config.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { geminiConfigService } from "../services/ai/gemini-config.service.js";
import { decryptStoredSecret } from "../utils/crypto.util.js";
import { getGeminiChatModelForUser } from "../agent/WORKPILOT-connect-agent.js";
import { randomUUID } from "node:crypto";

async function runGeminiByokTests() {
  console.log("================================================================================");
  console.log("🧪 WORKPILOT MULTI-TENANT PER-USER GEMINI API KEY TEST SUITE");
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

  const userAId = randomUUID();
  const userBId = randomUUID();

  try {
    // 1. Create Test User A and Test User B
    await db.insert(users).values([
      {
        id: userAId,
        name: "User Alpha (Custom Key)",
        email: `alpha_${Date.now()}@example.com`,
        password: "hash_test_12345",
      },
      {
        id: userBId,
        name: "User Beta (Default Key)",
        email: `beta_${Date.now()}@example.com`,
        password: "hash_test_12345",
      },
    ]);
    console.log(`👤 Created User A (${userAId}) and User B (${userBId})`);

    // TEST 1: Default fallback when no key is set
    console.log("\n--- TEST 1: Default Fallback for Unconfigured Users ---");
    const userAInitial = await geminiConfigService.getUserConfig(userAId);
    const userBInitial = await geminiConfigService.getUserConfig(userBId);

    assert(userAInitial.isCustom === false, "User A isCustom is false initially");
    assert(userAInitial.source === "SYSTEM_DEFAULT", "User A source is SYSTEM_DEFAULT");
    assert(Boolean(userAInitial.apiKey), "User A resolves valid system default API key");
    assert(userBInitial.isCustom === false, "User B isCustom is false initially");

    // TEST 2: Live Connection Test with current key
    console.log("\n--- TEST 2: Live Connection Verification with Gemini API ---");
    const testResult = await geminiConfigService.testConnection();
    assert(testResult.success === true, "Gemini API connection test succeeded", testResult);
    assert(Boolean(testResult.model), `Target model identified: ${testResult.model}`);

    // TEST 3: User A configures custom personal key and model
    console.log("\n--- TEST 3: User A Sets Personal API Key (Isolation Check) ---");
    const mockPersonalKey = "AIzaSyFakeTestKeyForTenantAlpha998877";
    const customModel = "gemini-1.5-pro";

    await geminiConfigService.setUserConfig(userAId, mockPersonalKey, customModel);

    const userAUpdated = await geminiConfigService.getUserConfig(userAId);
    const userBAfter = await geminiConfigService.getUserConfig(userBId);

    assert(userAUpdated.isCustom === true, "User A isCustom is now true");
    assert(decryptStoredSecret(userAUpdated.apiKey) === mockPersonalKey, "User A resolves their encrypted personal key");
    assert(userAUpdated.model === customModel, "User A resolves their custom model preference");
    assert(userAUpdated.source === "USER_CUSTOM", "User A source is USER_CUSTOM");
    assert(
      Boolean(userAUpdated.maskedKey?.includes("AIzaSy") && userAUpdated.maskedKey?.includes("8877")),
      `User A key is properly masked: ${userAUpdated.maskedKey}`,
    );

    // CRITICAL: Verify User B is completely untouched and still on system key
    assert(userBAfter.isCustom === false, "User B isCustom is still false (Strict Tenant Isolation)");
    assert(userBAfter.source === "SYSTEM_DEFAULT", "User B still uses SYSTEM_DEFAULT key");
    assert(userBAfter.apiKey !== mockPersonalKey, "User B does NOT share User A's personal key");

    // TEST 4: getGeminiChatModelForUser resolves per-user configuration
    console.log("\n--- TEST 4: AI Model Instantiation Resolves Per-User Config ---");
    const modelA = await getGeminiChatModelForUser(userAId);
    const modelB = await getGeminiChatModelForUser(userBId);

    assert((modelA as any).apiKey === mockPersonalKey, "ChatGoogleGenerativeAI for User A initialized with User A's key");
    assert((modelA as any).model === customModel, "ChatGoogleGenerativeAI for User A initialized with User A's custom model");
    assert((modelB as any).apiKey !== mockPersonalKey, "ChatGoogleGenerativeAI for User B initialized with system key");

    // TEST 5: User A removes personal key and reverts to workspace default
    console.log("\n--- TEST 5: User A Reverts Back to Workspace Default Key ---");
    await geminiConfigService.setUserConfig(userAId, null, null);
    const userAReverted = await geminiConfigService.getUserConfig(userAId);

    assert(userAReverted.isCustom === false, "User A isCustom is false after reset");
    assert(userAReverted.source === "SYSTEM_DEFAULT", "User A source reverted to SYSTEM_DEFAULT");
    assert(userAReverted.apiKey !== mockPersonalKey, "User A no longer has personal key active");

    console.log("\n================================================================================");
    console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("================================================================================");

    if (failed > 0) process.exit(1);
  } finally {
    // Cleanup
    await db.delete(users).where(eq(users.id, userAId));
    await db.delete(users).where(eq(users.id, userBId));
  }
}

runGeminiByokTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  });
