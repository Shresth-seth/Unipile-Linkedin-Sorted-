# Unipile LinkedIn Authentication Integration Guide

This guide documents the native Unipile authentication implementation in **WORKPILOT**, supporting **both** login methods per the [Unipile Documentation](https://developer.unipile.com/docs/getting-started):

1. **ID & Password (Username / Password)**
2. **Session Cookie (`li_at` + optional `li_a`)**
3. **Security Checkpoint Handling (`2FA`, `OTP`, and `IN_APP_VALIDATION`)**

---

## 1. Authentication Architecture

```
                               ┌─────────────────────────────┐
                               │     WORKPILOT Client     │
                               │ (LinkedInConnectModal.tsx)  │
                               └──────────────┬──────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
         Method 1: ID & Password                             Method 2: Session Cookie
  POST /api/linkedin/connect/credentials              POST /api/linkedin/connect/cookie
  { username, password, country, userAgent }         { li_at, li_a, country, userAgent }
                    │                                                   │
                    └─────────────────────────┬─────────────────────────┘
                                              ▼
                               ┌─────────────────────────────┐
                               │    WORKPILOT Backend     │
                               │  (linkedin.controller.ts)   │
                               └──────────────┬──────────────┘
                                              ▼
                               ┌─────────────────────────────┐
                               │   Unipile API Gateway       │
                               │  (POST /api/v1/accounts)    │
                               └──────────────┬──────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                                               │
             HTTP 201 (Success)                              HTTP 202 (Checkpoint)
           Directly Connected!                         2FA / OTP / In-App Confirmation
                      │                                               │
                      │                                               ▼
                      │                               ┌─────────────────────────────┐
                      │                               │ Checkpoint Resolver Modal   │
                      │                               │  - Enter 6-digit SMS / OTP  │
                      │                               │  - Tap 'Yes' on Phone App   │
                      │                               │  - Try Another Way option   │
                      │                               │  - Resend Code              │
                      │                               └──────────────┬──────────────┘
                      │                                              │
                      └───────────────────────┬──────────────────────┘
                                              ▼
                               ┌─────────────────────────────┐
                               │   SQLite / Drizzle Store    │
                               │   Account Active & Sync'd   │
                               └─────────────────────────────┘
```

---

## 2. API Endpoints Reference

All endpoints require JWT authorization (`Bearer <token>` or active session cookie).

### A. Connect with ID & Password

- **Route**: `POST /api/linkedin/connect/credentials`
- **Body**:
  ```json
  {
    "username": "user@example.com",
    "password": "your_password",
    "country": "US", // optional ISO 3166-1 alpha-2 proxy country code
    "userAgent": "Mozilla/5.0..." // optional client User-Agent
  }
  ```
- **Responses**:
  - **Success (HTTP 200)**:
    ```json
    {
      "success": true,
      "checkpoint": false,
      "accountId": "acc_xyz123",
      "account": {
        "id": "...",
        "linkedinName": "Alex Doe",
        "isConnected": true
      },
      "message": "LinkedIn account connected successfully via credentials."
    }
    ```
  - **Checkpoint Triggered (HTTP 200)**:
    ```json
    {
      "success": true,
      "checkpoint": true,
      "accountId": "acc_xyz123",
      "checkpointType": "2FA", // "2FA" | "OTP" | "IN_APP_VALIDATION"
      "message": "Security checkpoint triggered (2FA). Please solve to continue."
    }
    ```

---

### B. Connect with Session Cookie (`li_at`)

- **Route**: `POST /api/linkedin/connect/cookie`
- **Body**:
  ```json
  {
    "li_at": "AQEDAT...",
    "li_a": "AQED...", // optional premium cookie for Sales Navigator
    "country": "US", // optional proxy country
    "userAgent": "Mozilla/5.0..." // matching client user agent
  }
  ```
- **Advantages of Cookie Login**:
  - Bypasses 2FA challenges in most cases.
  - Recommended for SSO or enterprise-enforced LinkedIn profiles.
  - Automatically supplies the matching browser User-Agent to prevent session revocation.

---

### C. Solve Checkpoint

- **Route**: `POST /api/linkedin/checkpoint/solve`
- **Body**:
  ```json
  {
    "accountId": "acc_xyz123",
    "code": "123456" // or "TRY_ANOTHER_WAY"
  }
  ```
- **Note**: Passing `code: "TRY_ANOTHER_WAY"` requests LinkedIn to switch from `IN_APP_VALIDATION` to SMS/email OTP.

---

### D. Resend Checkpoint Code

- **Route**: `POST /api/linkedin/checkpoint/resend`
- **Body**:
  ```json
  {
    "accountId": "acc_xyz123"
  }
  ```

---

### E. Check In-App Validation Status

- **Route**: `GET /api/linkedin/checkpoint/status/:accountId`
- **Response**:
  ```json
  {
    "success": true,
    "isConnected": true,
    "status": "OK",
    "account": { ... }
  }
  ```

---

### F. Get Active Connected LinkedIn Account

- **Route**: `GET /api/linkedin/account`
- **Query Params**: `accountId` (optional)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "tvKrFOnCQEeTTpO3GNklng",
      "name": "Alex Doe",
      "type": "LINKEDIN",
      "provider": "LINKEDIN",
      "status": "OK"
    }
  }
  ```

---

### G. Get Profile (By Public Identifier, URL, or Provider ID)

- **Route**: `GET /api/linkedin/profile/:identifier`
- **Example**: `GET /api/linkedin/profile/satyanadella`
- **Query Params**: `accountId` (optional; auto-resolved if omitted)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "name": "Satya Nadella",
      "first_name": "Satya",
      "last_name": "Nadella",
      "headline": "Chairman and CEO at Microsoft",
      "public_identifier": "satyanadella",
      "provider_id": "ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ",
      "company": "Microsoft",
      "location": "Redmond, Washington, United States",
      "profile_url": "https://www.linkedin.com/in/satyanadella"
    }
  }
  ```

---

### H. Search People on LinkedIn

- **Route**: `GET /api/linkedin/search` (also supports `POST /api/linkedin/search`)
- **Query / Body Params**:
  - `query` or `keywords`: text search query (e.g., `"AI Engineer"`, `"CEO"`)
  - `url`: optional direct LinkedIn search URL from your browser
  - `location`, `company`, `role`: optional filter criteria
  - `limit`: number of results (default `10`)
  - `accountId`: optional account ID (auto-resolved if omitted)
- **Response**:
  ```json
  {
    "success": true,
    "isLive": true,
    "source": "LIVE_LINKEDIN",
    "count": 10,
    "data": [
      {
        "name": "Satya Nadella",
        "linkedin_id": "ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ",
        "designation": "Chairman and CEO at Microsoft",
        "company": "Microsoft",
        "location": "Redmond, Washington, United States"
      }
    ]
  }
  ```

---

### I. Send Connection Request (Invite)

- **Route**: `POST /api/linkedin/connection` (or `POST /api/linkedin/invite`)
- **Body** (supports multiple formats):
  - **By provider_id**:
    ```json
    {
      "provider_id": "ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ",
      "message": "Hey Satya, came across your profile and would love to connect!",
      "accountId": "tvKrFOnCQEeTTpO3GNklng" // optional, auto-resolved if omitted
    }
    ```
  - **By public identifier / profile URL** (auto-resolves provider_id via `getProfile`):
    ```json
    {
      "identifier": "satyanadella",
      "message": "Hey Satya, came across your profile and would love to connect!"
    }
    ```
  - **By person object**:
    ```json
    {
      "person": {
        "linkedin_id": "ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ",
        "name": "Satya Nadella"
      },
      "note": "Hey Satya, came across your profile and would love to connect!"
    }
    ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Connection invite sent to Satya Nadella",
    "data": {
      "invitation_id": "inv_12345"
    }
  }
  ```

---

## 3. Frontend Implementation Details

1. **`client/components/dashboard/linkedin-connect-modal.tsx`**:
   - Modern tabbed dialog offering:
     - **Tab 1 (Password)**: Direct sign-in with username/password, show/hide password toggle, and optional proxy geo-selector.
     - **Tab 2 (Cookie)**: `li_at` cookie input, expandable step-by-step extraction instructions, optional `li_a` field, auto-detected browser User-Agent.
     - **Tab 3 (Hosted)**: Backup browser pop-up link flow.
   - **Interactive Security Checkpoint Screen**:
     - Dynamic recognition of `2FA`, `OTP`, or `IN_APP_VALIDATION`.
     - 6-digit verification code entry with resend timer.
     - Auto-polling every 3 seconds when waiting for LinkedIn mobile app approval.
     - "Try another way" fallback to switch verification channels.
2. **Components Using the Modal**:
   - `client/components/dashboard/linkedin-connect-card.tsx` (Overview tab)
   - `client/components/dashboard/views/integrations-view.tsx` (Integrations tab)
   - `client/components/dashboard/views/agent-view.tsx` (AI Agent tab)

---

## 4. How to Test It Out

1. Make sure both server and client dev servers are running:
   - Server: `http://localhost:5000`
   - Client: `http://localhost:3000`
2. Open `http://localhost:3000/dashboard` in your browser.
3. Click the blue **"Connect LinkedIn"** button on the Overview card, or navigate to **Integrations** / **AI Agent**.
4. Test **Method 1 (ID & Password)**:
   - Enter your LinkedIn email and password.
   - Click **Connect with Password**.
   - If a checkpoint is requested, enter the code from SMS/authenticator or confirm the prompt in your LinkedIn mobile app.
5. Test **Method 2 (Session Cookie)**:
   - Switch to the **Cookie** tab.
   - Click **"How to get li_at"** for quick DevTools instructions.
   - Paste your `li_at` cookie value and click **Connect with Cookie**.
