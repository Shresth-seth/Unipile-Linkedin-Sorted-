import "../config/dotenv.config.js";

const BASE_URL = `http://localhost:${process.env.PORT || 4000}`;

interface TestResult {
  step: string;
  passed: boolean;
  details?: any;
}

const results: TestResult[] = [];

const logStep = (step: string, passed: boolean, details?: any) => {
  results.push({ step, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${step}`);
  if (details) {
    console.log("   ", typeof details === "string" ? details : JSON.stringify(details));
  }
};

const runAuthTests = async () => {
  console.log("\n=======================================================");
  console.log("🧪 WorkPilot Auth Verification Test (Terminal Runner)");
  console.log(`📡 Target API: ${BASE_URL}`);
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const testUser = {
    name: "Raunak Sharma",
    email: `raunak_${timestamp}@workpilot.io`,
    password: "SecurePassword123!",
  };

  let authToken = "";

  try {
    // 1. Health Check
    try {
      const healthRes = await fetch(`${BASE_URL}/api/health`);
      const healthData: any = await healthRes.json();
      logStep("Backend API Health Check", healthRes.ok, healthData);
    } catch (err: any) {
      logStep("Backend API Health Check", false, `Server not responding at ${BASE_URL}. Ensure server is running!`);
      return;
    }

    // 2. Signup Test
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    const signupData: any = await signupRes.json();
    const signupPassed = signupRes.status === 201 && signupData.success && !!signupData.token;
    authToken = signupData.token || "";
    logStep(
      "User Signup (POST /api/auth/signup)",
      signupPassed,
      signupPassed ? `User ID: ${signupData.user.id}, Email: ${signupData.user.email}` : signupData
    );

    // 3. Duplicate Signup Prevention Test
    const duplicateRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    const duplicateData: any = await duplicateRes.json();
    const duplicatePassed = duplicateRes.status === 400 && !duplicateData.success;
    logStep(
      "Duplicate Signup Prevention",
      duplicatePassed,
      duplicatePassed ? "Correctly rejected duplicate email with 400 Bad Request" : duplicateData
    );

    // 4. Login with Correct Credentials
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });
    const loginData: any = await loginRes.json();
    const loginPassed = loginRes.status === 200 && loginData.success && !!loginData.token;
    if (loginPassed) authToken = loginData.token;
    logStep(
      "User Login with Valid Password (POST /api/auth/login)",
      loginPassed,
      loginPassed ? `JWT Token issued successfully (User: ${loginData.user.name})` : loginData
    );

    // 5. Login with Wrong Password
    const wrongLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUser.email,
        password: "WrongPassword999",
      }),
    });
    const wrongLoginData: any = await wrongLoginRes.json();
    const wrongLoginPassed = wrongLoginRes.status === 401 && !wrongLoginData.success;
    logStep(
      "Reject Invalid Password (401 Unauthorized)",
      wrongLoginPassed,
      wrongLoginPassed ? "Properly rejected invalid credentials" : wrongLoginData
    );

    // 6. Get Current User Profile with Token (Protected Route)
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    const meData: any = await meRes.json();
    const mePassed = meRes.status === 200 && meData.success && meData.user.email === testUser.email;
    logStep(
      "Protected Route: Get Me (GET /api/auth/me)",
      mePassed,
      mePassed ? `Session authenticated for ${meData.user.email}` : meData
    );

    // 7. Protected Route Without Token
    const unauthRes = await fetch(`${BASE_URL}/api/auth/me`, {
      method: "GET",
    });
    const unauthData: any = await unauthRes.json();
    const unauthPassed = unauthRes.status === 401 && !unauthData.success;
    logStep(
      "Protected Route Without Token Rejected (401 Unauthorized)",
      unauthPassed,
      unauthPassed ? "Successfully blocked unauthenticated request" : unauthData
    );

    // 8. Logout Test
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
    });
    const logoutData: any = await logoutRes.json();
    const logoutPassed = logoutRes.status === 200 && logoutData.success;
    logStep(
      "User Logout (POST /api/auth/logout)",
      logoutPassed,
      logoutPassed ? "Cookie cleared successfully" : logoutData
    );

    console.log("\n=======================================================");
    const allPassed = results.every((r) => r.passed);
    if (allPassed) {
      console.log("🎉 ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!");
    } else {
      console.log("⚠️ SOME TESTS FAILED. Check output details above.");
    }
    console.log("=======================================================\n");
  } catch (err: any) {
    console.error("\n❌ Unexpected error running tests:", err);
  }
};

runAuthTests();
