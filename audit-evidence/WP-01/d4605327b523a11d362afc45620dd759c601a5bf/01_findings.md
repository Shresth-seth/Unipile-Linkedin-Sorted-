# WP-01 Credential Exposure Findings & Analysis

**Inspection Target Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Repository:** `YuvrajKhare2025/unipile-linkedin-automation`  
**Date:** October 24, 2026  
**Auditor / Agent:** Antigravity AI  

---

## 1. Executive Summary

A comprehensive security audit of commit `d4605327b523a11d362afc45620dd759c601a5bf` identified **confirmed live database credentials** hardcoded into utility and maintenance scripts, **unmasked credential and token logging**, **unsafe fallback secrets**, **untracked binary packaging archives**, and **missing CI secret scanning**. 

All actual secrets have been removed from source code, replaced with strict environment variable loading and validation, error logging has been scrubbed of connection strings and tokens, packaging and Docker exclusions have been hardened, and automated secret scanning with regression tests has been added to the CI pipeline.

Per task specifications, **no real secret values are reproduced in this report**. Redacted identifiers are used throughout.

---

## 2. Classified Findings Inventory

### [FINDING-01] Live Neon DB Connection String Hardcoded in Utility Script
- **Classification:** **Confirmed Defect / Active Exposure**
- **Affected File:** `server/src/scripts/clear-all-users.ts` (Line 8)
- **Credential Type:** PostgreSQL URI with embedded username (`neondb_owner`) and plaintext database password (`npg_NoBl*** [REDACTED]`).
- **Endpoint:** `ep-little-recipe-ay9d5cov-pooler.c-5.us-east-2.aws.neon.tech/neondb`
- **Root Cause:** Developer embedded a real cloud connection string as a fallback for `process.env.DATABASE_URL` for local execution convenience.
- **Exposure Status:** Committed to Git repository. Must be treated as compromised.
- **Remediation:** Removed fallback connection string. Added strict guard requiring `process.env.DATABASE_URL` with fatal exit if missing.

### [FINDING-02] Live Neon DB Credentials, Hardcoded Admin Password, and Plaintext Credential Logging
- **Classification:** **Confirmed Defect / Active Exposure & Logging Defect**
- **Affected File:** `server/src/scripts/assign-admin.ts` (Lines 9, 15, 40-42)
- **Credential Type:** Neon DB password (`npg_NoBl*** [REDACTED]`), static default admin password (`[REDACTED_DEFAULT_PASSWORD]`).
- **Root Cause:** Developer hardcoded production connection string fallback, static admin password, and printed cleartext credentials to stdout via `console.log`.
- **Exposure Status:** Committed to Git repository.
- **Remediation:** Removed hardcoded DB URI. Configured password generation to accept `ADMIN_INITIAL_PASSWORD` or generate a random one-time password via `crypto.randomBytes(16).toString("hex")`. Removed password logging to persistent console output.

### [FINDING-03] Live Neon DB Connection String Hardcoded in CommonJS Script
- **Classification:** **Confirmed Defect / Active Exposure**
- **Affected File:** `server/check-role.cjs` (Line 2)
- **Credential Type:** PostgreSQL URI with embedded password (`npg_NoBl*** [REDACTED]`).
- **Root Cause:** Ad-hoc debugging script committed with hardcoded connection string.
- **Exposure Status:** Committed to Git repository.
- **Remediation:** Replaced hardcoded string with `process.env.DATABASE_URL`. Added graceful validation and error message.

### [FINDING-04] Live Neon DB Connection String and Plaintext Password Comment in ES Module Script
- **Classification:** **Confirmed Defect / Active Exposure & Information Disclosure**
- **Affected File:** `server/check_unipile.mjs` (Lines 3, 15)
- **Credential Type:** PostgreSQL URI with embedded password (`npg_NoBl*** [REDACTED]`), plaintext password comment (`// [REDACTED_PASSWORD]`) accompanying bcrypt hash.
- **Root Cause:** Ad-hoc database query script committed to repository.
- **Exposure Status:** Committed to Git repository.
- **Remediation:** Removed hardcoded connection string and plaintext password comment. Replaced with `process.env.DATABASE_URL` and masked system settings output.

### [FINDING-05] Reported EC2 SSH Key Directory
- **Classification:** **Suspected Risk / Verified Absent in current Git repository**
- **Affected Location:** `deploy/keys/`
- **Investigation Result:** `deploy/keys/` does not exist on disk or in the Git commit tree. However, `deploy/aws/deploy-remote.ps1` previously hardcoded an external local machine path (`e:\WORKPILOT-main\linkdin  brain.pem`), and upstream technical dossier documents (`LINKEDIN_AUTOMATION_TECHNICAL_DOSSIER.md`) noted that `linkdin  brain.pem` was committed in an earlier workspace.
- **Root Cause:** Script relied on hardcoded developer paths and lacked parameterization.
- **Remediation:** Parameterized `deploy/aws/deploy-remote.ps1` to use environment variables (`$env:EC2_SSH_KEY_PATH`, `$env:EC2_TARGET_IP`, `$env:PRODUCTION_ENV_FILE`) with zero hardcoded machine defaults. Added `deploy/keys/`, `keys/`, `*.pem`, and `*.key` to `.gitignore` and all `.dockerignore` files.

### [FINDING-06] Plaintext Password in Comment & Fallback in Reset Admin Script
- **Classification:** **Confirmed Defect / Information Disclosure**
- **Affected File:** `server/src/scripts/reset-admin.ts` (Lines 8, 13)
- **Credential Type:** Plaintext password comment (`// New password: [REDACTED_PASSWORD]`), static bcrypt hash, and local connection fallback.
- **Root Cause:** Developer left password documentation in source code comments.
- **Remediation:** Removed comment and static hash. Password is now provided dynamically via environment variable `ADMIN_NEW_PASSWORD` or generated securely at runtime.

### [FINDING-07] Hardcoded Unipile Account ID in Batch Script
- **Classification:** **Information Disclosure / Account Exposure**
- **Affected File:** `server/test-batch-dm.mts` (Line 3)
- **Credential Type:** Unipile Account ID (`84K4FddgRp-[REDACTED]`).
- **Root Cause:** Ad-hoc test script with hardcoded production account ID.
- **Remediation:** Refactored to read `process.env.UNIPILE_ACCOUNT_ID` or CLI argument.

### [FINDING-08] Unmasked Credential Output in Account Listing Script
- **Classification:** **Information Disclosure / Logging Risk**
- **Affected File:** `server/get-accounts.ts` (Line 6)
- **Root Cause:** Entire database rows dumped to stdout without field masking.
- **Remediation:** Sanitized output to mask Unipile Account IDs (`84K4...`) and redact encrypted credentials.

### [FINDING-09] Arbitrary Archive Committed in Repository Root
- **Classification:** **Verification Gap / Packaging Risk**
- **Affected File:** `deploy.tar.gz` (Root repository)
- **Root Cause:** Tar archive committed into version control containing `docker-compose.yml`. Binary archives conceal file contents from diffs and code review.
- **Remediation:** Removed `deploy.tar.gz` from Git tracking (`git rm deploy.tar.gz`) and added `*.tar.gz` to `.gitignore` and `.dockerignore`.

### [FINDING-10] Incomplete Exclusions in Ignore Files
- **Classification:** **Packaging & Containerization Gap**
- **Affected Files:** `.gitignore`, `server/.dockerignore`, `client/.dockerignore`, root `.dockerignore`
- **Root Cause:** Incomplete exclusion patterns allowed `.env` variants or `.key`/`.pem` files to be packaged into Docker contexts.
- **Remediation:** Updated all ignore files with unified patterns covering `*.pem`, `*.key`, `*.id_rsa*`, `*.id_ed25519*`, `deploy/keys/`, `keys/`, `*.tar.gz`, and `.env*` (except `.env.example`).

### [FINDING-11] Missing Secret Scanning in CI/CD Pipeline
- **Classification:** **Verification Gap / CI Pipeline Defect**
- **Affected File:** `.github/workflows/deploy-production.yml`
- **Root Cause:** Pipeline ran build and lint checks without verifying secret exposure.
- **Remediation:** Added `Secret Scanning Validation` and `Verify Secret Scanner Regression` steps into the `ci-validate` workflow. Added `scripts/scan-secrets.mjs` and `scripts/test-secret-scanner.mjs`.

### [FINDING-12] Database Runtime Account Privileges
- **Classification:** **Privilege Architecture Risk**
- **Affected Component:** Neon Database Connection (`neondb_owner`)
- **Root Cause:** Application connects using `neondb_owner`, which possesses database superuser/owner privileges (allowing `DROP TABLE`, `ALTER TABLE`, and role modification).
- **Remediation / Recommendation:** Documented in the Rotation Runbook that production operations must provision a dedicated `workpilot_app` role granted only `SELECT, INSERT, UPDATE, DELETE` on application tables and `USAGE` on sequences.
