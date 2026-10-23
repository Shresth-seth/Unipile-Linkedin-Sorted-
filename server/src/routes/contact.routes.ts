import { Router } from "express";
import { contactLimit } from "../middlewares/rate-limit-middleware.js";
import { submitContact } from "../controllers/contact.controller.js";

const router = Router();
router.post("/", contactLimit, submitContact);
export default router;
