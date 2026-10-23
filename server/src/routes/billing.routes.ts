import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { cancelSubscription, createCheckout, getSubscription, handleBillingWebhook } from "../controllers/billing.controller.js";

const router = Router();
router.post("/webhook", handleBillingWebhook);
router.get("/subscription", authenticate, getSubscription);
router.post("/checkout", authenticate, createCheckout);
router.post("/cancel", authenticate, cancelSubscription);

export default router;
