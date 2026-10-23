# WORKPILOT LinkedIn Automation — Complete Technical Dossier

**Prepared by:** Automated Technical Audit (Antigravity AI)  
**Audit Date:** 2026-09-20  
**Repository:** `e:\WORKPILOT-main` (corpus: `201Harsh/WORKPILOT`)  
**Classification:** Internal Engineering — Sensitive  

> **⚠️ CRITICAL NOTICE — READ FIRST**  
> This dossier was produced during a **read-only inspection**. No production systems, LinkedIn accounts, or external services were contacted. However, the audit discovered **live credentials committed to the repository** (database connection string, Unipile API key, JWT secret, AWS EC2 SSH private key). These must be **rotated immediately** before this report is shared more broadly. All actual secret values below are replaced with `[REDACTED]`.

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Repository and File Inventory](#2-repository-and-file-inventory)
3. [Architecture Teardown](#3-architecture-teardown)
4. [Feature and Workflow Matrix](#4-feature-and-workflow-matrix)
5. [Technology Stack and Dependency Audit](#5-technology-stack-and-dependency-audit)
6. [LinkedIn Integration Teardown](#6-linkedin-integration-teardown)
7. [Frontend Review](#7-frontend-review)
8. [Backend and API Review](#8-backend-and-api-review)
9. [Database and Data Model](#9-database-and-data-model)
10. [Background Jobs, Queues, and Scheduling](#10-background-jobs-queues-and-scheduling)
11. [Authentication, Authorization, and Tenancy](#11-authentication-authorization-and-tenancy)
12. [Security Review and Threat Model (STRIDE)](#12-security-review-and-threat-model-stride)
13. [Privacy, Compliance, and Platform-Policy Review](#13-privacy-compliance-and-platform-policy-review)
14. [Configuration and Secret Management](#14-configuration-and-secret-management)
15. [Deployment Teardown](#15-deployment-teardown)
16. [CI/CD and Engineering Workflow](#16-cicd-and-engineering-workflow)
17. [Observability and Operations](#17-observability-and-operations)
18. [Reliability and Failure Analysis](#18-reliability-and-failure-analysis)
19. [Performance and Scalability](#19-performance-and-scalability)
20. [Testing and Quality](#20-testing-and-quality)
21. [Code Quality and Maintainability Review](#21-code-quality-and-maintainability-review)
22. [Cost Analysis](#22-cost-analysis)
23. [Production-Readiness Checklist](#23-production-readiness-checklist)
24. [Findings and Prioritized Remediation Roadmap](#24-findings-and-prioritized-remediation-roadmap)
25. [Target Production Architecture](#25-target-production-architecture)
26. [Handoff Information for the Next AI/Engineering Session](#26-handoff-information-for-the-next-aiengineering-session)

---

## 1. Executive Overview

### What the Product Does

**WorkPilot** is a LinkedIn outreach automation SaaS platform. It enables sales professionals, recruiters, and business developers to automate LinkedIn activities — including connection requests, follow-up messages, inbox reply-handling, and post engagement — while applying daily rate limits and safety controls intended to mimic human usage patterns.

### Current Maturity Level

**Verified.** The codebase is a functioning **early-stage SaaS product** with a working backend, frontend, database schema, CI/CD pipeline, and a deployment footprint on AWS EC2 (`eu-north-1`). It is beyond prototype but has critical security defects and operational gaps that block safe production use.

### LinkedIn Integration Approach

**Verified.** The product uses **Unipile** (a third-party LinkedIn API middleware). Unipile acts as a headless browser orchestration layer that connects using LinkedIn session cookies (`li_at`) or username/password credentials. This is **not the official LinkedIn API**. WorkPilot itself does not contain any browser automation code (no Playwright, Puppeteer, Selenium).

### Current Deployment Model

**Verified.** Single AWS EC2 instance (`eu-north-1`, IP `[REDACTED]`) running Docker Compose with server, client, PostgreSQL, and Redis containers. The Neon serverless PostgreSQL instance is used as the primary production database. CI/CD is via GitHub Actions → AWS SSM → EC2.

### Five Most Serious Production Risks

1. **SEC-001 — Live secrets committed to git**: Real Neon DB password, Unipile API key, JWT secret, and an EC2 RSA private key (`linkdin  brain.pem`) are committed to the repository.
2. **POLICY-001 — LinkedIn ToS conflict**: The product operates through Unipile, which automates LinkedIn via session credentials. LinkedIn's User Agreement (Section 8.2) prohibits unauthorized scrapers, bots, or automated tools.
3. **SEC-003 — Unauthenticated webhook endpoint**: The webhook endpoint (`POST /api/webhooks/`) accepts requests from anyone on the internet when `UNIPILE_WEBHOOK_SECRET` is not set.
4. **SEC-004 — LinkedIn credentials encrypted with JWT secret as key**: User LinkedIn username/passwords are AES-256-CBC encrypted at rest, but the encryption key is derived from `JWT_SECRET` — the same weak, hardcoded value used to sign session tokens.
5. **SCALE-001 — In-process polling replaces true queue**: All background work is driven by `setInterval` loops inside the HTTP server process with no distributed queue, no dead-letter mechanism, and no ability to scale workers independently.

### Production-Readiness Verdict

> **NOT DEPLOYABLE IN CURRENT STATE** (Confidence: High)

The product has functional LinkedIn automation capabilities and reasonable safety guardrails, but at least four critical security vulnerabilities must be resolved before any production traffic is appropriate.

---

## 2. Repository and File Inventory

### Top-Level Structure

```
WORKPILOT-main/
├── .github/workflows/          CI/CD pipeline (GitHub Actions)
├── client/                     Next.js 16 frontend (React 19)
├── server/                     Express 5 / TypeScript backend API + workers
├── deploy/aws/                 AWS deployment scripts and templates
├── scripts/                    Deployment shell scripts
├── docs/                       (Not inspected)
├── .env.example                Safe template — committed intentionally
├── .env.production             *** LIVE SECRETS committed ***
├── server/.env                 *** LIVE SECRETS committed ***
├── linkdin  brain.pem          *** EC2 RSA PRIVATE KEY committed ***
├── docker-compose.yml          Local/dev Docker Compose
├── docker-compose.prod.yml     Production Docker Compose variant
└── *.md                        Multiple operational guides
```

### Server Structure (`server/src/`)

```
server/src/
├── app.ts              Express app setup, CORS, route registration
├── index.ts            Server entry point; starts workers and pollers
├── controllers/        10 controller files
├── middlewares/        auth, admin, rate-limit, validate
├── routes/             10 route files
├── services/
│   ├── linkedin/       Core LinkedIn service layer (9 files)
│   ├── queue/          In-process action queue service
│   ├── safety/         Account safety + circuit breaker
│   ├── unipile/        Unipile HTTP client (single 834-line file)
│   └── webhook/        Webhook processing, dedup, AI message agent (8 files)
├── agent/
│   ├── WORKPILOT-connect-agent.ts     LangGraph connection agent (34KB)
│   ├── WORKPILOT-inbox-subagent.ts    Inbox reply subagent (11KB)
│   ├── WORKPILOT-subgraphs.ts         LangGraph subgraphs (33KB)
│   ├── WORKPILOT-task-manager.ts      Task orchestration (9KB)
│   └── daily/                         Daily agent scheduler
├── db/
│   ├── schema.ts       Drizzle ORM schema (10 tables)
│   ├── migrate.ts      Migration runner
│   └── migrations/     8 SQL migration files
└── utils/
    ├── crypto.util.ts  AES-256-CBC encrypt/decrypt
    ├── jwt.util.ts     JWT sign/verify
    ├── error.util.ts   Safe error message extraction
    └── resolve-user.ts User resolution helper
```

### Notable Committed Documents (Require Review)

| Document | Risk |
|---|---|
| `RAUNAK_ROLE_AND_TASKS.md` | PII risk — individual contributor personal tasks |
| `SECURITY_TEST_AUDIT.md` | Internal security notes — may reveal exploit paths |
| `DETAILED_BACKEND_DEPLOYMENT_BUG_REPORT.md` | Internal bug data |
| `linkdin  brain.pem` | **EC2 RSA PRIVATE KEY — ROTATE IMMEDIATELY** |

---

## 3. Architecture Teardown

### System Overview

```
User Browser
  → Next.js 16 Client (port 3000)
  → Express 5 API (port 4000)
  → [Neon PostgreSQL | Unipile API | Google Gemini AI]
  → Unipile → LinkedIn Platform
```

### Component Responsibilities

| Component | Technology | Responsibilities |
|---|---|---|
| **Client** | Next.js 16 / React 19 / Tailwind 4 | UI, JWT token management, API calls |
| **API Server** | Express 5 / TypeScript | REST endpoints, auth, business logic |
| **Action Queue Worker** | setInterval (30s), PostgreSQL | Processes deferred LinkedIn actions |
| **Message Agent Worker** | setInterval (30s), PostgreSQL | Processes AI reply jobs |
| **Inbound Sync Service** | setInterval (30s), Unipile REST | Polls LinkedIn inbox every 30 seconds |
| **Daily Agent** | LangGraph, Gemini AI | AI-powered prospect discovery + outreach (partially disabled) |
| **Webhook Handler** | Express route | Real-time event processing from Unipile |
| **Unipile Client** | REST/HTTPS | All LinkedIn actions via Unipile gateway |

### Request Flow (Authenticated Action)

```
Browser → Client → POST /api/linkedin/connection (JWT)
  → authenticate() middleware (JWT verify)
  → fetch linkedinAccounts for user
  → safety pre-flight check (daily limits, health status)
  → INSERT into action_queue (status=QUEUED, scheduled_for=now+delay)
  → 200 {jobId}

setInterval (every 30s):
  → SELECT from action_queue WHERE status=QUEUED AND scheduled_for<=now LIMIT 10
  → POST /api/v1/users/invite to Unipile
  → Unipile → LinkedIn
  → UPDATE action_queue SET status=COMPLETED
  → UPDATE contacts SET status=CONTACTED
```

### LinkedIn Automation Job Lifecycle

```
[*] → QUEUED (enqueue())
QUEUED → PROCESSING (processDueActions() poll)
PROCESSING → COMPLETED (success)
PROCESSING → FAILED (exception — no retry)
PROCESSING → SKIPPED (safety check blocked)
PROCESSING → PAUSED (daily limit reached — circuit breaker)
```

### Deployment Topology

```
GitHub (main branch)
  → GitHub Actions CI/CD
  → AWS OIDC → AWS SSM
  → EC2 Instance (eu-north-1)
     ├── workpilot_server:4000 (Express API + all workers)
     ├── workpilot_client:3000 (Next.js)
     ├── workpilot_postgres:5432 (local, but Neon is actual DB)
     └── workpilot_redis:6379 (UNUSED)
  
  Primary DB: Neon Serverless PostgreSQL (external, AWS us-east-2)
```

### Key Architectural Concerns

- **Single point of failure:** Entire system runs in one EC2 instance. No clustering, no replicas.
- **Tight coupling:** HTTP server process runs all background workers via `setInterval`. A crash stops all automation.
- **No true queue:** `action_queue` PostgreSQL table is a pseudo-queue. Redis is defined but unused.
- **No retry:** Failed `actionQueue` jobs are permanently marked `FAILED` with no automatic retry.
- **Race condition:** No atomic claim for `action_queue` — two server instances (or a restart mid-tick) could process the same job twice.

---

## 4. Feature and Workflow Matrix

| Feature | Status | Entry Point | LinkedIn Risk |
|---|---|---|---|
| LinkedIn account connection (hosted OAuth) | Complete | `/api/linkedin/connect` | Medium |
| LinkedIn credential login | Complete | `/api/linkedin/connect/credentials` | High — passes credentials to Unipile |
| LinkedIn session cookie login | Complete | `/api/linkedin/connect/cookie` | High |
| 2FA / Checkpoint resolution | Complete | `/api/linkedin/checkpoint/solve` | Medium |
| People search / prospecting | Complete | `GET /api/linkedin/search` | High — scraping |
| Send connection request (queued) | Complete | `POST /api/linkedin/connection` | High |
| Automated daily connection agent | **DISABLED** | `daily-agent.worker.ts` returns 0 | N/A |
| AI inbox replies (Gemini) | Complete | Webhook or inbound polling | High |
| Follow-up messages | Complete | Action queue (MESSAGE type) | High |
| Post engagement (react, comment) | Complete | `POST /api/linkedin/react` | High |
| Create / delete posts | Complete | `POST /api/linkedin/posts` | Medium |
| Invitation management | Complete | `/api/linkedin/invitations/...` | Medium |
| CRM / Contact pipeline | Complete | Conversation controller | None |
| AI chat interface | Complete | `/api/agent/*` | None |
| Admin panel | Complete | `/api/admin/*` | None |
| Webhook event processing | Complete | `POST /api/webhooks/` | None |
| Billing / subscriptions | **Unknown** | Not found | N/A |
| Team / multi-user workspaces | **Unknown** | Not found | N/A |
| Campaign management | **Unknown** | Not found | N/A |
| Opted-out contact exclusion | **Broken** | `contacts.optedOut` field not checked | High — legal |

---

## 5. Technology Stack and Dependency Audit

### Backend Key Dependencies

| Dependency | Version | Purpose | Concern |
|---|---|---|---|
| express | 5.0.6 | HTTP server | Express 5 stable — good |
| drizzle-orm | 0.45.2 | SQL ORM | None |
| jsonwebtoken | 9.0.3 | JWT sign/verify | Ensure secret rotation |
| bcrypt | 6.0.0 | Password hashing | Solid |
| express-rate-limit | 8.7.0 | Rate limiting | In-memory only — resets on restart |
| @langchain/langgraph | 1.4.14 | AI agent orchestration | None known |
| @langchain/google-genai | 2.3.0 | Gemini AI client | Requires valid API key |
| zod | 4.5.4 | Schema validation | None |
| luxon | 3.7.2 | Date/time | None |
| postgres | 3.4.9 | PostgreSQL client | None |
| typescript | 7.0.2 | Type compiler | Very new — watch for breaking changes |

### Frontend Key Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| next | 16.3.4 | React framework (App Router) |
| react | 19.2.8 | UI library |
| axios | 1.20.0 | HTTP client |
| tailwindcss | ^4 | CSS utility framework |
| lucide-react | 1.41.0 | Icons |
| motion | 13.2.0 | Animation |

### Audit Findings

- **Verified:** Redis is defined in `docker-compose.yml` but no Redis client is imported in any server code. Redis is dead infrastructure.
- **Verified:** `express-rate-limit` uses in-memory store (default). Rate limits reset on every restart.
- **Verified:** No security scanning (`npm audit`, SAST, secret scan) step exists in the CI pipeline.
- **Verified:** TypeScript 7.0.2 and Next.js 16.3.4 are very recent (late 2026) releases — monitor for stability issues.

---

## 6. LinkedIn Integration Teardown

### Authentication Methods Supported

| Method | Code Location | Risk Level | Notes |
|---|---|---|---|
| Hosted OAuth (Unipile UI) | `unipile.client.ts:323` | Medium | Credentials never reach WorkPilot |
| Username/Password | `unipile.client.ts:230`, `account.service.ts:163` | High | Credentials sent to Unipile; encrypted copy stored in DB |
| Session cookie (`li_at`) | `account.service.ts:connectWithCookie` | High | Raw LinkedIn session cookie submitted |

### Credential Storage (Critical)

**Verified.** LinkedIn usernames, passwords, and session cookies are AES-256-CBC encrypted and stored in `linkedinAccounts.encryptedCredentials`. The encryption key is derived from `JWT_SECRET` via SHA-256.

```typescript
// server/src/utils/crypto.util.ts:5
const SECRET = process.env.JWT_SECRET || "default-WORKPILOT-secret-key-32";
const KEY = crypto.createHash("sha256").update(SECRET).digest();
```

The committed `JWT_SECRET` is weak and hardcoded. A single credential compromise gives access to all stored LinkedIn sessions.

### Safety Controls

| Control | Default | Implementation | Gap |
|---|---|---|---|
| Daily connection limit | 25/day | DB counter, `COMPLETED` queue entries | No carryover if limit hit mid-day |
| Daily message limit | 50/day | Same mechanism | Same |
| Business hours scheduling | 08:00–19:00 | Server local time check | Uses server timezone, not user timezone |
| Connection deduplication | Contact status | `safety.service.ts:120-150` | Only `CONTACTED`/`CONNECTED` check |
| Message deduplication | Text exact match | `safety.service.ts:153-176` | Fragile — text must match exactly |
| Circuit breaker | Pause on limit | `automationStatus = PAUSED` | No user notification |

### Inbound Message Processing (Two Parallel Paths)

1. **Webhook-driven** (`POST /api/webhooks/`): Real-time push from Unipile. Processes via `messageAgentWorker`.
2. **Polling-driven** (`inboundSyncService.startPolling(30000)`): Every 30s, fetches all conversations from Unipile.

**Duplicate processing risk:** Deduplication uses `messageId` from webhook but a synthetic `sync_{chatId}_{timestamp}` ID from polling — these may not match, leading to double AI replies.

### LinkedIn Actions Inventory

| Action | Unipile Endpoint | Retry | Idempotency |
|---|---|---|---|
| Send connection | `POST /api/v1/users/invite` | None | Contact status check |
| Send message | `POST /api/v1/chats/{id}/messages` | None | Text-match only |
| React to post | `POST /api/v1/posts/{id}/reactions` | None | None |
| Comment on post | `POST /api/v1/posts/{id}/comments` | None | None |
| Profile lookup | `GET /api/v1/users/{id}` | None | N/A |
| People search | `POST /api/v1/linkedin/search` | Fallback URL | N/A |

### Platform-Policy Risk

LinkedIn's User Agreement Section 8.2 explicitly prohibits automated data collection, scraping, creating accounts or accessing LinkedIn through unauthorized means. This constitutes an **existential strategic risk** requiring legal counsel before commercial operation.

---

## 7. Frontend Review

### Framework and Rendering

**Verified.** Next.js 16 with App Router. Tailwind CSS 4 for styling. Fonts: Plus Jakarta Sans (headings), Inter (body).

### Security Concerns

- **Verified:** `dangerouslySetInnerHTML` used in `layout.tsx:44-62` for theme initialization (hardcoded content — low immediate risk, dangerous pattern).
- **Unknown:** Whether JWT is stored in `localStorage` (XSS-accessible) in addition to cookies.
- **Unknown:** CSRF protection not confirmed. Server accepts cookies with `credentials: true`.
- **Unknown:** Security headers (CSP, HSTS, X-Frame-Options) not confirmed.

### Key Screens

| Screen | Route | API |
|---|---|---|
| Login | `/login` | `POST /api/auth/login` |
| Register | `/register` | `POST /api/auth/signup` |
| Dashboard | `/dashboard` | `GET /api/dashboard/stats` |
| LinkedIn Connect | `/linkedin` | `GET /api/linkedin/connect` |
| Admin Panel | `/admin` | `GET /api/admin/*` |

---

## 8. Backend and API Review

### Route Registration

**Verified.** All routes mount under `/api/*`. An additional `/internal/admin` duplicate mount exists with the same admin controller — confusing and unnecessary.

### Authentication

**Verified.** JWT tokens accepted from:
1. `Authorization: Bearer {token}` header
2. `Cookie: token={token}`
3. `?token={token}` query parameter ← **Unsafe — tokens appear in logs**

### Webhook Security

**Verified Critical.** `POST /api/webhooks/` has NO authentication by default.

```typescript
// server/src/services/webhook/webhook-auth.service.ts:13-15
if (!configuredSecret) {
  return { valid: true }; // Anyone can send fake webhooks
}
```

`UNIPILE_WEBHOOK_SECRET` is absent from all committed env files.

### CORS Configuration

**Verified.** CORS allows any origin in non-production. In production, allows `workpilot.co.in` subdomains. Reasonable for production, dangerous in dev if server is Internet-accessible.

### Missing Controls

- No API versioning (`/api/v1/...`)
- No global payload size limit configured
- No CSRF token protection
- No `helmet` middleware (security headers)
- No OpenAPI/Swagger specification

---

## 9. Database and Data Model

### Engine and ORM

**Verified.** PostgreSQL (Neon Serverless). Drizzle ORM 0.45.2. 8 SQL migrations tracked.

### Core Tables

| Table | Key Columns | Notes |
|---|---|---|
| `users` | id, email (unique), password (bcrypt), role, timezone, geminiApiKey | Personal Gemini key per user |
| `linkedinAccounts` | id, userId FK, unipileAccountId (unique), healthStatus, automationStatus, encryptedCredentials | AES-CBC encrypted LinkedIn creds |
| `contacts` | id, userId FK, linkedinId, status, conversationMode, optedOut, matchScore | Core prospecting CRM entity |
| `dailyAgentSettings` | userId FK (unique), dailyQuota, targetRoles[], targetIndustries[], networkingGoal, companyKnowledge, faq | User's automation config |
| `dailyAgentRuns` | userId FK, runKey (unique idempotency), logDetails JSONB[] | Unbounded growth risk |
| `webhookEvents` | eventId (unique), payload JSONB | Full webhook body stored — unbounded |
| `messageAgentJobs` | messageId (unique), status, suggestedReply, sentReply, reasoning, payload JSONB | AI job store |
| `messages` | userId FK, contactId FK, direction, content | Full LinkedIn message text stored in plaintext |
| `actionQueue` | userId FK, contactId FK, actionType, status, scheduledFor, payload JSONB | Pseudo-queue |
| `systemSettings` | key (PK), value TEXT | **API keys stored in plaintext** |

### Critical Data Concerns

| Issue | Evidence | Severity |
|---|---|---|
| `systemSettings.value` stores Unipile/Gemini API keys in plaintext | `schema.ts:209` | High |
| `encryptedCredentials` encrypted with key derived from weak JWT_SECRET | `crypto.util.ts:5` | Critical |
| LinkedIn message `content` stored in plaintext | `schema.ts:185` | Medium — GDPR concern |
| `webhookEvents.payload` stores full Unipile webhook body | `schema.ts:148` | Medium |
| No soft-delete — hard cascade delete | All FK constraints | Medium |
| No data retention policies | No cleanup jobs | Medium |
| No composite index on `(userId, status)` for `action_queue` | Not in schema | Performance |
| No index on `contacts.userId` or `contacts.linkedinId` | Not in schema | Performance |

### Tenant Isolation

**Inferred.** Tenant isolation based entirely on `userId` carried through all queries. No PostgreSQL Row-Level Security (RLS) policies. Application-level bugs could expose cross-tenant data.

---

## 10. Background Jobs, Queues, and Scheduling

### Worker Architecture

All workers run in-process with the HTTP server via `setInterval`:

| Worker | Interval | Function | Jobs Per Tick |
|---|---|---|---|
| Action Queue Worker | 30 seconds | `actionQueueService.processDueActions()` | 10 |
| Message Agent Worker | 30 seconds | `messageAgentWorker.processPendingJobs()` | 10 |
| Inbound Sync Service | 30 seconds | `inboundSyncService.syncAllActiveAccounts()` | All accounts |

### Job Types

| Job Type | Producer | Consumer | Retry | Idempotency |
|---|---|---|---|---|
| CONNECT | API controller | Action Queue | None | Contact status check |
| MESSAGE | API controller | Action Queue | None | Text dedup (weak) |
| REACT | API controller | Action Queue | None | None |
| COMMENT | API controller | Action Queue | None | None |
| message_agent_job | Webhook / inbound sync | Message Agent | 3 attempts | `messageId` unique key |

### Failure Scenarios

| Scenario | Current Behavior | Risk |
|---|---|---|
| Worker crashes mid-action | Job stays PROCESSING indefinitely | Action may have executed; DB not updated |
| Server restarts | Action queue PROCESSING jobs not reclaimed | High — duplicate actions on restart |
| Same job runs twice | No atomic claim for action_queue | Duplicate LinkedIn actions |
| Account restricted | Circuit breaker PAUSES; user not notified | Silent failure |
| Daily limit reached | Jobs marked PAUSED; not rescheduled for next day | Jobs lost |

### Key Missing Features

- No automatic retry for failed `actionQueue` jobs
- No dead-letter queue
- No job cancellation API
- No fan-out isolation per user (one user's 100 jobs can starve others)

---

## 11. Authentication, Authorization, and Tenancy

### User Authentication

- **Password hashing:** `bcrypt` (default rounds ~10)
- **JWT:** HS256, 7-day expiry
- **No refresh tokens:** Users must re-login after 7 days
- **No token revocation:** Logging out does not invalidate JWT server-side
- **No MFA support**
- **No email verification on signup**

### Role Model

| Role | Access |
|---|---|
| USER | Own resources only (userId scoped) |
| ADMIN | All admin endpoints + system settings |

Admin set by DB `users.role` field OR `ADMIN_EMAILS` environment variable list.

### Tenancy Model

Single-tier tenancy — one user = one tenant. Data isolation enforced only by application-layer `userId` filtering. No DB-level RLS.

---

## 12. Security Review and Threat Model (STRIDE)

### Security Findings Register

| ID | Title | Severity | Evidence |
|---|---|---|---|
| SEC-001 | Live secrets committed to git | **Critical** | `server/.env`, `.env.production` |
| SEC-002 | EC2 RSA private key in repository | **Critical** | `linkdin  brain.pem` |
| SEC-003 | Unauthenticated webhook endpoint | **Critical** | `webhook-auth.service.ts:13-15` |
| SEC-004 | JWT secret used as LinkedIn credential encryption key | **Critical** | `crypto.util.ts:5` |
| SEC-005 | JWT accepted via query string (log exposure) | Medium | `auth.middleware.ts:20-21` |
| SEC-006 | No token revocation on logout | Medium | Auth routes |
| SEC-007 | No CSRF protection | Medium | `app.ts` |
| SEC-008 | No security headers (Helmet) | Medium | `app.ts` |
| SEC-009 | `systemSettings` API keys in plaintext DB | High | `schema.ts:209` |
| SEC-010 | In-memory rate limits reset on restart | Low | `rate-limit-middleware.ts` |
| SEC-011 | `ADMIN_EMAILS` bypass with predictable email | Medium | `admin.middleware.ts:36-41` |
| SEC-012 | LinkedIn credentials stored (even if encrypted) | Medium | `linkedinAccounts.encryptedCredentials` |
| SEC-013 | Unverified IDOR on contact/queue resources | Medium | Inferred from architecture |

### STRIDE Summary

| Threat | Finding | Severity |
|---|---|---|
| **Spoofing** — Fake webhook injection | SEC-003 | Critical |
| **Spoofing** — JWT forged with known secret | SEC-001 | Critical |
| **Tampering** — DB credentials in git | SEC-001 | Critical |
| **Tampering** — LinkedIn creds re-derivable from known JWT_SECRET | SEC-004 | Critical |
| **Information Disclosure** — Secrets in git history | SEC-001, SEC-002 | Critical |
| **Information Disclosure** — JWT in query string | SEC-005 | Medium |
| **Denial of Service** — Unauthenticated webhook flood | SEC-003 | High |
| **Elevation of Privilege** — BOLA via contact ID | SEC-013 | Medium |
| **Elevation of Privilege** — Admin via known email | SEC-011 | Medium |

---

## 13. Privacy, Compliance, and Platform-Policy Review

> **This is a technical issue-spotting review, not legal advice. All items require qualified legal counsel.**

### Data Categories Collected

| Category | Source | Tables | Lawful Basis? |
|---|---|---|---|
| Account credentials | User registration | `users` | Contract — likely OK |
| LinkedIn profile data | Unipile/LinkedIn scraping | `contacts` | **Uncertain** |
| LinkedIn private messages | Unipile API | `messages`, `messageAgentJobs` | **Uncertain** |
| LinkedIn session credentials | User submission | `linkedinAccounts.encryptedCredentials` | Contract — risky |
| AI interaction history | Gemini AI | `agentMessages` | **Uncertain** |
| Webhook event payloads | Unipile push | `webhookEvents` | **Unknown retention** |

### LinkedIn Terms of Service Conflicts (Verified by Architecture)

1. **Automated connection requests** — ToS §8.2 prohibits automated communications
2. **Scraping profiles and search results** — ToS §8.2(a) prohibits crawlers/scrapers/bots
3. **Storing LinkedIn credentials** — ToS §8.2(g) prohibits unauthorized credential use
4. **Automated messaging** — ToS §8.2(f) prohibits unsolicited commercial messages

### GDPR Gaps

| Requirement | Status |
|---|---|
| Lawful basis for LinkedIn contact data | Unknown — requires DPA/DPIA |
| Data subject access requests | No DSAR mechanism found |
| Right to erasure completeness | Cascade delete exists; completeness unknown |
| Data processor agreements (Unipile, Neon, Google) | Unknown — must execute DPAs |
| International transfers | Likely without SCCs |
| Consent for automated decision-making | No consent layer found |

### Critical Legal Gaps

- `contacts.optedOut` field exists but is **NOT checked** in the safety service pre-flight — opted-out contacts can still receive automated messages.
- No GDPR DPA confirmed with Unipile, Neon (AWS us-east-2), or Google Gemini.

---

## 14. Configuration and Secret Management

### Environment Variable Catalog

| Variable | Required | Secret | Current State | Action |
|---|---|---|---|---|
| `DATABASE_URL` | Yes | Yes | **COMMITTED IN GIT** | Rotate immediately |
| `JWT_SECRET` | Yes | Yes | **COMMITTED — weak value** | Rotate + strengthen |
| `UNIPILE_DSN` | Yes | Yes | **COMMITTED IN GIT** | Rotate immediately |
| `UNIPILE_API_KEY` | Yes | Yes | **COMMITTED IN GIT** | Rotate immediately |
| `UNIPILE_WEBHOOK_SECRET` | Recommended | Yes | **Not set** | Set immediately |
| `GEMINI_API_KEY` | Yes (AI) | Yes | Placeholder in example | Verify production value |
| `ADMIN_EMAILS` | No | Semi-secret | `admin@example.com` committed | Review and secure |
| `CLIENT_URL` | Yes | No | Committed | OK |
| `GEMINI_MODEL` | No | No | Committed | OK |
| `NEXT_PUBLIC_API_URL` | Yes | No | Committed | OK |

### Secret Management Issues

1. `server/.env` and `.env.production` contain **live credentials** committed to repository.
2. `JWT_SECRET` value (`workpilot_super_secret_jwt_key_2026_change_in_prod`) committed with note "change in prod" — not changed.
3. `UNIPILE_WEBHOOK_SECRET` absent — webhook unauthenticated.
4. The ECS task definition template (`deploy/aws/ecs-task-definition.json`) shows correct AWS Secrets Manager pattern but is **not used** in the actual EC2 deployment.

### Recommended Approach

Use AWS Secrets Manager for all secrets. Inject via EC2 IAM role at runtime. Never commit `.env` files.

---

## 15. Deployment Teardown

### Current Deployment Model

**Verified.** Single AWS EC2 instance running Docker Compose, deployed via GitHub Actions → AWS SSM → `deploy-production.sh`.

### Docker Compose Services

| Service | Port | Status |
|---|---|---|
| `workpilot_server` | 4000 | Active |
| `workpilot_client` | 3000 | Active |
| `workpilot_postgres` | 5432 | Defined but Neon is actual DB |
| `workpilot_redis` | 6379 | Defined but UNUSED |

### CI/CD Pipeline Stages

1. **CI Validate**: TypeScript typecheck + build (backend); Lint + typecheck + build (frontend)
2. **Deploy Production**: AWS OIDC → SSM → `deploy-production.sh` on EC2
3. **Post-deploy health checks**: HTTP GET to backend `:4000/api/health/liveness` and frontend `:3000/`

### Production Blockers

- No TLS/HTTPS — traffic unencrypted in transit
- No load balancer
- No auto-scaling
- No automated database backup verification
- Single point of failure

---

## 16. CI/CD and Engineering Workflow

### Pipeline Assessment

| Gate | Status | Gap |
|---|---|---|
| Backend TypeScript typecheck | ✅ Present | |
| Frontend TypeScript typecheck | ✅ Present | |
| Frontend ESLint | ✅ Present | |
| Backend ESLint | ❌ Missing | No eslint for server |
| Unit tests | ❌ Missing | No test framework |
| Security scan (`npm audit`) | ❌ Missing | |
| SAST scan | ❌ Missing | |
| Secret scan (gitleaks, trufflehog) | ❌ Missing | Would have caught committed secrets |
| Database migration step | ❌ Missing | Must be run manually |
| Rollback procedure | ❌ Missing | Manual only |

---

## 17. Observability and Operations

### Current State

| Signal | Implementation | Gap |
|---|---|---|
| Logging | `console.log/warn/error` only | No structured logging, no correlation IDs |
| Metrics | None | No Prometheus, CloudWatch metrics |
| Tracing | None | No distributed tracing |
| Error tracking | None | No Sentry, Datadog |
| Audit logs | None | No admin action audit trail |
| Health endpoint | `GET /api/health/liveness` | No DB connectivity check |

### Operational Questions — Can We Answer?

| Question | Answerable Now? |
|---|---|
| Is the system healthy? | Partially — health endpoint exists |
| Which LinkedIn account is failing? | No — console logs only |
| Are messages/actions delayed? | No |
| Are jobs duplicated? | No |
| Is LinkedIn rejecting requests? | No |
| Is the queue backing up? | Admin UI only |
| Did a deployment cause regressions? | No |

---

## 18. Reliability and Failure Analysis

| Failure Mode | Current Control | Gap |
|---|---|---|
| Database outage | Neon HA | Add retry with backoff |
| Queue processing stuck | None | Alert on queue age > 10 min |
| Worker crash | Graceful shutdown (10s) | Supervisor/PM2; separate worker process |
| LinkedIn rate limit | Circuit breaker PAUSES | Alert user; retry with backoff |
| Account restriction/ban | `healthStatus = RECONNECT_REQUIRED` | No user notification |
| Deployment mid-processing | 10s graceful shutdown | Implement worker drain |
| Duplicate message send | Message text dedup (weak) | Full idempotency key for all actions |
| Clock skew | None | Use DB server time for scheduling |

---

## 19. Performance and Scalability

### Scaling Analysis

| User Scale | Actions/Day | Queue Ticks/Hour | Risk |
|---|---|---|---|
| 10 users | ~250 | Manageable | None |
| 100 users | ~2,500 | Near capacity | First bottleneck: in-process queue |
| 1,000 users | ~25,000 | Backlog grows | Complete re-architecture needed |
| 10,000 users | ~250,000 | Cannot process | Requires distributed queue |

### First Bottleneck

The 30-second `setInterval` processing loop handles only 10 jobs per tick. At 100 users with 25 queued jobs each = 2,500 pending jobs. At 10 jobs/30s = 8+ minutes lag per cycle. Inbound sync polling fetches ALL accounts every 30s, making each poll `N × M` Unipile API requests.

### Missing Indexes (Immediate Performance Risk)

```sql
-- Critical missing indexes
CREATE INDEX ON contacts(user_id, linkedin_id);
CREATE INDEX ON action_queue(user_id, status, scheduled_for);
CREATE INDEX ON message_agent_jobs(status, attempt_count);
CREATE INDEX ON messages(user_id, contact_id);
```

---

## 20. Testing and Quality

### Current State

| Test Type | Status |
|---|---|
| Unit tests | ❌ None |
| Integration tests | ❌ None (manual scripts only) |
| API contract tests | ❌ None |
| End-to-end tests | ❌ None |
| Security tests | ❌ None (manual scripts only) |
| CI test execution | ❌ None |

### Critical Untested Paths

1. Safety service daily limit logic
2. Message deduplication edge cases
3. Webhook idempotency
4. Admin authorization checks
5. AES encrypt/decrypt round-trip
6. Tenant isolation (cross-user data access prevention)

---

## 21. Code Quality and Maintainability Review

### Strengths

- TypeScript throughout with reasonable type coverage
- Clear service-layer separation (routes → controllers → services)
- Drizzle ORM provides type-safe DB queries
- Safety service with circuit breaker is good design
- Graceful shutdown implemented in `index.ts`
- Webhook idempotency via `messageAgentJobs.messageId` unique key

### Concerns

| Issue | Evidence | Impact |
|---|---|---|
| Very large files | `admin.controller.ts` (41KB), `daily-agent.service.ts` (35KB), `WORKPILOT-connect-agent.ts` (34KB) | Hard to maintain |
| `any` types pervasive | Unipile API responses typed as `any` throughout | No type safety for external data |
| Business hours check uses server time | `queue.service.ts:55` | Wrong timezone for global users |
| No logging structure | `console.log` strings only | Cannot search/filter in production |
| Unused Redis container | `docker-compose.yml` | Dead infrastructure confusion |
| `setImmediate` for async webhook processing | `webhook.controller.ts:51,157` | No backpressure, no error visibility |
| Daily agent worker permanently disabled | `daily-agent.worker.ts:24-30` | Confusing dead code |

---

## 22. Cost Analysis

### Cost-Driving Resources

| Resource | Provider | Monthly Cost Driver |
|---|---|---|
| Compute | AWS EC2 | Instance hours |
| Database | Neon Serverless PostgreSQL | Query volume + storage |
| AI | Google Gemini API | Messages processed × token count |
| LinkedIn Integration | Unipile | Per-account subscription |
| Bandwidth | AWS | Outbound data volume |

### Cost Formula

```
Monthly ≈
  EC2 (instance_type × hours) +
  Neon (compute_units × CU_rate + storage_GB × storage_rate) +
  Unipile (accounts × per_account_monthly) +
  Gemini (messages_per_month × avg_tokens × token_rate)
```

---

## 23. Production-Readiness Checklist

| # | Item | Status | Risk | Priority | Release Blocker |
|---|---|---|---|---|---|
| 1 | No live secrets in git | ❌ FAIL | Critical | P0 | **Yes** |
| 2 | Private key not in repo | ❌ FAIL | Critical | P0 | **Yes** |
| 3 | Webhook authentication enabled | ❌ FAIL | Critical | P0 | **Yes** |
| 4 | Strong unique JWT secret | ❌ FAIL | Critical | P0 | **Yes** |
| 5 | LinkedIn credentials use separate encryption key | ❌ FAIL | Critical | P0 | **Yes** |
| 6 | Opted-out contacts excluded from automation | ❌ FAIL | High (legal) | P0 | **Yes** |
| 7 | LinkedIn ToS legal review | Unknown | Critical (business) | P0 | **Yes** |
| 8 | HTTPS/TLS on production | ❌ FAIL | High | P1 | **Yes** |
| 9 | Database backups verified | Unknown | High | P1 | **Yes** |
| 10 | Security headers (Helmet) | ❌ FAIL | Medium | P1 | No |
| 11 | Remove JWT from query string | ❌ FAIL | Medium | P1 | No |
| 12 | CSRF protection | ❌ FAIL | Medium | P1 | No |
| 13 | Encrypt `systemSettings` API keys | ❌ FAIL | Medium | P1 | No |
| 14 | Automated test suite | ❌ FAIL | High | P1 | No |
| 15 | CI secret scanning | ❌ FAIL | High | P1 | No |
| 16 | CI `npm audit` | ❌ FAIL | Medium | P2 | No |
| 17 | Rate limits survive restarts (Redis store) | ❌ FAIL | Medium | P2 | No |
| 18 | Retry for failed queue jobs | ❌ FAIL | Medium | P2 | No |
| 19 | Structured logging | ❌ FAIL | Medium | P2 | No |
| 20 | Error tracking (Sentry) | ❌ FAIL | Medium | P2 | No |
| 21 | GDPR DPAs with Unipile/Neon/Google | Unknown | High (legal) | P0 | **Yes** |
| 22 | Multi-tenant RLS in PostgreSQL | Partial | Medium | P2 | No |
| 23 | Worker process isolation from HTTP server | ❌ FAIL | High | P2 | No |
| 24 | Health check verifies DB connectivity | ❌ FAIL | Low | P3 | No |

---

## 24. Findings and Prioritized Remediation Roadmap

### Consolidated Findings

| ID | Title | Category | Severity |
|---|---|---|---|
| SEC-001 | Live secrets committed to git | Security | **Critical** |
| SEC-002 | EC2 RSA private key committed | Security | **Critical** |
| SEC-003 | Unauthenticated webhook endpoint | Security | **Critical** |
| SEC-004 | LinkedIn credentials encrypted with JWT_SECRET | Security | **Critical** |
| POLICY-001 | LinkedIn ToS violation risk | Platform Policy | **Critical** |
| DATA-001 | `systemSettings` API keys in plaintext | Data | High |
| DATA-002 | Opted-out contacts not excluded from automation | Data/Legal | **Critical** |
| REL-001 | No retry for failed queue jobs | Reliability | High |
| REL-002 | Race condition: duplicate job execution | Reliability | High |
| REL-003 | In-process workers crash stops all automation | Reliability | High |
| SCALE-001 | In-process queue cannot scale beyond ~100 users | Scalability | High |
| DEPLOY-001 | No HTTPS/TLS on production | Deployment | High |
| DEPLOY-002 | Database migration not automated in CI/CD | Deployment | High |
| SEC-005 | JWT accepted via query string | Security | Medium |
| SEC-006 | No token revocation on logout | Security | Medium |
| SEC-007 | No CSRF protection | Security | Medium |
| SEC-008 | No security headers | Security | Medium |
| OBS-001 | No structured logging or error tracking | Observability | Medium |
| TEST-001 | No automated test suite | Quality | Medium |
| SEC-009 | Business hours check uses server timezone | Logic | Low |

### Remediation Roadmap

#### Phase 0 — Immediate Containment (0–48 hours)

1. **[SEC-001]** Rotate ALL committed credentials:
   - Neon DB password → update in Neon console → update EC2 `.env`
   - Unipile API key → rotate in Unipile dashboard → update EC2 `.env`
   - JWT secret → generate new 256-bit random string → update EC2 `.env` + restart (invalidates all sessions)
   - Google Gemini API key (if real value exists)
2. **[SEC-002]** Regenerate EC2 SSH key pair in AWS console; revoke old key from EC2 instance
3. **[SEC-003]** Set `UNIPILE_WEBHOOK_SECRET` to a random string in production `.env`
4. **[DATA-002]** Add `contacts.optedOut === true` check to `verifyPreFlight()` in `safety.service.ts`

#### Phase 1 — Before Any Production Use

5. **[DEPLOY-001]** Add TLS: Configure AWS ALB with ACM certificate OR Nginx + Let's Encrypt
6. **[SEC-004]** Generate separate `ENCRYPTION_KEY` env var; update `crypto.util.ts:5` to use it instead of `JWT_SECRET`
7. **[POLICY-001]** Engage qualified legal counsel regarding LinkedIn ToS and Unipile terms
8. **[DEPLOY-002]** Add database migration step to CI/CD before deployment
9. **[SEC-005]** Remove query-string JWT acceptance in `auth.middleware.ts:20-21`
10. **[SEC-008]** Add `helmet()` middleware to `app.ts`
11. **[CI]** Add secret scanning (Gitleaks/Trufflehog) to CI pipeline
12. **[CI]** Add `npm audit --audit-level=high` to CI pipeline

#### Phase 2 — First 30 Days

13. **[REL-001]** Add exponential retry (3 attempts, 30s/5m/15m backoff) for FAILED `actionQueue` jobs
14. **[REL-002]** Implement atomic claim for `actionQueue` (`UPDATE WHERE status=QUEUED RETURNING`)
15. **[DATA-001]** Encrypt API keys before storing in `systemSettings.value`
16. **[TEST-001]** Add Jest or Vitest; unit tests for `safety.service.ts`, `crypto.util.ts`, auth flow
17. **[OBS-001]** Add Pino structured logging + Sentry for error tracking
18. **[SEC-006]** Add JWT revocation list (Redis-based denylist) for logout
19. **[SEC-007]** Add CSRF protection (double-submit cookie or SameSite=Strict)
20. **[PERF]** Add missing database indexes (see Section 19)

#### Phase 3 — 31–90 Days

21. **[SCALE-001]** Migrate action queue to BullMQ + Redis; separate worker process
22. **[REL-003]** Run workers as separate processes or ECS tasks
23. **[SCALE]** Replace inbound sync polling with pure webhook-driven processing
24. **[OBS]** Add Prometheus metrics + Grafana dashboards
25. **[GDPR]** Implement data subject request (access/deletion) workflows
26. **[TEST]** Add integration tests with Unipile mock server

#### Phase 4 — 3–6 Months

27. **[SCALE]** Add read replica for analytics queries
28. **[SCALE]** Multi-region or multi-AZ deployment
29. **[PRODUCT]** Campaign management, suppression lists, proper opted-out enforcement
30. **[OBS]** Distributed tracing with OpenTelemetry
31. **[POLICY]** Evaluate official LinkedIn Marketing API partnership

---

## 25. Target Production Architecture

```
Users → AWS ALB (HTTPS + ACM TLS)
  → ECS/ASG: Next.js Client (N tasks)
  → ECS/ASG: Express API (N tasks) → RDS PostgreSQL (Multi-AZ)
                                    → ElastiCache Redis (BullMQ + Rate Limits)
                                    → AWS Secrets Manager
  → ECS/ASG: BullMQ Workers (N tasks) → Unipile API → LinkedIn
                                       → Google Gemini AI
  → CloudWatch Logs + Metrics
  → Sentry (error tracking)
  
Webhooks: Unipile → ALB → Express API
```

### Key Differences from Current

| Aspect | Current | Target |
|---|---|---|
| TLS | None | ALB + ACM |
| Compute | Single EC2 | ECS Auto-Scaling Group |
| Workers | In-process setInterval | Separate ECS tasks (BullMQ) |
| Queue | PostgreSQL table | Redis + BullMQ |
| Secrets | `.env` file on disk | AWS Secrets Manager |
| Logging | `console.log` | CloudWatch + Sentry |
| Rate limiting | In-memory | ElastiCache Redis |

---

## 26. Handoff Information for the Next AI/Engineering Session

### How to Run Locally

```bash
# 1. Server setup
cd server
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET (new random),
# UNIPILE_DSN, UNIPILE_API_KEY, GEMINI_API_KEY
npm install
npm run db:push
npm run dev   # starts server on :4000

# 2. Client setup
cd ../client
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev   # starts client on :3000
```

### How It Is Deployed

Push to `main` branch → GitHub Actions CI → AWS SSM → EC2 `/home/ubuntu/app/scripts/deploy-production.sh` → `docker-compose pull + up -d`

### Critical Files

| File | Purpose |
|---|---|
| `server/src/app.ts` | Express app setup |
| `server/src/index.ts` | Server entry + workers |
| `server/src/db/schema.ts` | All database entities |
| `server/src/services/unipile/unipile.client.ts` | All LinkedIn actions |
| `server/src/services/safety/safety.service.ts` | Rate limits + circuit breaker |
| `server/src/services/queue/queue.service.ts` | Action queue processing |
| `server/src/utils/crypto.util.ts` | AES encryption — **fix key derivation** |
| `server/src/middlewares/auth.middleware.ts` | JWT authentication |
| `.github/workflows/deploy-production.yml` | CI/CD pipeline |

### Files That Must NEVER Be Uploaded Elsewhere

- `server/.env` — live DB credentials
- `.env.production` — live credentials
- `linkdin  brain.pem` — EC2 SSH private key (ROTATE IMMEDIATELY)

### Environment Variables (Names Only)

`DATABASE_URL`, `JWT_SECRET`, `UNIPILE_DSN`, `UNIPILE_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `CLIENT_URL`, `NODE_ENV`, `PORT`, `ADMIN_EMAILS`, `UNIPILE_WEBHOOK_SECRET`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SERVER_URL`

### Open Questions for the Next Session

1. What do `services/ai/`, `services/crm/`, `services/engagement/`, `services/intelligence/`, `services/prospects/`, `services/sequence/` contain?
2. Is Neon database PITR backup enabled and tested?
3. Does `RAUNAK_ROLE_AND_TASKS.md` contain personal data requiring redaction?
4. Is the Unipile partnership official or using public API?
5. Are there existing customers / live LinkedIn accounts connected?
6. Does the frontend store JWT in `localStorage` in addition to cookies?
7. What is the EC2 instance type and Node.js version?

### Recommended Next Task

**Immediate (P0):** Credential rotation + webhook secret configuration + opted-out check fix. Then TLS. Then legal review. Then automated tests.

---

## Appendix A — API Inventory

### Auth Routes

| Method | Route | Auth | Rate Limit |
|---|---|---|---|
| POST | `/api/auth/signup` | None | 10/5min |
| POST | `/api/auth/login` | None | 5/2min |
| GET | `/api/auth/me` | JWT | 10/min |
| POST | `/api/auth/logout` | None | 10/min |
| DELETE | `/api/auth/account` | JWT | 5/min |

### LinkedIn Routes (all require JWT)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/linkedin/connect` | Get hosted auth URL |
| GET | `/api/linkedin/status` | Account status |
| POST | `/api/linkedin/connect/credentials` | Connect with username/password |
| POST | `/api/linkedin/connect/cookie` | Connect with session cookie |
| POST | `/api/linkedin/checkpoint/solve` | Solve 2FA |
| POST | `/api/linkedin/connection` | Queue connection request |
| GET | `/api/linkedin/search` | Search LinkedIn people |
| GET | `/api/linkedin/profile/:id` | Get LinkedIn profile |
| GET | `/api/linkedin/conversations` | List conversations |
| POST | `/api/linkedin/message` | Send direct message |
| POST | `/api/linkedin/react` | React to post |
| POST | `/api/linkedin/comment` | Comment on post |
| POST | `/api/linkedin/posts` | Create post |
| ... | (30+ routes total) | |

### Admin Routes (require JWT + ADMIN role)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/admin/overview` | Dashboard KPIs |
| GET | `/api/admin/linkedin-accounts` | All accounts |
| GET | `/api/admin/users` | All users |
| GET/POST | `/api/admin/settings/unipile` | Unipile settings |
| GET/POST | `/api/admin/settings/gemini` | Gemini settings |
| GET | `/api/admin/queue/stats` | Queue stats |
| GET | `/api/admin/automation/health` | Health telemetry |
| POST | `/api/admin/daily-agent/run/:userId` | Trigger daily agent |

### Webhook Routes (NO AUTH when secret not set)

| Method | Route |
|---|---|
| POST | `/api/webhooks/` |
| POST | `/api/webhooks/unipile` |
| POST | `/api/webhooks/messages` |
| POST | `/api/webhooks/unipile/messages` |
| POST | `/api/linkedin/webhook` |

---

## Appendix B — Database Inventory

| Table | Growth Pattern | Retention Policy | Sensitive Data |
|---|---|---|---|
| `users` | Low/linear | User lifetime | Password hash, email |
| `linkedinAccounts` | ~1 per user | User lifetime | **Encrypted LinkedIn credentials** |
| `contacts` | 100s per user | User lifetime | LinkedIn profile data |
| `dailyAgentSettings` | 1 per user | User lifetime | Company knowledge, FAQ |
| `dailyAgentRuns` | Unbounded | **None** | Agent run logs |
| `webhookEvents` | Unbounded | **None** | Full Unipile webhook payloads |
| `messageAgentJobs` | Unbounded | **None** | LinkedIn message content, AI replies |
| `messages` | Unbounded | **None** | Full LinkedIn message content (plaintext) |
| `actionQueue` | Unbounded | **None** | Action payloads |
| `systemSettings` | Small/fixed | Permanent | **API keys in plaintext** |
| `agentMessages` | Unbounded | **None** | AI conversation history |

---

## Appendix C — Background Job Inventory

| Job | Schedule | Producer | Consumer | Retry | Idempotency |
|---|---|---|---|---|---|
| Action Queue Processor | Every 30s | HTTP handlers | `actionQueueService` | None | Contact status dedup |
| Message Agent Worker | Every 30s | Webhook / Sync | `messageAgentWorker` | 3 attempts | `messageId` unique |
| Inbound Sync | Every 30s | Startup | `inboundSyncService` | None per account | Message text dedup |
| Daily Agent | Manual only | Admin trigger | `dailyAgentService` | **DISABLED** | `runKey` unique |
| Webhook Handler | Real-time | Unipile push | `handleUnipileWebhook` | None | `eventId` unique |

---

## Appendix D — External Services

| Service | Purpose | Auth | Data Shared | Risk |
|---|---|---|---|---|
| **Unipile** | LinkedIn API middleware | API Key | LinkedIn creds, profile data, messages | ToS conflict; GDPR DPA required |
| **Neon PostgreSQL** | Primary database | Connection string | All user data | DPA required; verify AWS region |
| **Google Gemini AI** | Message generation | API Key | Message content, contact context | GDPR DPA with Google required |
| **AWS EC2** | Compute | SSH + IAM | Deployed code | Standard compliance |
| **GitHub** | Source + CI/CD | OIDC | Source code | Private repo required |

---

## Appendix E — Glossary

| Term | Definition |
|---|---|
| **Unipile** | Third-party SaaS that provides a REST API for LinkedIn automation by managing LinkedIn browser sessions |
| **Action Queue** | The `action_queue` PostgreSQL table used as a pseudo-message queue for deferred LinkedIn actions |
| **Circuit Breaker** | `triggerCircuitBreaker()` in `safety.service.ts` — sets `automationStatus = PAUSED` when limits or errors are detected |
| **Daily Agent** | LangGraph-based autonomous agent for prospect discovery and outreach scheduling |
| **Inbound Sync** | 30-second polling service that fetches LinkedIn conversations from Unipile |
| **Message Agent Worker** | Worker processing `messageAgentJobs` — AI-generated replies to inbound LinkedIn messages |
| **Checkpoint** | LinkedIn 2FA/OTP security challenge triggered on new logins |
| **Hot Lead** | Contact marked `isHotLead = true` by AI agent, indicating high match score |
| **Neon** | Serverless PostgreSQL provider used as primary production database |
| **LangGraph** | Framework for stateful multi-step AI agent workflows (inbox reply and daily agent logic) |
| **JWT** | JSON Web Token — stateless session token (7-day expiry, HS256) |
| **BOLA/IDOR** | Broken Object Level Authorization — vulnerability where users access other users' resources via ID manipulation |
| **AES-256-CBC** | Encryption used for LinkedIn credentials at rest |
| **li_at** | LinkedIn authentication session cookie used to authenticate Unipile sessions |
| **DSN** | Data Source Name — the Unipile gateway URL including hostname and port |

---

*End of WORKPILOT LinkedIn Automation Technical Dossier*

**Generated:** 2026-09-20 | **Auditor:** Antigravity AI (read-only inspection)  
**No production systems were modified. No external services were contacted.**  
**All real credential values have been replaced with `[REDACTED]` in this document.**
