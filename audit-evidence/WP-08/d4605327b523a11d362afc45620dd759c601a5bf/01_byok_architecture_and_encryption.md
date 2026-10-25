# WP-08: AI Model Provider, BYOK Architecture & Encryption Proof

## 1. Executive Summary
This document provides audit evidence for the Bring Your Own Key (BYOK) architecture, API key encryption at rest, and priority resolution implemented for Work Package WP-08 ("Constrain AI Tools and BYOK").

---

## 2. BYOK Priority Hierarchy & Model Resolution

### 2.1 Resolution Hierarchy
- **Location:** `server/src/services/ai/gemini-config.service.ts` (`GeminiConfigService.getUserConfig`)
- **Precedence Order:**
  1. **User Custom Key (`USER_CUSTOM`):** If the authenticated user has configured their own Gemini API key in `users.geminiApiKey`, it takes precedence.
  2. **Database System Setting:** If configured in `system_settings` under key `gemini_api_key`.
  3. **Environment Variable (`SYSTEM_DEFAULT`):** Fallback to `process.env.GEMINI_API_KEY` or `process.env.GOOGLE_API_KEY`.

### 2.2 At-Rest Key Encryption
- **Standard:** All personal API keys stored in `users.geminiApiKey` and system keys in `system_settings.value` are encrypted using AES-256-GCM authenticated encryption (`v2:iv:tag:ciphertext`).
- **Secret Redaction:**
  - Raw API keys are never returned in public config responses.
  - The `maskKey(key)` method returns an obfuscated representation (e.g., `AIzaSy••••3456`) for UI verification.

### 2.3 Per-User Cache Isolation
- `userConfigCache` maintains an in-memory Map keyed by `userId` with a 60-second TTL.
- Calls to `setUserConfig(userId, ...)` immediately purge the target user's cache entry to ensure immediate key rotation.

---

## 3. Test Evidence

Validated in `server/src/__tests__/unit/ai-tools-and-byok.test.ts`:
- `returns USER_CUSTOM key when configured and masks key properly` (PASS)
- `falls back to SYSTEM_DEFAULT key when user has no custom key` (PASS)
- `setUserConfig encrypts personal API key at rest using AES-256-GCM` (PASS)
