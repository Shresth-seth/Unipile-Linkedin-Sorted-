import { Request, Response } from "express";
import { emailService } from "../services/email/email.service.js";

export async function submitContact(req: Request, res: Response): Promise<void> {
  const { name, email, company = "", topic = "Product question", message, website = "" } = req.body || {};
  if (website) {
    res.status(202).json({ success: true, message: "Message received." });
    return;
  }
  if (!name || !email || !message || String(message).length > 4000) {
    res.status(400).json({ success: false, message: "Name, email, and a message under 4,000 characters are required." });
    return;
  }
  try {
    await emailService.sendContactMessage({
      name: String(name).trim().slice(0, 120),
      email: String(email).trim().slice(0, 255),
      company: String(company).trim().slice(0, 160),
      topic: String(topic).trim().slice(0, 80),
      message: String(message).trim(),
    });
    res.status(202).json({ success: true, message: "Message received." });
  } catch {
    res.status(503).json({ success: false, message: "We could not deliver your message. Please try again later." });
  }
}
