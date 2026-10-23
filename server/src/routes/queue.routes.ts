import { Router } from "express";
import {
  getQueueStats,
  processDueActions,
  pauseAutomation,
  resumeAutomation,
  discoverProspects,
  queueConnection,
  connectionAcceptedWebhook,
} from "../controllers/queue.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireProspectCapacity } from "../middlewares/entitlement.middleware.js";

const router = Router();

// Queue Operations (All Protected - User Isolated)
router.get("/stats", authenticate, getQueueStats);
router.post("/process", authenticate, processDueActions);
router.post("/pause", authenticate, pauseAutomation);
router.post("/resume", authenticate, resumeAutomation);

// Prospecting and Outbound Integration
router.post("/prospects/discover", authenticate, requireProspectCapacity, discoverProspects);
router.post("/prospects/connect", authenticate, queueConnection);
router.post("/prospects/accepted", authenticate, connectionAcceptedWebhook);

export default router;
