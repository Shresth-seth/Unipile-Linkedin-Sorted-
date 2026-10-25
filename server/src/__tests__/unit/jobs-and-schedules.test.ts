import { describe, it, expect, vi, beforeEach } from "vitest";
import { actionQueueService } from "../../services/queue/queue.service.js";
import { accountSafetyService } from "../../services/safety/safety.service.js";
import { dailyAgentService } from "../../agent/daily/daily-agent.service.js";
import { linkedInMessageService } from "../../services/linkedin/message.service.js";
import { db } from "../../db/index.js";
import { DateTime } from "luxon";

describe("WP-06: Reliable Jobs, Schedules & Worker State Machine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Action Queue Atomic CAS Lock Claiming & Concurrency", () => {
    it("claims queued job atomically via CAS and skips if already claimed by another worker", async () => {
      const mockJob = {
        id: "job-atomic-1",
        userId: "user-1",
        contactId: "contact-1",
        actionType: "MESSAGE",
        payload: { recipientId: "recip-1", message: "Hello" },
        status: "QUEUED",
        scheduledFor: new Date(Date.now() - 10000),
        attempts: 0,
      };

      // Mock select returning the due job
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockJob]),
          }),
        }),
      } as any);

      // First worker call claims successfully; second worker call returns empty (already claimed)
      vi.spyOn(db, "update")
        // reclaim transient stale locks
        .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any)
        // mark exhausted stale locks
        .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any)
        // CAS claim attempt: returns empty (lost race)
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any);

      const msgSpy = vi.spyOn(linkedInMessageService, "sendMessage");

      const result = await actionQueueService.processDueActions("user-1");

      // When CAS claim returns empty, job is skipped with zero side effects
      expect(result.processed).toBe(0);
      expect(msgSpy).not.toHaveBeenCalled();
    });
  });

  describe("2. Opt-Out Immediate Dispatch Prevention (AccountSafetyService & ActionQueue)", () => {
    it("accountSafetyService.verifyPreFlight rejects queued action if contact has opted out", async () => {
      // Mock account lookup (healthy & connected)
      vi.spyOn(db, "select")
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "acc-1",
                  userId: "user-1",
                  isConnected: true,
                  healthStatus: "HEALTHY",
                  automationStatus: "RUNNING",
                  dailyMessagesLimit: 50,
                  dailyConnectionsLimit: 25,
                },
              ]),
            }),
          }),
        } as any)
        // Mock message count check
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        } as any)
        // Mock contact lookup: contact has optedOut = true
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "contact-optout-1",
                  userId: "user-1",
                  name: "Alex Vance",
                  optedOut: true,
                  optedOutAt: new Date(),
                },
              ]),
            }),
          }),
        } as any);

      const safetyResult = await accountSafetyService.verifyPreFlight(
        "user-1",
        "MESSAGE",
        "contact-optout-1",
        undefined,
        "Follow up text",
      );

      expect(safetyResult.allowed).toBe(false);
      expect(safetyResult.reason).toContain("opted out of automated communications");
      expect(safetyResult.circuitBreakerTriggered).toBe(false);
    });

    it("processDueActions marks job as SKIPPED and suppresses provider call when contact opted out", async () => {
      const mockJob = {
        id: "job-optout-test",
        userId: "user-1",
        contactId: "contact-optout-1",
        actionType: "MESSAGE",
        payload: { recipientId: "recip-1", message: "Hey there" },
        status: "QUEUED",
        scheduledFor: new Date(Date.now() - 5000),
        attempts: 0,
      };

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockJob]),
          }),
        }),
      } as any);

      // update mocks: stale recovery 1, stale recovery 2, CAS claim, status=SKIPPED update
      const updateStatusSpy = vi.fn().mockResolvedValue([]);
      vi.spyOn(db, "update")
        .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any)
        .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any)
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: mockJob.id }]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          set: vi.fn().mockImplementation((setVals) => {
            expect(setVals.status).toBe("SKIPPED");
            expect(setVals.errorMessage).toContain("opted out");
            return {
              where: updateStatusSpy,
            };
          }),
        } as any);

      vi.spyOn(accountSafetyService, "verifyPreFlight").mockResolvedValue({
        allowed: false,
        reason: "Contact Alex Vance has opted out of automated communications.",
        circuitBreakerTriggered: false,
      });

      const providerMessageSpy = vi.spyOn(linkedInMessageService, "sendMessage");

      const result = await actionQueueService.processDueActions("user-1");

      expect(result.processed).toBe(1);
      expect(result.results[0]?.status).toBe("SKIPPED");
      expect(result.results[0]?.reason).toContain("opted out");
      expect(providerMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe("3. Ambiguous Provider Outcome Idempotency", () => {
    it("marks job as COMPLETED with error note if provider succeeds but secondary DB record update fails", async () => {
      const mockJob = {
        id: "job-ambig-1",
        userId: "user-1",
        contactId: "contact-1",
        actionType: "MESSAGE",
        payload: { recipientId: "recip-1", message: "Hello" },
        status: "QUEUED",
        scheduledFor: new Date(Date.now() - 5000),
        attempts: 0,
      };

      vi.spyOn(db, "select")
        // due jobs query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJob]),
            }),
          }),
        } as any)
        // user account query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: "acc-1",
                userId: "user-1",
                unipileAccountId: "unipile_acc_1",
                isConnected: true,
                healthStatus: "HEALTHY",
              },
            ]),
          }),
        } as any)
        // owned contact query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "contact-1" }]),
            }),
          }),
        } as any);

      // CAS claim success
      vi.spyOn(db, "update")
        .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any)
        .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any)
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: mockJob.id }]),
            }),
          }),
        } as any)
        // Simulating secondary DB update failure on contact record
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error("Database connection dropped during contact timestamp update")),
          }),
        } as any)
        // Final update sets COMPLETED with ambiguous error message to prevent blind resend
        .mockReturnValueOnce({
          set: vi.fn().mockImplementation((setVals) => {
            expect(setVals.status).toBe("COMPLETED");
            expect(setVals.errorMessage).toContain("Provider action succeeded, but secondary record update failed");
            return { where: vi.fn().mockResolvedValue([]) };
          }),
        } as any);

      vi.spyOn(accountSafetyService, "verifyPreFlight").mockResolvedValue({
        allowed: true,
      });

      // Provider call successfully executed
      vi.spyOn(linkedInMessageService, "sendMessage").mockResolvedValue({
        success: true,
        message: "Message sent via Unipile",
      });

      const result = await actionQueueService.processDueActions("user-1");

      expect(result.processed).toBe(1);
      expect(result.results[0]?.status).toBe("COMPLETED");
      expect(result.results[0]?.reason).toContain("Provider action succeeded, but secondary record update failed");
    });
  });

  describe("4. Daily Agent Atomic Idempotency Key & Concurrent Lock", () => {
    it("skips execution cleanly when runKey is already claimed by another active worker", async () => {
      const mockSettings = {
        userId: "user-daily-1",
        dailyAgentEnabled: true,
        preferredDailyStartTime: "04:00",
        timezone: "America/New_York",
      };

      vi.spyOn(db, "select")
        // user settings query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockSettings]),
            }),
          }),
        } as any)
        // check for existing completed run (returns empty initially)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any)
        // check for existing active run in check-then-act (returns empty)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any)
        // inspection of existing record after onConflictDoNothing: already claimed as RUNNING
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "run-existing-1",
                  status: "RUNNING",
                  startedAt: new Date(), // Active, not stale
                },
              ]),
            }),
          }),
        } as any);

      // Worker 2 attempts atomic insert on dailyAgentRuns: returns empty because Worker 1 already inserted it
      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const runResult = await dailyAgentService.runForUser("user-daily-1", false);

      expect(runResult.status).toBe("SKIPPED");
      expect(runResult.summary).toContain("already claimed");
    });
  });

  describe("5. Timezone & Schedule Boundary Calculation", () => {
    it("calculateNextDailyRun calculates correct next run in target timezone", () => {
      const nextNy = dailyAgentService.calculateNextDailyRun("04:00", "America/New_York");
      const nextKolkata = dailyAgentService.calculateNextDailyRun("04:00", "Asia/Kolkata");
      const nextUtc = dailyAgentService.calculateNextDailyRun("04:00", "UTC");

      expect(nextNy).toBeInstanceOf(Date);
      expect(nextKolkata).toBeInstanceOf(Date);
      expect(nextUtc).toBeInstanceOf(Date);
      // New York and Kolkata must have different UTC epoch times for 04:00 wall clock
      expect(nextNy.getTime()).not.toBe(nextKolkata.getTime());
    });

    it("calculateNextDailyRun falls back gracefully to UTC on invalid or missing timezone", () => {
      const nextFallback = dailyAgentService.calculateNextDailyRun("04:00", "Invalid/Timezone");
      expect(nextFallback).toBeInstanceOf(Date);
      expect(isNaN(nextFallback.getTime())).toBe(false);
    });

    it("calculateNextDailyRun sanitizes malformed time strings without NaN", () => {
      const nextMalformed1 = dailyAgentService.calculateNextDailyRun("invalid-time", "UTC");
      const nextMalformed2 = dailyAgentService.calculateNextDailyRun("25:99", "UTC");
      const nextMalformed3 = dailyAgentService.calculateNextDailyRun("", "UTC");

      expect(nextMalformed1).toBeInstanceOf(Date);
      expect(isNaN(nextMalformed1.getTime())).toBe(false);
      expect(nextMalformed2).toBeInstanceOf(Date);
      expect(isNaN(nextMalformed2.getTime())).toBe(false);
      expect(nextMalformed3).toBeInstanceOf(Date);
      expect(isNaN(nextMalformed3.getTime())).toBe(false);
    });
  });

  describe("6. Timezone-Aware Outbound Action Enqueuing", () => {
    it("enqueue adjusts delay outside business hours based on specified timezone", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      let capturedScheduledFor: Date | undefined;
      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          capturedScheduledFor = val.scheduledFor;
          return {
            returning: vi.fn().mockResolvedValue([{ id: "job-tz-1", ...val }]),
          };
        }),
      } as any);

      await actionQueueService.enqueue(
        "user-1",
        "MESSAGE",
        { recipientId: "recip-1", message: "Hi" },
        { delayMinutes: 10, timezone: "America/New_York" },
      );

      expect(capturedScheduledFor).toBeDefined();
      const nyTime = DateTime.fromJSDate(capturedScheduledFor!).setZone("America/New_York");
      // Hour in New York must be within business hours (8:00 to 19:00)
      expect(nyTime.hour).toBeGreaterThanOrEqual(8);
      expect(nyTime.hour).toBeLessThan(19);
    });

    it("enqueue with delayMinutes: 0 bypasses business hours adjustment for immediate actions", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      let capturedScheduledFor: Date | undefined;
      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          capturedScheduledFor = val.scheduledFor;
          return {
            returning: vi.fn().mockResolvedValue([{ id: "job-immediate-1", ...val }]),
          };
        }),
      } as any);

      const before = Date.now();
      await actionQueueService.enqueue(
        "user-1",
        "MESSAGE",
        { recipientId: "recip-1", message: "Immediate" },
        { delayMinutes: 0 },
      );

      expect(capturedScheduledFor).toBeDefined();
      // Should be scheduled right now (within 1 second)
      expect(capturedScheduledFor!.getTime() - before).toBeLessThan(1000);
    });
  });
});
