import http from "node:http";
import https from "node:https";
import dotenv from "dotenv";

// ----------------------------------------------------------------------------
// 1. FAIL-CLOSED DATABASE ISOLATION GUARD & DOTENV INTERCEPTION
// ----------------------------------------------------------------------------
// Strictly forbid test runner from inheriting or accessing cloud/production DATABASE_URL
delete process.env.DATABASE_URL;

// Intercept dotenv.config to prevent re-injection from server/.env, root .env, or any .env file
const nativeDotenvConfig = dotenv.config;
dotenv.config = function (options?: any) {
  const result = nativeDotenvConfig.call(dotenv, options);
  if (result?.parsed && "DATABASE_URL" in result.parsed) {
    delete result.parsed.DATABASE_URL;
  }
  delete process.env.DATABASE_URL;
  return result;
};

// Intercept dotenv.parse to sanitize parsed key-value pairs
const nativeDotenvParse = dotenv.parse;
dotenv.parse = function (src: any) {
  const parsed = nativeDotenvParse.call(dotenv, src);
  if (parsed && "DATABASE_URL" in parsed) {
    delete parsed.DATABASE_URL;
  }
  return parsed as any;
} as any;

// Helper validator for test database target safety
export function validateTestDatabaseUrl(url?: string | null): void {
  if (!url || typeof url !== "string" || !url.trim()) {
    throw new Error(
      "[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL is missing or empty. When validation is invoked, a valid database URL must be provided."
    );
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // Multiple independent rejection checks:
  // 1. Cloud provider keywords
  if (
    lower.includes("neon.tech") ||
    lower.includes("aws") ||
    lower.includes("supabase") ||
    lower.includes("rds.amazonaws.com")
  ) {
    throw new Error(
      `[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL points to a remote/cloud database target '${trimmed}'. Live tests must use a strictly local disposable database.`
    );
  }

  // 2. Parse URL and validate protocol & loopback host
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();

    if (protocol !== "postgresql:" && protocol !== "postgres:") {
      throw new Error(
        `[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL has invalid protocol '${protocol}'. Only 'postgresql:' and 'postgres:' are permitted.`
      );
    }

    const host = parsed.hostname.toLowerCase();
    const cleanHost = host.startsWith("[") && host.endsWith("]")
      ? host.slice(1, -1)
      : host;

    if (!cleanHost || (cleanHost !== "localhost" && cleanHost !== "127.0.0.1" && cleanHost !== "::1")) {
      throw new Error(
        `[DATABASE HAZARD BLOCKED] TEST_DATABASE_URL points to non-loopback host '${host}'. Offline testing forbids remote databases.`
      );
    }
  } catch (err: any) {
    if (err.message.includes("[DATABASE HAZARD BLOCKED]")) throw err;
    throw new Error(`[DATABASE HAZARD BLOCKED] Invalid TEST_DATABASE_URL: ${err.message}`);
  }
}

// Initial fail-closed check on TEST_DATABASE_URL if present in environment
if (process.env.TEST_DATABASE_URL) {
  validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
}

// Ensure test runner default environment
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-at-least-32-chars-long";
process.env.DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || "test-data-encryption-key-must-be-long-enough-32";

// ----------------------------------------------------------------------------
// 2. FAIL-CLOSED OUTBOUND NETWORK KILLSWITCH
// ----------------------------------------------------------------------------
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isHostAllowed(host?: string | null): boolean {
  if (!host) return false;
  const cleanHost = host.split(":")[0]?.toLowerCase();
  return cleanHost ? ALLOWED_HOSTS.has(cleanHost) : false;
}

// Guard globalThis.fetch
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input: any, init?: RequestInit): Promise<Response> => {
  let urlString: string;
  if (typeof input === "string") {
    urlString = input;
  } else if (input instanceof URL) {
    urlString = input.toString();
  } else if ("url" in input) {
    urlString = input.url;
  } else {
    urlString = String(input);
  }

  try {
    const parsed = new URL(urlString);
    if (!isHostAllowed(parsed.hostname)) {
      throw new Error(
        `[NETWORK HAZARD BLOCKED] Attempted outbound HTTP request to '${parsed.hostname}'. Offline test sandbox forbids live egress.`
      );
    }
  } catch (err: any) {
    if (err.message?.includes("[NETWORK HAZARD BLOCKED]")) throw err;
    throw new Error(`[NETWORK HAZARD BLOCKED] Invalid or unparseable URL in test fetch: ${urlString}`);
  }

  return nativeFetch(input, init);
};

// Guard node:http.request
const nativeHttpRequest = http.request;
http.request = function (options: any, callback?: any): http.ClientRequest {
  const host = options?.hostname || options?.host;
  if (!isHostAllowed(host)) {
    throw new Error(
      `[NETWORK HAZARD BLOCKED] Attempted outbound http.request to '${host}'. Offline test sandbox forbids live egress.`
    );
  }
  return nativeHttpRequest.call(http, options, callback);
} as any;

// Guard node:https.request
const nativeHttpsRequest = https.request;
https.request = function (options: any, callback?: any): http.ClientRequest {
  const host = options?.hostname || options?.host;
  if (!isHostAllowed(host)) {
    throw new Error(
      `[NETWORK HAZARD BLOCKED] Attempted outbound https.request to '${host}'. Offline test sandbox forbids live egress.`
    );
  }
  return nativeHttpsRequest.call(https, options, callback);
} as any;
