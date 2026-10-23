import { Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { contacts } from "../db/schema.js";
import { engagementService } from "../services/engagement/engagement.service.js";
import { linkedInPostService } from "../services/linkedin/post.service.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { resolveUserId } from "../utils/resolve-user.js";

export const startWarmupSequence = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      contactId,
      postDelayMinutes,
      commentDelayMinutes,
      connectDelayMinutes,
    } = req.body;
    const userId = await resolveUserId(req);

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

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
      res
        .status(404)
        .json({
          success: false,
          message: "Contact not found or access denied.",
        });
      return;
    }

    const result = await engagementService.orchestrateWarmupSequence(
      userId,
      {
        id: contact.id,
        name: contact.name,
        linkedinId: contact.linkedinId,
        company: contact.company || undefined,
        designation: contact.designation || undefined,
      },
      {
        postDelayMinutes,
        commentDelayMinutes,
        connectDelayMinutes,
      },
    );

    res.status(200).json({
      success: true,
      message: `3-Step social warmup sequence successfully queued for ${contact.name}.`,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTargetPosts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const rawTargetId = req.params.targetId;
    if (!rawTargetId) {
      res
        .status(400)
        .json({ success: false, message: "targetId is required." });
      return;
    }
    const targetId = Array.isArray(rawTargetId) ? rawTargetId[0]! : rawTargetId;
    const posts = await linkedInPostService.readPosts(targetId);
    res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const validateComment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { comment } = req.body;
    if (!comment) {
      res
        .status(400)
        .json({ success: false, message: "comment text is required." });
      return;
    }
    const check = engagementService.validateCommentQuality(comment);
    res.status(200).json({ success: true, ...check });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
