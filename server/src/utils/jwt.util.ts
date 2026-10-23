import jwt from "jsonwebtoken";

export interface TokenPayload {
  userId: string;
  id?: string;
  email: string;
  role?: string; // 'USER' | 'ADMIN'
  sessionVersion?: number;
}

const JWT_SECRET = process.env.JWT_SECRET?.trim();
if (process.env.NODE_ENV === "production" && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET must contain at least 32 characters in production.");
}
const SIGNING_SECRET = JWT_SECRET || "local-development-only-jwt-secret";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as any;

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(
    {
      userId: payload.userId,
      id: payload.userId,
      email: payload.email,
      role: payload.role || "USER",
      sessionVersion: payload.sessionVersion ?? 0,
    },
    SIGNING_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    },
  );
};

export const verifyJwt = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, SIGNING_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
};
