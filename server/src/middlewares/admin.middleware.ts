import { Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { AuthRequest } from "./auth.middleware.js";

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
    return;
  }

  try {
    const [user] = await db
      .select({ id: users.id, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User account not found.",
      });
      return;
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isSuperAdminEmail = adminEmails.includes(user.email.toLowerCase());

    if (user.role !== "ADMIN" && !isSuperAdminEmail) {
      res.status(403).json({
        success: false,
        message: "Access forbidden. You do not have administrator privileges.",
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error("Admin middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during authorization check.",
    });
  }
};
