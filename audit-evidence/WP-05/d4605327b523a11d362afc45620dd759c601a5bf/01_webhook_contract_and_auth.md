# WP-05: Webhook Contract, Authentication & Boundary Verification

## 1. Executive Summary
This document provides audit evidence for the webhook ingress pipeline hardening implemented for Work Package WP-05 ("Authenticate & Persist Webhooks"). The ingress layer interfaces between external Unipile webhook callbacks and WorkPilot's background conversational intelligence engine.

---

## 2. Webhook Ingress Architecture & Request Normalization

### 2.1 Request Body Sizing & Raw Body Preservation
- **Location:** `server/src/app.ts`
- **Enforcement:**
  - `express.json({ limit: "1mb", verify: (req, _res, buf) => { (req as any).rawBody = Buffer.from(buf); } })`
  - Prevents unbounded memory allocation from payload flooding attacks.
  - Retains unaltered raw byte buffer (`req.rawBody`) for deterministic HMAC signature verification.

### 2.2 Dual-Secret Authentication Boundary
- **Location:** `server/src/services/webhook/webhook-auth.service.ts`
- **Supported Headers:**
  - `unipile-auth` (Primary HTTP header)
  - `x-unipile-secret` (Fallback header)
- **Security Invariants:**
  - Universal fail-closed: If `UNIPILE_WEBHOOK_SECRET` environment variable is missing, undefined, or empty, all incoming requests are rejected with `HTTP 401 Unauthorized` without logging secret material.
  - Constant-time comparison (`crypto.timingSafeEqual`) prevents timing attack side-channel leaks.

### 2.3 Payload Normalization (Unipile v1 & v2 Schemas)
- **Location:** `server/src/controllers/webhook.controller.ts` (`normalizeWebhookPayload`)
- **Normalized Schema:**
```typescript
export interface NormalizedWebhookEvent {
  event: string;
  accountId: string;
  chatId: string;
  messageId: string;
  senderName: string;
  senderProviderId: string;
  text: string;
  isOwnSent: boolean;
  isValid: boolean;
  validationError?: string;
  rawPayload: any;
}
```
- **Validation Rules:**
  - Inbound messages require: `account_id`, `chat_id`, `message_id`, and `sender.attendee_provider_id`.
  - Missing mandatory fields return `HTTP 400 Bad Request` with descriptive validation errors before any database mutation or queuing occurs.

---

## 3. Verification Artifacts & Test Coverage

All invariants are covered by unit regression tests in `server/src/__tests__/unit/webhook-pipeline.test.ts`:
1. `rejected webhook with invalid authentication returns 401 Unauthorized with zero side effects`
2. `malformed payload missing required identifiers returns 400 Bad Request with zero persistence`
