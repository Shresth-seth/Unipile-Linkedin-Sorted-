# WP-03 Baseline and Change Manifest

**Recorded Upstream Base Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Current Branch:** `main`  
**Execution Timestamp:** 2026-10-24T17:00:00+05:30  
**Node.js Version:** `v24.22.1`  
**npm Version:** `12.2.1`  
**OS Platform:** `Windows_NT x64`  
**Task Scope:** WP-03 — Identity and Customer Boundaries (Phase 1 Baseline & Manifest)

---

## 1. Upstream Commit & Integrity Hashes

The repository work tree is positioned on top of upstream commit `d4605327b523a11d362afc45620dd759c601a5bf`.

### Lockfile Integrity Hashes (SHA-256)
- Root `package-lock.json`: `8209D8B1FF52EB7473DC4B2AB61AE811546E28C1B83E85028486EAC541157C94`
- Server `server/package-lock.json`: `F4FAF7838106C970F4B66B536D1B03AC8A901938B088F86A6E5F0A1A6AC60237`
- Client `client/package-lock.json`: `B01E60F9622F3BDE54E404ED746001FD34AE6AECA3AF60F8684A8FB3525CE178`

---

## 2. Pre-Existing Working Tree Modifications (Preserved Invariant)

All changes listed below were made during prior work packages (WP-01 Credential Containment and WP-02 Evidence Audit) and are strictly preserved. **Zero changes will be reset, cleaned, stashed, checked out, or overwritten.**

### A. Staged Changes
1. `D deploy.tar.gz` (Binary deletion staged; archive contained unencrypted private keys and production credentials).

### B. Unstaged Modifications (16 files, +237 / -60 lines)
1. `.dockerignore` (Excluded credential files and keys from build context)
2. `.github/workflows/deploy-production.yml` (Removed hardcoded host IPs, secrets)
3. `.gitignore` (Added ignore patterns for keyfiles, deploy archives, local envs)
4. `client/.dockerignore` (Sanitized client docker build context)
5. `deploy/aws/deploy-remote.ps1` (Hardened remote deployment script against secret logging)
6. `package.json` (Added root security scripts)
7. `server/.dockerignore` (Sanitized server docker build context)
8. `server/check-role.cjs` (Hardened role-check script to require ENV credentials)
9. `server/check_unipile.mjs` (Replaced hardcoded Unipile DSN with fail-closed ENV checks)
10. `server/get-accounts.ts` (Removed hardcoded credentials)
11. `server/src/db/index.ts` (Removed hardcoded fallback database connection strings)
12. `server/src/scripts/assign-admin.ts` (Fail-closed admin script parameterization)
13. `server/src/scripts/clear-all-users.ts` (Guarded destructive user cleanup script)
14. `server/src/scripts/reset-admin.ts` (Guarded reset script against hardcoded passwords)
15. `server/src/utils/error.util.ts` (Sanitized error logging utilities to prevent credential leaks)
16. `server/test-batch-dm.mts` (Removed hardcoded test tokens)

### C. Pre-Existing Untracked Files & Scripts
1. `audit-evidence/` (Contains WP-02 baseline audit and WP-03 planning documents)
2. `scripts/scan-secrets.mjs` (WP-01 secret scanning utility)
3. `scripts/test-config-validation.mjs` (WP-01 config validation test)
4. `scripts/test-secret-scanner.mjs` (WP-01 test secret scanner)
5. `server/src/scripts/ast-route-inventory.ts` (WP-02 AST route inventory parser)

---

## 3. WP-03 Change Manifest (To Be Tracked Incrementally)

Files created or modified specifically for WP-03 execution:

| File Path | Action | Purpose | Pre-existing or WP-03 |
|-----------|--------|---------|-----------------------|
| `audit-evidence/WP-03/d4605327b523a11d362afc45620dd759c601a5bf/baseline-and-change-manifest.md` | Created | Records starting state and tracks modifications | WP-03 |
| `audit-evidence/WP-03/d4605327b523a11d362afc45620dd759c601a5bf/test-matrix.csv` | Created | 14-case tenant-isolation matrix | WP-03 |
| `audit-evidence/WP-03/d4605327b523a11d362afc45620dd759c601a5bf/test-inventory.md` | Created | Inventory of security & tenant-isolation tests | WP-03 |
| `audit-evidence/WP-03/d4605327b523a11d362afc45620dd759c601a5bf/network-isolation-evidence.md` | Created | Outbound network boundaries & mock proofs | WP-03 |
| `audit-evidence/WP-03/d4605327b523a11d362afc45620dd759c601a5bf/test-database-safety.md` | Created | Database isolation validation & guard rules | WP-03 |
| `audit-evidence/WP-03/d4605327b523a11d362afc45620dd759c601a5bf/exact-test-commands-and-results.txt` | Created | Raw execution traces with exit codes | WP-03 |
| `audit-evidence/WP-03/d4605327b523a11d362afc45620dd759c601a5bf/remediation.diff` | Created | Patch diff for confirmed code remediations | WP-03 |
| `audit-evidence/WP-03/d4605327b523a11d362afc45620dd759c601a5bf/remaining-blockers.md` | Created | Documented blockers for incomplete items | WP-03 |
| `audit-evidence/WP-03/d4605327b523a11d362afc45620dd759c601a5bf/final-report.md` | Created | Executive and technical completion report | WP-03 |

---

## 4. Safety Guardrails Observed

- Zero production database connections: `DATABASE_URL` is never targeted.
- Offline provider mocks: All external API transports (Unipile, Gemini, Resend, Razorpay) are stubbed with synthetic fixtures.
- Preservation invariant: No git commands that destroy or revert uncommitted changes will be executed.
- Secret sanitization: No real keys or credentials appear in any terminal outputs or evidence files.
