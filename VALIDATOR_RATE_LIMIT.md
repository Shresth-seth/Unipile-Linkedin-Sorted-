# WORKPILOT — Express-Validator & Rate Limiting System Architecture

**Document Version:** 1.0.0  
**Status:** Implemented & Verified (6/6 Tests Passing)  
**Date:** September 2026  
**Target Components:**

- `server/src/middlewares/rate-limit-middleware.ts`
- `server/src/middlewares/validate.middleware.ts`
- `server/src/routes/auth.routes.ts`
- `server/src/scripts/test-validator-rate-limit.ts`

---

## 1. Overview & Objectives

To protect the **WORKPILOT** backend API against brute-force attacks, credential stuffing, spam registrations, and malformed payload injection, we integrated **`express-validator`** input validation and custom **`express-rate-limit`** tiering into the authentication routing layer.

### Core Goals Achieved:

1. **Tiered Rate Limiting:** Granular throttling per endpoint (login, register, logout, account deletion, and global).
2. **Schema & Semantic Validation:** Strict validation for required fields, email formatting, and password constraints prior to database execution.
3. **Structured Error Contract:** Consistent HTTP 400 response contract supplying both a top-level error `message` and an array of individual field errors (`errors: [...]`).
4. **Execution Order:** `Rate Limiter` executes first to deflect flood traffic cheaply before any parsing or DB operations occur.

---

## 2. Rate Limiting Middleware Architecture

File: [`server/src/middlewares/rate-limit-middleware.ts`](file:///d:/WORKPILOT%20Connect/server/src/middlewares/rate-limit-middleware.ts)

The rate limiting middleware utilizes standard client IP identification with localized sliding windows:

| Limiter                  | Target Endpoint                       | Window (ms)         | Max Requests | HTTP Status | Response Message                                                         |
| :----------------------- | :------------------------------------ | :------------------ | :----------- | :---------- | :----------------------------------------------------------------------- |
| **`GlobalLimit`**        | `GET /api/auth/me` (and general APIs) | 1 min (`60,000ms`)  | 10           | `429`       | "Too many requests, please try again after 1 minutes 🚦"                 |
| **`registerLimit`**      | `POST /api/auth/signup`               | 5 min (`300,000ms`) | 10           | `429`       | "Too many registration attempts, please try again after 5 minutes 🛑"    |
| **`loginLimit`**         | `POST /api/auth/login`                | 2 min (`120,000ms`) | 5            | `429`       | "Too many login attempts, please try again after 2 minute ⚠️"            |
| **`logoutLimit`**        | `POST /api/auth/logout`               | 1 min (`60,000ms`)  | 10           | `429`       | "Too many logout attempts, please try again after 1 minute 🚪"           |
| **`deleteAccountLimit`** | `DELETE /api/auth/account`            | 1 min (`60,000ms`)  | 5            | `429`       | "Too many account deletion attempts, please try again after 1 minute 🚪" |

---

## 3. Express-Validator Middleware

File: [`server/src/middlewares/validate.middleware.ts`](file:///d:/WORKPILOT%20Connect/server/src/middlewares/validate.middleware.ts)

The validation handler intercepts requests immediately following the `express-validator` inspection chain:

```typescript
import { validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const ValidateData = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const errorList = errors.array();
      return res.status(400).json({
        success: false,
        message: errorList[0]?.msg || "Validation error.",
        errors: errorList,
      });
    }
    return next();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error during validation.",
    });
  }
};

export default ValidateData;
```

### Standard Error Response Shape (HTTP 400):

```json
{
  "success": false,
  "message": "Password must be at least 6 characters long.",
  "errors": [
    {
      "type": "field",
      "value": "123",
      "msg": "Password must be at least 6 characters long.",
      "path": "password",
      "location": "body"
    }
  ]
}
```

---

## 4. Auth Routes Implementation

File: [`server/src/routes/auth.routes.ts`](file:///d:/WORKPILOT%20Connect/server/src/routes/auth.routes.ts)

Validation chains are declared directly and piped with the corresponding rate limiter:

### 1. Registration (`POST /api/auth/signup`)

- **`name`**: Trimmed, non-empty, minimum length of 2 characters.
- **`email`**: Trimmed, valid email syntax, normalized to lowercase.
- **`password`**: Non-empty, minimum length of 6 characters.
- **Pipeline:** `registerLimit` ➔ `signupValidation` (`ValidateData`) ➔ `signup` controller.

```typescript
export const signupValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required.")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters long."),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required.")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required.")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long."),
  ValidateData,
];
```

### 2. Login (`POST /api/auth/login`)

- **`email`**: Trimmed, valid email syntax, normalized to lowercase.
- **`password`**: Non-empty.
- **Pipeline:** `loginLimit` ➔ `loginValidation` (`ValidateData`) ➔ `login` controller.

```typescript
export const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required.")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required."),
  ValidateData,
];
```

### 3. Route Map

```typescript
router.post("/signup", registerLimit, signupValidation, signup);
router.post("/login", loginLimit, loginValidation, login);
router.get("/me", GlobalLimit, authenticate, getMe);
router.post("/logout", logoutLimit, logout);
router.delete("/account", deleteAccountLimit, authenticate, deleteAccount);
```

---

## 5. Automated Verification & Test Results

A dedicated end-to-end automated test runner was authored at [`server/src/scripts/test-validator-rate-limit.ts`](file:///d:/WORKPILOT%20Connect/server/src/scripts/test-validator-rate-limit.ts) and registered as `npm run test:validator`.

### Test Suite Execution Output:

```bash
> server@1.0.0 test:validator
> tsx src/scripts/test-validator-rate-limit.ts

=======================================================
🧪 Express-Validator & Rate-Limit Verification Suite
📡 Target API: http://localhost:4000/api/auth
=======================================================

🟢 Server is online and responding.

✅ [400] Validator: Signup rejects empty body with 400 and validation error array
✅ [400] Validator: Signup rejects invalid email format with 400
✅ [400] Validator: Signup rejects password shorter than 6 characters with 400
✅ [400] Validator: Login rejects missing email and password with 400
✅ [400] Validator: Login rejects malformed email format with 400

⏳ Testing Login Rate Limiter (loginLimit: max 3 requests per 2 minutes)...
✅ [429] RateLimit: Triggers 429 Too Many Requests when loginLimit is exceeded

=======================================================
📊 Test Summary: 6/6 tests passed
=======================================================

🎉 All express-validator and rate-limiting tests passed successfully!
```

---

## 6. Frontend Compatibility

The frontend forms ([`LoginForm`](file:///d:/WORKPILOT%20Connect/client/components/auth/login-form.tsx) and [`RegisterForm`](file:///d:/WORKPILOT%20Connect/client/components/auth/register-form.tsx)) seamlessly handle the validation responses:

1. If validation fails, `error.response?.data?.message` receives the exact validation message (e.g. _"Password must be at least 6 characters long."_).
2. The UI renders the error message in the alert pill without crashing or requiring page reload.
3. If rate-limited, the HTTP 429 message _"Too many login attempts, please try again after 2 minute ⚠️"_ is directly surfaced to the user.

---

## 7. How to Run Verification

From the server directory:

```bash
# Run the automated validator and rate limit test suite
npm run test:validator

# Verify complete TypeScript compilation
npx tsc --noEmit
```

Both commands return clean zero-exit-code status.
