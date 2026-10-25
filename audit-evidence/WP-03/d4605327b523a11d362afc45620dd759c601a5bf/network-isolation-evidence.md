# WP-03 Network Isolation Evidence & Provider Sandbox Architecture

**Target Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Timestamp:** 2026-10-24T17:19:40+05:30  
**Test File:** `src/__tests__/unit/network-guard.test.ts`  
**Result:** 6 / 6 Tests Passed (Fail-Closed Egress Blocking Verified)

---

## 1. Network Boundary Architecture

Application-level interception alone is **not** a complete network sandbox because low-level transports (e.g. raw TCP sockets used by PostgreSQL) can bypass standard HTTP/HTTPS wrappers. Therefore, a multi-layer defense-in-depth model is required:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   LAYER 1: HOST / CONTAINER OS LEVEL                   │
│   Docker `--network none` or internal bridge with zero default gateway │
│   Outbound public internet egress is physically dropped at OS kernel   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  LAYER 2: APPLICATION FAIL-CLOSED GUARD                │
│   `setup.ts` intercepts globalThis.fetch, http.request, https.request  │
│   Enforces strict allowlist: only localhost, 127.0.0.1, ::1 permitted  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  LAYER 3: DETERMINISTIC PROVIDER MOCKS                 │
│   `MockUnipileClient` and `MockGeminiConfigService` stubs              │
│   Zero network requests emitted; deterministic synthetic fixtures      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Codebase Transports Inventory

| Transport Mechanism | Library / Module | Source File | Sandboxing Strategy |
|---------------------|------------------|-------------|---------------------|
| Global `fetch` | Native Node.js fetch | `services/unipile/unipile.client.ts` | Guarded in `setup.ts`; replaced by `MockUnipileClient` in tests |
| Global `fetch` | Google Generative AI SDK | `agent/WORKPILOT-connect-agent.ts` | Guarded in `setup.ts`; replaced by `FakeListChatModel` in tests |
| Global `fetch` | Razorpay Billing Service | `services/billing/razorpay.service.ts` | Guarded in `setup.ts`; mocked in test fixtures |
| Native `http.request` | `node:http` | Node runtime / Express internals | Blocked for all external hosts in `setup.ts` |
| Native `https.request` | `node:https` | Node runtime / TLS transports | Blocked for all external hosts in `setup.ts` |
| Raw TCP / TLS Sockets | `postgres@3.4.9` | `db/index.ts` (port 5432) | Never points to cloud DSN; strictly loopback or disabled in tests |
| Child Processes | `node:child_process` | Scripts / Build tools | Not invoked during automated security test executions |

---

## 3. Safe Local PostgreSQL Access Strategy

- When local database integration tests are executed, PostgreSQL traffic must travel strictly over:
  - Localhost loopback: `127.0.0.1:5432` or `localhost:5432`
  - Unix Domain Socket: `/var/run/postgresql/.s.PGSQL.5432`
  - Internal Docker Bridge: A container network with `internal: true` where the test container and PostgreSQL container communicate on the bridge, while outbound gateway routing to the internet is disabled.
- Application-level socket guards do not interfere with loopback `127.0.0.1` connections, ensuring that local database integration remains viable once a safe container or service is available.

---

## 4. Empirical Verification Results

The network guard suite (`src/__tests__/unit/network-guard.test.ts`) executed 6 automated assertions proving fail-closed blocking:

```
 ✓ src/__tests__/unit/network-guard.test.ts (6 tests)
   ✓ blocks outbound fetch calls to Unipile API
   ✓ blocks outbound fetch calls to Google Gemini API
   ✓ blocks outbound fetch calls to Razorpay API
   ✓ blocks outbound fetch calls to Resend API
   ✓ blocks outbound node:http.request to external IP/host
   ✓ blocks outbound node:https.request to external IP/host
```

When an unmocked outbound request is initiated, the sandbox immediately throws:
`[NETWORK HAZARD BLOCKED] Attempted outbound HTTP request to '<hostname>'. Offline test sandbox forbids live egress.`

This guarantees zero accidental live provider API consumption or token exposure during automated test runs.
