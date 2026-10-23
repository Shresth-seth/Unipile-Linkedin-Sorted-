import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Dashboard & CRM Pipeline (Protected - User isolated)
router.get("/dashboard/overview", authenticate, (req, res) => dashboardController.getOverview(req, res));
router.get("/dashboard/funnel", authenticate, (req, res) => dashboardController.getFunnel(req, res));
router.get("/dashboard/contacts", authenticate, (req, res) => dashboardController.getContacts(req, res));
router.patch("/dashboard/contacts/:id/stage", authenticate, (req, res) => dashboardController.updateContactStage(req, res));

// Account Health State Machine & Killswitch (Protected - User isolated)
router.get("/dashboard/account-health", authenticate, (req, res) => dashboardController.getAccountHealth(req, res));
router.post("/dashboard/emergency-pause", authenticate, (req, res) => dashboardController.emergencyPause(req, res));
router.post("/dashboard/resume", authenticate, (req, res) => dashboardController.resumeAutomation(req, res));

// Health Probes (Public Infrastructure Monitoring)
router.get("/health/liveness", (req, res) => dashboardController.liveness(req, res));
router.get("/health/readiness", (req, res) => dashboardController.readiness(req, res));

export default router;
