import { Router } from "express";
import { userSettingsController } from "../controllers/user-settings.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Protected per-user Gemini API Key settings
router.get("/gemini", authenticate, (req, res) =>
  userSettingsController.getGeminiSettings(req, res),
);
router.post("/gemini", authenticate, (req, res) =>
  userSettingsController.updateGeminiSettings(req, res),
);
router.post("/gemini/test", authenticate, (req, res) =>
  userSettingsController.testGeminiSettings(req, res),
);
router.delete("/gemini", authenticate, (req, res) =>
  userSettingsController.deleteGeminiSettings(req, res),
);

export default router;
