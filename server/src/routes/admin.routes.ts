import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import {
  getAdminOverview,
  getAdminLinkedinAccounts,
  adminDisconnectAccount,
  adminCheckAccountHealth,
  getAdminUsers,
  getUnipileSettings,
  updateUnipileSettings,
  testUnipileConnection,
  getGeminiSettings,
  updateGeminiSettings,
  testGeminiConnection,
  getAdminQueueStats,
  adminRunDailyAgent,
  adminSimulateMessageWebhook,
  adminProcessMessageJob,
  getAutomationHealth,
} from "../controllers/admin.controller.js";

const router = Router();

// All admin routes require: 1) valid JWT (authenticate) + 2) ADMIN role (requireAdmin)
router.use(authenticate, requireAdmin);

// Dashboard KPIs
router.get("/overview", getAdminOverview);

// LinkedIn Accounts Management
router.get("/linkedin-accounts", getAdminLinkedinAccounts);
router.post("/linkedin-accounts/:id/disconnect", adminDisconnectAccount);
router.post("/linkedin-accounts/:id/check-health", adminCheckAccountHealth);

// User Management
router.get("/users", getAdminUsers);

// Unipile Credential Management
router.get("/settings/unipile", getUnipileSettings);
router.post("/settings/unipile", updateUnipileSettings);
router.post("/settings/unipile/test", testUnipileConnection);

// Google Gemini AI Credential Management
router.get("/settings/gemini", getGeminiSettings);
router.post("/settings/gemini", updateGeminiSettings);
router.post("/settings/gemini/test", testGeminiConnection);

// Queue Telemetry
router.get("/queue/stats", getAdminQueueStats);

// Automation Health & Telemetry
router.get("/automation/health", getAutomationHealth);

// Daily Agent Manual Execution
router.post("/daily-agent/run/:userId", adminRunDailyAgent);

// Message Agent Webhook Simulation & Manual Job Processing
router.post("/message-agent/simulate-webhook", adminSimulateMessageWebhook);
router.post("/message-agent/process-job/:jobId", adminProcessMessageJob);

export default router;
