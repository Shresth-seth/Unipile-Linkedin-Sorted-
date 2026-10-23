import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, linkedinAccounts, contacts, messages, actionQueue, authTokens } from "../db/schema.js";
import { generateToken } from "../utils/jwt.util.js";
import { safeErrorMessage } from "../utils/error.util.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { unipileClient } from "../services/unipile/unipile.client.js";
import { dailyAgentService } from "../agent/daily/daily-agent.service.js";
import { emailService } from "../services/email/email.service.js";
import { razorpayService } from "../services/billing/razorpay.service.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function createOpaqueToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: crypto.createHash("sha256").update(raw).digest("hex") };
}

export const signup = async (req: Request, res: Response): Promise<void> => {
  let createdUserId: string | undefined;
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Please provide name, email, and password.",
      });
      return;
    }

    if (password.length < 10) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 10 characters long.",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
      return;
    }

    // Capture client timezone if provided (header or body)
    const userTimezone = (
      req.body.timezone ||
      req.headers["x-timezone"] ||
      "UTC"
    ).toString().trim();

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Public registration never grants admin access unless explicitly allowlisted.
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const initialRole =
      adminEmails.includes(normalizedEmail) ? "ADMIN" : "USER";

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: initialRole,
        timezone: userTimezone,
        emailVerifiedAt: process.env.NODE_ENV === "production" ? null : new Date(),
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        plan: users.plan,
        subscriptionStatus: users.subscriptionStatus,
        createdAt: users.createdAt,
      });

    if (!newUser) {
      res.status(500).json({
        success: false,
        message: "Failed to create user account.",
      });
      return;
    }
    createdUserId = newUser.id;

    // Auto-initialize Daily Agent schedule at 04:00 AM in user's local timezone
    await dailyAgentService.ensureUserInitialized(newUser.id, userTimezone);

    if (process.env.NODE_ENV === "production") {
      const verification = createOpaqueToken();
      await db.insert(authTokens).values({
        userId: newUser.id,
        tokenHash: verification.hash,
        type: "EMAIL_VERIFICATION",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await emailService.sendVerification(newUser.email, newUser.name, verification.raw);
    } else {
      const token = generateToken({ userId: newUser.id, email: newUser.email, role: newUser.role, sessionVersion: 0 });
      res.cookie("token", token, COOKIE_OPTIONS);
    }

    res.status(201).json({
      success: true,
      message: process.env.NODE_ENV === "production"
        ? "Account created. Check your email to verify your workspace."
        : "User registered successfully.",
      requiresEmailVerification: process.env.NODE_ENV === "production",
      user: newUser,
    });
  } catch (error: any) {
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId)).catch(() => undefined);
    }
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Internal server error during signup."),
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Please provide email and password.",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    if (!user.emailVerifiedAt) {
      res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before signing in.",
      });
      return;
    }

    // Determine effective role: check DB role or ADMIN_EMAILS env fallback
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const effectiveRole =
      user.role === "ADMIN" || adminEmails.includes(user.email.toLowerCase())
        ? "ADMIN"
        : user.role || "USER";

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: effectiveRole,
      sessionVersion: user.sessionVersion,
    });

    // Set cookie
    res.cookie("token", token, COOKIE_OPTIONS);

    // Fetch user's linked LinkedIn accounts
    const linkedAccounts = await db
      .select({
        id: linkedinAccounts.id,
        linkedinName: linkedinAccounts.linkedinName,
        linkedinEmail: linkedinAccounts.linkedinEmail,
        isConnected: linkedinAccounts.isConnected,
        healthStatus: linkedinAccounts.healthStatus,
        automationStatus: linkedinAccounts.automationStatus,
      })
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, user.id));

    // Ensure Daily Agent schedule is initialized with user's local timezone
    const userTimezone = (
      req.body.timezone ||
      req.headers["x-timezone"] ||
      ""
    ).toString().trim();
    await dailyAgentService.ensureUserInitialized(user.id, userTimezone);

    res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: effectiveRole,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
        linkedinAccounts: linkedAccounts,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Internal server error during login."),
    });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const hash = crypto.createHash("sha256").update(String(req.body.token || "")).digest("hex");
  const [record] = await db.select().from(authTokens).where(and(
    eq(authTokens.tokenHash, hash),
    eq(authTokens.type, "EMAIL_VERIFICATION"),
    isNull(authTokens.usedAt),
    gt(authTokens.expiresAt, new Date()),
  )).limit(1);
  if (!record) {
    res.status(400).json({ success: false, message: "This verification link is invalid or expired." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, record.userId));
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, record.id));
  });
  res.json({ success: true, message: "Email verified. You can now sign in." });
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user) {
    const reset = createOpaqueToken();
    await db.insert(authTokens).values({
      userId: user.id,
      tokenHash: reset.hash,
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await emailService.sendPasswordReset(user.email, user.name, reset.raw);
  }
  res.json({ success: true, message: "If that email exists, a reset link has been sent." });
};

export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user && !user.emailVerifiedAt) {
    const verification = createOpaqueToken();
    const [created] = await db.insert(authTokens).values({
      userId: user.id,
      tokenHash: verification.hash,
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).returning({ id: authTokens.id });
    try {
      await emailService.sendVerification(user.email, user.name, verification.raw);
    } catch (error) {
      if (created) await db.delete(authTokens).where(eq(authTokens.id, created.id));
      throw error;
    }
  }
  res.json({ success: true, message: "If that account needs verification, a new link has been sent." });
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const rawToken = String(req.body.token || "");
  const password = String(req.body.password || "");
  if (password.length < 10) {
    res.status(400).json({ success: false, message: "Password must be at least 10 characters long." });
    return;
  }
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const [record] = await db.select().from(authTokens).where(and(
    eq(authTokens.tokenHash, hash),
    eq(authTokens.type, "PASSWORD_RESET"),
    isNull(authTokens.usedAt),
    gt(authTokens.expiresAt, new Date()),
  )).limit(1);
  if (!record) {
    res.status(400).json({ success: false, message: "This reset link is invalid or expired." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await db.transaction(async (tx) => {
    await tx.update(users).set({
      password: passwordHash,
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
    }).where(eq(users.id, record.userId));
    await tx.update(authTokens).set({ usedAt: new Date() }).where(and(
      eq(authTokens.userId, record.userId),
      eq(authTokens.type, "PASSWORD_RESET"),
      isNull(authTokens.usedAt),
    ));
  });
  res.clearCookie("token", COOKIE_OPTIONS);
  res.json({ success: true, message: "Password updated. Sign in with your new password." });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized." });
      return;
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        plan: users.plan,
        subscriptionStatus: users.subscriptionStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const clientTimezone = (req.headers["x-timezone"] || "").toString().trim();
    if (clientTimezone) {
      await dailyAgentService.ensureUserInitialized(user.id, clientTimezone);
    }

    // Get linked LinkedIn accounts
    const linkedAccounts = await db
      .select({
        id: linkedinAccounts.id,
        linkedinName: linkedinAccounts.linkedinName,
        linkedinEmail: linkedinAccounts.linkedinEmail,
        isConnected: linkedinAccounts.isConnected,
        healthStatus: linkedinAccounts.healthStatus,
        automationStatus: linkedinAccounts.automationStatus,
      })
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, userId));

    // Determine effective role: check DB role or ADMIN_EMAILS env fallback
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const effectiveRole =
      user.role === "ADMIN" || adminEmails.includes(user.email.toLowerCase())
        ? "ADMIN"
        : user.role || "USER";

    res.status(200).json({
      success: true,
      user: {
        ...user,
        role: effectiveRole,
        linkedinAccounts: linkedAccounts,
      },
    });
  } catch (error: any) {
    console.error("GetMe error:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Internal server error fetching user profile."),
    });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie("token", COOKIE_OPTIONS);
  res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};

/**
 * Permanently deletes user account, LinkedIn connection, campaigns, and queues.
 * DELETE /api/auth/account
 */
export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const [account] = await db.select({
      razorpaySubscriptionId: users.razorpaySubscriptionId,
      subscriptionStatus: users.subscriptionStatus,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!account) {
      res.status(404).json({ success: false, message: "Account not found." });
      return;
    }

    if (account.razorpaySubscriptionId && ["ACTIVE", "PENDING", "PAST_DUE"].includes(account.subscriptionStatus)) {
      try {
        await razorpayService.cancelSubscription(account.razorpaySubscriptionId);
      } catch (error) {
        console.error("Subscription cancellation before account deletion failed:", error);
        res.status(502).json({
          success: false,
          message: "We could not cancel your subscription, so the account was not deleted. Please retry or contact support.",
        });
        return;
      }
    }

    // 1. Disconnect any connected Unipile remote accounts
    const linkedAccounts = await db
      .select()
      .from(linkedinAccounts)
      .where(eq(linkedinAccounts.userId, userId));

    let remoteDisconnectFailed = false;
    for (const acc of linkedAccounts) {
      if (acc.unipileAccountId) {
        try {
          await unipileClient.disconnectAccount(acc.unipileAccountId);
        } catch (error) {
          remoteDisconnectFailed = true;
          console.error("Remote LinkedIn account deletion failed:", error);
        }
      }
    }
    if (remoteDisconnectFailed) {
      res.status(502).json({
        success: false,
        message: "We could not remove all hosted LinkedIn connections, so local account deletion was stopped. Please retry or contact support.",
      });
      return;
    }

    // 2. Cascade delete will clean child tables, but delete explicitly for safety
    try {
      await db.delete(actionQueue).where(eq(actionQueue.userId, userId));
      await db.delete(messages).where(eq(messages.userId, userId));
      await db.delete(contacts).where(eq(contacts.userId, userId));
      await db.delete(linkedinAccounts).where(eq(linkedinAccounts.userId, userId));
    } catch (e) {
      console.warn("Cascade table cleanup notice:", e);
    }

    // 3. Delete user row
    await db.delete(users).where(eq(users.id, userId));

    // 4. Clear auth cookie
    res.clearCookie("token", COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: "Account and all associated workspace data have been permanently deleted.",
    });
  } catch (error: any) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to delete account."),
    });
  }
};
