import { Request, Response } from "express";
import fs from "fs";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { crmService } from "../services/crm/crm.service.js";
import { accountSafetyService } from "../services/safety/safety.service.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { NotFoundError, isInternalDbError, safeErrorMessage } from "../utils/error.util.js";

export class DashboardController {
  private getAuthenticatedUserId(req: Request): string | null {
    const authReq = req as AuthRequest;
    return authReq.user?.userId || authReq.user?.id || null;
  }

  /**
   * GET /api/dashboard/overview
   * Retrieves summary overview cards, funnel metrics and account health for the authenticated user.
   */
  public async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }
      const funnel = await crmService.getFunnelAnalytics(userId);
      const health = await accountSafetyService.getAccountHealth(userId);
      res.status(200).json({ success: true, data: { funnel, health } });
    } catch (error: any) {
      console.error("Failed to get overview:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/dashboard/funnel
   * Retrieves real-time conversion funnel metrics across all stages for the authenticated user.
   */
  public async getFunnel(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const funnel = await crmService.getFunnelAnalytics(userId);
      res.status(200).json({ success: true, data: funnel });
    } catch (error: any) {
      console.error("Failed to get funnel analytics:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/dashboard/contacts
   * Retrieves paginated contacts strictly scoped to the authenticated user.
   */
  public async getContacts(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const stage = req.query.stage as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const contactList = await crmService.getContactsByStage(userId, stage, limit);
      res.status(200).json({ success: true, data: contactList });
    } catch (error: any) {
      console.error("Failed to get contacts:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PATCH /api/dashboard/contacts/:id/stage
   * Manually moves a contact to another pipeline stage if owned by the authenticated user.
   */
  public async updateContactStage(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const contactId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
      const { stage } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      if (!contactId || !stage) {
        res.status(400).json({ success: false, error: "Missing required contactId or stage." });
        return;
      }

      const updated = await crmService.updateContactStage(userId, contactId, stage);
      res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      console.error("Failed to update contact stage:", error);
      if (error instanceof NotFoundError || error?.name === "NotFoundError") {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      if (!isInternalDbError(error) && error?.message && error.message.toLowerCase().includes("contact") && error.message.toLowerCase().includes("not found")) {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      res.status(500).json({ success: false, error: safeErrorMessage(error, "Failed to update contact stage") });
    }
  }

  /**
   * GET /api/dashboard/account-health
   * Returns live account health and quota utilization for the authenticated user.
   */
  public async getAccountHealth(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const health = await accountSafetyService.getAccountHealth(userId);
      res.status(200).json({ success: true, data: health });
    } catch (error: any) {
      console.error("Failed to get account health:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/dashboard/emergency-pause
   * One-click safety killswitch strictly scoped to the authenticated user's account.
   */
  public async emergencyPause(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { reason } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      await accountSafetyService.pauseAutomation(userId, reason);
      res.status(200).json({
        success: true,
        message: "Emergency pause activated. All automated outbound actions are immediately frozen.",
      });
    } catch (error: any) {
      console.error("Failed to trigger emergency pause:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/dashboard/resume
   * Resumes automated queue execution for the authenticated user.
   */
  public async resumeAutomation(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      await accountSafetyService.resumeAutomation(userId);
      res.status(200).json({
        success: true,
        message: "Automation resumed. Outbound queue processing is now active.",
      });
    } catch (error: any) {
      console.error("Failed to resume automation:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/health/liveness
   * High-visibility liveness probe confirming Express is alive, returning version stamp, uptime, and memory.
   */
  public liveness(_req: Request, res: Response): void {
    let version = process.env.DEPLOY_COMMIT_SHA || process.env.GIT_COMMIT || "1.0.0";
    try {
      if (fs.existsSync(".deploy-version")) {
        version = fs.readFileSync(".deploy-version", "utf8").trim();
      } else if (fs.existsSync("server/.deploy-version")) {
        version = fs.readFileSync("server/.deploy-version", "utf8").trim();
      }
    } catch (_) {}

    const mem = process.memoryUsage();
    res.status(200).json({
      status: "ok",
      version,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/health/readiness
   * Readiness probe validating database connectivity.
   */
  public async readiness(_req: Request, res: Response): Promise<void> {
    try {
      await db.execute(sql`SELECT 1`);
      res.status(200).json({
        status: "ready",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Readiness check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        database: "disconnected",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const dashboardController = new DashboardController();
