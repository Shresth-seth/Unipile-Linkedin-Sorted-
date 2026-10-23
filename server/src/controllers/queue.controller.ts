import { Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { contacts } from "../db/schema.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { actionQueueService } from "../services/queue/queue.service.js";
import { accountSafetyService } from "../services/safety/safety.service.js";
import { prospectService } from "../services/prospects/prospect.service.js";
import { resolveUserId } from "../utils/resolve-user.js";

export const getQueueStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const stats = await actionQueueService.getQueueStats(userId);
    res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processDueActions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const result = await actionQueueService.processDueActions(userId);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const pauseAutomation = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    await accountSafetyService.triggerCircuitBreaker(
      userId,
      "Manual user pause.",
    );
    res
      .status(200)
      .json({ success: true, message: "Automation paused successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resumeAutomation = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    await accountSafetyService.resumeAutomation(userId);
    res
      .status(200)
      .json({ success: true, message: "Automation resumed successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const discoverProspects = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const { role, location, industry, limit, note, autoEnqueue } = req.body;
    const result = await prospectService.discoverAndIngest(
      userId,
      {
        role,
        location,
        industry,
        limit: limit ? Number(limit) : 15,
      },
      autoEnqueue !== false,
      note,
    );
    res.status(200).json({
      success: true,
      count: result.contacts.length,
      enqueuedCount: result.enqueuedCount,
      data: result.contacts,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const queueConnection = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const { contactId, note, delayMinutes } = req.body;
    if (!contactId) {
      res
        .status(400)
        .json({ success: false, message: "contactId is required." });
      return;
    }

    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
      .limit(1);

    if (!contact) {
      res.status(404).json({
        success: false,
        message: "Contact not found or access denied.",
      });
      return;
    }

    const job = await prospectService.queueConnectionRequest(
      userId,
      contactId,
      note,
      delayMinutes,
    );
    res.status(201).json({ success: true, data: job });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const connectionAcceptedWebhook = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }
    const { linkedinId, firstMessage } = req.body;
    if (!linkedinId) {
      res
        .status(400)
        .json({ success: false, message: "linkedinId is required." });
      return;
    }
    const result = await prospectService.handleConnectionAccepted(
      userId,
      linkedinId,
      firstMessage,
    );
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
