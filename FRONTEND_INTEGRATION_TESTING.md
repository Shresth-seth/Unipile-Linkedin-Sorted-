# Frontend Integration & Testing Guide

This document outlines the recent connections made between the Next.js frontend and the Node.js/Express backend for WORKPILOT, along with instructions on how to manually test these integrations.

## Overview of Connections

We have successfully integrated 15+ backend endpoints into the frontend utilizing a standardized `AxiosInstance` (which handles interceptors for the Bearer token and User ID) and a typed service layer (`client/lib/api.ts`).

### 1. State Management & Synchronization

- **File:** `client/lib/use-dashboard.ts`
- **Functionality:** Synchronizes live backend data (Profile, Funnel, Health, CRM, Campaign) into the frontend state. It ensures data persistence and reactivity without causing infinite re-render loops (safeguarded via `useRef` initialization guards).

### 2. Authentication

- **Files:** `client/components/auth/register-form.tsx`, `client/components/auth/login-form.tsx`
- **Functionality:** Connects to the backend auth routes to register new users and log in existing ones. Auth tokens are stored and attached to subsequent Axios requests.

### 3. LinkedIn Management

- **Files:** `client/components/dashboard/linkedin-connect-card.tsx`, `client/components/dashboard/views/integrations-view.tsx`
- **Functionality:** Handles connecting LinkedIn accounts and managing their state through the backend integrations endpoints.

### 4. Safety & Agent Controls

- **Files:** `client/components/dashboard/views/agent-view.tsx`
- **Functionality:** Features an Emergency Killswitch that interacts with the backend `safety.service.ts` to toggle the automation status between `RUNNING` and `PAUSED`.

### 5. CRM Pipeline & Prospects

- **Files:** `client/components/dashboard/views/prospects-view.tsx`, `client/components/dashboard/campaign-builder.tsx`, `client/components/dashboard/leads-table.tsx`
- **Functionality:** Fetches and updates CRM stages. Prospect discovery logic is now connected to the campaign builder, and the leads table displays accurate pipeline statuses.

### 6. Inbox & Messaging

- **Files:** `client/components/dashboard/views/messages-view.tsx`
- **Functionality:** Connects to messaging endpoints allowing the frontend to display conversations and execute manual takeover actions.

---

## How to Test the Integrations

Since the user interface is fully connected to the live backend, you can test the functionality by running both the frontend and backend servers and performing the following manual checks:

### Prerequisites

1. Ensure your backend server is running (e.g., `npm run dev` in the `server` directory).
2. Ensure your frontend Next.js server is running (e.g., `npm run dev` in the `client` directory).
3. Verify that your backend database is properly seeded or accessible.

### Test Scenarios

#### A. Authentication Flow

1. Navigate to `/register` and create a new account. Verify that the backend successfully processes the request and returns a token.
2. Navigate to `/login` and sign in with the new credentials. Ensure you are redirected to the `/dashboard`.

#### B. Dashboard Data Fetching

1. Once on the `/dashboard`, verify that the data fetching logic in `use-dashboard.ts` populates the Account Health, Funnel Stats, and Profile information correctly.
2. Check the browser console to ensure there are no infinite loop warnings or excessive network requests (fixing the "Maximum update depth exceeded" error).

#### C. LinkedIn Integration

1. Go to the Integrations view in the dashboard.
2. Interact with the LinkedIn Connect card. (If using mocked/test endpoints, ensure the frontend correctly sends the request and processes the backend's response).

#### D. Agent Safety (Killswitch)

1. Go to the Agent view.
2. Toggle the Emergency Killswitch.
3. Check your backend logs or database to confirm the account status updates to `PAUSED` (or `RUNNING` if toggled back).

#### E. CRM & Prospects

1. Navigate to the Prospects view.
2. Try updating a prospect's stage (if the UI allows). Verify the backend reflects this change.
3. In the Campaign Builder, test the prospect discovery flow to ensure the frontend successfully receives the prospect data from the backend.

#### F. Inbox

1. Go to the Messages view.
2. Ensure conversations load.
3. Test sending a message or initiating a manual takeover to verify the API call triggers correctly.

## Notes

- All API requests automatically include the required headers via `AxiosInstance`.
- No further automated tests have been executed; please proceed with manual verification as instructed.
