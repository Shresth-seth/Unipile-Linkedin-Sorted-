# WP-07: Authentication Methods & Credential Encryption Proof

## 1. Executive Summary
This document provides audit evidence for Work Package WP-07 ("Verify LinkedIn Account Lifecycle"). It covers the three authentication mechanisms supported by WorkPilot (Hosted OAuth Link, Session Cookie, Native Credentials) and the cryptographic security applied to stored credentials.

---

## 2. Authentication Methods Architecture

### 2.1 Hosted OAuth Authentication Link
- **Location:** `server/src/services/linkedin/account.service.ts` (`generateAuthLink`)
- **Mechanics:**
  - Invokes `unipileClient.createHostedAuthLink({ successRedirectUrl })`.
  - Returns a secure, hosted browser redirect URL.
  - Zero raw user credentials touch WorkPilot during this flow.

### 2.2 Native Credentials Login (Username / Password)
- **Location:** `server/src/services/linkedin/account.service.ts` (`connectWithCredentials`)
- **Flow:**
  1. User supplies LinkedIn username and password.
  2. Dispatched to Unipile via `unipileClient.connectWithCredentials`.
  3. If a 2FA/OTP security checkpoint is encountered, the credentials and environmental metadata (country, userAgent) are encrypted and stored in `linkedinAccounts.encryptedCredentials` with `authMethod: "CREDENTIALS"`.
  4. Returns checkpoint challenge details (`2FA`, `OTP`, or `IN_APP_VALIDATION`) for frontend resolution.

### 2.3 Session Cookie Connection (`li_at` / `li_a`)
- **Location:** `server/src/services/linkedin/account.service.ts` (`connectWithCookie`)
- **Flow:**
  1. User supplies session cookie (`li_at`) and optional premium token (`li_a`).
  2. Verified with Unipile via `unipileClient.connectWithCookie`.
  3. The cookie payload is encrypted via AES-256-GCM and stored in `linkedinAccounts.encryptedCredentials` with `authMethod: "COOKIE"`.

---

## 3. Cryptographic Storage & Key Derivation

### 3.1 Encryption Standard
- **Location:** `server/src/utils/crypto.util.ts`
- **Algorithm:** `aes-256-gcm` (Authenticated Encryption with Associated Data).
- **Format:** `v2:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
  - IV: 12-byte cryptographically secure random buffer (`crypto.randomBytes(12)`).
  - Auth Tag: 16-byte GCM authentication tag preventing tampering.
  - Key: Derived via SHA-256 hash of `DATA_ENCRYPTION_KEY` (minimum 32 characters in production).

### 3.2 Decryption & Tamper Resistance
- Any alteration to ciphertext, IV, or authentication tag causes `decipher.final()` to reject decryption, returning `null` safely without leaking secret material or throwing unhandled errors.

---

## 4. Test Evidence

Validated in `server/src/__tests__/unit/linkedin-account-lifecycle.test.ts`:
- `generateAuthLink calls Unipile hosted auth link generator` (PASS)
- `connectWithCredentials encrypts credentials using AES-256-GCM when checkpoint is triggered` (PASS)
- `connectWithCookie securely encrypts session cookie and links account` (PASS)
