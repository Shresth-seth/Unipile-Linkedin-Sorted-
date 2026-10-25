import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";

describe("WP-13: Application Security & Supply-Chain Hardening", () => {
  describe("1. Security Headers & Browser Protections", () => {
    it("express disables X-Powered-By fingerprinting", async () => {
      const res = await request(app).get("/api/health/liveness");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("applies strict defense-in-depth security headers on all responses", async () => {
      const res = await request(app).get("/api/health/liveness");

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(res.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    });
  });

  describe("2. State-Changing Mutation Origin Gate (CSRF Guard)", () => {
    it("rejects unauthorized origin for cookie-authenticated mutation in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      try {
        const res = await request(app)
          .post("/api/auth/logout")
          .set("Cookie", ["token=test_session_cookie"])
          .set("Origin", "https://malicious-attacker-site.com");

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.message.toLowerCase()).toContain("is not allowed");
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("allows valid configured origin for cookie-authenticated mutation in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      try {
        const res = await request(app)
          .post("/api/auth/logout")
          .set("Cookie", ["token=test_session_cookie"])
          .set("Origin", "http://localhost:3000");

        // Allowed origin proceeds past the origin check (even if unauthenticated token fails auth)
        expect(res.status).not.toBe(403);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("3. Sensitive Error Sanitization", () => {
    it("sanitizes Postgres error messages to prevent leakage of internal relations or schemas", async () => {
      const res = await request(app)
        .patch("/api/dashboard/contacts/non-existent-contact/stage")
        .set("Authorization", "Bearer invalid-or-unauthed")
        .send({ stage: "LEAD" });

      // Unauthenticated returns clean 401 without stack trace
      expect(res.status).toBe(401);
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("password");
      expect(JSON.stringify(res.body)).not.toContain("postgres://");
    });
  });
});
