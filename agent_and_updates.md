# WORKPILOT Autonomous AI Agent — Features & Changelog Update

> **To**: Raunak  
> **From**: Harsh  
> **Date**: September 6, 2026  
> **Subject**: Complete WORKPILOT Agent Architecture, Upgrades, Features & Testing Guide

Hey Raunak,

Here is the complete breakdown of everything we have built and upgraded for the **WORKPILOT Autonomous AI Agent**, from the ground up to the latest long-term memory and smart decision-making systems.

Please test everything out in your environment and let me know if you run into any issues.

---

## 1. Executive Summary & Core Identity

The **WORKPILOT AI Agent** is an autonomous relationship director and LinkedIn outreach automation engine. It combines **LangGraph (JavaScript/TypeScript)** with **Google Gemini (`gemini-3.5-flash-lite`)** to conduct lead generation, profile auditing, connection outreach, and inbox management with human-like pacing and safety heuristics.

### Key Architectural Highlights

- **Framework**: LangGraph + LangChain JS (`@langchain/langgraph`, `@langchain/google-genai`).
- **Primary Model**: `gemini-3.5-flash-lite` (with automatic fallback to `gemini-3.1-flash-lite` on 429 rate limit or quota retries).
- **State Management**: Bounded thread checkpointer pool in Node.js to eliminate memory leaks, backed by PostgreSQL as the persistent source of truth.
- **Human-in-the-Loop (HITL)**: LangGraph native `interrupt()` for high-stakes actions like outbound connection requests with interactive user override.
- **Long-Term Memory**: Database-backed conversation storage (`agent_messages` table in PostgreSQL) with automatic 30+ message summarization.

---

## 2. All 14 Modular LinkedIn Automation Tools

The agent has full access to 14 modular, typed tools to execute actions on LinkedIn:

| #   | Tool Name                       | Category  | Description                                                                                                                                                          |
| --- | ------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `search_linkedin_leads`         | Discovery | Searches LinkedIn for verified professionals by role, location, company, and industry.                                                                               |
| 2   | `send_connection_request`       | Outreach  | Dispatches outbound connection requests with optional personalized notes. Supports LangGraph HITL review and auto-recovers from LinkedIn's monthly note quota (422). |
| 3   | `send_linkedin_message`         | Outreach  | Sends 1-on-1 direct messages to active conversations or 1st-degree connections.                                                                                      |
| 4   | `schedule_autonomous_campaign`  | Campaign  | Enqueues leads with randomized humanized delays (8–18 min) and strict business hours rollover (8:30 AM to 7:30 PM).                                                  |
| 5   | `get_account_safety_and_limits` | Safety    | Checks account status and daily limits (25 connections/day, 50 messages/day).                                                                                        |
| 6   | `get_pending_invitations`       | Network   | Inspects sent invitations awaiting acceptance or incoming requests awaiting approval.                                                                                |
| 7   | `manage_invitation`             | Network   | Accepts, declines incoming requests, or withdraws outgoing invitations.                                                                                              |
| 8   | `get_inbox_conversations`       | Inbox     | Retrieves recent chat threads enriched with attendees, profile pictures, and last messages.                                                                          |
| 9   | `get_own_profile_and_rating`    | Profile   | Audits own LinkedIn profile, scoring headline, about, and experience (0–100) with actionable recommendations.                                                        |
| 10  | `update_profile_headline`       | Profile   | Updates user's LinkedIn headline directly and syncs to workspace.                                                                                                    |
| 11  | `create_linkedin_post`          | Content   | Publishes new text and media posts directly to the user's LinkedIn feed.                                                                                             |
| 12  | `get_own_posts`                 | Content   | Inspects recent posts and engagement performance (likes and comments).                                                                                               |
| 13  | `emergency_pause_automation`    | Safety    | Instant killswitch that freezes all outbound automations across queues.                                                                                              |
| 14  | `resume_automation`             | Safety    | Resumes paused queues and sequence processing.                                                                                                                       |

---

## 3. Major Features & Systems Implemented

### A. Intelligent Decision-Making (No More Hardcoding)

- **Eliminated Rigid Regexes**: Removed all regex-based intent routing (`TOOL_INTENT_ROUTES`) and client-side command hijacking.
- **Dynamic Reasoning**: The agent dynamically parses natural language, handles multi-turn context (e.g., _"invite the second person"_, _"rewrite that note to be friendlier"_), extracts tool parameters flexibly, and formulates rich markdown responses.

### B. Long-Term Memory in PostgreSQL (`agent_messages`)

- **Table**: `agent_messages` in PostgreSQL stores every user message, assistant reply, tool execution list (JSONB), and generated summaries, partitioned cleanly by `user_id`.
- **Hydration on Page Refresh**: When opening or refreshing the Agent View (`/agent`), `GET /api/agent/messages` restores the conversation history, tool action chips, and summaries.
- **Clear History**: Added a "Clear History" button in the terminal header that clears both local UI state and the database records.

### C. LangGraph 30+ Message Conversation Summarization

- Follows the official [LangGraph Add Memory Guide](https://docs.langchain.com/oss/javascript/langgraph/add-memory#summarize-messages).
- When a user's conversation reaches **30+ messages** (user + assistant):
  1. The agent triggers an automatic summarization step with Gemini.
  2. It generates a dense executive summary capturing goals, targets discussed, actions executed, and user preferences.
  3. If a prior summary exists, it extends and updates the existing summary.
  4. The summary is saved into PostgreSQL with `isSummary: true` and `role: "system"`.
  5. The active context window for the model is compressed to `[SystemMessage(summary), ...recentMessages]`, keeping API calls fast and token-efficient while 100% of the original messages remain safely stored in the database.

### D. Human-in-the-Loop (HITL) with 10-Second Auto-Countdown

- When the agent prepares to send a connection request, LangGraph suspends execution and returns an `__interrupt__`.
- **Interactive UI Card**:
  - Displays target prospect name and proposed personalized note.
  - Features an animated 10-second progress bar and live countdown timer.
  - **Auto-Send**: If no action is taken within 10 seconds, it sends with the personalized note.
  - **Send With Note**: Immediately sends with the note.
  - **Send Without Note (Blank)**: Sends a blank invite (bypasses LinkedIn's 422 custom note monthly quota).
  - **Cancel**: Cancels the pending request.
  - Resumes execution via `new Command({ resume: decision })`.

### E. Account Isolation & Database Deletion

- **No Orphan Fallbacks**: Eliminated Unipile workspace account fallbacks. Disconnected users cannot perform actions using someone else's account.
- **Delete Saved Cookies & Login from Database**:
  - In Settings View, the button and modal explicitly perform `await db.delete(linkedinAccounts).where(eq(linkedinAccounts.userId, userId))`.
  - Permanently purges stored cookies (`li_at`, `li_a`), encrypted credentials, remote Unipile sessions, and pending queue items from PostgreSQL.
- **Danger Zone (Delete Account)**: Permanently deletes the entire user account, campaigns, contacts, and credentials after typing `DELETE` for confirmation.

### F. Zero Memory Leaks

- **BoundedCheckpointerPool**: Prevents unbounded in-memory checkpointer Map growth in Node.js by evicting stale thread checkpointers.
- **Client Timer Cleanup**: All `useEffect` timers (`setTimeout`, `setInterval`) have strict unmount cleanup handlers.

---

## 4. Step-by-Step Testing Guide for Raunak

Here is how you can test each feature to confirm everything is working smoothly:

### 1. Test Intelligent Natural Language Reasoning

1. Go to the **AI Agent** tab (`/agent`).
2. Try sending varied, natural instructions without rigid keywords:
   - _"Can you find me CTOs or Engineering Directors in London?"_
   - _"Who are the top candidates? Give me a brief overview."_

### G. Multi-Step Subgraphs & LangGraph Stores (Batch Outreach)

- **Official LangGraph Architecture**:
  - [LangGraph Checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers): `MemorySaver` saves graph execution state at every superstep per `threadId`.
  - [LangGraph Stores](https://docs.langchain.com/oss/javascript/langgraph/stores): `InMemoryStore` configured on the graph (`WORKPILOTStore`) to store cross-turn prospects under `["prospects", userId]`.
  - [LangGraph Subgraphs](https://docs.langchain.com/oss/javascript/langgraph/stores):
    - **`researchSubgraph`**: Searches LinkedIn for targeted verified profiles via Unipile, ingests prospects into the LangGraph store, and returns structured candidates.
    - **`batchOutreachSubgraph`**: State graph that plans a candidate queue, supports mixed note policies (e.g. first N with personalized notes, remainder blank), runs Human-in-the-Loop review, dispatches in a loop with cancellation checks, and generates a formatted status summary.
- **Solving the Multi-Step Halting Problem**:
  - Previously, the agent stopped after sending a connection request to only 1 person.
  - Now, with the Batch Outreach Subgraph and tools `research_and_batch_connect` and `batch_send_connection_requests`, commands like:
    > _"Research 5 AI engineers in India, send 2 with personalized note and the rest 3 without notes"_
    > execute completely across all 5 candidates without stopping after the first person!
- **Enhanced HITL Batch Confirmation**:
  - The Human-in-the-Loop card now shows the full candidate batch overview (e.g., _5 Candidates: 2 with Note, 3 Blank_).
  - Users can review the full plan, click **Send All Blank (No Notes)**, **Proceed Batch**, or **Cancel Batch**, with a 10-second auto-proceed countdown.

### H. Stop / Interrupt Agent Button (External Cancellation)

- **Official LangGraph Interrupt Documentation**:
  - [LangGraph Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts).
- **Backend Thread Cancellation Registry**:
  - `activeExecutionSignals` maps `threadId` to an `AbortController` and cancellation token.
  - When the agent runs, `abortController.signal` is passed into `agent.invoke(...)` and checked between subgraph loop iterations.
- **New Endpoint**:
  - `POST /api/agent/stop` halts active executions immediately and cleanly marks state as cancelled.
- **Frontend Stop Button**:
  - When the agent is reasoning or running a batch, a prominent red **"Stop Agent"** button appears next to the input and inline in the reasoning bubble.
  - Clicking it instantly cancels all background actions, displays _"⏸️ Agent stopped"_, and halts execution safely without hanging.

---

## 4. How to Test & Verify

### 1. Test Multi-Step Batch Outreach (2 With Note, 3 Blank)

1. Open the **AI Agent** tab (`/agent`).
2. Click the quick prompt:
   > **"Research 5 AI Leads (2 Notes, 3 Blank)"**
3. Notice:
   - The agent invokes `research_and_batch_connect`.
   - Discovers 5 verified AI engineers.
   - The **HITL Batch Review Card** appears displaying:
     - `5 Candidates • 2 With Note • 3 Blank`
     - The scrollable candidate list with strategy tags (`✍️ With Note` vs `✉️ Blank`).
   - Click **Proceed Batch** or let the 10-second timer expire.
   - The agent loops through all 5 candidates and prints the full Markdown status table showing each candidate's outcome.

### 2. Test the "Stop Agent" Button

1. While the agent is reasoning or processing a multi-step batch, look at the input bar and the reasoning banner.
2. Click the glowing red **"Stop Agent"** button.
3. Notice:
   - The frontend calls `POST /api/agent/stop`.
   - The backend aborts the active thread via `AbortController`.
   - The UI immediately halts the thinking state and outputs:
     _"⏸️ Agent stopped. Ongoing reasoning and background dispatch loop have been cleanly halted."_

### 3. Run Automated Multi-Step & Subgraph Test

Run the automated backend test in your terminal:

```bash
cd server
npx tsx src/scripts/test-multistep-subgraphs.ts
```

Expected output:

- `Test 1: LangGraph InMemoryStore Key-Value Storage... ✅`
- `Test 2: Batch Outreach Subgraph Execution (5 Candidates: 2 with Note, 3 Blank)... ✅`
- `Test 3: Stop / Interrupt Backend Cancellation Mechanism... ✅`
- `Test 4: Tool System Declarations & Router Registration (16 tools)... ✅`

### 4. Test Single HITL Connection Request & Auto-Countdown

1. In the console, ask: _"Send a connection request to Satya Nadella with note"_.
2. Notice the **HITL Outbound Connection Request Card** appear with:
   - Recipient name and drafted personalized note.
   - 10-second countdown timer and progress bar.
3. Test the choices: auto-send after 10s, **Send Without Note (Blank)**, or **Cancel**.

### 5. Test Refresh & Memory Persistence

1. Have a conversation with 4–5 turns.
2. Refresh the browser page (`F5` or `Ctrl+R`).
3. Notice the entire conversation history, tool chips, and timestamps restore from PostgreSQL.
4. Click **Clear History** in the terminal header and verify the history resets both on screen and in PostgreSQL.

### 6. Test Settings: Deleting Saved Cookies & Login

1. Go to **Settings** (`/settings`).
2. Locate the **Saved LinkedIn Cookies & Login** card (`Database Storage` badge).
3. Click **Delete Saved Cookies & Login**.
4. Confirm in the modal by clicking **Delete from Database**.
5. Verify the account status transitions to disconnected, and returning to the Agent tab immediately warns that LinkedIn is disconnected rather than silently using an old session.

---

Test it out and let me know if any problem!

Best regards,  
**Harsh**
