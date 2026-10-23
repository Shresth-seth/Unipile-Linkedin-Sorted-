import { NextFunction, Response } from "express";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "../db/index.js";
import { contacts, users } from "../db/schema.js";
import { AuthRequest } from "./auth.middleware.js";

export async function requirePaidPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const [user] = await db.select({ plan: users.plan, status: users.subscriptionStatus })
    .from(users).where(eq(users.id, req.user!.userId)).limit(1);
  if (!user || !["PRO", "TEAM"].includes(user.plan) || user.status !== "ACTIVE") {
    res.status(403).json({
      success: false,
      code: "PLAN_UPGRADE_REQUIRED",
      message: "This automation requires an active Pro or Team subscription.",
    });
    return;
  }
  next();
}

export async function requireProspectCapacity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const [user] = await db.select({ plan: users.plan, status: users.subscriptionStatus })
    .from(users).where(eq(users.id, req.user!.userId)).limit(1);
  const effectivePlan = user?.status === "ACTIVE" ? user.plan : "STARTER";
  const limits: Record<string, number> = { STARTER: 50, PRO: 500, TEAM: 2000 };
  const limit = limits[effectivePlan] ?? 50;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [usage] = await db.select({ count: count() }).from(contacts).where(and(
    eq(contacts.userId, req.user!.userId),
    gte(contacts.createdAt, monthStart),
  ));
  if ((usage?.count || 0) >= limit) {
    res.status(403).json({
      success: false,
      code: "MONTHLY_PROSPECT_LIMIT_REACHED",
      message: `Your ${effectivePlan.toLowerCase()} plan includes ${limit} prospects per month.`,
    });
    return;
  }
  next();
}
