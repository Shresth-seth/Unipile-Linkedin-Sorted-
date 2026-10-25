# WP-13: Application Security Headers & CSRF Protection

**Work Package:** WP-13 ("Close Application and Supply-Chain Risks", Handover Pages 30–31)  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Date:** 2026-10-25  
**Harness Tests:** `server/src/__tests__/unit/application-and-supply-chain.test.ts`

---

## 1. Browser Defense-in-Depth Headers

Configured centrally in `server/src/app.ts`:

```typescript
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
```

- **MIME Sniffing Prevention:** `X-Content-Type-Options: nosniff` stops browsers from interpreting files as a different MIME type.
- **Clickjacking Protection:** `X-Frame-Options: DENY` prevents rendering WorkPilot in an iframe.
- **Referrer Privacy:** `Referrer-Policy: strict-origin-when-cross-origin` preserves user token secrecy by stripping paths from cross-origin links.
- **Hardware Privacy:** `Permissions-Policy: camera=(), microphone=(), geolocation=()` blocks access to device hardware.
- **Server Fingerprint Removal:** `x-powered-by` header is completely removed.
- **HSTS Enforcement:** `Strict-Transport-Security: max-age=31536000; includeSubDomains` forces HTTPS in production.

---

## 2. Cross-Site Request Forgery (CSRF) & Origin Validation

WorkPilot employs a dual protection model:
1. **Bearer Token Architecture:** Standard API operations require `Authorization: Bearer <JWT>`, immune to classic browser CSRF ambient credential exploitation.
2. **Cookie Mutation Origin Guard:** For any cookie-authenticated session, state-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) require a validated `Origin` header matching `allowedOrigins`:
   ```typescript
   if (
     process.env.NODE_ENV === "production" &&
     req.cookies?.token &&
     !["GET", "HEAD", "OPTIONS"].includes(req.method)
   ) {
     const origin = req.header("origin")?.replace(/\/+$/, "");
     if (!origin || !allowedOrigins.includes(origin)) {
       res.status(403).json({ success: false, message: "Request origin is not allowed." });
       return;
     }
   }
   ```
   Cross-origin forged mutations receive an immediate HTTP 403 Forbidden.

---

## 3. Sensitive Data Redaction & Error Masking

Database query exceptions, stack traces, and internal schema names are sanitized by `safeErrorMessage` before reaching the HTTP response layer:
- Postgres relation names (`PostgresError: relation contacts not found in schema`) are converted to clean, generic messages.
- Connection strings and authorization headers are scrubbed of secrets.
- Zero sensitive data leaks in HTTP responses.
