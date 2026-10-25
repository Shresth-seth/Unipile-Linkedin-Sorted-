import { describe, it, expect } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { validateTestDatabaseUrl } from "../setup.js";
import { client } from "../../db/index.js";

describe("Database Safety & Fail-Closed Isolation Guards", () => {
  it("process.env.DATABASE_URL is strictly undefined at test runner startup", () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it("dotenv.config() cannot re-inject DATABASE_URL from server/.env or root .env", () => {
    // Attempt to invoke dotenv.config targeting server/.env
    const envPath = path.resolve(process.cwd(), ".env");
    const result = dotenv.config({ path: envPath });

    // Assert that DATABASE_URL is stripped from parsed object
    if (result.parsed) {
      expect(result.parsed.DATABASE_URL).toBeUndefined();
    }
    // Assert process.env.DATABASE_URL remains strictly undefined
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it("dotenv.config({ override: true }) cannot re-inject DATABASE_URL", () => {
    const envPath = path.resolve(process.cwd(), ".env");
    const result = dotenv.config({ path: envPath, override: true });

    if (result.parsed) {
      expect(result.parsed.DATABASE_URL).toBeUndefined();
    }
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it("importing server/src/config/dotenv.config.js cannot re-inject DATABASE_URL", async () => {
    await import("../../config/dotenv.config.js");
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it("dotenv.parse() sanitizes and removes DATABASE_URL from parsed key-value pairs", () => {
    const fakeEnv = `
      PORT=3000
      DATABASE_URL=postgresql://neondb_owner:dummy_password@ep-pooler.neon.tech/neondb
      SOME_OTHER_KEY=foobar
    `;
    const parsed = dotenv.parse(fakeEnv);

    expect(parsed.PORT).toBe("3000");
    expect(parsed.SOME_OTHER_KEY).toBe("foobar");
    expect(parsed.DATABASE_URL).toBeUndefined();
  });

  it("server/src/db/index.ts client operates in fail-closed offline mode without TEST_DATABASE_URL and forbids socket queries", () => {
    // In offline test mode without TEST_DATABASE_URL, client points to offline-blocked stub
    expect(client.options.host).toEqual(["offline-blocked"]);
    expect(client.options.database).toBe("offline_blocked");

    // Any unmocked socket query or unsafe invocation must fail closed immediately
    expect(() => {
      (client as any).unsafe("SELECT 1");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*offline test mode/);

    expect(() => {
      (client as any)`SELECT 1`;
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*offline test mode/);
  });

  it("validateTestDatabaseUrl fails closed on cloud/remote database targets", () => {
    expect(() => {
      validateTestDatabaseUrl("postgresql://user:dummy_password@ep-pooler.neon.tech/neondb?sslmode=require");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*neon\.tech/);

    expect(() => {
      validateTestDatabaseUrl("postgresql://user:dummy_password@database-1.cluster-xyz.us-east-1.rds.amazonaws.com/prod");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*rds\.amazonaws\.com/);

    expect(() => {
      validateTestDatabaseUrl("postgresql://postgres:dummy_password@db.xyz.supabase.co:5432/postgres");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*supabase/);

    expect(() => {
      validateTestDatabaseUrl("postgresql://user:dummy_password@198.51.100.25:5432/remotedb");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*non-loopback host/);
  });

  it("validateTestDatabaseUrl allows strictly local loopback disposable targets", () => {
    expect(() => {
      validateTestDatabaseUrl("postgresql://postgres:postgres@localhost:5432/workpilot_test");
    }).not.toThrow();

    expect(() => {
      validateTestDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:5432/workpilot_test");
    }).not.toThrow();
  });

  it("validateTestDatabaseUrl rejects missing, null, undefined, or empty URL strings when validation is invoked", () => {
    expect(() => {
      validateTestDatabaseUrl(undefined);
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*missing or empty/);

    expect(() => {
      validateTestDatabaseUrl(null);
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*missing or empty/);

    expect(() => {
      validateTestDatabaseUrl("");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*missing or empty/);

    expect(() => {
      validateTestDatabaseUrl("   ");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*missing or empty/);
  });

  it("validateTestDatabaseUrl enforces protocol whitelist (postgres: and postgresql: only)", () => {
    // Valid postgres: protocol is allowed
    expect(() => {
      validateTestDatabaseUrl("postgres://postgres:postgres@localhost:5432/workpilot_test");
    }).not.toThrow();

    // Invalid non-postgres protocols are rejected
    expect(() => {
      validateTestDatabaseUrl("http://localhost:5432/workpilot_test");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*invalid protocol 'http:'/);

    expect(() => {
      validateTestDatabaseUrl("https://localhost:5432/workpilot_test");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*invalid protocol 'https:'/);

    expect(() => {
      validateTestDatabaseUrl("redis://127.0.0.1:6379");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*invalid protocol 'redis:'/);

    expect(() => {
      validateTestDatabaseUrl("mysql://root:pass@localhost:3306/db");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*invalid protocol 'mysql:'/);

    expect(() => {
      validateTestDatabaseUrl("file:///etc/passwd");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*invalid protocol 'file:'/);
  });

  it("validateTestDatabaseUrl correctly allows IPv6 bracketed loopback [::1]", () => {
    expect(() => {
      validateTestDatabaseUrl("postgresql://postgres:postgres@[::1]:5432/workpilot_test");
    }).not.toThrow();

    expect(() => {
      validateTestDatabaseUrl("postgres://postgres:postgres@[::1]:5432/workpilot_test");
    }).not.toThrow();
  });

  it("validateTestDatabaseUrl rejects malformed URLs and spoofed localhost hostnames", () => {
    // Malformed URLs
    expect(() => {
      validateTestDatabaseUrl("not-a-valid-url");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\] Invalid TEST_DATABASE_URL/);

    expect(() => {
      validateTestDatabaseUrl("postgresql://");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*(non-loopback host|Invalid TEST_DATABASE_URL)/);

    // Subdomain / suffix spoofing
    expect(() => {
      validateTestDatabaseUrl("postgresql://user:pass@localhost.attacker.com:5432/db");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*non-loopback host 'localhost\.attacker\.com'/);

    expect(() => {
      validateTestDatabaseUrl("postgresql://user:pass@notlocalhost:5432/db");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*non-loopback host 'notlocalhost'/);

    expect(() => {
      validateTestDatabaseUrl("postgresql://user:pass@attacker.localhost.com:5432/db");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*non-loopback host 'attacker\.localhost\.com'/);

    expect(() => {
      validateTestDatabaseUrl("postgresql://user:pass@127.0.0.1.nip.io:5432/db");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*non-loopback host '127\.0\.0\.1\.nip\.io'/);

    // Userinfo confusion (user is localhost, host is attacker.com)
    expect(() => {
      validateTestDatabaseUrl("postgresql://localhost@attacker.com:5432/db");
    }).toThrow(/\[DATABASE HAZARD BLOCKED\].*non-loopback host 'attacker\.com'/);
  });
});
