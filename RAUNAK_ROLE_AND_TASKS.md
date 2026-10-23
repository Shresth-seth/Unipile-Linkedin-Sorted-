# 📘 Raunak's Role & Task Specification: WorkPilot LinkedIn Automation

---

## 📌 1. Executive Summary & Core Identity

### 🎯 Primary Goal

> **"Make LinkedIn controllable from WorkPilot."**

### 🧠 Guiding Engineering Question

> **"Can WorkPilot perform this LinkedIn action reliably?"**

### 🌐 Scope of Ownership

Raunak exclusively owns and maintains the entire integration and communication pipeline:
$$\mathbf{WorkPilot \longleftrightarrow Unipile \longleftrightarrow LinkedIn}$$

### 🏁 Definition of Done for Raunak

Raunak's core responsibility is completely fulfilled when the rest of WorkPilot (Harsh's AI, campaign engine, and CRM) can safely and deterministically execute abstract commands:

- _"Search this person."_
- _"Send this connection request."_
- _"Send this message."_
- _"Give me new incoming messages."_
- _"Like this post."_
- _"Comment on this post."_

...and the corresponding action reliably occurs on LinkedIn without triggering account restrictions, spam flags, or API failures.

---

## 🏛️ 2. Architectural Blueprint & Decoupling Principle

### 2.1 The Architectural Flow

```
 ┌─────────────────────────────────────────────────────────────┐
 │                      HARSH'S DOMAIN                         │
 │     AI Intelligence • Campaign Rules • Lead Scoring         │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Issues high-level intent)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                      RAUNAK'S DOMAIN                        │
 │                                                             │
 │  1. WorkPilot Safety Guard: Checks permissions & limits     │
 │  2. Action Queue Engine: Throttles & humanizes timing       │
 │  3. Adapter Layer: Translates internal call -> Unipile API  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Calls normalized endpoints)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                     UNIPILE PLATFORM                        │
 │     Cloud Gateway / LinkedIn Headless Bridge                │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Executes browser action)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                         LINKEDIN                            │
 └─────────────────────────────────────────────────────────────┘
```

### 2.2 Unipile Decoupling (Strict Anti-Lock-In Requirement)

- **Unipile is NOT the brain**: Unipile is purely an execution worker. It must never make decisions, orchestrate sequences, or store campaign intelligence.
- **The Anti-Pattern (WRONG)**:
  $$\text{AI} \longrightarrow \text{Unipile} \longrightarrow \text{Send Message}$$
- **The Correct Pattern**:
  $$\text{AI suggests} \longrightarrow \text{WorkPilot checks if allowed} \longrightarrow \text{WorkPilot schedules/queues} \longrightarrow \text{Unipile performs}$$
- **Zero Vendor Lock-in**:
  If Unipile is swapped out tomorrow for another provider (e.g. RapidAPI, custom Playwright cluster, or official partner API), **only Raunak's adapter code will change**. Harsh's AI, the CRM, campaign logic, dashboard metrics, and message generators must remain 100% untouched.

---

## 🔍 3. Deep Breakdown of Raunak's Specific Responsibilities

```
                      RAUNAK'S RESPONSIBILITIES
   ┌──────────────────────────────┼─────────────────────────────┐
   │                              │                             │
   ▼                              ▼                             ▼
[PART 1: AUTH & HEALTH]    [PART 2: API ADAPTER]      [PART 3: WEBHOOKS]
• Unipile OAuth session    • People search & profile  • Inbound message sync
• 0 password storage       • Connection management    • Connection accept hook
• Health state machine     • Messaging engine         • Event parsing to AI
                           • Post & feed interactions
   ┌──────────────────────────────┼─────────────────────────────┐
   │                              │                             │
   ▼                              ▼                             ▼
[PART 4: ACTION QUEUE]     [PART 5: ACCOUNT SAFETY]   [PART 6: DASHBOARD & DEPLOY]
• Anti-bursting schedule   • 8-point preflight check  • Status state reporting
• Jitter & human delays    • Auto-pause circuit breaker• Express backend infra
• Rate-limit management    • Anti-spam deduplication  • Background worker daemon
```

---

### Part 1: LinkedIn Account Authentication & Session Lifecycle

1. **User Connection Trigger**:
   - Deliver the frontend hook and backend endpoint for the user button: `[Connect LinkedIn]`.
   - Initiate the Unipile hosted auth / QR code / session link flow.
2. **Strict Security Constraint**:
   - **User LinkedIn passwords must NEVER be accepted, transmitted, or stored inside WorkPilot.**
   - Only Unipile access tokens, account IDs, and session cookies managed by Unipile are stored.
3. **Account State Machine**:
   WorkPilot must track and persist the following states for every user account:
   - `account_id`: Owner/User identification mapping.
   - `is_connected`: Boolean state (`true` / `false`).
   - `health_status`: `HEALTHY`, `DEGRADED`, `DISCONNECTED`, `CHECKPOINT_REQUIRED`.
   - `reconnection_required`: Boolean flag indicating if token/session expired or LinkedIn logged out.
   - `automation_status`: `RUNNING` vs `PAUSED`.

---

### Part 2: LinkedIn Action Functions (Internal API Surface)

Raunak must build an internal service/SDK module in WorkPilot that abstracts all Unipile endpoints into clean, typed TypeScript functions:

#### A. People & Search

- `searchPeople(filters: SearchFilters): Promise<Person[]>`
  - Searches LinkedIn by keywords, titles (e.g., "Founder", "CEO", "Sales Head"), geography (e.g., "Dubai"), industry ("Real Estate"), and company size.
- `getProfile(linkedinId: string): Promise<Person>`
  - Retrieves profile information for a specific LinkedIn user.
- `getProfileDetails(linkedinId: string): Promise<ProfileDetails>`
  - Fetches complete profile data (experience, company details, mutual connections, about summary).

#### B. Connection Management

- `sendConnectionRequest(person: Person, note?: string): Promise<ActionResult>`
  - Sends a connection invite, optionally with a personalized connection note generated by Harsh's AI.
- `getSentRequests(): Promise<PendingRequest[]>`
  - Lists pending outgoing connection requests.
- `getReceivedRequests(): Promise<IncomingRequest[]>`
  - Retrieves pending incoming invites for inbound lead qualification.
- `acceptConnectionRequest(requestId: string): Promise<ActionResult>`
  - Accepts an incoming request.
- `declineConnectionRequest(requestId: string): Promise<ActionResult>`
  - Rejects or ignores an incoming request.
- `checkConnectionStatus(personId: string): Promise<'PENDING' | 'CONNECTED' | 'NOT_CONNECTED'>`
  - Checks whether a sent invitation has been accepted.

#### C. Messaging & Conversation Flow

- `getConversations(limit?: number): Promise<Conversation[]>`
  - Retrieves active messaging threads.
- `getMessages(conversationId: string): Promise<Message[]>`
  - Fetches the message history of a specific chat thread.
- `sendMessage(recipientId: string, messageText: string): Promise<ActionResult>`
  - Dispatches a direct message to an existing 1st-degree connection.
- `receiveNewMessage(): Promise<Message[]>`
  - Polling/sync fallback for incoming messages.

#### D. Posts & Feed Interactions (Social Engagement)

- `readPosts(targetUserOrCompany: string): Promise<Post[]>`
  - Fetches recent posts for sentiment/engagement analysis.
- `readComments(postId: string): Promise<Comment[]>`
  - Fetches comment threads on relevant posts.
- `reactToPost(postId: string, reactionType: 'LIKE' | 'CELEBRATE' | 'SUPPORT' | 'INSIGHTFUL'): Promise<ActionResult>`
  - Sends a reaction to warm up a prospect before sending an invite.
- `commentOnPost(postId: string, commentText: string): Promise<ActionResult>`
  - Posts an AI-generated contextual comment on a prospect's post.

---

### Part 3: Webhooks & Real-Time Event Ingestion Pipeline

Raunak must implement the real-time event ingestion infrastructure so external LinkedIn events are captured and fed directly into Harsh's AI system.

#### 1. Inbound Direct Message Notification

- **Ingestion Chain**:
  $$\text{LinkedIn} \longrightarrow \text{Unipile} \longrightarrow \text{WorkPilot Webhook Endpoint (Raunak)} \longrightarrow \text{Harsh's AI Pipeline}$$
- **Payload Normalization**:
  When a lead replies (e.g., Rahul: _"Hi, can you tell me more?"_), Raunak's webhook receiver must parse the Unipile webhook and dispatch a standardized event payload to Harsh's module:
  ```json
  {
    "sender": "Rahul",
    "sender_linkedin_id": "urn:li:fsd_profile:123456",
    "message": "Hi, can you tell me more?",
    "conversation_id": "conv_987654",
    "linkedin_account_id": "acc_001",
    "timestamp": "2026-09-05T10:45:00Z"
  }
  ```
- **AI Trigger**: This event initiates Harsh's Conversation Agent to evaluate intent, check limits, and generate the response.

#### 2. Connection Accepted Detection

- When a target prospect accepts a pending invite:
  - Raunak’s webhook listener captures the `CONNECTION_ACCEPTED` event.
  - Emits an internal event to Harsh’s campaign engine:
    $$\text{"Rahul is now connected"}$$
  - Harsh's system receives this signal to trigger the next phase (e.g. wait delay, then queue first outreach message).

---

### Part 4: The Action Queue & Throttling Engine

To prevent LinkedIn algorithm bans and rate limits, **bursting actions is strictly forbidden**.

- **Prohibited**: Never send 50 connections, 50 messages, or 20 likes in rapid succession.
- **Architecture**: Every single outbound LinkedIn action must enter a persistent queue (e.g. BullMQ / Redis or DB-backed worker queue).
- **Controlled Staggered Dispatch**:
  Actions must be dispatched sequentially with human-like intervals and randomized jitter:
  - `10:05 AM`: Send connection request to Prospect A
  - `10:12 AM`: View profile / interact with Prospect B
  - `10:25 AM`: Send connection request to Prospect C
  - `10:40 AM`: Send follow-up message to Prospect D
- **Configurable Quotas**:
  Raunak must build configurable limits (per day and per hour) for:
  - Max connection requests per day (e.g. 20–25/day)
  - Max messages per day (e.g. 40–50/day)
  - Max profile views / likes per day

---

### Part 5: Account Safety Engine & Circuit Breakers

Before the queue dispatcher attempts to execute **any** queued LinkedIn action, Raunak's engine must run an **8-Point Pre-Flight Verification Checklist**:

```
                  PRE-FLIGHT VERIFICATION
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [1. Is Account Connected?]       [2. Is Account Healthy?]
            │                                 │
            ▼                                 ▼
   [3. Is Automation Paused?]       [4. Daily Limit Reached?]
            │                                 │
            ▼                                 ▼
   [5. LinkedIn Errors/429?]        [6. Unipile Errors/500?]
            │                                 │
            ▼                                 ▼
   [7. Duplicate Message?]          [8. Duplicate Connection?]
                             │
                             ▼
         [Any Check Fails?] ──► [PAUSE AUTOMATION]
```

#### The Circuit Breaker Rule

> **If any safety check fails, LinkedIn returns a security warning/captcha, or Unipile fails repeatedly: IMMEDIATELY PAUSE AUTOMATION. Do NOT continue retrying in a loop.**

---

### Part 6: Account Health Monitoring & Dashboard Status Logic

Raunak manages the health state machine that feeds into the UI dashboard, returning real-time status:

- ✅ **LinkedIn Account: Connected**
- ✅ **Health: Healthy**
- ✅ **Status: Automation Running**
- ⚠️ **Status: Reconnection Required** _(triggers modal for user to re-authenticate)_
- 🛑 **Status: Automation Paused** _(indicates safety threshold or error triggered)_

---

## 🤝 4. Collaboration Contract: Raunak vs. Harsh

### 4.1 Boundary Division Matrix

| Feature / Area                 |   Owner    | Description                                                 |
| :----------------------------- | :--------: | :---------------------------------------------------------- |
| **LinkedIn Authentication**    | **Raunak** | Unipile connection, session state, token refreshes          |
| **LinkedIn API Wrappers**      | **Raunak** | Search, invite, message, post, comment abstractions         |
| **Action Queue & Delays**      | **Raunak** | Throttling, jitter, spacing actions across the day          |
| **Safety Circuit Breaker**     | **Raunak** | Error catching, quota enforcement, auto-pause logic         |
| **Webhooks / Event Ingestion** | **Raunak** | Listening for replies, acceptances, and passing to app      |
| **Backend Infra & Deploy**     | **Raunak** | Server runtime, worker processes, API route integration     |
| **Target Audience & Filters**  |   Harsh    | Defining who to reach (e.g. "Dubai Real Estate Founders")   |
| **Lead Scoring (0-100)**       |   Harsh    | Evaluating prospect relevance and explaining why            |
| **Copywriting & Templates**    |   Harsh    | Generating personalized connection & outreach copy          |
| **Conversation Agent**         |   Harsh    | Analyzing inbound replies and answering questions           |
| **Hot Lead Intent Detection**  |   Harsh    | Detecting pricing/demo queries and triggering notifications |
| **Human Takeover Mode**        |   Harsh    | Halting AI messaging and alerting the user                  |
| **CRM & Campaign Dashboard**   |   Harsh    | Managing funnel stages, stats, analytics charts             |

### 4.2 Shared Data Schema Contracts (Must Agree Before Coding)

Raunak and Harsh must adhere to identical data contracts so real and mock data swap seamlessly:

#### 1. `Person`

```typescript
interface Person {
  name: string;
  linkedin_id: string;
  profile_url: string;
  company: string;
  designation: string;
  location: string;
  industry: string;
}
```

#### 2. `Message`

```typescript
interface Message {
  conversation: string;
  sender: string;
  receiver: string;
  message: string;
  time: string; // ISO 8601
}
```

#### 3. `LinkedInAction`

```typescript
interface LinkedInAction {
  action: "CONNECT" | "MESSAGE" | "VIEW" | "REACT" | "COMMENT";
  person: string;
  time: string; // ISO 8601
  status: "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED" | "SKIPPED";
}
```

### 4.3 Parallel Execution Strategy (No Blocking)

- **Harsh works with a Fake LinkedIn System**: Harsh uses mock data (`searchPeople() -> [Rahul, Priya, Amit]`) to independently build lead scoring, message generation, and CRM without waiting for real LinkedIn accounts.
- **Raunak builds the Real LinkedIn System**: Raunak develops and validates the real Unipile connection in parallel.
- When both are validated, Raunak’s real service replaces the mock provider in a single configuration switch.

---

## 🧪 5. Raunak's 13 Mandatory Validation Tests (Phase 1 Gate)

Raunak must prove that Unipile and LinkedIn communication works by passing these 13 unit/integration tests before connecting to Harsh's campaigns:

- [ ] **Test 1**: **Connect LinkedIn** — Successfully link an account via Unipile auth flow.
- [ ] **Test 2**: **Search Someone** — Execute search query with role/location filters and receive profiles.
- [ ] **Test 3**: **Get Profile Details** — Fetch complete metadata for a specific LinkedIn profile.
- [ ] **Test 4**: **Send Connection** — Successfully send an invitation request to a test profile.
- [ ] **Test 5**: **See Incoming Connection** — Retrieve pending incoming connection requests.
- [ ] **Test 6**: **Accept Connection** — Accept an incoming request programmatically.
- [ ] **Test 7**: **Send Message** — Transmit a direct message to a 1st-degree connection.
- [ ] **Test 8**: **Receive Message** — Webhook/poller successfully receives an incoming reply with accurate fields.
- [ ] **Test 9**: **Detect Accepted Connection** — Webhook detects when an outgoing invite is accepted by the recipient.
- [ ] **Test 10**: **Get Post** — Read an existing LinkedIn post and its metadata.
- [ ] **Test 11**: **React to Post** — Submit a reaction (like/celebrate) to a targeted post.
- [ ] **Test 12**: **Comment on Post** — Publish a comment to a targeted post.
- [ ] **Test 13**: **Disconnect and Reconnect** — Perform account disconnect and verify clean re-authentication flow.

---

## 🌿 6. Git Branching & Development Workflow

### Repository

Shared repo: `workpilot-linkedin-agent` (or `WORKPILOT`)

### Raunak's Dedicated Feature Branches

- `raunak/unipile-auth` — OAuth integration, session persistence, health checks.
- `raunak/messages` — Messaging API wrappers, conversation fetchers, post engagement functions.
- `raunak/webhooks` — Ingestion webhooks for inbound replies and accepted connections.
- `raunak/action-queue` — Queue implementation, scheduling, and circuit-breaker safety checks.

### Workflow Rules

1. Never commit directly to `main`.
2. Rebase on the latest staging branch before starting work.
3. Push to `raunak/<feature>`.
4. Open Pull Request for review (reviewed by Harsh if contracts or API surfaces are modified).
5. Merge into `staging` for end-to-end testing, then promote to `main`.
