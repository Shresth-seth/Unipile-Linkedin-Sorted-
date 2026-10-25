import "./config/dotenv.config.js";
import { safeErrorMessage } from "./utils/error.util.js";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import linkedinRoutes from "./routes/linkedin.routes.js";
import queueRoutes from "./routes/queue.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import engagementRoutes from "./routes/engagement.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import agentRoutes from "./routes/agent.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import contactRoutes from "./routes/contact.routes.js";

import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";

const app = express();
app.set("trust proxy", 1);

const rawClientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const allowedOrigins = rawClientUrl
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      try {
        const parsed = new URL(origin);
        if (process.env.NODE_ENV !== "production" && (
          parsed.hostname === "workpilot.co.in" ||
          parsed.hostname.endsWith(".workpilot.co.in")
        )) {
          return callback(null, true);
        }
      } catch {
        // invalid URL format, fall through to check
      }
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      const corsError: any = new Error(`Origin '${origin}' is not allowed by CORS policy.`);
      corsError.status = 403;
      return callback(corsError);
    },
    credentials: true,
  }),
);

app.use(express.json({
  limit: "1mb",
  verify: (req: any, _res, buffer) => {
    if (
      req.originalUrl?.startsWith("/api/billing/webhook") ||
      req.originalUrl?.startsWith("/api/webhooks") ||
      req.originalUrl?.startsWith("/webhook")
    ) {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    req.cookies?.token &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method)
  ) {
    const origin = req.header("origin")?.replace(/\/+$/, "");
    if (!origin || !allowedOrigins.includes(origin)) {
      res.status(403).json({ success: false, message: "Request origin is not allowed." });
      return;
    }
  }
  next();
});
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Base infrastructure health and commit/version tracking
app.get(["/api/health", "/api/health/liveness"], (_req, res) => {
  let version = "development";
  try {
    const candidateFiles = [
      path.resolve(process.cwd(), ".deploy-version"),
      path.resolve(process.cwd(), "server", ".deploy-version"),
      path.resolve(process.cwd(), "..", ".deploy-version"),
      "/home/ubuntu/app/.deploy-version",
    ];
    for (const versionFile of candidateFiles) {
      if (fs.existsSync(versionFile)) {
        const content = fs.readFileSync(versionFile, "utf8").trim();
        const firstLine = content.split("\n")[0];
        if (firstLine) {
          version = firstLine.trim();
          break;
        }
      }
    }
  } catch {}
  const mem = process.memoryUsage();
  res.status(200).json({
    status: "ok",
    version,
    commit: process.env.DEPLOYED_SHA || version,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health/readiness", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.status(200).json({ status: "ready", database: "connected", timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ status: "not_ready", database: "disconnected", error: err?.message, timestamp: new Date().toISOString() });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/linkedin", linkedinRoutes);
app.use("/api", queueRoutes);
app.use("/api", conversationRoutes);
app.use("/api", engagementRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/internal/admin", adminRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/user/settings", settingsRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/contact", contactRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found on this server.",
  });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error caught by global middleware:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: safeErrorMessage(
      err,
      "An unexpected internal server error occurred.",
      "A database error occurred. Please try again later.",
    ),
  });
});

export default app;
