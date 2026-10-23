import { Router } from "express";
import { handleUnipileWebhook } from "../controllers/webhook.controller.js";

const router = Router();

// Primary Unipile Webhook Endpoints
router.post("/", handleUnipileWebhook);
router.post("/unipile", handleUnipileWebhook);
router.post("/messages", handleUnipileWebhook);
router.post("/unipile/messages", handleUnipileWebhook);

export default router;
