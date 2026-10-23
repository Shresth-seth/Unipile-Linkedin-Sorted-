import { Router } from "express";
import {
  getConversationHistory,
  takeOverConversation,
  sendManualReply,
  setPilotMode,
  generateAiReply,
  chatWithCopilot,
  checkOutreachCollision,
  differentiateOutreach,
  getChatbotStatus,
  toggleChatbot,
} from "../controllers/conversation.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Public webhook routes are consolidated exclusively in webhook.routes.ts (/api/webhooks/unipile/messages)

// Protected conversation & takeover management
router.get(
  "/conversations/:contactId/messages",
  authenticate,
  getConversationHistory,
);
router.post(
  "/conversations/:contactId/takeover",
  authenticate,
  takeOverConversation,
);
router.post(
  "/conversations/:contactId/pilot-mode",
  authenticate,
  setPilotMode,
);
router.post(
  "/conversations/generate-reply",
  authenticate,
  generateAiReply,
);
router.post(
  "/conversations/copilot-chat",
  authenticate,
  chatWithCopilot,
);
router.post(
  "/conversations/outreach-brain/check",
  authenticate,
  checkOutreachCollision,
);
router.post(
  "/conversations/outreach-brain/differentiate",
  authenticate,
  differentiateOutreach,
);
router.get(
  "/conversations/chatbot/status",
  authenticate,
  getChatbotStatus,
);
router.post(
  "/conversations/chatbot/toggle",
  authenticate,
  toggleChatbot,
);
router.post("/conversations/:contactId/reply", authenticate, sendManualReply);

export default router;
