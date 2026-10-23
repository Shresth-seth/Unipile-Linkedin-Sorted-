# 📖 WorkPilot: Complete Frontend Integration & API Master Guide (For Harsh)

This document provides ready-to-use API endpoints, request payloads, response schemas, and Next.js / React integration snippets for connecting the `client/` frontend to the `server/` backend.

**Base URL**: `http://localhost:4000` (or `process.env.NEXT_PUBLIC_API_URL`)

> **Important Cookie / Auth Note**: For all requests to protected routes, always include `credentials: "include"` so the authentication JWT cookie (`token`) is sent automatically.

---

## 🧭 Complete API & Page Route Matrix

| Feature / Page | What It Does | HTTP Method & Route |
| :--- | :--- | :--- |
| **Auth (`/login`, `/signup`)** | Register new WorkPilot user | `POST /api/auth/signup` |
| **Auth** | Login with email & password | `POST /api/auth/login` |
| **Auth / Header** | Fetch current logged-in user | `GET /api/auth/me` |
| **Auth** | Logout and clear cookie | `POST /api/auth/logout` |
| **Settings (`/settings`)** | Generate Unipile LinkedIn Connect Link | `GET /api/linkedin/connect` |
| **Settings / Header** | Live LinkedIn Profile & Health Details | `GET /api/linkedin/status` |
| **Settings** | Disconnect LinkedIn Account | `POST /api/linkedin/disconnect` |
| **Dashboard (`/dashboard`)**| Funnel KPIs & 10-Stage Counts | `GET /api/dashboard/funnel` |
| **Dashboard** | Quota Utilization (Used vs Limit) | `GET /api/dashboard/account-health` |
| **Dashboard** | 1-Click Safety Pause (Killswitch) | `POST /api/dashboard/emergency-pause` |
| **Dashboard** | Resume Outbound Automation | `POST /api/dashboard/resume` |
| **Smart Inbox (`/inbox`)** | List all conversation threads | `GET /api/conversations` |
| **Smart Inbox** | Full chat transcript for a contact | `GET /api/conversations/:contactId/messages` |
| **Smart Inbox** | Human Takeover Mode (Halt AI) | `POST /api/conversations/:contactId/takeover` |
| **Smart Inbox** | Send Manual Message Reply | `POST /api/conversations/:contactId/reply` |
| **CRM (`/crm`)** | Fetch Contacts (filtered by stage) | `GET /api/dashboard/contacts?stage=HOT_LEAD` |
| **CRM** | Update Lead Stage (Kanban drag-drop)| `PATCH /api/dashboard/contacts/:id/stage` |
| **Campaigns (`/campaigns`)**| Search & Ingest Prospect Candidates | `POST /api/prospects/discover` |
| **Campaigns** | Run 3-Step Social Warmup Sequence | `POST /api/engagement/warmup` |
| **Campaigns / Queue** | Live Queue Dispatch Stats | `GET /api/queue/stats` |
| **Health Probes** | Backend & Database Connectivity Check | `GET /api/health/readiness` |

---

## 1. User Authentication & Session (`/login`, `/signup`)

### A. Signup
```typescript
const res = await fetch("http://localhost:4000/api/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    name: "Harsh Sharma",
    email: "harsh@workpilot.io",
    password: "Password123!"
  }),
});
const { data } = await res.json();
```

### B. Login
```typescript
const res = await fetch("http://localhost:4000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    email: "harsh@workpilot.io",
    password: "Password123!"
  }),
});
const { data } = await res.json();
```

### C. Get Current User (`/api/auth/me`)
Use this in your React `AuthProvider` or layout to check if user is logged in:
```typescript
const res = await fetch("http://localhost:4000/api/auth/me", {
  credentials: "include"
});
const { data } = await res.json(); // returns { id, name, email }
```

### D. Logout
```typescript
await fetch("http://localhost:4000/api/auth/logout", {
  method: "POST",
  credentials: "include"
});
```

---

## 2. Settings: LinkedIn Connection & Account Sync

### A. Connect LinkedIn Button
Directs the user to Unipile's secure hosted LinkedIn authentication wizard. **Zero passwords stored.**

```typescript
export const handleConnectLinkedIn = async () => {
  const res = await fetch("http://localhost:4000/api/linkedin/connect", {
    credentials: "include"
  });
  const data = await res.json();
  if (data.success && data.url) {
    window.location.href = data.url; // Opens official LinkedIn login
  }
};
```

### B. Live LinkedIn Account Status & Profile Sync
Returns the live connected LinkedIn account details:
```typescript
const res = await fetch("http://localhost:4000/api/linkedin/status", {
  credentials: "include"
});
const { data } = await res.json();
```
**Response Format**:
```json
{
  "id": "6bae1089-7263-4398-ae3b-f5d88e6f8df0",
  "name": "Sahil Verma",
  "email": "sahil@workpilot.io",
  "isConnected": true,
  "healthStatus": "HEALTHY",
  "automationStatus": "RUNNING",
  "reconnectionRequired": false
}
```

### C. Disconnect LinkedIn
```typescript
await fetch("http://localhost:4000/api/linkedin/disconnect", {
  method: "POST",
  credentials: "include"
});
```

---

## 3. Dashboard: Analytics & Safety State

### A. Conversion Funnel KPIs
```typescript
const res = await fetch("http://localhost:4000/api/dashboard/funnel", {
  credentials: "include"
});
const { data } = await res.json();
```
**Response Schema**:
```json
{
  "totalLeads": 43,
  "connectionsSent": 24,
  "connectionsAccepted": 29,
  "acceptanceRate": 120.8,
  "totalReplies": 18,
  "replyRate": 62.1,
  "activeConversations": 11,
  "hotLeads": 13,
  "hotLeadConversionRate": 72.2,
  "meetingsBooked": 5,
  "dealsWon": 5,
  "stageBreakdown": {
    "NEW": 6,
    "CONTACTED": 8,
    "CONNECTED": 6,
    "CONVERSATION": 5,
    "INTERESTED": 3,
    "HOT_LEAD": 13,
    "MEETING": 5,
    "PROPOSAL": 0,
    "WON": 5,
    "LOST": 0,
    "FOLLOW_UP_LATER": 0
  }
}
```

### B. Daily Quotas & Account Health
```typescript
const res = await fetch("http://localhost:4000/api/dashboard/account-health", {
  credentials: "include"
});
const { data } = await res.json();
```
**Response Schema**:
```json
{
  "hasAccount": true,
  "isConnected": true,
  "healthStatus": "HEALTHY",
  "automationStatus": "RUNNING",
  "dailyLimits": {
    "connections": { "limit": 25, "usedToday": 4, "remaining": 21 },
    "messages": { "limit": 50, "usedToday": 12, "remaining": 38 }
  }
}
```

### C. 1-Click Emergency Killswitch
```typescript
// Freeze all outbound automated actions instantly
await fetch("http://localhost:4000/api/dashboard/emergency-pause", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ reason: "User clicked pause" })
});

// Resume automated execution
await fetch("http://localhost:4000/api/dashboard/resume", {
  method: "POST",
  credentials: "include"
});
```

---

## 4. Smart Inbox & Human Handover

### A. List All Conversation Threads
```typescript
const res = await fetch("http://localhost:4000/api/conversations", {
  credentials: "include"
});
const { data } = await res.json();
```
Each thread item contains:
* `id`: Contact ID
* `name`: Lead name
* `company`: Company name
* `status`: e.g. `HOT_LEAD`, `CONVERSATION`
* `isHotLead`: `true` or `false` (shows 🔥 icon)
* `conversationMode`: `AUTOMATIC`, `SUGGESTED`, or `MANUAL`
* `lastMessageReceivedAt`: Timestamp

### B. Full Chat History for a Lead
```typescript
const res = await fetch(`http://localhost:4000/api/conversations/${contactId}/messages`, {
  credentials: "include"
});
const { data } = await res.json();
```
Returns chronological messages: `{ id, direction: "INBOUND"|"OUTBOUND", senderName, content, sentAt }`.

### C. Human Takeover Button (`[Take Over Conversation]`)
Halts AI autonomous sending, switches mode to `MANUAL`, and lets the human operator reply:
```typescript
await fetch(`http://localhost:4000/api/conversations/${contactId}/takeover`, {
  method: "POST",
  credentials: "include"
});
```

### D. Send Manual Response
```typescript
await fetch(`http://localhost:4000/api/conversations/${contactId}/reply`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    message: "Hi Rahul, thank you for reaching out! Here is my calendar link to book a demo: cal.com/demo"
  })
});
```

---

## 5. 10-Stage CRM Pipeline (Kanban Board)

### A. Fetch Contacts by Stage
```typescript
// Query contacts in specific stage (e.g., NEW, HOT_LEAD, MEETING, WON)
const res = await fetch("http://localhost:4000/api/dashboard/contacts?stage=HOT_LEAD", {
  credentials: "include"
});
const { data } = await res.json();
```

### B. Advance Contact Stage (On Drag & Drop in Kanban)
```typescript
await fetch(`http://localhost:4000/api/dashboard/contacts/${contactId}/stage`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ stage: "WON" })
});
```

**Valid 10 Stages**:
1. `NEW`
2. `CONTACTED`
3. `CONNECTED`
4. `CONVERSATION`
5. `INTERESTED`
6. `HOT_LEAD`
7. `MEETING`
8. `PROPOSAL`
9. `WON`
10. `LOST` / `FOLLOW_UP_LATER`

---

## 6. Campaigns & Prospecting Discovery

### A. Discover Prospects
```typescript
const res = await fetch("http://localhost:4000/api/prospects/discover", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    query: "Founder",
    role: "Founder",
    location: "Dubai",
    industry: "Real Estate",
    limit: 10
  })
});
const { data } = await res.json(); // returns array of discovered candidates
```

### B. Trigger 3-Step Social Warmup (`REACT` $\rightarrow$ `COMMENT` $\rightarrow$ `CONNECT`)
```typescript
await fetch("http://localhost:4000/api/engagement/warmup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    contactId: "contact_uuid_here",
    postDelayMinutes: 0,
    commentDelayMinutes: 1440, // 24 hours later
    connectDelayMinutes: 2880  // 48 hours later
  })
});
```

---

## 7. Health & Diagnostic Probes

Validate server and database health:
* `GET http://localhost:4000/api/health/liveness` $\rightarrow$ `{"status": "ok"}`
* `GET http://localhost:4000/api/health/readiness` $\rightarrow$ `{"status": "ready", "database": "connected"}`

---

## 8. LinkedIn Lead Search & Transparency Mode Banner

When users search for leads (`GET /api/linkedin/search`), the API tells you whether the leads are **LIVE** (from their connected LinkedIn) or **PRE-SAVED SAMPLES** (if their LinkedIn is not connected yet).

### A. API Endpoint & Response
* **URL**: `GET /api/linkedin/search?role=Founder&location=Dubai&limit=10`
* **Response (When Not Connected)**:
```json
{
  "success": true,
  "isLive": false,
  "source": "PRE_SAVED_PREVIEW",
  "notice": "Aapka LinkedIn account connected nahi hai. Ye sample pre-saved leads hain. Real-time live leads search karne ke liye apna LinkedIn account connect karein.",
  "count": 3,
  "data": [
    {
      "name": "Rahul Sharma",
      "linkedin_id": "urn:li:fsd_profile:rahul-sharma-123",
      "profile_url": "https://linkedin.com/in/rahul-sharma-123",
      "company": "XYZ Realty Dubai",
      "designation": "Sales Director",
      "location": "Dubai",
      "industry": "Real Estate"
    }
  ]
}
```

### B. Ready-to-use React Banner Component (For Harsh)
```tsx
import React, { useState, useEffect } from "react";
import Link from "next/link";

export function LeadSearchPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [notice, setNotice] = useState<string>("");

  const handleSearch = async (role: string, location: string) => {
    const res = await fetch(
      `http://localhost:4000/api/linkedin/search?role=${encodeURIComponent(role)}&location=${encodeURIComponent(location)}`,
      { credentials: "include" }
    );
    const json = await res.json();
    if (json.success) {
      setLeads(json.data);
      setIsLive(json.isLive);
      setNotice(json.notice || "");
    }
  };

  return (
    <div className="space-y-4">
      {/* ⚠️ Transparency Notice Banner when account is not connected */}
      {!isLive && (
        <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200">
          <div className="flex items-center gap-3">
            <span className="text-xl">ℹ️</span>
            <div>
              <p className="font-semibold text-sm">Preview Mode: Pre-saved Sample Leads</p>
              <p className="text-xs text-amber-300/80">{notice}</p>
            </div>
          </div>
          <Link
            href="/settings"
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition"
          >
            Connect LinkedIn
          </Link>
        </div>
      )}

      {/* Leads List Rendering */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {leads.map((lead) => (
          <div key={lead.linkedin_id} className="p-4 border border-zinc-800 rounded-xl bg-zinc-900/60">
            <h4 className="font-bold text-white">{lead.name}</h4>
            <p className="text-xs text-indigo-400">{lead.designation} at {lead.company}</p>
            <p className="text-xs text-zinc-400 mt-1">📍 {lead.location}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```
