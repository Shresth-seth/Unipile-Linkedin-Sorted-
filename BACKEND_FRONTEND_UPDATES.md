# WORKPILOT — Backend & Frontend Latest Updates & Architectural Guide

> **Audience**: Engineering Partner & Team  
> **Date**: September 2026  
> **Status**: Production-Ready / All Mocks Removed / Live Unipile & SQLite Integration Active

---

## Executive Summary

This document details all recent foundational improvements made across the **WORKPILOT** codebase. The application has fully transitioned from demo/mock states to a **live, production-grade system**:

1. **Elimination of Mock Data**: Removed fake responses from both backend and frontend. Every action (authentication, safety checks, prospects pipeline, outreach sequences) is backed by real SQLite database models and live Unipile API gateways.
2. **Native LinkedIn Authentication via Unipile**: Added support for both **ID & Password** and **Session Cookie (`li_at`)** methods, complete with an interactive **Checkpoint Resolver** (2FA, OTP, and In-App mobile push confirmation).
3. **Live Profile Search & Connection Requests**: Implemented profile discovery by username, LinkedIn URL, or keyword, and connected real outbound invitation dispatch (`POST /api/v1/users/invite`).
4. **Resilient Frontend UI**: Unified all connect triggers into a single modal (`LinkedInConnectModal`), added a dedicated profile finder (`LinkedInProspectSearchModal`), and wired all dashboard views to live endpoints via `AxiosInstance`.

---

## System Architecture

```
                                  ┌────────────────────────────────────────┐
                                  │           Next.js Frontend             │
                                  │      (App Router / Tailwind CSS)       │
                                  └───────────────────┬────────────────────┘
                                                      │
                                                      │ AxiosInstance (JWT & Cookie)
                                                      ▼
                                  ┌────────────────────────────────────────┐
                                  │            Node.js / Express           │
                                  │           TypeScript Backend           │
                                  └─────────┬────────────────────┬─────────┘
                                            │                    │
                   SQLite / Drizzle ORM     │                    │  HTTPS / X-API-KEY
                   (Persistent Database)    │                    │  (Residential Proxy)
                                            ▼                    ▼
                                  ┌──────────────────┐ ┌───────────────────┐
                                  │   Local SQLite   │ │    Unipile API    │
                                  │  - Users         │ │  - Auth Gateways  │
                                  │  - Accounts      │ │  - Profile Search │
                                  │  - Campaigns     │ │  - Invites/Msgs   │
                                  │  - Contacts      │ │  - Checkpoints    │
                                  │  - Activity Log  │ └───────────────────┘
                                  └──────────────────┘
```

---

## 1. Complete Removal of Mock Data

### Backend Changes (`server/`)

- **Database as Single Source of Truth**:
  - Prior versions had placeholder objects returned when third-party services were unconfigured.
  - All controllers (`dashboard.controller.ts`, `auth.controller.ts`, `linkedin.controller.ts`) now execute real database transactions using Drizzle ORM (`drizzle-orm/better-sqlite3`).
  - If an operation fails or credentials are invalid, the backend returns real HTTP status codes (`400`, `401`, `404`, `500`) with actionable error messages instead of masking issues.
- **Live Unipile Gateway**:
  - Calls to search, invite, retrieve messages, or check connection health pass directly to Unipile via `unipileClient.request()`.
  - Real error payloads from Unipile (such as bad passwords, expired cookies, or checkpoint challenges) are parsed and propagated to the client.

### Frontend Changes (`client/`)

- **State Management (`use-dashboard.ts`)**:
  - Removed static fallback arrays for prospects, campaigns, and activities.
  - `refreshBackendData()` executes concurrent fetches to `/api/dashboard/overview`, `/api/dashboard/contacts`, `/api/dashboard/funnel`, `/api/dashboard/health`, and `/api/linkedin/status`.
  - User state is verified against `/api/auth/me` on every mount.
- **Component-Level Cleanups**:
  - `prospects-view.tsx`: Uses `dashboardApi.getContacts()` with live stage updates (`dashboardApi.updateContactStage`).
  - `activity-view.tsx`: Reads actual system event logs from `/api/dashboard/activities`.
  - `leads-table.tsx` & `agent-view.tsx`: Directly reflect live DB records and toggle the real emergency safety killswitch (`/api/dashboard/emergency-pause`).

---

## 2. Unipile LinkedIn Authentication System

Per the official [Unipile API Documentation](https://developer.unipile.com/docs/getting-started), users can connect their LinkedIn accounts using **either of two native methods**, with full checkpoint recovery:

```
                  ┌──────────────────────────────────────────────┐
                  │          LinkedIn Authentication             │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
     Method 1: ID & Password                         Method 2: Session Cookie
     POST /api/linkedin/connect/credentials          POST /api/linkedin/connect/cookie
     - Username (Email/Phone)                        - li_at Cookie (Required)
     - Password                                      - li_a Premium Cookie (Optional)
     - Optional Proxy Country Code                   - Browser User-Agent (Auto-detected)
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                             Unipile API Processing
                                         │
                        ┌────────────────┴────────────────┐
                        │                                 │
                 Status 201 (OK)                   Status 202 (Checkpoint)
             Connected & Synced to DB                     │
                                                          ▼
                                            Interactive Checkpoint Screen
                                            - 2FA / OTP 6-Digit Code
                                            - Mobile In-App Approval Prompt
                                            - "Try Another Way" option
                                            - Resend Code with timer
```

### Authentication Endpoints

#### A. ID & Password Login

- **Route**: `POST /api/linkedin/connect/credentials`
- **Body**:
  ```json
  {
    "username": "alex@company.com",
    "password": "mySecurePassword123",
    "country": "US",
    "userAgent": "Mozilla/5.0..."
  }
  ```
- **Behavior**: Transmits credentials securely over TLS to Unipile's `POST /api/v1/accounts`. On success, synchronizes the account into the local SQLite database.

#### B. Session Cookie Login (`li_at`)

- **Route**: `POST /api/linkedin/connect/cookie`
- **Body**:
  ```json
  {
    "li_at": "AQEDAT...",
    "li_a": "AQED...",
    "country": "US",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
  }
  ```
- **Why this is critical**: Bypasses 2FA challenges in enterprise and SSO environments. WORKPILOT automatically sends the client's `navigator.userAgent` to ensure LinkedIn's fraud detection does not revoke the session cookie.

#### C. Checkpoint Resolution & Mobile In-App Verification

- **Solve Route**: `POST /api/linkedin/checkpoint/solve`
  - Body: `{ "accountId": "acc_123", "code": "654321" }`
  - Special Code: `{ "accountId": "acc_123", "code": "TRY_ANOTHER_WAY" }` requests LinkedIn to fall back from mobile app push notifications to SMS/email OTP.
- **Resend Route**: `POST /api/linkedin/checkpoint/resend`
  - Body: `{ "accountId": "acc_123" }`
- **Status Polling**: `GET /api/linkedin/checkpoint/status/:accountId`
  - Used for `IN_APP_VALIDATION`. The frontend polls every 3 seconds while the user taps _"Yes, that's me"_ on their phone.

---

## 3. LinkedIn Profile Lookup, Search & Outreach

All methods from your test script (`d:\Linkedin-Automation\test.js`) have been integrated into production services and controllers.

### 1. Account Auto-Resolution (`GET /api/linkedin/account`)

- If an endpoint is called without an explicit `accountId`, WORKPILOT automatically resolves the active LinkedIn account from:
  1. The authenticated user's database records in `linkedinAccounts`.
  2. Or Unipile's connected accounts (`GET /api/v1/accounts?limit=100`).

### 2. Profile Lookup (`GET /api/linkedin/profile/:identifier`)

- **Example**: `GET /api/linkedin/profile/satyanadella`
- **Supports**:
  - Public identifier (e.g. `satyanadella`)
  - Full profile URL (e.g. `https://www.linkedin.com/in/satyanadella/`)
  - Provider internal ID (e.g. `ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ`)
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

### 3. People & Keyword Search (`GET /api/linkedin/search`)

- **Query Parameters**: `query`, `keywords`, `role`, `location`, `company`, `url`, `limit`, `cursor`.
- **Direct URL Search**: You can paste a LinkedIn search results URL directly from your browser (`url=https://www.linkedin.com/search/results/people/?keywords=...`) to replicate exact search filters through Unipile.

### 4. Send Connection Request (`POST /api/linkedin/connection` or `POST /api/linkedin/invite`)

- **Endpoint**: Calls Unipile's `POST /api/v1/users/invite` with `{ account_id, provider_id, message }`.
- **Smart Auto-Conversion**: If you provide a public identifier or LinkedIn URL instead of an internal `provider_id`, the backend **automatically fetches the profile first to extract the `provider_id`**, then dispatches the invite seamlessly!
- **Body Formats Supported**:

  ```json
  // Format 1: By provider_id
  {
    "provider_id": "ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ",
    "message": "Hey Satya, came across your profile and would love to connect!"
  }

  // Format 2: By username or URL
  {
    "identifier": "satyanadella",
    "message": "Hey Satya, came across your profile and would love to connect!"
  }
  ```

---

## 4. Frontend Component Breakdown

| Component File                       | Location                             | Responsibilities                                                                                                                             |
| :----------------------------------- | :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `linkedin-connect-modal.tsx`         | `client/components/dashboard/`       | Multi-tab dialog for ID/Password, Session Cookie, and Hosted link. Contains live 2FA/OTP solver and automated in-app approval polling.       |
| `linkedin-prospect-search-modal.tsx` | `client/components/dashboard/`       | UI modal to search any person on LinkedIn, preview their profile details, write a personalized note, and dispatch a real connection request. |
| `linkedin-connect-card.tsx`          | `client/components/dashboard/`       | Overview card showing live LinkedIn account health, connection status, and triggering the connect modal.                                     |
| `prospects-view.tsx`                 | `client/components/dashboard/views/` | CRM pipeline view with real contact stages, CSV export, and a new **"Find on LinkedIn"** action button.                                      |
| `integrations-view.tsx`              | `client/components/dashboard/views/` | Platform integrations dashboard using the unified `LinkedInConnectModal`.                                                                    |
| `agent-view.tsx`                     | `client/components/dashboard/views/` | AI agent behavior settings, killswitch toggle, and LinkedIn connection gateway.                                                              |
| `api.ts`                             | `client/lib/`                        | Typed frontend API SDK connecting AxiosInstance to all backend routes.                                                                       |

---

## 5. Complete API Route Reference

| Method | Endpoint                              | Description                                   | Auth Required |
| :----- | :------------------------------------ | :-------------------------------------------- | :-----------: |
| `POST` | `/api/auth/signup`                    | Create new workspace user in SQLite           |      No       |
| `POST` | `/api/auth/login`                     | Authenticate user & issue JWT token           |      No       |
| `GET`  | `/api/auth/me`                        | Fetch authenticated user with linked accounts |      Yes      |
| `GET`  | `/api/linkedin/account`               | Retrieve active connected LinkedIn account    |      Yes      |
| `GET`  | `/api/linkedin/status`                | Get account health & daily quota limits       |      Yes      |
| `POST` | `/api/linkedin/connect/credentials`   | Native login with Email & Password            |      Yes      |
| `POST` | `/api/linkedin/connect/cookie`        | Native login with `li_at` Session Cookie      |      Yes      |
| `POST` | `/api/linkedin/checkpoint/solve`      | Submit 2FA/OTP code or "TRY_ANOTHER_WAY"      |      Yes      |
| `POST` | `/api/linkedin/checkpoint/resend`     | Resend verification code                      |      Yes      |
| `GET`  | `/api/linkedin/checkpoint/status/:id` | Poll in-app mobile push approval status       |      Yes      |
| `GET`  | `/api/linkedin/profile/:identifier`   | Fetch live LinkedIn profile by public ID/URL  |      Yes      |
| `GET`  | `/api/linkedin/search`                | Search LinkedIn prospects by query or URL     |      Yes      |
| `POST` | `/api/linkedin/connection`            | Send outbound connection invitation           |      Yes      |
| `POST` | `/api/linkedin/disconnect`            | Revoke LinkedIn connection and update DB      |      Yes      |
| `GET`  | `/api/dashboard/overview`             | Fetch live summary cards and account state    |      Yes      |
| `GET`  | `/api/dashboard/contacts`             | Fetch CRM pipeline prospects from SQLite      |      Yes      |
| `POST` | `/api/dashboard/emergency-pause`      | Trigger manual safety killswitch              |      Yes      |

---

## 6. How to Run & Verify

1. **Start the Backend Server**:
   ```bash
   cd server
   npm run dev
   # Runs on http://localhost:5000
   ```
2. **Start the Frontend Client**:
   ```bash
   cd client
   npm run dev
   # Runs on http://localhost:3000
   ```
3. **Type Checking Verification**:
   - Server: `cd server && npx tsc --noEmit` -> **0 errors**
   - Client: `cd client && npx tsc --noEmit` -> **0 errors**

---

## 7. Developer Handover Note

> **Note for Partner**:  
> All mock data layers have been removed. Live database tables, real Unipile connection flows (both ID/password and session cookie `li_at`), profile lookup by identifier, and connection invitation endpoints are fully implemented and type-checked.
>
> **You can now handle the rest of the agent logic from here.**
