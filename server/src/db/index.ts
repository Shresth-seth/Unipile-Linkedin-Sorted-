import "../config/dotenv.config.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const isTestEnv = process.env.NODE_ENV === "test";
const databaseUrl = process.env.DATABASE_URL?.trim();
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

let activeClient: postgres.Sql;

if (isTestEnv) {
  if (testDatabaseUrl) {
    // Approved & validated test database configuration
    activeClient = postgres(testDatabaseUrl, { prepare: false });
  } else {
    // Fail-closed offline test client: allows Drizzle initialization & mocking,
    // but strictly forbids opening database sockets or executing unmocked queries.
    const offlineStub = postgres("postgresql://offline-blocked:5432/offline_blocked", {
      prepare: false,
      connect_timeout: 0,
    });
    activeClient = new Proxy(offlineStub, {
      apply() {
        throw new Error(
          "[DATABASE HAZARD BLOCKED] Database query attempted in offline test mode without an explicitly validated TEST_DATABASE_URL.",
        );
      },
      get(target, prop, receiver) {
        if (
          prop === "unsafe" ||
          prop === "begin" ||
          prop === "reserve" ||
          prop === "listen"
        ) {
          return () => {
            throw new Error(
              "[DATABASE HAZARD BLOCKED] Database query attempted in offline test mode without an explicitly validated TEST_DATABASE_URL.",
            );
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
} else {
  // Production and development environments: fail closed without silent localhost fallback
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is mandatory. Silent fallback to localhost is disabled for safety.",
    );
  }
  const poolMax = parseInt(process.env.DB_POOL_MAX || "10", 10);
  const idleTimeout = parseInt(process.env.DB_IDLE_TIMEOUT || "20", 10);
  const connectTimeout = parseInt(process.env.DB_CONNECT_TIMEOUT || "10", 10);

  activeClient = postgres(databaseUrl, {
    prepare: false,
    max: poolMax,
    idle_timeout: idleTimeout,
    connect_timeout: connectTimeout,
  });
}

export const client = activeClient;
export const db = drizzle(client, { schema });
