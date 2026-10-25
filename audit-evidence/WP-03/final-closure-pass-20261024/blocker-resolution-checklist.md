# Work Package WP-03: Actionable Blocker-Resolution Checklist
## Roadmap to Final Closure & Production Readiness Gate

**Target Commit Baseline:** `d4605327b523a11d362afc45620dd759c601a5bf` (branch `main`)  
*Notice: This Git hash identifies the upstream repository commit where the readiness audit began. Uncommitted working-tree modifications, remediations, and audit evidence are preserved locally in the working tree and have not been committed.*  
**Run ID:** `final-closure-pass-20261024`  
**Document ID:** `WP-03-BLOCKER-CHECKLIST-01`  
**Timestamp:** 2026-10-24T21:10:00+05:30  
**Overall Readiness Status:** **`PARTIALLY COMPLETE`**  
**WP-02 Status:** **`BLOCKED`**  
**PostgreSQL Isolation:** **`UNVERIFIED / BLOCKED`**  
**Cloud Credential Rotation:** **`PENDING AUTHORIZED OPERATOR ACTION`**  
**Production Readiness:** **`NOT READY`**  
**Next Work Package:** **`DO NOT START WP-04`**

---

## 1. Overview & Separation of Responsibilities

To achieve final closure of Work Package WP-03 and unblock downstream work packages (WP-04+), four concrete blockers must be resolved. The tasks are strictly partitioned between:
1. **Authorized Human Operator Actions:** External, cloud, or infrastructure operations requiring privileged human credentials and policy authorization.
2. **Safe Local Engineering Tasks:** Deterministic, offline code tasks that can be performed locally without cloud access, network egress, or destructive Git operations.

---

## 2. Actionable Blocker-Resolution Specifications

### BLK-01: WP-02 Baseline Formally Blocked
- **Description:** Historical WP-02 handover claims contradictory; claims ledger contains 0 supported claims from the historical dossier.
- **Severity:** High
- **Owner:** Human Lead Auditor / Security Reviewer
- **Prerequisites:** Independent audit findings from WP-02 dossier review.
- **Action Partitioning:**
  - *Authorized Human Operator Action:* Formally review the 0-supported-claims ledger from the WP-02 audit. Reconcile historical route claims (155 declared vs AST actuals) and execute a formal sign-off decision unblocking WP-02.
  - *Safe Local Engineering Task:* Maintain static route inventory generator ([`server/src/scripts/ast-route-inventory.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/scripts/ast-route-inventory.ts)) and ensure AST inventory output is reproducible offline without database or network dependencies.
- **Exact Verification Evidence Required to Clear:**
  - Written and signed decision record in `audit-evidence/WP-02/claims-reconciliation.md` stating which claims are voided, revised, or confirmed.
  - Formal sign-off declaration unblocking WP-02 recorded in repository evidence.
- **Closure Criteria:** WP-02 status updated from `BLOCKED` to `RESOLVED / COMPLETE` by human reviewer.

---

### BLK-02: Live PostgreSQL Engine-Level Tenant Isolation
- **Description:** Host environment lacks Docker and a local PostgreSQL daemon (port 5432 is closed). Cloud Neon connection is strictly forbidden. True row-level security (RLS) policies, triggers, and SQL constraint enforcement remain unverified at the database engine level.
- **Severity:** High
- **Owner:** Authorized Operator / Infrastructure Lead (Provisioning) & Test Engineer (Execution)
- **Prerequisites:** Authorization to run an ephemeral local container bound strictly to loopback (`127.0.0.1:5432`).
- **Action Partitioning:**
  - *Authorized Human Operator Action:* Authorize and spin up a disposable local PostgreSQL container bound strictly to loopback with zero external bridge exposure:
    ```bash
    docker run --name workpilot-test-pg -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:5432:5432 -d postgres:16-alpine
    ```
  - *Safe Local Engineering Task:*
    1. Define `TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/workpilot_test` in an ephemeral test profile.
    2. Confirm [`validateTestDatabaseUrl`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts) validates the loopback target.
    3. Execute Drizzle schema migration (`drizzle-kit push`) against the local test database.
    4. Run real SQL-level tenant isolation integration suite verifying cross-tenant queries return 0 rows or throw constraint violations.
    5. Terminate and remove the local container immediately after test completion (`docker rm -f workpilot-test-pg`).
- **Exact Verification Evidence Required to Clear:**
  - Verifiable console execution log showing clean migration execution and passing SQL-level negative/positive assertions against `workpilot_test`.
  - Evidence artifact `audit-evidence/WP-03/live-database-tenant-isolation-evidence.txt` documenting zero cross-tenant row leakage under direct SQL queries.
- **Closure Criteria:** Database engine tenant isolation evaluated as `VERIFIED` against an isolated local database with 100% passing tests and exit code `0`.

---

### BLK-03: Cloud Credential Invalidation and Rotation
- **Description:** Plaintext credentials for Neon PostgreSQL (`neondb_owner`), Unipile API, AWS EC2, and Resend were exposed in historical Git commits and `deploy.tar.gz`. Rotating references in local code does NOT revoke live cloud tokens.
- **Severity:** Critical
- **Owner:** Authorized Cloud Administrator / DevOps Engineer
- **Prerequisites:** Authorized human administrative access to cloud consoles (Neon, Unipile, AWS IAM, Resend).
- **Action Partitioning:**
  - *Authorized Human Operator Action:*
    1. Log into the **Neon Console**: Reset the password for `neondb_owner`, terminate existing connection pool sessions, and update connection strings in production secret managers (e.g. AWS Secrets Manager or Doppler).
    2. Log into the **Unipile Dashboard**: Revoke exposed API keys and generate replacement tokens.
    3. Log into the **AWS Management Console**: Revoke exposed IAM access keys, rotate EC2 keypairs, and verify security group ingress rules.
    4. Log into the **Resend Dashboard**: Revoke exposed SMTP/API tokens and issue replacements.
  - *Safe Local Engineering Task:*
    1. Run `npm run test:all-security` to verify local secret scanner clean baseline.
    2. Verify all local example configurations and documentation use placeholder credentials (`dummy_password`, `example.com`).
- **Exact Verification Evidence Required to Clear:**
  - Signed operator declaration in `audit-evidence/security/credential-rotation-confirmation.md` listing rotated key IDs, timestamps of revocation, and confirmation that compromised credentials are deactivated.
  - Clean `scripts/scan-secrets.mjs` report confirming zero live credentials across all tracking branches.
- **Closure Criteria:** Cloud credential rotation status updated from `PENDING AUTHORIZED OPERATOR ACTION` to `CONFIRMED ROTATED` by authorized administrator.

---

### BLK-04: OS / Container-Level Network Boundary
- **Description:** The test harness application-level interceptor guards `fetch`, `http.request`, and `https.request`. It cannot intercept raw TCP streams (`net.Socket`), TLS sessions, DNS queries, or child processes.
- **Severity:** Medium
- **Owner:** DevOps / CI Administrator
- **Prerequisites:** Docker / containerized CI execution environment (e.g. GitHub Actions runner).
- **Action Partitioning:**
  - *Authorized Human Operator Action:* Configure CI runner environments to run offline test suites inside Docker with the `--network none` flag:
    ```yaml
    # .github/workflows/test.yml
    jobs:
      test:
        runs-on: ubuntu-latest
        container:
          image: node:24-alpine
          options: --network none
        steps:
          - run: npm test
    ```
  - *Safe Local Engineering Task:* Maintain the application-level fail-closed killswitches in [`server/src/__tests__/setup.ts`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/server/src/__tests__/setup.ts) as defense-in-depth for local developer workstations.
- **Exact Verification Evidence Required to Clear:**
  - Verified CI run log demonstrating `npm test` (79 tests) completing with exit code `0` inside a `--network none` container sandbox.
- **Closure Criteria:** CI test pipeline enforces kernel-level network isolation.

---

## 3. Human Sign-Off Checklist for Blocker Resolution

```text
[ ] 1. BLK-01 (WP-02 Baseline):
    - [ ] WP-02 claims ledger reviewed by human auditor.
    - [ ] Formal unblocking sign-off recorded in audit-evidence/WP-02/.
    - [ ] WP-02 marked UNBLOCKED.

[ ] 2. BLK-02 (Live PostgreSQL Engine Isolation):
    - [ ] Local throwaway PostgreSQL container provisioned (127.0.0.1:5432).
    - [ ] Drizzle migrations successfully applied to test database.
    - [ ] Real SQL-level RLS positive/negative tests executed and passed (exit code 0).
    - [ ] Container cleanly destroyed; log preserved in audit-evidence/WP-03/.

[ ] 3. BLK-03 (Cloud Credential Invalidation):
    - [ ] Neon DB password rotated and old pool sessions terminated.
    - [ ] Unipile API key revoked and replaced.
    - [ ] AWS EC2/IAM credentials rotated.
    - [ ] Resend API token rotated.
    - [ ] Operator confirmation logged in audit-evidence/security/.

[ ] 4. BLK-04 (CI Network Egress Sandbox):
    - [ ] CI runner configured with --network none.
    - [ ] Offline test execution verified in CI pipeline.

[ ] 5. Gate to WP-04:
    - [ ] BLK-01 resolved.
    - [ ] BLK-03 resolved.
    - [ ] Human operator formally authorizes commencement of WP-04.
```
