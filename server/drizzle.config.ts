import { defineConfig } from "drizzle-kit";
import "./src/config/dotenv.config.js";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/workpilot",
  },
});
