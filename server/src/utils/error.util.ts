/**
 * Utility to sanitize error messages before sending to clients.
 *
 * Prevents leaking raw database errors (SQL queries, schema names, etc.)
 * or internal stack traces to the API consumer.
 */

const DB_ERROR_PATTERNS = [
  "select ",
  "insert ",
  "update ",
  "delete ",
  "Failed query",
  "NeonDbError",
  "PostgresError",
  "relation ",
  "column ",
  "syntax error",
  "violates",
  "duplicate key",
  "foreign key",
  "not-null constraint",
];

/**
 * Returns true if the error message looks like an internal DB / infrastructure error.
 */
export function isInternalDbError(error: any): boolean {
  if (!error) return false;
  // Postgres driver error codes (e.g. "28P01", "42P01", "23505")
  if (error.code && typeof error.code === "string") return true;
  const msg: string = (error.message || "").toLowerCase();
  return DB_ERROR_PATTERNS.some((pattern) => msg.includes(pattern.toLowerCase()));
}

/**
 * Scrubs passwords, bearer tokens, API keys, and connection strings from arbitrary text.
 */
export function redactSensitiveText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi, "$1[REDACTED]$2")
    .replace(/(bearer\s+)[a-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key[:=]\s*)[a-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(password[:=]\s*)[^\s,;&]+/gi, "$1[REDACTED]");
}

/**
 * Returns a safe, user-facing error message that never exposes internals or credentials.
 *
 * @param error        The caught error object.
 * @param fallback     Generic fallback message for this specific operation.
 * @param dbFallback   Override message when a DB/infra error is detected.
 */
export function safeErrorMessage(
  error: any,
  fallback = "An unexpected error occurred.",
  dbFallback = "A database error occurred. Please try again later.",
): string {
  if (isInternalDbError(error)) {
    return dbFallback;
  }
  const rawMsg = error?.message || fallback;
  return redactSensitiveText(rawMsg);
}

/**
 * Typed domain error representing an entity or resource that does not exist or is inaccessible.
 * Enables controllers to safely return HTTP 404 without relying on brittle substring matching.
 */
export class NotFoundError extends Error {
  public readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

