import { describe, it, expect, vi, beforeEach } from "vitest";
import { linkedInAccountService } from "../../services/linkedin/account.service.js";
import { unipileClient } from "../../services/unipile/unipile.client.js";
import { db } from "../../db/index.js";
import { encryptData, decryptData } from "../../utils/crypto.util.js";

describe("WP-07: LinkedIn Account Lifecycle & Credential Security", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Hosted Auth Link & Credential Connection", () => {
    it("generateAuthLink calls Unipile hosted auth link generator", async () => {
      vi.spyOn(unipileClient, "createHostedAuthLink").mockResolvedValue({
        url: "https://api.unipile.com/hosted/auth/session_123",
      });

      const res = await linkedInAccountService.generateAuthLink("user-1", "https://app.workpilot.io/callback");
      expect(res.url).toBe("https://api.unipile.com/hosted/auth/session_123");
    });

    it("connectWithCredentials encrypts credentials using AES-256-GCM when checkpoint is triggered", async () => {
      vi.spyOn(unipileClient, "connectWithCredentials").mockResolvedValue({
        object: "Checkpoint",
        checkpoint: { type: "2FA" },
        account_id: "unipile_acc_checkpoint",
      });
      vi.spyOn(unipileClient, "getAccount").mockResolvedValue({
        id: "unipile_acc_checkpoint",
        status: "CHECKPOINT",
      });

      let savedEncryptedCreds: string | undefined;
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          savedEncryptedCreds = val.encryptedCredentials;
          return {
            returning: vi.fn().mockResolvedValue([{ id: "acc-new", ...val }]),
          };
        }),
      } as any);

      const res = await linkedInAccountService.connectWithCredentials(
        "user-1",
        "user@example.com",
        "superSecretPassword123!",
        { country: "US" },
      );

      expect(res.checkpoint).toBe(true);
      expect(res.accountId).toBe("unipile_acc_checkpoint");
      expect(savedEncryptedCreds).toBeDefined();
      expect(savedEncryptedCreds?.startsWith("v2:")).toBe(true);

      // Decrypt to verify integrity
      const decrypted = decryptData(savedEncryptedCreds!);
      expect(decrypted.username).toBe("user@example.com");
      expect(decrypted.password).toBe("superSecretPassword123!");
    });
  });

  describe("2. Cookie-Based Connection & Auth Method", () => {
    it("connectWithCookie securely encrypts session cookie and links account", async () => {
      vi.spyOn(unipileClient, "connectWithCookie").mockResolvedValue({
        account_id: "unipile_acc_cookie",
      });

      vi.spyOn(unipileClient, "isConfigured").mockReturnValue(true);
      vi.spyOn(unipileClient, "getAccount").mockResolvedValue({
        id: "unipile_acc_cookie",
        name: "Cookie Connection",
        status: "OK",
        connection_params: { im: { status: "CONNECTED" } },
      });

      let insertedAccount: any;
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          insertedAccount = val;
          return {
            returning: vi.fn().mockResolvedValue([{ id: "acc-cookie-id", ...val }]),
          };
        }),
      } as any);

      const res = await linkedInAccountService.connectWithCookie(
        "user-1",
        "ajax:847291847192847",
        { premiumToken: "li_a_premium_token" },
      );

      expect(res.checkpoint).toBe(false);
      expect(res.accountId).toBe("unipile_acc_cookie");
      expect(insertedAccount.authMethod).toBe("COOKIE");
      expect(insertedAccount.encryptedCredentials.startsWith("v2:")).toBe(true);

      const decrypted = decryptData(insertedAccount.encryptedCredentials);
      expect(decrypted.li_at).toBe("ajax:847291847192847");
      expect(decrypted.li_a).toBe("li_a_premium_token");
    });
  });

  describe("3. Account Status & Silent Auto-Reconnect", () => {
    it("getAccountStatus auto-recovers healthy status via stored credentials when live status degraded", async () => {
      const encryptedCreds = encryptData({
        username: "user@example.com",
        password: "secretPassword",
      });

      const dbAccount = {
        id: "acc-db-1",
        userId: "user-1",
        unipileAccountId: "unipile_acc_old",
        linkedinName: "Test User",
        linkedinEmail: "user@example.com",
        isConnected: true,
        healthStatus: "HEALTHY",
        automationStatus: "RUNNING",
        authMethod: "CREDENTIALS",
        encryptedCredentials: encryptedCreds,
      };

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([dbAccount]),
          }),
        }),
      } as any);

      vi.spyOn(unipileClient, "isConfigured").mockReturnValue(true);
      // Unipile says account is degraded/disconnected
      vi.spyOn(unipileClient, "getAccount").mockResolvedValue({
        id: "unipile_acc_old",
        status: "DISCONNECTED",
        connection_params: { im: { status: "DISCONNECTED" } },
      });

      // Silent auto-reconnect returns successful new connection
      vi.spyOn(linkedInAccountService, "connectWithCredentials").mockResolvedValue({
        checkpoint: false,
        accountId: "unipile_acc_reconnected",
        message: "Reconnected",
      });

      const status = await linkedInAccountService.getAccountStatus("user-1");

      expect(status.isConnected).toBe(true);
      expect(status.healthStatus).toBe("HEALTHY");
      expect(status.automationStatus).toBe("RUNNING");
      expect(status.reconnectionRequired).toBe(false);
    });

    it("getAccountStatus auto-heals DB state when remote status transitions to disconnected", async () => {
      const dbAccount = {
        id: "acc-db-1",
        userId: "user-1",
        unipileAccountId: "unipile_acc_1",
        linkedinName: "Test User",
        linkedinEmail: "user@example.com",
        isConnected: true,
        healthStatus: "HEALTHY",
        automationStatus: "RUNNING",
        authMethod: "HOSTED",
        encryptedCredentials: null, // No stored credentials for auto-reconnect
      };

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([dbAccount]),
          }),
        }),
      } as any);

      vi.spyOn(unipileClient, "isConfigured").mockReturnValue(true);
      // Unipile reports remote disconnected
      vi.spyOn(unipileClient, "getAccount").mockResolvedValue({
        id: "unipile_acc_1",
        status: "RECONNECT_REQUIRED",
        connection_params: { im: { status: "DISCONNECTED" } },
      });

      let updatedFields: any;
      vi.spyOn(db, "update").mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updatedFields = val;
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      } as any);

      const status = await linkedInAccountService.getAccountStatus("user-1");

      expect(status.isConnected).toBe(false);
      expect(status.healthStatus).toBe("RECONNECT_REQUIRED");
      expect(status.reconnectionRequired).toBe(true);
      expect(updatedFields.isConnected).toBe(false);
      expect(updatedFields.healthStatus).toBe("RECONNECT_REQUIRED");
      expect(updatedFields.automationStatus).toBe("PAUSED");
    });
  });

  describe("4. Account Disconnect & Queued Action Pausing", () => {
    it("disconnect marks account DISCONNECTED, clears credentials, and immediately pauses queued actions", async () => {
      const dbAccount = {
        id: "acc-disc-1",
        userId: "user-1",
        unipileAccountId: "unipile_acc_disc",
        isConnected: true,
        healthStatus: "HEALTHY",
      };

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([dbAccount]),
          }),
        }),
      } as any);

      const remoteDisconnectSpy = vi.spyOn(unipileClient, "disconnectAccount").mockResolvedValue(true);

      const updateAccountSpy = vi.fn().mockResolvedValue([]);
      const updateQueueSpy = vi.fn().mockResolvedValue([]);

      vi.spyOn(db, "update")
        // Update account record
        .mockReturnValueOnce({
          set: vi.fn().mockImplementation((val) => {
            expect(val.unipileAccountId).toBeNull();
            expect(val.isConnected).toBe(false);
            expect(val.healthStatus).toBe("DISCONNECTED");
            expect(val.automationStatus).toBe("PAUSED");
            expect(val.encryptedCredentials).toBeNull();
            return { where: updateAccountSpy };
          }),
        } as any)
        // Update actionQueue to PAUSED
        .mockReturnValueOnce({
          set: vi.fn().mockImplementation((val) => {
            expect(val.status).toBe("PAUSED");
            expect(val.errorMessage).toContain("Account disconnected");
            return { where: updateQueueSpy };
          }),
        } as any);

      const result = await linkedInAccountService.disconnect("user-1");

      expect(result).toBe(true);
      expect(remoteDisconnectSpy).toHaveBeenCalledWith("unipile_acc_disc");
      expect(updateAccountSpy).toHaveBeenCalled();
      expect(updateQueueSpy).toHaveBeenCalled();
    });
  });

  describe("5. Permanent Account Deletion & Cookie Purge", () => {
    it("deleteLinkedInLoginAndCookies purges account record and deletes pending queue actions", async () => {
      const dbAccounts = [
        {
          id: "acc-del-1",
          userId: "user-1",
          unipileAccountId: "unipile_del_1",
        },
      ];

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(dbAccounts),
        }),
      } as any);

      const remoteDisconnectSpy = vi.spyOn(unipileClient, "disconnectAccount").mockResolvedValue(true);
      const deleteSpy = vi.spyOn(db, "delete").mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await linkedInAccountService.deleteLinkedInLoginAndCookies("user-1");

      expect(result).toBe(true);
      expect(remoteDisconnectSpy).toHaveBeenCalledWith("unipile_del_1");
      // Must delete from both linkedinAccounts and actionQueue
      expect(deleteSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("6. Checkpoint Verification & Status Check", () => {
    it("solveCheckpoint calls Unipile checkpoint resolver and syncs account upon success", async () => {
      vi.spyOn(unipileClient, "solveCheckpoint").mockResolvedValue({
        status: "OK",
        account_id: "acc_solved_1",
      });

      const syncSpy = vi.spyOn(linkedInAccountService, "syncAccount").mockResolvedValue({
        id: "acc-db-1",
        isConnected: true,
        healthStatus: "HEALTHY",
      });

      const res = await linkedInAccountService.solveCheckpoint("user-1", "acc_unsolved", "123456");

      expect(res.checkpoint).toBe(false);
      expect(res.accountId).toBe("acc_solved_1");
      expect(res.message).toContain("successfully connected");
      expect(syncSpy).toHaveBeenCalledWith("user-1", "acc_solved_1");
    });

    it("solveCheckpoint returns next checkpoint if multi-step verification is required", async () => {
      vi.spyOn(unipileClient, "solveCheckpoint").mockResolvedValue({
        object: "Checkpoint",
        checkpoint: { type: "OTP" },
        account_id: "acc_unsolved",
      });

      const syncSpy = vi.spyOn(linkedInAccountService, "syncAccount");

      const res = await linkedInAccountService.solveCheckpoint("user-1", "acc_unsolved", "123456");

      expect(res.checkpoint).toBe(true);
      expect(res.checkpointType).toBe("OTP");
      expect(syncSpy).not.toHaveBeenCalled();
    });

    it("checkCheckpointStatus checks live status and auto-syncs when account becomes connected", async () => {
      vi.spyOn(unipileClient, "getAccount").mockResolvedValue({
        id: "acc_in_flight",
        status: "OK",
        connection_params: { im: { status: "CONNECTED" } },
      });

      const syncSpy = vi.spyOn(linkedInAccountService, "syncAccount").mockResolvedValue({
        id: "acc-db-1",
        isConnected: true,
      });

      const res = await linkedInAccountService.checkCheckpointStatus("user-1", "acc_in_flight");

      expect(res.isConnected).toBe(true);
      expect(res.status).toBe("OK");
      expect(syncSpy).toHaveBeenCalledWith("user-1", "acc_in_flight");
    });
  });
});
