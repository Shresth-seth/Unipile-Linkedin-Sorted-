const MIN_SECRET_LENGTH = 32;

function requireSecret(name: string): void {
  const value = process.env[name]?.trim();
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be configured with at least ${MIN_SECRET_LENGTH} characters in production.`,
    );
  }
}

function requireValue(name: string): void {
  if (!process.env[name]?.trim()) throw new Error(`${name} must be configured in production.`);
}

export function validateProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  requireSecret("JWT_SECRET");
  requireSecret("DATA_ENCRYPTION_KEY");
  requireSecret("UNIPILE_WEBHOOK_SECRET");
  requireValue("UNIPILE_API_KEY");
  requireValue("RAZORPAY_KEY_SECRET");
  requireSecret("RAZORPAY_WEBHOOK_SECRET");
  if (!process.env.RESEND_API_KEY?.trim()) throw new Error("RESEND_API_KEY must be configured in production.");
  if (!process.env.EMAIL_FROM?.trim()) throw new Error("EMAIL_FROM must be configured in production.");
  if (!process.env.SUPPORT_EMAIL?.trim()) throw new Error("SUPPORT_EMAIL must be configured in production.");

  for (const name of [
    "UNIPILE_DSN",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_PLAN_PRO_MONTHLY",
    "RAZORPAY_PLAN_PRO_YEARLY",
  ]) {
    requireValue(name);
  }

  const unipileDsn = new URL(process.env.UNIPILE_DSN!.trim());
  if (unipileDsn.protocol !== "https:" || !unipileDsn.hostname.endsWith(".unipile.com")) {
    throw new Error("UNIPILE_DSN must be an HTTPS endpoint on unipile.com in production.");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl || databaseUrl.includes("localhost")) {
    throw new Error("DATABASE_URL must reference a production database.");
  }

  const clientUrl = process.env.CLIENT_URL?.trim();
  if (!clientUrl?.startsWith("https://")) {
    throw new Error("CLIENT_URL must be an HTTPS URL in production.");
  }
}
