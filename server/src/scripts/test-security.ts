import "../config/dotenv.config.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq, and, sql } from "drizzle-orm";
import { db, client } from "../db/index.js";
import { users, linkedinAccounts, contacts, actionQueue } from "../db/schema.js";
import { accountSafetyService } from "../services/safety/safety.service.js";
import { engagementService } from "../services/engagement/engagement.service.js";
import { crmService } from "../services/crm/crm.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const BASE_URL = `http://localhost:${PORT}`;

interface AuditResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: any;
}

const auditResults: AuditResult[] = [];

const recordAudit = (
  id: string,
  category: string,
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
  details?: any
) => {
  auditResults.push({ id, category, name, passed, expected, actual, details });
  const icon = passed ? "✅ [PASS]" : "❌ [FAIL]";
  console.log(`\n${icon} [${id}] ${category} :: ${name}`);
  console.log(`   Expected : ${expected}`);
  console.log(`   Observed : ${actual}`);
  if (details) {
    console.log("   Details  :", typeof details === "string" ? details : JSON.stringify(details));
  }
};

const runSecurityAudit = async () => {
  console.log("\n==========================================================================");
  console.log("🛡️  WORKPILOT BACKEND DEFENSIVE SECURITY & INTEGRITY AUDIT SUITE");
  console.log(`📡 Target API Gateway: ${BASE_URL}`);
  console.log("==========================================================================\n");

  const timestamp = Date.now();
  const testEmailA = `sec_user_a_${timestamp}@workpilot-audit.io`;
  const testEmailB = `sec_user_b_${timestamp}@workpilot-audit.io`;
  const rawPasswordA = "Super$ecureP@ss123!";
  const rawPasswordB = "Another$ecureP@ss456!";

  let tokenA = "";
  let userAId = "";
  let userBId = "";

  try {
    // ------------------------------------------------------------------------
    // SEC-01: Auth Protection (Missing Credentials)
    // ------------------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data: any = await res.json().catch(() => ({}));
      const passed = res.status === 401 && data.success === false;
      recordAudit(
        "SEC-01",
        "Auth Protection",
        "Block unauthenticated access to /api/auth/me",
        passed,
        "HTTP 401 with { success: false }",
        `HTTP ${res.status} with message "${data.message || ""}"`,
        data
      );
    } catch (err: any) {
      recordAudit(
        "SEC-01",
        "Auth Protection",
        "Block unauthenticated access to /api/auth/me",
        false,
        "HTTP 401",
        `Connection failed: ${err.message}. Is the backend server running?`
      );
    }

    // ------------------------------------------------------------------------
    // SEC-02: Token Tampering (Malformed Bearer Token)
    // ------------------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid.malformed.header.jwt.signature",
        },
      });
      const data: any = await res.json().catch(() => ({}));
      const passed = res.status === 401 && data.success === false;
      recordAudit(
        "SEC-02",
        "Token Tampering",
        "Safely reject malformed JWT Bearer tokens without server crash",
        passed,
        "HTTP 401 without unhandled crash",
        `HTTP ${res.status} with message "${data.message || ""}"`
      );
    } catch (err: any) {
      recordAudit("SEC-02", "Token Tampering", "Reject malformed JWT", false, "HTTP 401", err.message);
    }

    // ------------------------------------------------------------------------
    // SEC-03: Expired / Signed-Wrong JWT
    // ------------------------------------------------------------------------
    try {
      const fakeToken = jwt.sign(
        { userId: "00000000-0000-0000-0000-000000000000", email: "attacker@hacker.com" },
        "completely_unauthorized_fake_jwt_secret_99999"
      );
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fakeToken}`,
        },
      });
      const data: any = await res.json().catch(() => ({}));
      const passed = res.status === 401 && data.success === false;
      recordAudit(
        "SEC-03",
        "Token Verification",
        "Reject tokens signed with unknown secret keys",
        passed,
        "HTTP 401 Signature verification failure",
        `HTTP ${res.status} with message "${data.message || ""}"`
      );
    } catch (err: any) {
      recordAudit("SEC-03", "Token Verification", "Reject wrong signature", false, "HTTP 401", err.message);
    }

    // ------------------------------------------------------------------------
    // Setup Test Users for downstream checks
    // ------------------------------------------------------------------------
    const signupResA = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Audit User A",
        email: testEmailA,
        password: rawPasswordA,
      }),
    });
    const signupDataA: any = await signupResA.json();
    tokenA = signupDataA.token || "";
    userAId = signupDataA.user?.id || "";

    const signupResB = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Audit User B",
        email: testEmailB,
        password: rawPasswordB,
      }),
    });
    const signupDataB: any = await signupResB.json();
    userBId = signupDataB.user?.id || "";

    // ------------------------------------------------------------------------
    // SEC-04: Password Hashing (Bcrypt Verification)
    // ------------------------------------------------------------------------
    try {
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmailA.toLowerCase()))
        .limit(1);

      const isBcrypt = dbUser && dbUser.password.startsWith("$2");
      const notPlaintext = dbUser && dbUser.password !== rawPasswordA;
      const bcryptValid = dbUser ? await bcrypt.compare(rawPasswordA, dbUser.password) : false;
      const passed = Boolean(isBcrypt && notPlaintext && bcryptValid);

      recordAudit(
        "SEC-04",
        "Password Storage",
        "Passwords hashed with bcrypt salt rounds (never plaintext)",
        passed,
        "Bcrypt hash string ($2b$10$...) matching plaintext password via bcrypt.compare",
        `Hash prefix: ${dbUser?.password?.substring(0, 7)}..., bcrypt.compare = ${bcryptValid}`
      );
    } catch (err: any) {
      recordAudit("SEC-04", "Password Storage", "Bcrypt hash storage", false, "Bcrypt hash", err.message);
    }

    // ------------------------------------------------------------------------
    // SEC-05: Sensitive Data Scrubbing
    // ------------------------------------------------------------------------
    try {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmailA, password: rawPasswordA }),
      });
      const loginData: any = await loginRes.json();

      const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const meData: any = await meRes.json();

      const signupNoPassword = signupDataA.user?.password === undefined;
      const loginNoPassword = loginData.user?.password === undefined;
      const meNoPassword = meData.user?.password === undefined;
      const passed = signupNoPassword && loginNoPassword && meNoPassword;

      recordAudit(
        "SEC-05",
        "Sensitive Data Scrubbing",
        "Ensure password fields are omitted from signup, login, and /me responses",
        passed,
        "password property strictly undefined in all returned user payloads",
        `Signup: ${signupNoPassword ? "OMITTED" : "LEAKED"}, Login: ${loginNoPassword ? "OMITTED" : "LEAKED"}, Me: ${meNoPassword ? "OMITTED" : "LEAKED"}`
      );
    } catch (err: any) {
      recordAudit("SEC-05", "Sensitive Data Scrubbing", "Omit passwords in JSON", false, "Omitted", err.message);
    }

    // ------------------------------------------------------------------------
    // SEC-06: SQL Injection (Drizzle AST Parameterization)
    // ------------------------------------------------------------------------
    try {
      const maliciousName = "'; DROP TABLE contacts; --";
      const maliciousCompany = "' OR '1'='1";

      // Query contacts using malicious strings in text columns
      const queryByName = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.userId, userAId), eq(contacts.name, maliciousName)));

      const queryByCompany = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.userId, userAId), eq(contacts.company, maliciousCompany)));

      // Verify contacts table remains fully intact and operational
      const [aliveCheck] = await db.select({ count: sql<number>`count(*)` }).from(contacts);
      const passed = queryByName.length === 0 && queryByCompany.length === 0 && Number(aliveCheck?.count ?? -1) >= 0;

      recordAudit(
        "SEC-06",
        "SQL Injection Immunity",
        "Drizzle ORM AST parameterization shields against raw SQL injection",
        passed,
        "Queries parse malicious strings as literal values; contacts table remains intact",
        `Matched rows: 0, Table alive check: count=${aliveCheck?.count}`
      );
    } catch (err: any) {
      recordAudit("SEC-06", "SQL Injection Immunity", "SQL injection immunity", false, "Immune", err.message);
    }

    // ------------------------------------------------------------------------
    // SEC-07: Safety Quota Cap Enforcement (Pre-Flight Engine)
    // ------------------------------------------------------------------------
    try {
      // Create a test account for User A with dailyConnectionsLimit = 25
      await db
        .insert(linkedinAccounts)
        .values({
          userId: userAId,
          unipileAccountId: `unipile_audit_${timestamp}`,
          isConnected: true,
          healthStatus: "HEALTHY",
          automationStatus: "RUNNING",
          dailyConnectionsLimit: 25,
          dailyMessagesLimit: 50,
        })
        .returning();

      // Seed 25 completed connection action records for today
      const today = new Date();
      const dummyInserts = [];
      for (let i = 0; i < 25; i++) {
        dummyInserts.push({
          userId: userAId,
          actionType: "CONNECT" as const,
          status: "COMPLETED" as const,
          payload: { dummy: true },
          scheduledFor: today,
          executedAt: today,
        });
      }
      await db.insert(actionQueue).values(dummyInserts);

      // Attempt 26th connection invite
      const preFlightResult = await accountSafetyService.verifyPreFlight(userAId, "CONNECT");
      const passed = preFlightResult.allowed === false && preFlightResult.circuitBreakerTriggered === true;

      recordAudit(
        "SEC-07",
        "Safety Quota Cap",
        "Pre-flight gate halts execution when 25/day connection quota is met",
        passed,
        "allowed = false, circuitBreakerTriggered = true, automation auto-paused",
        `allowed: ${preFlightResult.allowed}, breaker: ${preFlightResult.circuitBreakerTriggered}, reason: "${preFlightResult.reason}"`
      );
    } catch (err: any) {
      recordAudit("SEC-07", "Safety Quota Cap", "Enforce 25/day cap", false, "Blocked", err.message);
    }

    // ------------------------------------------------------------------------
    // SEC-08: Circuit Breaker on Degraded Account Health
    // ------------------------------------------------------------------------
    try {
      // Set account to CHALLENGED health status
      await db
        .update(linkedinAccounts)
        .set({ healthStatus: "CHALLENGED", automationStatus: "RUNNING" })
        .where(eq(linkedinAccounts.userId, userAId));

      const breakerResult = await accountSafetyService.verifyPreFlight(userAId, "MESSAGE");
      const [updatedAccount] = await db
        .select()
        .from(linkedinAccounts)
        .where(eq(linkedinAccounts.userId, userAId))
        .limit(1);

      const passed =
        breakerResult.allowed === false &&
        breakerResult.circuitBreakerTriggered === true &&
        updatedAccount?.automationStatus === "PAUSED";

      recordAudit(
        "SEC-08",
        "Circuit Breaker",
        "Auto-trips safety switch when account health is CHALLENGED or RESTRICTED",
        passed,
        "allowed = false, breaker triggered, automationStatus updated to PAUSED in DB",
        `Breaker triggered: ${breakerResult.circuitBreakerTriggered}, DB Status: ${updatedAccount?.automationStatus}`
      );
    } catch (err: any) {
      recordAudit("SEC-08", "Circuit Breaker", "Trip on degraded health", false, "Paused", err.message);
    }

    // ------------------------------------------------------------------------
    // SEC-09: Anti-Spam & Cliché Detection
    // ------------------------------------------------------------------------
    try {
      const generic1 = engagementService.validateCommentQuality("Great post!");
      const generic2 = engagementService.validateCommentQuality("awesome post.");
      const tooShort = engagementService.validateCommentQuality("Thanks for this info.");
      const highQuality = engagementService.validateCommentQuality(
        "The most effective automation workflows eliminate repetitive manual qualification so closers spend 100% of their time talking to qualified buyers."
      );

      const passed = !generic1.isValid && !generic2.isValid && !tooShort.isValid && highQuality.isValid;

      recordAudit(
        "SEC-09",
        "Anti-Spam Guardrails",
        "Rejects generic robotic clichés and sub-8-word spam comments",
        passed,
        "Clichés ('Great post!') & short comments rejected; high-value comments accepted",
        `Generic1 valid: ${generic1.isValid}, Generic2 valid: ${generic2.isValid}, TooShort valid: ${tooShort.isValid}, HighQuality valid: ${highQuality.isValid}`
      );
    } catch (err: any) {
      recordAudit("SEC-09", "Anti-Spam Guardrails", "Anti-spam filter", false, "Protected", err.message);
    }

    // ------------------------------------------------------------------------
    // SEC-10: Emergency Killswitch Enforcement
    // ------------------------------------------------------------------------
    try {
      // Restore healthy status first, then trigger explicit user pause
      await db
        .update(linkedinAccounts)
        .set({ healthStatus: "HEALTHY", automationStatus: "RUNNING" })
        .where(eq(linkedinAccounts.userId, userAId));

      await accountSafetyService.pauseAutomation(userAId, "Admin emergency freeze");
      const checkAfterPause = await accountSafetyService.verifyPreFlight(userAId, "VIEW");
      const passed = Boolean(checkAfterPause.allowed === false && checkAfterPause.reason?.includes("PAUSED"));

      recordAudit(
        "SEC-10",
        "Emergency Killswitch",
        "Instant freeze blocks all subsequent background queue dispatches",
        passed,
        "allowed = false with reason indicating PAUSED state",
        `allowed: ${checkAfterPause.allowed}, reason: "${checkAfterPause.reason}"`
      );
    } catch (err: any) {
      recordAudit("SEC-10", "Emergency Killswitch", "Emergency killswitch", false, "Halted", err.message);
    }

    // ------------------------------------------------------------------------
    // SEC-11: Data Isolation & Multi-Tenant Scoping (IDOR Immunity)
    // ------------------------------------------------------------------------
    try {
      // Insert a private contact for User B
      const [contactB] = await db
        .insert(contacts)
        .values({
          userId: userBId,
          name: "Confidential Enterprise Prospect",
          linkedinId: `secret_prospect_${timestamp}`,
          company: "Stealth Corp",
          status: "HOT_LEAD",
        })
        .returning();

      // 1. Service Layer: Query User A's contacts
      const userAContacts = await crmService.getContactsByStage(userAId);
      const leakedContact = userAContacts.find((c) => c.id === contactB?.id);

      // 2. Service Layer: Attempt unauthorized cross-tenant mutation
      let crossTenantMutationBlocked = false;
      try {
        if (contactB) {
          await crmService.updateContactStage(userAId, contactB.id, "WON");
        }
      } catch {
        crossTenantMutationBlocked = true;
      }

      // 3. HTTP Layer (IDOR): User A attempts to view User B's conversation history
      let httpConversationBlocked = false;
      if (contactB) {
        const idorConvRes = await fetch(`${BASE_URL}/api/conversations/${contactB.id}/messages`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });
        httpConversationBlocked = idorConvRes.status === 404;
      }

      // 4. HTTP Layer (IDOR): User A attempts query param override (?userId=userBId) on /dashboard/contacts
      const idorDashboardRes = await fetch(`${BASE_URL}/api/dashboard/contacts?userId=${userBId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const idorDashboardData: any = await idorDashboardRes.json().catch(() => ({}));
      const foreignContactLeaked = Array.isArray(idorDashboardData?.data)
        ? idorDashboardData.data.some((c: any) => c.id === contactB?.id)
        : false;

      // 5. Unauthenticated access blocked on dashboard & linkedin routes
      const unauthDashRes = await fetch(`${BASE_URL}/api/dashboard/overview`);
      const unauthLinkedinRes = await fetch(`${BASE_URL}/api/linkedin/account`);
      const unauthBlocked = unauthDashRes.status === 401 && unauthLinkedinRes.status === 401;

      const passed = Boolean(
        userAContacts.length >= 0 &&
        leakedContact === undefined &&
        crossTenantMutationBlocked &&
        httpConversationBlocked &&
        !foreignContactLeaked &&
        unauthBlocked
      );

      recordAudit(
        "SEC-11",
        "Data Isolation (IDOR)",
        "Strict user scoping ensures tenant data is shielded from foreign read & write across DB and HTTP APIs",
        passed,
        "User B's contact is never read or mutated across User A's context, query param injection ignored, routes require auth",
        `Leaked contact: ${Boolean(leakedContact)}, Cross-tenant write blocked: ${crossTenantMutationBlocked}, HTTP IDOR blocked: ${httpConversationBlocked}, Query param override defeated: ${!foreignContactLeaked}, Unauth routes blocked: ${unauthBlocked}`
      );
    } catch (err: any) {
      recordAudit("SEC-11", "Data Isolation (IDOR)", "Data scoping check", false, "Isolated", err.message);
    }

    // ------------------------------------------------------------------------
    // SEC-12: Environment & Secret Hygiene
    // ------------------------------------------------------------------------
    try {
      const gitignorePath = path.resolve(__dirname, "../../../.gitignore");
      const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";

      const envIgnored = gitignoreContent.includes(".env*");
      const hasJwtSecret = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16);

      const passed = envIgnored && hasJwtSecret;

      recordAudit(
        "SEC-12",
        "Secret Hygiene",
        ".env files gitignored and cryptographically strong JWT secret present",
        passed,
        ".gitignore contains '.env*' and JWT_SECRET is configured with >= 16 chars",
        `.env* in .gitignore: ${envIgnored}, JWT_SECRET configured: ${hasJwtSecret}`
      );
    } catch (err: any) {
      recordAudit("SEC-12", "Secret Hygiene", "Secret hygiene audit", false, "Clean", err.message);
    }

    // ------------------------------------------------------------------------
    // Cleanup audit records created during test
    // ------------------------------------------------------------------------
    try {
      if (userAId) {
        await db.delete(actionQueue).where(eq(actionQueue.userId, userAId));
        await db.delete(linkedinAccounts).where(eq(linkedinAccounts.userId, userAId));
        await db.delete(users).where(eq(users.id, userAId));
      }
      if (userBId) {
        await db.delete(contacts).where(eq(contacts.userId, userBId));
        await db.delete(users).where(eq(users.id, userBId));
      }
    } catch (cleanupErr: any) {
      console.warn("⚠️ Cleanup notice:", cleanupErr.message);
    }
  } finally {
    // Close database connection pool
    await client.end({ timeout: 5 });
  }

  // ------------------------------------------------------------------------
  // Final Scorecard
  // ------------------------------------------------------------------------
  console.log("\n==========================================================================");
  console.log("📊 SECURITY AUDIT FINAL SUMMARY SCORECARD");
  console.log("==========================================================================");

  const total = auditResults.length;
  const passedCount = auditResults.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Defensive Tests Run : ${total}`);
  console.log(`Tests Passed              : ${passedCount} ✅`);
  console.log(`Tests Failed              : ${failedCount} ${failedCount === 0 ? "🎉" : "❌"}`);
  console.log(`Overall Security Health   : ${passedCount === total ? "100% SECURE" : "VULNERABILITIES DETECTED"}`);
  console.log("==========================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
};

runSecurityAudit();
