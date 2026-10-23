import crypto from "node:crypto";
import { Response, Request } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { billingEvents, users } from "../db/schema.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { BillingCycle, PaidPlan, razorpayService } from "../services/billing/razorpay.service.js";

export async function getSubscription(req: AuthRequest, res: Response): Promise<void> {
  const [user] = await db.select({
    plan: users.plan,
    status: users.subscriptionStatus,
    billingCycle: users.billingCycle,
    currentPeriodEnd: users.currentPeriodEnd,
    cancelAtPeriodEnd: users.cancelAtPeriodEnd,
  }).from(users).where(eq(users.id, req.user!.userId)).limit(1);

  res.json({ success: true, subscription: user });
}

export async function createCheckout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const plan = String(req.body.plan || "").toUpperCase() as PaidPlan;
    const cycle = String(req.body.cycle || "").toLowerCase() as BillingCycle;
    if (plan !== "PRO" || !["monthly", "yearly"].includes(cycle)) {
      res.status(400).json({ success: false, message: "Choose a valid plan and billing cycle." });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }
    if (user.subscriptionStatus === "ACTIVE") {
      res.status(409).json({ success: false, message: "This workspace already has an active subscription." });
      return;
    }
    if (user.subscriptionStatus === "PENDING" && user.razorpaySubscriptionId) {
      const pending = await razorpayService.getSubscription(user.razorpaySubscriptionId);
      if (pending.short_url) {
        res.status(200).json({ success: true, checkoutUrl: pending.short_url });
        return;
      }
    }

    const subscription = await razorpayService.createSubscription({
      userId: user.id,
      email: user.email,
      plan,
      cycle,
    });
    if (!subscription.short_url) throw new Error("The billing provider did not return a checkout link.");
    await db.update(users).set({
      plan,
      subscriptionStatus: "PENDING",
      billingCycle: cycle.toUpperCase(),
      razorpaySubscriptionId: subscription.id,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    res.status(201).json({ success: true, checkoutUrl: subscription.short_url });
  } catch (error: any) {
    res.status(503).json({ success: false, message: error.message || "Unable to start checkout." });
  }
}

export async function cancelSubscription(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    if (!user?.razorpaySubscriptionId) {
      res.status(400).json({ success: false, message: "No paid subscription was found." });
      return;
    }
    await razorpayService.cancelSubscription(user.razorpaySubscriptionId);
    await db.update(users).set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    res.json({ success: true, message: "Your subscription will end after the current billing period." });
  } catch (error: any) {
    res.status(502).json({ success: false, message: error.message || "Unable to cancel subscription." });
  }
}

export async function handleBillingWebhook(req: Request & { rawBody?: Buffer }, res: Response): Promise<void> {
  const rawBody = req.rawBody;
  const signature = req.header("x-razorpay-signature") || undefined;
  if (!rawBody || !razorpayService.verifyWebhook(rawBody, signature)) {
    res.status(401).json({ success: false, message: "Invalid webhook signature." });
    return;
  }

  const event = req.body;
  const entity = event?.payload?.subscription?.entity;
  if (!entity?.id) {
    res.status(200).json({ success: true, ignored: true });
    return;
  }
  const eventId = crypto.createHash("sha256").update(rawBody).digest("hex");
  const notes = entity.notes || {};
  const userId = String(notes.workpilot_user_id || "");
  const plan = String(notes.workpilot_plan).toUpperCase() === "PRO" ? "PRO" : "STARTER";
  const active = ["subscription.activated", "subscription.charged", "subscription.resumed"].includes(event.event);
  const terminal = ["subscription.cancelled", "subscription.completed", "subscription.expired"].includes(event.event);
  const pastDue = ["subscription.pending", "subscription.halted"].includes(event.event);

  const processed = await db.transaction(async (tx) => {
    const [claimed] = await tx.insert(billingEvents)
      .values({ eventId, eventType: event.event, payload: event })
      .onConflictDoNothing({ target: billingEvents.eventId })
      .returning({ id: billingEvents.id });
    if (!claimed) return false;

    if (userId && (active || terminal || pastDue)) {
      await tx.update(users).set({
        plan: terminal ? "STARTER" : plan,
        subscriptionStatus: active ? "ACTIVE" : terminal ? "CANCELED" : "PAST_DUE",
        currentPeriodEnd: entity.current_end ? new Date(entity.current_end * 1000) : null,
        cancelAtPeriodEnd: Boolean(entity.cancel_at_cycle_end),
        updatedAt: new Date(),
      }).where(and(eq(users.id, userId), eq(users.razorpaySubscriptionId, entity.id)));
    }
    return true;
  });

  res.status(200).json({ success: true, duplicate: !processed || undefined });
}
