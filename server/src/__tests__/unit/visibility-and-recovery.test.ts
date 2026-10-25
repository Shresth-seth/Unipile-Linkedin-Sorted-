import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { generateToken } from "../../utils/jwt.util.js";
import { db } from "../../db/index.js";
import { accountSafetyService } from "../../services/safety/safety.service.js";
import { actionQueueService } from "../../services/queue/queue.service.js";

describe("WP-11: Visibility, Health Probes & Emergency Recovery", () => {
  const testUser = {
    userId: "uuid-recovery-test-user",
    email: "recovery@example.com",
    role: "USER",
    sessionVersion: 0,
  };
  const userToken = generateToken(testUser);

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default mock for user lookup in auth middleware
    vi.spyOn(db, "select").mockImplementation((_fields?: any) => {
      const mockResult = [
        {
          id: testUser.userId,
          userId: testUser.userId,
          role: testUser.role,
          email: testUser.email,
          sessionVersion: 0,
          emailVerifiedAt: new Date(),
        },
      ];
      return {
        from: (_table: any) => ({
          where: (_cond: any) => ({
            limit: async (_n?: number) => mockResult,
            orderBy: () => ({ limit: async () => mockResult }),
            then: (resolve: any) => Promise.resolve(mockResult).then(resolve),
          }),
        }),
      } as any;
    });

    vi.spyOn(db, "update").mockImplementation((_table: any) => ({
      set: () => ({
        where: () => {
          const promise: any = Promise.resolve([]);
          promise.returning = vi.fn().mockResolvedValue([{ id: "job-1" }]);
          return promise;
        },
      }),
    } as any));
  });

  // ==========================================================================
  // 1. Health Probes (Liveness & Readiness)
  // ==========================================================================
  describe("Health Monitoring Endpoints", () => {
    it("GET /api/health/liveness returns 200 with status, version, uptime, and memory metrics", async () => {
      const res = await request(app).get("/api/health/liveness");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.version).toBeDefined();
      expect(typeof res.body.uptimeSeconds).toBe("number");
      expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.memory).toBeDefined();
      expect(res.body.memory.rssBytes).toBeGreaterThan(0);
      expect(res.body.memory.heapUsedBytes).toBeGreaterThan(0);
      expect(res.body.timestamp).toBeDefined();
    });

    it("GET /api/health/readiness returns 200 when database connectivity succeeds", async () => {
      vi.spyOn(db, "execute").mockResolvedValue({ rows: [{ "?column?": 1 }] } as any);

      const res = await request(app).get("/api/health/readiness");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ready");
      expect(res.body.database).toBe("connected");
      expect(res.body.timestamp).toBeDefined();
    });

    it("GET /api/health/readiness returns 503 fail-closed when database is unreachable", async () => {
      vi.spyOn(db, "execute").mockRejectedValue(new Error("Connection terminated unexpectedly"));

      const res = await request(app).get("/api/health/readiness");

      expect(res.status).toBe(503);
      expect(res.body.status).toBe("not_ready");
      expect(res.body.database).toBe("disconnected");
      expect(res.body.error).toContain("Connection terminated");
    });
  });

  // ==========================================================================
  // 2. Emergency Recovery & Killswitch Probing
  // ==========================================================================
  describe("Emergency Killswitch & Recovery Operations", () => {
    it("POST /api/dashboard/emergency-pause activates instant automation freeze strictly for user", async () => {
      const pauseSpy = vi.spyOn(accountSafetyService, "pauseAutomation").mockResolvedValue(true);

      const res = await request(app)
        .post("/api/dashboard/emergency-pause")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ reason: "Unusual activity detected by tenant" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Emergency pause activated");
      expect(pauseSpy).toHaveBeenCalledWith(testUser.userId, "Unusual activity detected by tenant");
    });

    it("POST /api/dashboard/resume reactivates queue processing strictly for user", async () => {
      const resumeSpy = vi.spyOn(accountSafetyService, "resumeAutomation").mockResolvedValue(true);

      const res = await request(app)
        .post("/api/dashboard/resume")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Automation resumed");
      expect(resumeSpy).toHaveBeenCalledWith(testUser.userId);
    });

    it("GET /api/dashboard/account-health returns live quotas and health metrics", async () => {
      vi.spyOn(accountSafetyService, "getAccountHealth").mockResolvedValue({
        hasAccount: true,
        isConnected: true,
        healthStatus: "HEALTHY",
        automationStatus: "RUNNING",
        dailyLimits: {
          connections: { limit: 25, usedToday: 5, remaining: 20 },
          messages: { limit: 50, usedToday: 10, remaining: 40 },
        },
      } as any);

      const res = await request(app)
        .get("/api/dashboard/account-health")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.healthStatus).toBe("HEALTHY");
      expect(res.body.data.dailyLimits.connections.remaining).toBe(20);
    });
  });

  // ==========================================================================
  // 3. Stale Lock Recovery in Background Worker
  // ==========================================================================
  describe("Queue Worker Stale Lock & Failure Recovery", () => {
    it("processDueActions executes stale lock cleanup and marks exhausted retries FAILED", async () => {
      const updateCalls: any[] = [];
      vi.spyOn(db, "update").mockImplementation((_table: any) => ({
        set: (values: any) => {
          updateCalls.push(values);
          return {
            where: () => {
              const promise: any = Promise.resolve([]);
              promise.returning = vi.fn().mockResolvedValue([]);
              return promise;
            },
          };
        },
      } as any));

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await actionQueueService.processDueActions(testUser.userId);

      expect(result.processed).toBe(0);
      // Verify stale lock cleanup query was executed in first batch
      const exhaustedUpdate = updateCalls.find(
        (call) => call.status === "FAILED" && call.errorMessage?.includes("timed out"),
      );
      expect(exhaustedUpdate).toBeDefined();
    });
  });
});
