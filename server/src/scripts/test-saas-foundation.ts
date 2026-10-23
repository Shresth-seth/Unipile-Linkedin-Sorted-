import assert from "node:assert/strict";
import crypto from "node:crypto";
import { razorpayService } from "../services/billing/razorpay.service.js";
import { validateProductionConfig } from "../config/production.config.js";
import { decryptData, decryptStoredSecret, encryptData, encryptSecret } from "../utils/crypto.util.js";

async function run() {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  try {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "provider-secret";
    process.env.RAZORPAY_PLAN_PRO_MONTHLY = "plan_pro_monthly";
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret-for-tests";

    let requestBody: any;
    globalThis.fetch = (async (_url: any, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "sub_test", status: "created", short_url: "https://rzp.io/test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const checkout = await razorpayService.createSubscription({
      userId: "user-test",
      email: "test@example.com",
      plan: "PRO",
      cycle: "monthly",
    });
    assert.equal(checkout.id, "sub_test");
    assert.equal(requestBody.plan_id, "plan_pro_monthly");
    assert.equal(requestBody.notes.workpilot_user_id, "user-test");

    const payload = Buffer.from('{"event":"subscription.activated"}');
    const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(payload).digest("hex");
    assert.equal(razorpayService.verifyWebhook(payload, signature), true);
    assert.equal(razorpayService.verifyWebhook(payload, "invalid"), false);

    const encrypted = encryptData({ credential: "sensitive" });
    assert.ok(encrypted.startsWith("v2:"));
    assert.deepEqual(decryptData(encrypted), { credential: "sensitive" });
    const encryptedSecret = encryptSecret("provider-key");
    assert.ok(encryptedSecret.startsWith("v2:"));
    assert.equal(decryptStoredSecret(encryptedSecret), "provider-key");
    assert.equal(decryptStoredSecret("legacy-plaintext-key"), "legacy-plaintext-key");

    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "j".repeat(40);
    process.env.DATA_ENCRYPTION_KEY = "e".repeat(40);
    process.env.UNIPILE_WEBHOOK_SECRET = "u".repeat(40);
    process.env.UNIPILE_DSN = "https://api1.unipile.com:13200";
    process.env.UNIPILE_API_KEY = "unipile-provider-key";
    process.env.RAZORPAY_KEY_SECRET = "provider-secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "r".repeat(40);
    process.env.RAZORPAY_KEY_ID = "rzp_live_test";
    process.env.RAZORPAY_PLAN_PRO_MONTHLY = "plan_1";
    process.env.RAZORPAY_PLAN_PRO_YEARLY = "plan_2";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "WORKPILOT <no-reply@example.com>";
    process.env.SUPPORT_EMAIL = "support@example.com";
    process.env.DATABASE_URL = "postgresql://db.example/workpilot";
    process.env.CLIENT_URL = "https://linkdin.workpilot.co.in";
    validateProductionConfig();

    console.log("SaaS foundation checks passed.");
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
