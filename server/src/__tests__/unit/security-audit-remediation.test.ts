import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateRedirectUrl } from "../../controllers/linkedin.controller.js";
import { isValidUuid, safeErrorMessage } from "../../utils/error.util.js";
import { linkedInPeopleService } from "../../services/linkedin/people.service.js";
import { linkedInConnectionService } from "../../services/linkedin/connection.service.js";
import { linkedInAccountService } from "../../services/linkedin/account.service.js";
import { db } from "../../db/index.js";

describe("Security Audit Remediation Verification Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Open Redirect & Safe Redirection (SEC-FIND-02)
  // ──────────────────────────────────────────────────────────────────────────
  describe("SEC-FIND-02: OAuth Open Redirect Mitigation (validateRedirectUrl)", () => {
    it("accepts benign relative paths", () => {
      expect(validateRedirectUrl("/dashboard")).toBe("/dashboard");
      expect(validateRedirectUrl("/settings/linkedin")).toBe("/settings/linkedin");
      expect(validateRedirectUrl("/campaigns?page=2&filter=active")).toBe("/campaigns?page=2&filter=active");
    });

    it("rejects dangerous protocol-relative URLs", () => {
      expect(validateRedirectUrl("//evil.com")).toBeUndefined();
      expect(validateRedirectUrl("//attacker.com/oauth/steal")).toBeUndefined();
      expect(validateRedirectUrl("///evil.com")).toBeUndefined();
    });

    it("rejects backslash directory traversal / bypass attempts", () => {
      expect(validateRedirectUrl("/\\evil.com")).toBeUndefined();
      expect(validateRedirectUrl("\\evil.com")).toBeUndefined();
    });

    it("rejects untrusted external domains", () => {
      expect(validateRedirectUrl("https://evil.com")).toBeUndefined();
      expect(validateRedirectUrl("http://phishing.site/login")).toBeUndefined();
      expect(validateRedirectUrl("ftp://evil.com/payload")).toBeUndefined();
    });

    it("handles null, undefined, and non-string inputs safely", () => {
      expect(validateRedirectUrl(undefined)).toBeUndefined();
      expect(validateRedirectUrl("" as any)).toBeUndefined();
      expect(validateRedirectUrl(null as any)).toBeUndefined();
      expect(validateRedirectUrl(12345 as any)).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. UUID Parameter Validation (SEC-FIND-07)
  // ──────────────────────────────────────────────────────────────────────────
  describe("SEC-FIND-07: UUID Format Validation (isValidUuid)", () => {
    it("accepts valid UUID strings (v1, v4, v5)", () => {
      expect(isValidUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
      expect(isValidUuid("c3a88fb0-43eb-46c9-a864-129671190bc9")).toBe(true);
      expect(isValidUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
      expect(isValidUuid("  c3a88fb0-43eb-46c9-a864-129671190bc9  ")).toBe(true);
    });

    it("rejects invalid, malformed, or injected strings", () => {
      expect(isValidUuid("abc")).toBe(false);
      expect(isValidUuid("12345")).toBe(false);
      expect(isValidUuid("../../etc/passwd")).toBe(false);
      expect(isValidUuid("' OR 1=1 --")).toBe(false);
      expect(isValidUuid("c3a88fb0-43eb-46c9-a864-129671190bcZ")).toBe(false);
      expect(isValidUuid("c3a88fb0-43eb-46c9-a864")).toBe(false);
    });

    it("rejects non-string types safely", () => {
      expect(isValidUuid(null)).toBe(false);
      expect(isValidUuid(undefined)).toBe(false);
      expect(isValidUuid(42)).toBe(false);
      expect(isValidUuid({})).toBe(false);
      expect(isValidUuid([])).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Error Sanitization & Information Disclosure (SEC-FIND-06)
  // ──────────────────────────────────────────────────────────────────────────
  describe("SEC-FIND-06: Error Sanitization and Info Leak Prevention (safeErrorMessage)", () => {
    it("replaces internal PostgreSQL errors with a safe generic DB message", () => {
      const pgSyntaxError = { code: "42P01", message: "relation \"users\" does not exist" };
      expect(safeErrorMessage(pgSyntaxError)).toBe("A database error occurred. Please try again later.");

      const pgUuidError = { code: "22P02", message: "invalid input syntax for type uuid: \"xyz\"" };
      expect(safeErrorMessage(pgUuidError)).toBe("A database error occurred. Please try again later.");

      const rawSqlError = new Error("Failed query: SELECT password FROM users WHERE id = '123'");
      expect(safeErrorMessage(rawSqlError)).toBe("A database error occurred. Please try again later.");
    });

    it("redacts credentials from error messages", () => {
      const tokenError = new Error("Auth failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token123");
      const safe = safeErrorMessage(tokenError);
      expect(safe).not.toContain("token123");
      expect(safe).toContain("[REDACTED]");
    });

    it("allows benign user-friendly messages through intact", () => {
      const userErr = new Error("Invalid email or password.");
      expect(safeErrorMessage(userErr)).toBe("Invalid email or password.");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Strict Tenant Confinement in Services (SEC-FIND-01)
  // ──────────────────────────────────────────────────────────────────────────
  describe("SEC-FIND-01: Zero AnyAcc Fallback Tenant Confinement", () => {
    it("linkedInPeopleService safely denies access when requesting user has no linked accounts", async () => {
      // Mock db.select returning empty array for user
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await linkedInPeopleService.searchPeopleWithMetadata({
        userId: "user-without-accounts",
        keywords: "Engineer",
      });

      expect(result.isLive).toBe(false);
      expect(result.results).toEqual([]);
      expect(result.notice).toMatch(/No active LinkedIn account connected/i);
    });

    it("linkedInConnectionService safely denies invite when requesting user has no linked accounts", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await linkedInConnectionService.sendConnectionRequest(
        { recipientId: "lead_123", note: "Let's connect" },
        "user-without-accounts"
      );

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/No active LinkedIn account connected/i);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Cross-Tenant Account Hijacking Prevention (SEC-FIND-04)
  // ──────────────────────────────────────────────────────────────────────────
  describe("SEC-FIND-04: Cross-Tenant Account Claiming Block", () => {
    it("linkedInAccountService rejects syncAccount if unipileAccountId is linked to a different tenant", async () => {
      // First select checks for existing account belonging to another tenant
      const mockExistingClash = [
        {
          id: "account-uuid-1",
          userId: "tenant-victim-user",
          unipileAccountId: "unipile-acc-shared",
        },
      ];

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockExistingClash),
          }),
        }),
      } as any);

      await expect(
        linkedInAccountService.syncAccount("tenant-attacker-user", "unipile-acc-shared")
      ).rejects.toThrow(/already linked to another workspace/i);
    });
  });
});
