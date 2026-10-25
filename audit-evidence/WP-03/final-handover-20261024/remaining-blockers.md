# Work Package WP-03: Remaining Blockers & Outstanding External Actions

**Target Commit Baseline:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Run ID:** `final-handover-20261024`  
**Document ID:** `WP-03-BLOCK-01`  
**Date:** 2026-10-24T17:58:00+05:30  
**Status:** **`PARTIALLY COMPLETE (Local verification complete; external/infrastructure blockers remain)`**  

---

## 1. Blocker Inventory & Ownership

| Blocker ID | Description | Severity | Why It Cannot Be Resolved Locally | Required Operator / External Action |
|---|---|---|---|---|
| **BLK-01** | **WP-02 Baseline Formally Blocked** | High | Historical handover claims contradictory; claims ledger has 0 supported claims. | Must remain BLOCKED until an independent audit resolves claims baseline. |
| **BLK-02** | **Live PostgreSQL Row-Level Isolation** | High | Host machine lacks Docker and local PostgreSQL daemon (port 5432 closed). Connecting to cloud Neon is forbidden. | Provision isolated throwaway local PostgreSQL container and run migration suite with real SQL queries. |
| **BLK-03** | **Cloud Credential Rotation Pending** | Critical | Credentials were exposed in `deploy.tar.gz` and historical Git commits. Rotating them in code alone does not invalidate live tokens. | Authorized human operator must log into Neon, Unipile, AWS, and Resend consoles to rotate keys and revoke old sessions. |
| **BLK-04** | **OS / Container Network Boundary** | Medium | Host OS does not enforce network namespace denial; JavaScript hooks do not intercept raw sockets or child processes. | Run CI test pipeline inside container with `--network none` flag. |

---

## 2. Prerequisites for Future Work Packages (WP-04+)

1. **Do not advance to WP-04** until BLK-01 (WP-02 evidence baseline) and BLK-03 (cloud credential rotation) have been formally resolved and verified by authorized human operators.
2. **Do not deploy to production** until BLK-02 (live database tenant isolation) is executed against an ephemeral local PostgreSQL database with verifiable row-level security assertions.
