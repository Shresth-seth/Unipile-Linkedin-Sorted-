import { Request, Response, NextFunction } from "express";
import { verifyJwt, TokenPayload } from "../utils/jwt.util.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
    return;
  }

  const decoded = verifyJwt(token);
  if (!decoded) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please log in again.",
    });
    return;
  }

  const [account] = await db
    .select({ sessionVersion: users.sessionVersion, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, decoded.userId))
    .limit(1);
  if (!account || !account.emailVerifiedAt || account.sessionVersion !== (decoded.sessionVersion ?? 0)) {
    res.clearCookie("token");
    res.status(401).json({
      success: false,
      message: "Your session is no longer valid. Please log in again.",
    });
    return;
  }

  req.user = decoded;
  next();
};
