import "../config/dotenv.config.js";

const BASE_URL = `http://localhost:${process.env.PORT || 4000}`;

interface TestResult {
  test: string;
  passed: boolean;
  status: number;
  details: any;
}

const results: TestResult[] = [];

const logResult = (test: string, passed: boolean, status: number, details: any) => {
  results.push({ test, passed, status, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${status}] ${test}`);
  if (!passed || process.env.VERBOSE) {
    console.log("   Details:", typeof details === "string" ? details : JSON.stringify(details));
  }
};

const safeJson = async (res: Response): Promise<any> => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const runTests = async () => {
  console.log("\n=======================================================");
  console.log("🧪 Express-Validator & Rate-Limit Verification Suite");
  console.log(`📡 Target API: ${BASE_URL}/api/auth`);
  console.log("=======================================================\n");

  try {
    // 1. Check server health
    try {
      const health = await fetch(`${BASE_URL}/api/health`);
      if (!health.ok) throw new Error("Health check failed");
      console.log("🟢 Server is online and responding.\n");
    } catch {
      console.error(`❌ Server is offline at ${BASE_URL}. Ensure 'npm run dev' is running in /server.`);
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 1: Signup with empty payload (Express-validator check)
    // -------------------------------------------------------------
    const emptySignupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const emptySignupData = await safeJson(emptySignupRes);
    const emptySignupPassed =
      emptySignupRes.status === 400 &&
      Array.isArray(emptySignupData.errors) &&
      emptySignupData.errors.length >= 3;
    logResult(
      "Validator: Signup rejects empty body with 400 and validation error array",
      emptySignupPassed,
      emptySignupRes.status,
      emptySignupData
    );

    // -------------------------------------------------------------
    // TEST 2: Signup with invalid email
    // -------------------------------------------------------------
    const invalidEmailRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "invalid-email-address",
        password: "ValidPassword123!",
      }),
    });
    const invalidEmailData = await safeJson(invalidEmailRes);
    const invalidEmailPassed =
      invalidEmailRes.status === 400 &&
      invalidEmailData.errors?.some((e: any) => e.path === "email" || e.param === "email");
    logResult(
      "Validator: Signup rejects invalid email format with 400",
      invalidEmailPassed,
      invalidEmailRes.status,
      invalidEmailData
    );

    // -------------------------------------------------------------
    // TEST 3: Signup with short password (< 10 chars)
    // -------------------------------------------------------------
    const shortPassRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: `valid_${Date.now()}@example.com`,
        password: "123",
      }),
    });
    const shortPassData = await safeJson(shortPassRes);
    const shortPassPassed =
      shortPassRes.status === 400 &&
      shortPassData.errors?.some((e: any) =>
        e.msg?.includes("at least 10 characters")
      );
    logResult(
      "Validator: Signup rejects password shorter than 10 characters with 400",
      shortPassPassed,
      shortPassRes.status,
      shortPassData
    );

    // -------------------------------------------------------------
    // TEST 4: Login with empty payload
    // -------------------------------------------------------------
    const emptyLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const emptyLoginData = await safeJson(emptyLoginRes);
    const emptyLoginPassed =
      emptyLoginRes.status === 400 &&
      Array.isArray(emptyLoginData.errors) &&
      emptyLoginData.errors.length >= 2;
    logResult(
      "Validator: Login rejects missing email and password with 400",
      emptyLoginPassed,
      emptyLoginRes.status,
      emptyLoginData
    );

    // -------------------------------------------------------------
    // TEST 5: Login with invalid email format
    // -------------------------------------------------------------
    const invalidLoginEmailRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "notanemail",
        password: "somepassword",
      }),
    });
    const invalidLoginEmailData = await safeJson(invalidLoginEmailRes);
    const invalidLoginEmailPassed =
      invalidLoginEmailRes.status === 400 &&
      invalidLoginEmailData.errors?.some((e: any) => e.path === "email" || e.param === "email");
    logResult(
      "Validator: Login rejects malformed email format with 400",
      invalidLoginEmailPassed,
      invalidLoginEmailRes.status,
      invalidLoginEmailData
    );

    // -------------------------------------------------------------
    // TEST 6: Rate Limiting Enforcement (Login limit)
    // -------------------------------------------------------------
    console.log("\n⏳ Testing Login Rate Limiter (loginLimit: max 5 requests per 2 minutes)...");
    let rateLimitTriggered = false;
    let rateLimitStatus = 0;
    let rateLimitData: any = null;

    // Send rapid login attempts until limit hits
    for (let i = 1; i <= 8; i++) {
      const rlRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ratelimit.test@example.com",
          password: "WrongPassword123!",
        }),
      });

      if (rlRes.status === 429) {
        rateLimitTriggered = true;
        rateLimitStatus = 429;
        rateLimitData = await safeJson(rlRes);
        break;
      }
    }

    logResult(
      "RateLimit: Triggers 429 Too Many Requests when loginLimit is exceeded",
      rateLimitTriggered,
      rateLimitStatus,
      rateLimitData || "Rate limit was not reached"
    );

    // Summary
    console.log("\n=======================================================");
    const totalPassed = results.filter((r) => r.passed).length;
    console.log(`📊 Test Summary: ${totalPassed}/${results.length} tests passed`);
    console.log("=======================================================\n");

    if (totalPassed === results.length) {
      console.log("🎉 All express-validator and rate-limiting tests passed successfully!");
      process.exit(0);
    } else {
      console.error("⚠️ Some tests did not pass.");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Unexpected test execution error:", error);
    process.exit(1);
  }
};

runTests();
