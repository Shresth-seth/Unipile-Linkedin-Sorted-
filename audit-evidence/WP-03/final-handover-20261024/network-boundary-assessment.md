# Work Package WP-03: Network Boundary Assessment & Sandbox Limitations

**Target Commit Baseline:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Run ID:** `final-handover-20261024`  
**Document ID:** `WP-03-NET-BOUND-01`  
**Date:** 2026-10-24T17:58:00+05:30  
**Network Sandbox Status:** **`PARTIALLY VERIFIED (Application-level HTTP/HTTPS interceptor verified; OS/container network isolation UNVERIFIED)`**  

---

## 1. Active Application-Level Interceptors

In [`server/src/__tests__/setup.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts), three high-level outbound HTTP mechanisms are intercepted before any tests run:

1. **`globalThis.fetch`:** Intercepted and parsed. Hostnames outside `localhost`, `127.0.0.1`, `::1` throw:
   `[NETWORK HAZARD BLOCKED] Attempted outbound HTTP request to '<hostname>'. Offline test sandbox forbids live egress.`
2. **`node:http.request`:** Intercepted. Targets outside localhost throw `[NETWORK HAZARD BLOCKED]`.
3. **`node:https.request`:** Intercepted. Targets outside localhost throw `[NETWORK HAZARD BLOCKED]`.

These hooks are verified by the 6 tests in [`server/src/__tests__/unit/network-guard.test.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/unit/network-guard.test.ts), which prove that attempts to contact Unipile (`api.unipile.com`), Gemini (`generativelanguage.googleapis.com`), Razorpay (`api.razorpay.com`), and Resend (`api.resend.com`) fail closed with non-zero error propagation.

---

## 2. Technical Limitations & Gaps (No False Confidence)

An application-level JavaScript monkey-patch **does not constitute a true network sandbox**. The following attack surfaces and bypass vectors exist:

| Mechanism | Intercepted by `setup.ts`? | Risk Description |
|---|---|---|
| `fetch()` | **YES** | High-level web API calls blocked |
| `http.request()` | **YES** | Node HTTP client calls blocked |
| `https.request()` | **YES** | Node HTTPS client calls blocked |
| `net.Socket` | **NO** | Raw TCP connections (e.g. database wire protocols, Redis, custom TCP) are unpatched |
| `tls.connect` | **NO** | Raw TLS sockets bypassing `https.request` are unpatched |
| `dns.lookup` | **NO** | DNS resolution queries can leak hostnames over UDP 53 before an HTTP request is made |
| `child_process` | **NO** | Subprocesses (`exec`, `spawn`, `curl`, `powershell`) execute directly against host network |
| Native C++ Addons | **NO** | Any native binary extension bypasses V8 JS hooks entirely |

---

## 3. Requirements for Complete Network Isolation

To achieve genuine network isolation for future continuous integration or automated testing, an **OS- or container-level egress denial boundary** is required:

1. **Container Isolation (Recommended):**  
   Run all test suites inside a Docker / Podman container launched with:
   `docker run --network none ...`
   This drops all host and external networking at the Linux kernel namespace layer, making raw TCP, DNS, and subprocess egress impossible.
2. **OS-Level Firewall Boundary (Host-level):**  
   If run on a bare-metal host, the test process UID must be bound to a firewall rule (e.g., Linux `iptables -m owner --uid-owner testuser -j DROP` or Windows Filtering Platform rule blocking non-loopback outbound traffic).

**Audit Declaration:** Complete network isolation is **UNVERIFIED**. The existing protection is an **application-level defense-in-depth safety net**, not a comprehensive sandbox.
