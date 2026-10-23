import { Router } from "express";
import {
  chatWithAgent,
  stopAgent,
  launchAutonomousCampaign,
  listAgentTools,
  getAgentMessages,
  clearAgentMessages,
  getAgentSettings,
  updateAgentSettings,
  streamAgentEvents,
  getAgentTasks,
  stopAgentTask,
  getDailyAgentRuns,
  triggerDailyAgentRunNow,
  getDraftReplies,
  approveDraftReply,
  rejectDraftReply,
  outreachConnections,
} from "../controllers/agent.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requirePaidPlan } from "../middlewares/entitlement.middleware.js";

const router = Router();

// Constant Server-Sent Events (SSE) Stream for real-time agent updates
router.get("/stream", authenticate, streamAgentEvents);

// Active Background Subagents & Tasks
router.get("/tasks", authenticate, getAgentTasks);
router.post("/tasks/:taskId/stop", authenticate, stopAgentTask);

// Daily Autonomous Agent Runs & Manual Execution
router.get("/daily/runs", authenticate, getDailyAgentRuns);
router.post("/daily/run-now", authenticate, requirePaidPlan, triggerDailyAgentRunNow);

// Draft Replies Management (Human-in-the-Loop Approval)
router.get("/drafts", authenticate, getDraftReplies);
router.post("/drafts/:contactId/approve", authenticate, approveDraftReply);
router.delete("/drafts/:contactId", authenticate, rejectDraftReply);

// Interactive Chat with Agent (Tool Calling + Memory)
router.post("/chat", authenticate, requirePaidPlan, chatWithAgent);

// Stop / Interrupt Active Agent Execution
router.post("/stop", authenticate, stopAgent);

// Retrieve Persisted Agent Chat Messages (Short-Term Memory)
router.get("/messages", authenticate, getAgentMessages);

// Clear Persisted Agent Chat Messages
router.delete("/messages", authenticate, clearAgentMessages);

// Agent Settings & Custom Personality Configuration
router.get("/settings", authenticate, getAgentSettings);
router.post("/settings", authenticate, updateAgentSettings);

// Autonomous Campaign Launch
router.post("/campaign", authenticate, requirePaidPlan, launchAutonomousCampaign);

// List Available Agent Tools
router.get("/tools", authenticate, listAgentTools);

// Outreach to Existing Connections by Niche
router.post("/outreach-connections", authenticate, requirePaidPlan, outreachConnections);

export default router;
