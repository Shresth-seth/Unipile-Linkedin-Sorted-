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
 * Returns a safe, user-facing error message that never exposes internals.
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
  return error?.message || fallback;
}
