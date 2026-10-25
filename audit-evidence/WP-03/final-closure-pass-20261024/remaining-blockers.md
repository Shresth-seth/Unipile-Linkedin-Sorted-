# Work Package WP-03: Remaining Blockers & Outstanding External Actions
## Final Closure Pass Evidence Baseline

**Target Commit Baseline:** `d4605327b523a11d362afc45620dd759c601a5bf` (branch `main`)  
*Notice: This Git hash identifies the upstream repository commit where the readiness audit began. Uncommitted working-tree modifications, remediations, and audit evidence are preserved locally in the working tree and have not been committed.*  
**Run ID:** `final-closure-pass-20261024`  
**Document ID:** `WP-03-BLOCK-02`  
**Timestamp:** 2026-10-24T20:15:00+05:30  
**Status:** **`PARTIALLY COMPLETE (Local verification complete; external/infrastructure blockers remain)`**  

---

## 1. Blocker Inventory & Ownership

| Blocker ID | Description | Severity | Why It Cannot Be Resolved Locally | Required Operator / External Action |
|---|---|---|---|---|
| **BLK-01** | **WP-02 Baseline Formally Blocked** | High | Historical WP-02 handover claims are contradictory; claims ledger has 0 supported claims. | Must remain BLOCKED until an independent audit resolves the claims baseline and human sign-off is recorded. |
| **BLK-02** | **Live PostgreSQL Engine-Level Tenant Isolation** | High | Host environment lacks Docker and local PostgreSQL daemon (port 5432 is closed/refusing connections). Connecting to cloud Neon is strictly forbidden by policy. | Provision an isolated throwaway local PostgreSQL instance (e.g. Docker container or local service) and execute migration & SQL-level row-security verification suite. |
| **BLK-03** | **Cloud Credential Rotation Pending Authorized Operator Action** | Critical | Sensitive credentials (Neon connection string, Unipile API key, AWS EC2 keys) were exposed in historical Git commits and `deploy.tar.gz`. Rotating or removing code references locally does not invalidate active cloud tokens. | Authorized human operator must log into Neon, Unipile, AWS, and Resend provider consoles, rotate all credentials, update production secret managers, and revoke compromised tokens. |
| **BLK-04** | **OS / Container-Level Egress Sandbox Boundary** | Medium | Test setup installs an application-level JS interceptor over `fetch`, `http.request`, and `https.request`. It cannot intercept raw TCP sockets (`net.Socket`), TLS sessions, DNS lookups, or child processes. | Run CI and offline test pipelines inside an OS or container sandbox configured with `--network none`. |

---

## 2. Prerequisites for Future Work Packages (WP-04+)

1. **Do not advance to WP-04:**
   - WP-02 must be unblocked via human resolution of historical claims.
   - BLK-03 (cloud credential rotation) must be completed by an authorized operator.
2. **Do not deploy to production:**
   - BLK-02 (live database tenant isolation) must be verified against an isolated local database with real SQL execution.
   - Production readiness remains **`NOT READY`**.
3. **Preserve working tree state:**
   - Keep `D deploy.tar.gz` staged.
   - Keep all modified security files and audit directories untouched until formal operator sign-off.
