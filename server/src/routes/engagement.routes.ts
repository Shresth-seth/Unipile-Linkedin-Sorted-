import { Router } from "express";
import {
  startWarmupSequence,
  getTargetPosts,
  validateComment,
} from "../controllers/engagement.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/engagement/warmup", authenticate, startWarmupSequence);
router.get("/engagement/posts/:targetId", authenticate, getTargetPosts);
router.post("/engagement/validate-comment", authenticate, validateComment);

export default router;
