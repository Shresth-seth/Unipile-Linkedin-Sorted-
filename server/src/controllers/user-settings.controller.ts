import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { geminiConfigService } from "../services/ai/gemini-config.service.js";

export class UserSettingsController {
  /**
   * GET /api/settings/gemini
   * Returns whether the current user has a personal Gemini API key configured,
   * along with a masked version of the key and selected model.
   */
  public async getGeminiSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required." });
        return;
      }

      const config = await geminiConfigService.getUserConfig(userId);

      res.status(200).json({
        success: true,
        data: {
          isCustom: config.isCustom,
          maskedKey: config.maskedKey || null,
          model: config.model,
          source: config.source,
          defaultModel: geminiConfigService.getModelName(),
        },
      });
    } catch (err: any) {
      console.error("[settings-controller] Failed to get Gemini settings:", err);
      res.status(500).json({ success: false, message: err.message || "Failed to load Gemini settings." });
    }
  }

  /**
   * POST /api/settings/gemini
   * Updates the current user's personal Gemini API key and model preference.
   */
  public async updateGeminiSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required." });
        return;
      }

      const { apiKey, model } = req.body || {};

      if (apiKey !== undefined && typeof apiKey !== "string") {
        res.status(400).json({ success: false, message: "Invalid API key format." });
        return;
      }

      const cleanKey = apiKey ? apiKey.trim() : null;
      const cleanModel = model ? String(model).trim() : null;

      // If user is setting a new key, let's verify it first to save them headaches
      if (cleanKey) {
        try {
          await geminiConfigService.testConnection(cleanKey, cleanModel || undefined);
        } catch (testErr: any) {
          res.status(400).json({
            success: false,
            message: `Could not verify Gemini API key: ${testErr.message || "Invalid API key."}`,
          });
          return;
        }
      }

      const updated = await geminiConfigService.setUserConfig(userId, cleanKey, cleanModel);

      res.status(200).json({
        success: true,
        message: cleanKey
          ? "Personal Gemini API key verified and saved successfully!"
          : "Personal Gemini API key cleared. Reverted to workspace default key.",
        data: {
          isCustom: updated.isCustom,
          maskedKey: updated.maskedKey || null,
          model: updated.model,
          source: updated.source,
        },
      });
    } catch (err: any) {
      console.error("[settings-controller] Failed to update Gemini settings:", err);
      res.status(500).json({ success: false, message: err.message || "Failed to save Gemini settings." });
    }
  }

  /**
   * POST /api/settings/gemini/test
   * Tests a candidate Gemini API key (or the user's active key) without saving.
   */
  public async testGeminiSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required." });
        return;
      }

      const { apiKey, model } = req.body || {};
      let keyToTest = apiKey ? String(apiKey).trim() : undefined;
      const modelToTest = model ? String(model).trim() : undefined;

      if (!keyToTest) {
        const userConfig = await geminiConfigService.getUserConfig(userId);
        keyToTest = userConfig.apiKey;
      }

      if (!keyToTest) {
        res.status(400).json({
          success: false,
          message: "No API key provided to test, and no workspace key is configured.",
        });
        return;
      }

      const result = await geminiConfigService.testConnection(keyToTest, modelToTest);

      res.status(200).json({
        success: true,
        message: result.message,
        model: result.model,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message || "Connection test failed.",
      });
    }
  }

  /**
   * DELETE /api/settings/gemini
   * Removes the user's personal key and reverts them to the workspace default key.
   */
  public async deleteGeminiSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required." });
        return;
      }

      const updated = await geminiConfigService.setUserConfig(userId, null, null);

      res.status(200).json({
        success: true,
        message: "Personal Gemini API key removed. Reverted to workspace default key.",
        data: {
          isCustom: false,
          maskedKey: null,
          model: updated.model,
          source: "SYSTEM_DEFAULT",
        },
      });
    } catch (err: any) {
      console.error("[settings-controller] Failed to delete Gemini settings:", err);
      res.status(500).json({ success: false, message: err.message || "Failed to remove personal key." });
    }
  }
}

export const userSettingsController = new UserSettingsController();
