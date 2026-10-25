import { describe, it, expect } from "vitest";
import {
  NotFoundError,
  isInternalDbError,
  redactSensitiveText,
  safeErrorMessage,
} from "../../utils/error.util.js";

describe("Error Sanitization & Typed Domain Error Classification", () => {
  describe("NotFoundError", () => {
    it("creates an instance of NotFoundError with statusCode 404", () => {
      const err = new NotFoundError("Contact contact-abc not found.");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.name).toBe("NotFoundError");
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Contact contact-abc not found.");
    });
  });

  describe("isInternalDbError", () => {
    it("identifies PostgreSQL driver error codes", () => {
      expect(isInternalDbError({ code: "42P01", message: "relation does not exist" })).toBe(true);
      expect(isInternalDbError({ code: "23505", message: "duplicate key value" })).toBe(true);
      expect(isInternalDbError({ code: "28P01", message: "password authentication failed" })).toBe(true);
      expect(isInternalDbError({ code: "08006", message: "connection failure" })).toBe(true);
    });

    it("identifies SQL query keywords and driver error names", () => {
      expect(isInternalDbError(new Error("Failed query: select * from users where id = 1"))).toBe(true);
      expect(isInternalDbError(new Error("NeonDbError: connection pool exhausted"))).toBe(true);
      expect(isInternalDbError(new Error("PostgresError: column status not found"))).toBe(true);
      expect(isInternalDbError(new Error("syntax error at or near update"))).toBe(true);
      expect(isInternalDbError(new Error("violates foreign key constraint fk_user"))).toBe(true);
    });

    it("returns false for benign application domain errors", () => {
      expect(isInternalDbError(new Error("Contact contact-123 not found."))).toBe(false);
      expect(isInternalDbError(new Error("Authentication required. Please log in."))).toBe(false);
      expect(isInternalDbError(new Error("Invalid or expired token."))).toBe(false);
      expect(isInternalDbError(null)).toBe(false);
      expect(isInternalDbError(undefined)).toBe(false);
    });
  });

  describe("redactSensitiveText", () => {
    it("scrubs database URL passwords", () => {
      const text = "Error: postgresql://neondb_owner:dummy_password_to_redact@ep-pooler.neon.tech/neondb?sslmode=require";
      const redacted = redactSensitiveText(text);
      expect(redacted).not.toContain("dummy_password_to_redact");
      expect(redacted).toContain("postgresql://neondb_owner:[REDACTED]@ep-pooler.neon.tech/neondb");
    });

    it("scrubs Bearer tokens", () => {
      const text = "Header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret";
      const redacted = redactSensitiveText(text);
      expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(redacted).toBe("Header Authorization: Bearer [REDACTED]");
    });

    it("scrubs API keys and passwords", () => {
      const text = "Failed with api_key: AIzaSySecretKey123 and password: MyPassword456";
      const redacted = redactSensitiveText(text);
      expect(redacted).not.toContain("AIzaSySecretKey123");
      expect(redacted).not.toContain("MyPassword456");
      expect(redacted).toBe("Failed with api_key: [REDACTED] and password: [REDACTED]");
    });
  });

  describe("safeErrorMessage", () => {
    it("returns generic database fallback when an internal DB error is detected", () => {
      const dbErr = new Error("PostgresError: relation contacts not found in schema");
      (dbErr as any).code = "42P01";

      const safe = safeErrorMessage(dbErr);
      expect(safe).toBe("A database error occurred. Please try again later.");
      expect(safe).not.toContain("contacts not found in schema");
    });

    it("returns custom dbFallback when provided", () => {
      const dbErr = new Error("syntax error at or near select");
      const safe = safeErrorMessage(dbErr, "Default error", "Database unavailable.");
      expect(safe).toBe("Database unavailable.");
    });

    it("redacts sensitive text for non-database errors", () => {
      const err = new Error("External request failed with api_key: AIzaSySecret123");
      const safe = safeErrorMessage(err);
      expect(safe).toBe("External request failed with api_key: [REDACTED]");
    });

    it("returns fallback message when error is empty or has no message", () => {
      expect(safeErrorMessage(null, "Fallback message")).toBe("Fallback message");
      expect(safeErrorMessage({}, "Fallback message")).toBe("Fallback message");
    });
  });
});
