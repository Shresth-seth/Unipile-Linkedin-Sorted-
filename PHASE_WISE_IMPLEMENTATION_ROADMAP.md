# 🗺️ WorkPilot: Phase-Wise Implementation Roadmap (Deep Specification)

This document provides an exhaustive, step-by-step implementation roadmap for building **WorkPilot — LinkedIn AI Automation**. It translates the system design into 5 sequential, highly detailed phases detailing **Raunak’s track (Infrastructure & LinkedIn Integration)**, **Harsh’s track (AI Intelligence & Campaigns)**, their integration points, data handoffs, verification tests, and exit criteria.

---

## 📊 Roadmap Overview at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Independent Foundations (Parallel Tracks)                                         │
│ • Raunak: Real Unipile/LinkedIn Driver + 13-Test Suite                                      │
│ • Harsh: Mock LinkedIn Provider + AI Campaign & Scoring Engine                              │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Core Outbound Outreach Integration                                                 │
│ • Real LinkedIn Prospect Search -> AI Lead Scoring -> Queue Dispatch -> Real Connections   │
│ • Webhook detection of Accepted Invitations -> Handover to Outreach Messaging               │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Inbound Webhooks, Conversational AI & Human Handover                               │
│ • Real-time Inbound Reply Webhooks -> AI Conversation Agent with Boundary Guardrails        │
│ • Smart Multi-Step Follow-Up Engine (Auto-cancels on reply)                                 │
│ • Hot Lead Buying Intent Classifier -> Human Handover & Notification System                 │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Social Warmup & LinkedIn Engagement Agent                                          │
│ • Target Feed/Post Discovery -> Non-Robotic AI Commenting & Reaction Automation             │
│ • Pre-outreach Prospect Warming Workflows                                                   │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: CRM, Dashboard, Account Health & Production Hardening                              │
│ • 10-Stage Visual CRM & Conversion Funnel Analytics                                         │
│ • Account Health State Machine, Rate-Limit Analytics & 8-Point Pre-Flight Circuit Breakers   │
│ • Multi-tenant Production Deployment, Docker/Infra & Monitoring                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 PHASE 1: Independent Foundations & Prototyping (Parallel Tracks)

### 🎯 Objective
Enable both engineers to make 100% development progress simultaneously without blocking each other:
* **Raunak** proves that Unipile reliably commands LinkedIn across all action types.
* **Harsh** builds the campaign builder, prompt pipelines, and lead scoring engine using realistic mock data.

---

### Track A: Raunak (LinkedIn Connection & Unipile Driver)
* **Branch**: `raunak/unipile-auth` and `raunak/messages`
* **Tasks**:
  1. **Unipile Setup & SDK Configuration**:
     - Establish Unipile developer account, API credentials, and webhook endpoints.
     - Implement secure credential storage (store Unipile tokens, strictly never store LinkedIn passwords).
  2. **Authentication Flow (Part 1)**:
     - Build Express API endpoints: `POST /api/linkedin/connect`, `GET /api/linkedin/status`, `POST /api/linkedin/disconnect`.
     - Implement session management, polling/webhook reception for account connection verification.
  3. **Abstraction Layer (Part 2)**:
     - Create internal typed service wrappers in `server/src/services/linkedin/`:
       - `people.service.ts`: `searchPeople()`, `getProfile()`, `getProfileDetails()`
       - `connection.service.ts`: `sendConnectionRequest()`, `getSentRequests()`, `getReceivedRequests()`, `acceptConnection()`, `declineConnection()`
       - `message.service.ts`: `getConversations()`, `getMessages()`, `sendMessage()`, `receiveNewMessage()`
       - `post.service.ts`: `readPosts()`, `readComments()`, `reactToPost()`, `commentOnPost()`

#### 🧪 Raunak's Phase 1 Exit Gate: The 13-Test Suite
Before proceeding to Phase 2, Raunak must execute and pass all 13 tests against a live LinkedIn test account:
- [ ] **Test 1**: Connect LinkedIn account via Unipile session.
- [ ] **Test 2**: Search for a target persona (e.g., query "Real Estate Founder").
- [ ] **Test 3**: Retrieve complete profile metadata for a target profile.
- [ ] **Test 4**: Dispatch a connection request with a custom note.
- [ ] **Test 5**: Fetch pending incoming connection requests.
- [ ] **Test 6**: Accept an incoming connection request programmatically.
- [ ] **Test 7**: Send a direct message to a 1st-degree connection.
- [ ] **Test 8**: Receive an inbound direct message payload via webhook/sync.
- [ ] **Test 9**: Detect an accepted connection event.
- [ ] **Test 10**: Fetch posts and comments from a feed/user.
- [ ] **Test 11**: Submit a reaction (Like/Celebrate) to a post.
- [ ] **Test 12**: Post a comment on a LinkedIn post.
- [ ] **Test 13**: Disconnect the account and verify clean reconnection.

---

### Track B: Harsh (Mock Engine, AI Intelligence & Campaigns)
* **Branch**: `harsh/campaign-ai-prototype`
* **Tasks**:
  1. **Mock LinkedIn Provider**:
     - Implement `MockLinkedInService` matching the agreed data schema contracts (`Person`, `Message`, `LinkedInAction`).
     - Provide fixture data for profiles (e.g., Rahul: Sales Director, Dubai, 50 employees; Amit: Intern; Priya: Founder).
  2. **Campaign Creation Engine (Part 1)**:
     - Schema & DB models: Campaign Name, Target Industry, Target Location, Target Roles (Founder, CEO, Sales Head), Target Company Size (10–200), Value Proposition / Offer, Goal (Generate meetings).
  3. **Lead Scoring Engine (Part 3)**:
     - LLM prompt pipeline taking `Campaign Parameters` + `Person Profile Data`.
     - Output JSON: Score (0–100), Match Category (`Outreach` vs `Ignore`), Detailed reasoning (`"Matches target title, located in Dubai, real estate sector"`).
  4. **Connection Message Generator (Part 4)**:
     - Few-shot prompt generating personalized, high-conversion notes under 300 characters.
     - Strictly avoids generic openers (*"Hello sir, I came across your profile"*).

#### 🧪 Harsh's Phase 1 Exit Gate
- [ ] Mock search returns realistic candidate profiles.
- [ ] AI correctly scores Rahul $\ge 90/100$ (Outreach) and Amit $\le 30/100$ (Ignore) with explanations.
- [ ] AI generates contextual, personalized connection copy based on persona, company, and campaign offer.

---

## 🔗 PHASE 2: Core Outbound Outreach Integration

### 🎯 Objective
Connect Harsh's campaign intelligence to Raunak’s live LinkedIn driver. Execute the end-to-end outbound prospecting flow in a controlled, safe environment.

---

### Key Work Streams

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│ 1. REAL PROSPECTING    │      │ 2. AI QUALIFICATION    │      │ 3. QUEUED DISPATCH     │
│ Harsh requests search  ├─────►│ Harsh's AI scores real ├─────►│ Raunak's queue spaces  │
│ Raunak searches Unipile│      │ profiles from LinkedIn │      │ requests (e.g. 15 min) │
└────────────────────────┘      └────────────────────────┘      └───────────┬────────────┘
                                                                            │
                                                                            ▼
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│ 6. READY FOR PHASE 3   │      │ 5. CAMPAIGN TRIGGER    │      │ 4. ACCEPTANCE DETECT   │
│ Awaiting reply from    │◄─────┤ Raunak notifies Harsh: │◄─────┤ Raunak's webhook flags │
│ connected prospect     │      │ "Rahul is connected"   │      │ accepted connection    │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

#### 1. Real Prospect Discovery & Scoring
- Campaign initiates a live search: `searchPeople({ role: "Founder", location: "Dubai", industry: "Real Estate" })`.
- Raunak's service retrieves real LinkedIn profiles via Unipile.
- Harsh’s Lead Scoring AI evaluates real profiles, discarding low-fit contacts and queueing qualified leads.

#### 2. Action Queue & Rate Limiter Implementation (Raunak)
- Setup background job queue (BullMQ + Redis or PostgreSQL Worker).
- Enforce strict spacing between connection dispatches (e.g., randomized delays between 10 to 25 minutes).
- Implement daily action counters per account (hard cap of max 20–25 connection invites/day).

#### 3. Connection Dispatch & Note Injection
- For qualified leads, Harsh generates the personalized invite note.
- Raunak’s worker pulls the job, validates safety checks, and calls `sendConnectionRequest(person, note)`.

#### 4. Accepted Connection Detection (Raunak & Harsh Handshake)
- Raunak configures the Unipile webhook listener for connection status updates.
- When target accepts:
  - Raunak emits internal event: `EVENT_CONNECTION_ACCEPTED` with `{ personId, linkedinAccountId, timestamp }`.
  - Harsh’s campaign engine updates lead stage from `Contacted` $\rightarrow$ `Connected`.
  - Harsh’s engine schedules the first direct message with a configurable cooldown period (e.g., wait 2 hours).

### 🧪 Phase 2 Verification Checklist
- [ ] User launches campaign targeting "Real Estate Founders in Dubai".
- [ ] System automatically retrieves live LinkedIn profiles and logs AI scoring rationale.
- [ ] Invitations are queued and dispatched with randomized human intervals (no bulk bursts).
- [ ] When recipient accepts invite on LinkedIn, WorkPilot detects it within 60 seconds and updates status to `Connected`.

---

## 💬 PHASE 3: Inbound Webhooks, Conversational AI & Human Handover

### 🎯 Objective
Automate intelligent 1-on-1 conversations while enforcing strict AI boundaries, multi-step follow-ups, and an immediate human handover when buying intent or hot leads are identified.

---

### Detailed Components

### 3.1 Real-Time Inbound Message Ingestion (Raunak)
- Expose public HTTPS webhook: `POST /api/webhooks/unipile/messages`.
- Secure endpoint with Unipile webhook signature validation.
- Parse inbound payload and extract:
  - Sender name & LinkedIn ID
  - Message text
  - Conversation thread ID
  - Connected account ID
  - Exact UTC timestamp
- Persist incoming message into the conversation database and broadcast internal event: `EVENT_NEW_MESSAGE_RECEIVED`.

---

### 3.2 AI Conversation Agent (Harsh)
- When a prospect replies, the Conversation Agent receives the full conversation thread history.
- Contextual Memory Injection:
  - Who we are & what we offer (e.g., AI WhatsApp Lead Qualification).
  - Target audience context & original campaign goal.
  - Full previous message history.
- Dynamic Conversation Engine:
  - Answers clarifying questions naturally (e.g., *"What do you automate?"* $\rightarrow$ *"We automate lead qualification and CRM updates..."*).
  - Maintains professional, human, consultative tone.

#### 🛡️ AI Boundary Guardrails (Critical Rules)
Harsh's agent prompt & post-generation validator must enforce strict limits. The AI is **forbidden** from:
1. Promising custom discounts or negotiating pricing.
2. Committing to delivery schedules or contracts.
3. Making legal or SLA commitments.
4. Quoting speculative pricing outside designated ranges.
5. Hallucinating unreleased product features.

---

### 3.3 Smart Follow-Up Engine (Harsh)
- If a connection is accepted but the prospect does not reply to the first outreach message:
  $$\text{Connection Accepted} \longrightarrow \text{First Message} \longrightarrow \text{Wait 3 Days} \longrightarrow \text{Follow-Up 1} \longrightarrow \text{Wait 4 Days} \longrightarrow \text{Follow-Up 2}$$
- **Mandatory Anti-Collision Rule**:
  - The instant an inbound message is received from a prospect: **IMMEDIATELY CANCEL ALL SCHEDULED FOLLOW-UPS**.
  - Never send an automated follow-up after the prospect has already replied.

---

### 3.4 Hot Lead Intent Detection & Human Handover
Harsh’s AI scans incoming replies for high buying intent signals:
- *"What is your pricing?"*
- *"Can we book a demo?"*
- *"We need this for our team."*
- *"Can you send me a proposal?"*
- *"Can we talk tomorrow?"*

#### Handover Execution Flow
```
Inbound Reply: "Can we schedule a demo call tomorrow?"
                     │
                     ▼
       Harsh's Intent Classifier
         Detected: [HOT LEAD]
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
 [Halt AI Auto-Reply]    [Trigger User Alert]
 AI mode -> 'MANUAL'     Push notification / Email / UI banner:
                         "🔥 Hot Lead: Rahul Sharma (Asked for demo)"
                                 │
                                 ▼
                         [Human Takes Over]
                     AI provides suggested reply;
                     Human approves or types custom reply.
```

### 🧪 Phase 3 Verification Checklist
- [ ] Inbound messages appear in WorkPilot in real time.
- [ ] AI accurately responds to informational questions without violating boundary rules.
- [ ] Receiving a reply instantly revokes any pending follow-up messages.
- [ ] Strong intent phrases immediately mark the prospect as `🔥 Hot Lead` and cease autonomous sending.
- [ ] User can click `[Take Over Conversation]` and take complete manual control.

---

## 💬 PHASE 4: Social Warmup & Engagement Agent

### 🎯 Objective
Increase connection acceptance rates and outreach conversion by organically engaging with prospect LinkedIn posts before and during outreach.

---

### Components & Implementation Details

#### 1. Relevant Post Discovery
- Raunak builds feed monitoring integration: `readPosts(targetUser)` and search posts by relevant industry hashtags.
- Harsh builds interest filter: Determines whether the post topic is relevant to the offer/business.

#### 2. Non-Robotic AI Comment & Reaction Generator (Harsh)
- Reads post text, context, and tone.
- Evaluates appropriate reaction: `LIKE`, `SUPPORT`, `INSIGHTFUL`.
- Generates thoughtful, high-value comments:
  - **Forbidden**: Generic spam like *"Great post!"*, *"Awesome share!"*, *"Agree 100%!"*.
  - **Required**: Specific, insightful commentary that adds value to the discussion (e.g., discussing lead response times or qualification friction).

#### 3. Pre-Warming Orchestration Workflow
```
Campaign targets Prospect
          │
          ▼
Step 1: Like latest relevant post
          │ (Wait 24 hours)
          ▼
Step 2: Leave insightful comment on another post
          │ (Wait 24 hours)
          ▼
Step 3: Send personalized connection request
```

### 🧪 Phase 4 Verification Checklist
- [ ] System identifies relevant recent posts from targeted personas.
- [ ] AI generates value-driven comments specific to the post content.
- [ ] Reactions and comments are routed through Raunak’s safety queue.
- [ ] Warmup sequence reliably precedes the connection invite.

---

## 📈 PHASE 5: CRM, Dashboard, Account Health & Production Hardening

### 🎯 Objective
Provide full visibility, funnel analytics, enterprise-grade safety circuit breakers, and production deployment infrastructure.

---

### Components & Implementation Details

### 5.1 The WorkPilot 10-Stage Pipeline CRM (Harsh)
Every prospect is tracked in a structured funnel database:
1. `New` — Sourced and awaiting qualification.
2. `Contacted` — Connection request sent.
3. `Connected` — Connection invitation accepted.
4. `Conversation` — Active messaging exchange in progress.
5. `Interested` — Positive sentiment detected.
6. `Hot Lead` — High buying intent / demo requested.
7. `Meeting` — Meeting scheduled or calendar link clicked.
8. `Proposal` — Commercial proposal sent.
9. `Won` — Deal closed.
10. `Lost` / `Follow Up Later` — Disqualified or deferred.

Each record maintains: Full name, LinkedIn profile URL, Company, Designation, Campaign ID, AI Score, Connection Status, Full Conversation History, Current Lead Status, Last Message, Next Follow-Up Time, AI vs Human Mode, and Internal Notes.

---

### 5.2 Performance & Conversion Dashboard (Harsh)
Real-time metrics display:
- **Connections Sent** (e.g. 74)
- **Connections Accepted** (e.g. 31 $\rightarrow$ 41.8% rate)
- **Total Replies** (e.g. 18 $\rightarrow$ 58.0% reply rate)
- **Active Conversations** (e.g. 11)
- **Hot Leads Generated** (e.g. 4)
- **Meetings Booked** (e.g. 2)

---

### 5.3 Account Health State Machine & 8-Point Preflight Engine (Raunak)
Before dispatching any queued job, verify:
1. `is_connected`: Account session alive?
2. `is_healthy`: No LinkedIn checkpoint or security flags?
3. `is_paused`: Has user or system toggled global pause?
4. `quota_exceeded`: Daily limit intact (connections < 25, messages < 50)?
5. `linkedin_errors`: No recent 429 (Rate Limit) or 999 (Anti-bot) responses?
6. `unipile_errors`: No 5xx gateway errors?
7. `dedup_message`: Has this message already been dispatched to this person?
8. `dedup_invite`: Has a connection already been sent or established?

> 🛑 **Circuit Breaker**: If any check fails, immediately pause automation, notify the user, and abort queue processing. Never retry in a tight loop.

---

### 5.4 Production Infrastructure & Deployment (Raunak)
- Containerize application with Docker & Docker Compose:
  - `client`: Next.js frontend
  - `server`: Express backend API
  - `worker`: BullMQ queue worker
  - `redis`: Queue & cache backend
  - `postgres`: Primary database
- Reverse proxy with SSL/TLS termination (Nginx / Cloudflare).
- Health check endpoints (`/health/liveness`, `/health/readiness`).
- Centralized structured logging with Winston / Pino.

---

## 🏆 MVP Success Criteria: The 14-Step End-to-End Walkthrough

The initial MVP is deemed completely successful when a customer can execute this exact flow without manual developer intervention:

| Step | Action | Owner System | Verification Result |
| :---: | :--- | :---: | :--- |
| **1** | Customer connects LinkedIn account | Raunak | Session is healthy; zero passwords stored in WorkPilot. |
| **2** | Customer enters prompt: *"Target real estate founders in Dubai"* | Harsh | Campaign parameters parsed and stored in DB. |
| **3** | System discovers target profiles on LinkedIn | Raunak | Live candidates returned via Unipile API. |
| **4** | AI filters & scores candidates (e.g., Rahul: 92, Amit: 25) | Harsh | Rahul marked for outreach; Amit ignored with reasoning. |
| **5** | Personalized connection invites are dispatched | Raunak | Invites spaced humanely via queue with personalized copy. |
| **6** | Recipient accepts connection request | Raunak | Webhook detects acceptance within 60s; marks `Connected`. |
| **7** | AI sends first value message | Harsh + Raunak | Message tailored to company & campaign sent after delay. |
| **8** | Prospect replies: *"Can you tell me more about pricing and demos?"* | Raunak | Webhook parses inbound text and notifies app immediately. |
| **9** | Follow-up scheduler is cancelled | Harsh | Scheduled reminders for Rahul are instantly halted. |
| **10** | AI intent detector evaluates reply | Harsh | High intent detected $\rightarrow$ marked as `🔥 HOT LEAD`. |
| **11** | Autonomous sending halts | Harsh | AI switches from `AUTOMATIC` to `SUGGESTED_REPLY` mode. |
| **12** | Human operator notified & takes over | Harsh + UI | User clicks `[Take Over]`, reviews history, and books meeting. |
| **13** | Complete audit trail recorded | Harsh | Lead progression and transcripts saved in CRM. |
| **14** | One-click safety pause | Raunak | User can click `[Pause Automation]` to instantly freeze all queues. |

---

## 🚫 Out of Scope: What NOT to Build in MVP

### Job Auto-Apply / Opportunity Agent
* **Directive**: Job auto-apply / candidate job application features are strictly deferred.
* **Reasoning**: Outbound B2B prospecting and client acquisition must be fully stable before exploring inbound job application automation.
* **Timeline**: Handled as an independent add-on module (*Opportunity Agent*) post-Phase 5.
