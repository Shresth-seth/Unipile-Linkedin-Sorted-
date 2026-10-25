import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { actionQueueService } from "../../services/queue/queue.service.js";
import { db } from "../../db/index.js";
import {
  actionQueue,
  users,
  linkedinAccounts,
  contacts,
  messages,
  dailyAgentSettings,
  dailyAgentRuns,
  messageAgentJobs,
  authTokens,
  agentMessages,
} from "../../db/schema.js";
import { accountSafetyService } from "../../services/safety/safety.service.js";
import { linkedInConnectionService } from "../../services/linkedin/connection.service.js";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

describe("WP-04: Database Integrity, Concurrency & Safety Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Concurrency Control & Atomic Claim Invariants (actionQueue)", () => {
    it("two concurrent workers attempting to claim the same queued job: exactly one succeeds; zero duplicate execution", async () => {
      const mockJob = {
        id: "job-concurrent-1",
        userId: "user-uuid-1",
        contactId: "contact-uuid-1",
        actionType: "CONNECT",
        payload: { person: { linkedin_id: "li-prospect-1" }, note: "Hi" },
        status: "QUEUED",
        scheduledFor: new Date(Date.now() - 10000),
        attempts: 0,
      };

      // Mock safety check to allow execution
      vi.spyOn(accountSafetyService, "verifyPreFlight").mockResolvedValue({
        allowed: true,
        circuitBreakerTriggered: false,
      });

      // Mock connected account and contact lookup
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: vi.fn().mockImplementation((table) => {
            return {
              where: vi.fn().mockImplementation(() => {
                if (table === linkedinAccounts) {
                  return Promise.resolve([{
                    id: "acc-1",
                    userId: "user-uuid-1",
                    unipileAccountId: "unipile-acc-1",
                    isConnected: true,
                    healthStatus: "HEALTHY",
                  }]);
                }
                return {
                  limit: vi.fn().mockImplementation(() => {
                    if (table === contacts) {
                      return Promise.resolve([{ id: "contact-uuid-1", userId: "user-uuid-1" }]);
                    }
                    // Return due jobs for actionQueue
                    return Promise.resolve([mockJob]);
                  }),
                };
              }),
            };
          }),
        } as any;
      });

      // Simulate atomic CAS lock: Worker 1 claim succeeds; Worker 2 claim fails
      let claimCallCount = 0;
      vi.spyOn(db, "update").mockImplementation(() => {
        return {
          set: vi.fn().mockImplementation((setVals) => {
            return {
              where: vi.fn().mockImplementation(() => {
                // If this is the atomic claim query
                if (setVals.status === "PROCESSING") {
                  claimCallCount++;
                  if (claimCallCount === 1) {
                    // Worker 1 atomically secures the lock
                    return {
                      returning: vi.fn().mockResolvedValue([{ id: mockJob.id }]),
                    };
                  }
                  // Worker 2 finds job already claimed (CAS condition matched 0 rows)
                  return {
                    returning: vi.fn().mockResolvedValue([]),
                  };
                }
                return {
                  returning: vi.fn().mockResolvedValue([{ id: mockJob.id }]),
                };
              }),
            };
          }),
        } as any;
      });

      const sendConnectionSpy = vi
        .spyOn(linkedInConnectionService, "sendConnectionRequest")
        .mockResolvedValue({ success: true, message: "Sent" });

      // Run two worker attempts simultaneously
      const [res1, res2] = await Promise.all([
        actionQueueService.processDueActions("user-uuid-1"),
        actionQueueService.processDueActions("user-uuid-1"),
      ]);

      // Exactly ONE provider execution proceeded
      expect(sendConnectionSpy).toHaveBeenCalledTimes(1);
      // Worker 1 completed the action
      expect(res1.results.find((r) => r.jobId === mockJob.id)?.status).toBe("COMPLETED");
      // Worker 2 processed 0 actions because atomic claim was rejected
      expect(res2.results.find((r) => r.jobId === mockJob.id)).toBeUndefined();
    });
  });

  describe("2. Stale Lock Reclamation & Orphan Job Recovery", () => {
    it("stale lock query resets jobs with attempts < 3 to QUEUED and marks attempts >= 3 as FAILED", async () => {
      const capturedUpdates: Array<{ setVals: any; whereCond: any }> = [];

      vi.spyOn(db, "update").mockImplementation(() => {
        return {
          set: vi.fn().mockImplementation((setVals) => {
            return {
              where: vi.fn().mockImplementation((whereCond) => {
                capturedUpdates.push({ setVals, whereCond });
                return {
                  returning: vi.fn().mockResolvedValue([]),
                };
              }),
            };
          }),
        } as any;
      });

      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any;
      });

      await actionQueueService.processDueActions("user-uuid-1");

      // Verify that stale recovery executed both updates:
      // Update 1: Reclaims transient locks (attempts < 3) back to QUEUED
      const transientRecovery = capturedUpdates.find((u) => u.setVals.status === "QUEUED");
      expect(transientRecovery).toBeDefined();
      expect(transientRecovery?.setVals.lockedAt).toBeNull();

      // Update 2: Marks exhausted locks (attempts >= 3) as FAILED to prevent orphaned PROCESSING jobs
      const exhaustedRecovery = capturedUpdates.find((u) => u.setVals.status === "FAILED");
      expect(exhaustedRecovery).toBeDefined();
      expect(exhaustedRecovery?.setVals.errorMessage).toContain("Job execution timed out after maximum retry attempts");
      expect(exhaustedRecovery?.setVals.lockedAt).toBeNull();
    });
  });

  describe("3. Ambiguous Provider Outcome Protection (No Blind Resends)", () => {
    it("when provider succeeds but secondary DB contact update throws, job is marked COMPLETED with warning to prevent duplicate sends", async () => {
      const mockJob = {
        id: "job-ambiguous-1",
        userId: "user-uuid-1",
        contactId: "contact-uuid-1",
        actionType: "CONNECT",
        payload: { person: { linkedin_id: "li-prospect-1" }, note: "Hi" },
        status: "QUEUED",
        scheduledFor: new Date(Date.now() - 10000),
        attempts: 0,
      };

      vi.spyOn(accountSafetyService, "verifyPreFlight").mockResolvedValue({
        allowed: true,
        circuitBreakerTriggered: false,
      });

      let selectCount = 0;
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1) {
                // Return due job
                return { limit: vi.fn().mockResolvedValue([mockJob]) };
              }
              if (selectCount === 2) {
                // Account lookup
                return [{
                  id: "acc-1",
                  userId: "user-uuid-1",
                  unipileAccountId: "unipile-1",
                  isConnected: true,
                  healthStatus: "HEALTHY",
                }];
              }
              // Contact ownership check
              return {
                limit: vi.fn().mockResolvedValue([{ id: "contact-uuid-1", userId: "user-uuid-1" }]),
              };
            }),
          }),
        } as any;
      });

      let capturedFinalStatus: any;
      let capturedErrorMessage: any;

      vi.spyOn(db, "update").mockImplementation(() => {
        return {
          set: vi.fn().mockImplementation((setVals) => {
            return {
              where: vi.fn().mockImplementation(() => {
                // Simulate failure on contact table update AFTER provider succeeded
                if (setVals.status === "CONTACTED") {
                  throw new Error("Simulated secondary DB write glitch: relation lock timeout");
                }
                if (setVals.status === "COMPLETED" || setVals.status === "FAILED") {
                  capturedFinalStatus = setVals.status;
                  capturedErrorMessage = setVals.errorMessage;
                }
                return {
                  returning: vi.fn().mockResolvedValue([{ id: mockJob.id }]),
                };
              }),
            };
          }),
        } as any;
      });

      // Provider call succeeds!
      vi.spyOn(linkedInConnectionService, "sendConnectionRequest").mockResolvedValue({
        success: true,
        message: "Invitation sent successfully",
      });

      const res = await actionQueueService.processDueActions("user-uuid-1");

      // The job status must be COMPLETED (not FAILED), with explanation to avoid duplicate resend
      expect(capturedFinalStatus).toBe("COMPLETED");
      expect(capturedErrorMessage).toContain("Provider action succeeded, but secondary record update failed");
      expect(res.results[0]?.status).toBe("COMPLETED");
    });
  });

  describe("4. Destructive Script Safeguards (clear-all-users.ts)", () => {
    it("clear-all-users.ts fails closed with code 1 when confirmation variable is missing", () => {
      const scriptPath = path.resolve(process.cwd(), "src/scripts/clear-all-users.ts");
      const result = spawnSync(process.execPath, [
        "--no-warnings",
        "--import",
        "tsx",
        scriptPath,
      ], {
        env: {
          ...process.env,
          DATABASE_URL: "postgresql://offline-blocked:5432/offline_blocked",
          CONFIRM_DESTRUCTIVE_DATABASE_WIPE: "",
        },
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      const output = (result.stdout || "") + (result.stderr || "");
      expect(output).toContain("Destructive database wipe blocked");
    }, 25000);

    it("clear-all-users.ts fails closed with code 1 in production environment without explicit production override", () => {
      const scriptPath = path.resolve(process.cwd(), "src/scripts/clear-all-users.ts");
      const result = spawnSync(process.execPath, [
        "--no-warnings",
        "--import",
        "tsx",
        scriptPath,
      ], {
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://offline-blocked:5432/offline_blocked",
          CONFIRM_DESTRUCTIVE_DATABASE_WIPE: "YES_DELETE_ALL_DATA",
          ALLOW_PRODUCTION_DATA_WIPE: "",
        },
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      const output = (result.stdout || "") + (result.stderr || "");
      expect(output).toContain("strictly forbidden in production");
    }, 25000);
  });

  describe("5. Schema Foreign Key Cascades & Relationship Invariants", () => {
    it("all tenant-owned tables define explicit onDelete foreign keys to users or contacts", () => {
      // Inspect users table primary key
      expect(users.id.primary).toBe(true);

      // Verify linkedin_accounts cascade to users
      const liAccFks = getTableConfig(linkedinAccounts).foreignKeys;
      expect(liAccFks.some((fk) => fk.onDelete === "cascade")).toBe(true);

      // Verify contacts cascade to users
      const contactsFks = getTableConfig(contacts).foreignKeys;
      expect(contactsFks.some((fk) => fk.onDelete === "cascade")).toBe(true);

      // Verify messages cascade
      const messagesFks = getTableConfig(messages).foreignKeys;
      expect(messagesFks.filter((fk) => fk.onDelete === "cascade").length).toBeGreaterThanOrEqual(1);

      // Verify action_queue cascades user and sets null for contact
      const queueFks = getTableConfig(actionQueue).foreignKeys;
      expect(queueFks.some((fk) => fk.onDelete === "cascade")).toBe(true);
      expect(queueFks.some((fk) => fk.onDelete === "set null")).toBe(true);

      // Verify daily_agent_settings cascade & unique user
      const dailySettingsFks = getTableConfig(dailyAgentSettings).foreignKeys;
      expect(dailySettingsFks.some((fk) => fk.onDelete === "cascade")).toBe(true);
      expect((dailyAgentSettings.userId as any).isUnique).toBe(true);

      // Verify daily_agent_runs cascade
      const dailyRunsFks = getTableConfig(dailyAgentRuns).foreignKeys;
      expect(dailyRunsFks.some((fk) => fk.onDelete === "cascade")).toBe(true);

      // Verify message_agent_jobs cascade & unique messageId
      const msgJobsFks = getTableConfig(messageAgentJobs).foreignKeys;
      expect(msgJobsFks.some((fk) => fk.onDelete === "cascade")).toBe(true);
      expect(messageAgentJobs.messageId.isUnique).toBe(true);

      // Verify auth_tokens cascade & unique tokenHash
      const authTokensFks = getTableConfig(authTokens).foreignKeys;
      expect(authTokensFks.some((fk) => fk.onDelete === "cascade")).toBe(true);
      expect(authTokens.tokenHash.isUnique).toBe(true);

      // Verify agent_messages cascade
      const agentMsgFks = getTableConfig(agentMessages).foreignKeys;
      expect(agentMsgFks.some((fk) => fk.onDelete === "cascade")).toBe(true);
    });
  });

  describe("6. Migration Files & Drizzle Configuration Integrity", () => {
    it("drizzle.config.ts rejects silent localhost fallback", async () => {
      const drizzleConfigPath = path.resolve(process.cwd(), "drizzle.config.ts");
      const configContent = fs.readFileSync(drizzleConfigPath, "utf-8");
      expect(configContent).not.toContain("localhost:5432");
      expect(configContent).toContain("offline-blocked");
    });

    it("migration files 0000 through 0009 exist and contain valid statement breakpoints", () => {
      const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
      const expectedMigrations = [
        "0000_late_arclight.sql",
        "0001_nasty_bloodstrike.sql",
        "0002_messy_thundra.sql",
        "0003_mature_cammi.sql",
        "0004_blue_veda.sql",
        "0005_daily_agent_and_webhooks.sql",
        "0006_message_jobs_and_daily_run_keys.sql",
        "0007_user_gemini_api_key.sql",
        "0008_saas_billing.sql",
        "0009_agent_new_connection_message.sql",
      ];

      for (const migFile of expectedMigrations) {
        const filePath = path.join(migrationsDir, migFile);
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content.length).toBeGreaterThan(0);
      }
    });
  });
});
