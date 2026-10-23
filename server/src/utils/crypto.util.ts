import crypto from "crypto";
import "../config/dotenv.config.js";

const ALGORITHM = "aes-256-gcm";
const SECRET = process.env.DATA_ENCRYPTION_KEY?.trim();
if (process.env.NODE_ENV === "production" && (!SECRET || SECRET.length < 32)) {
  throw new Error("DATA_ENCRYPTION_KEY must contain at least 32 characters in production.");
}
const KEY = crypto
  .createHash("sha256")
  .update(SECRET || "local-development-only-encryption-key")
  .digest();

const LEGACY_KEY = crypto
  .createHash("sha256")
  .update(process.env.JWT_SECRET?.trim() || "default-WORKPILOT-secret-key-32")
  .digest();

export function encryptData(data: any): string {
  if (!data) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const text = typeof data === "string" ? data : JSON.stringify(data);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `v2:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptData<T = any>(encryptedString: string): T | null {
  try {
    if (!encryptedString || !encryptedString.includes(":")) return null;
    const parts = encryptedString.split(":");
    const isV2 = parts[0] === "v2";
    const ivHex = isV2 ? parts[1] : parts[0];
    const authTagHex = isV2 ? parts[2] : undefined;
    const encryptedHex = isV2 ? parts[3] : parts[1];
    if (!ivHex || !encryptedHex) return null;
    const iv = Buffer.from(ivHex, "hex");
    let decrypted: string;
    if (isV2) {
      if (!authTagHex) return null;
      const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
    } else {
      const decipher = crypto.createDecipheriv("aes-256-cbc", LEGACY_KEY, iv);
      decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
    }
    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return decrypted as unknown as T;
    }
  } catch (err) {
    return null;
  }
}

export function encryptSecret(value: string): string {
  return encryptData(value.trim());
}

export function decryptStoredSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("v2:")) return value.trim();
  return decryptData<string>(value) || "";
}
