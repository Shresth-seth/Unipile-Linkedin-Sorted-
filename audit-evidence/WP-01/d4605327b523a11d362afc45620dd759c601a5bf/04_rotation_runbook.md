# Production Credential Rotation Runbook (WP-01)

**Status:** **BLOCKED (Awaiting Authorized Operator Execution)**  
**Reason:** Rotating live cloud production credentials or re-provisioning infrastructure requires direct console/cloud access and explicit authorization from the system owner.  

> [!WARNING]  
> Removing a secret or deleting a `.pem` file from Git **does not revoke** the credential in the cloud provider. Any credential that was committed to version control must be treated as fully compromised and rotated at the provider level immediately.

---

## 1. Scope of Compromised Credentials

| Credential | Identity / Endpoint | Exposure Source | Rotation Status |
|---|---|---|---|
| **Neon PostgreSQL Password** | `neondb_owner` (`ep-little-recipe-ay9d5cov-pooler...`) | Hardcoded in 4 maintenance scripts | **BLOCKED** (Operator Action Required) |
| **AWS EC2 SSH Key** | `linkdin  brain.pem` (`eu-north-1`, instance `i-08531a9572271b45e`) | Hardcoded path in `deploy-remote.ps1`, historical upstream commit | **BLOCKED** (Operator Action Required) |
| **Unipile Master API Key** | `https://api60.unipile.com:19086` / `system_settings` | Upstream technical dossier reference | **BLOCKED** (Operator Action Required) |
| **JWT & Encryption Secrets** | `JWT_SECRET`, `DATA_ENCRYPTION_KEY` | Upstream references / weak fallbacks | **LOCAL REMEDIATED / ROTATION PENDING** |

---

## 2. Neon Database Credential Rotation Procedure

### Affected Consumers
- **Express API Backend:** `server/src/db/index.ts` (connection pool via `postgres` driver)
- **Background Action Queue Worker:** In-process worker in `server/src/index.ts`
- **Inbound Message Sync Worker:** In-process worker in `server/src/index.ts`
- **Database Migrations:** `npm run db:migrate:prod` / `npm run db:custom-migrate:prod`
- **AWS ECS / Docker Containers:** `docker-compose.prod.yml` injecting `DATABASE_URL`

### Step-by-Step Operator Procedure

#### Phase 1: Provision Dedicated Least-Privilege App User (Recommended)
Rather than reusing `neondb_owner` (which possesses superuser privileges), create an isolated application user:
1. Log into the Neon Console ([console.neon.tech](https://console.neon.tech)).
2. Open the SQL Editor for project `ep-little-recipe` and execute:
   ```sql
   -- 1. Create a dedicated application role with strong random password
   CREATE ROLE workpilot_app WITH LOGIN PASSWORD '<GENERATE_64_CHAR_HEX_PASSWORD>';

   -- 2. Grant table and sequence permissions on public schema
   GRANT CONNECT ON DATABASE neondb TO workpilot_app;
   GRANT USAGE ON SCHEMA public TO workpilot_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO workpilot_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO workpilot_app;

   -- 3. Ensure future tables also inherit permissions
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO workpilot_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO workpilot_app;
   ```

#### Phase 2: Rotate Existing `neondb_owner` Password
If continuing with `neondb_owner` prior to user migration:
1. In Neon Console -> **Project Settings** -> **Roles**.
2. Select `neondb_owner` -> Click **Reset Password**.
3. Generate and copy the new connection string (including connection pooler `-pooler.c-5...`).

#### Phase 3: Update Production Configuration
1. Update AWS Secrets Manager secret:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id "workpilot/DATABASE_URL" \
     --secret-string "postgresql://workpilot_app:<NEW_PASSWORD>@ep-little-recipe-ay9d5cov-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```
2. If EC2 uses a local `/home/ubuntu/app/.env` file:
   ```bash
   # Connect to EC2
   ssh ubuntu@<EC2_IP>
   # Update DATABASE_URL in /home/ubuntu/app/.env
   nano /home/ubuntu/app/.env
   ```

#### Phase 4: Restart Services & Verify Recovery
1. Restart the application containers:
   ```bash
   cd /home/ubuntu/app
   docker compose up -d --force-recreate server client
   ```
2. Check backend startup logs:
   ```bash
   docker compose logs -f server
   ```
   *Verify:* Logs show `🚀 WorkPilot Server running on http://0.0.0.0:4000 [production]` without connection failures.
3. Verify health probes:
   ```bash
   curl -I http://127.0.0.1:4000/api/health/liveness
   # Expected: HTTP/1.1 200 OK
   ```

---

## 3. AWS EC2 SSH Key Pair Rotation Procedure

### Assessment
- The SSH private key `linkdin  brain.pem` was referenced as a local path and previously committed upstream.
- Merely removing references to the key file **does not revoke access** on the EC2 host.

### Step-by-Step Operator Procedure

1. **Generate New Key Pair in AWS Console:**
   - AWS Console -> **EC2** -> **Network & Security** -> **Key Pairs**.
   - Click **Create Key Pair** (Name: `workpilot-prod-deploy-2026`, Type: `ED25519` or `RSA 4096`).
   - Download the new private key `workpilot-prod-deploy-2026.pem` and store it securely in a password manager or corporate vault.

2. **Add New Public Key to EC2 Instance:**
   - Open AWS Systems Manager (SSM) Session Manager or connect via existing session:
   ```bash
   # Append new public key to authorized_keys
   echo "<NEW_PUBLIC_KEY_CONTENT>" >> /home/ubuntu/.ssh/authorized_keys
   chmod 600 /home/ubuntu/.ssh/authorized_keys
   ```

3. **Verify Connectivity with New Key:**
   ```bash
   ssh -i workpilot-prod-deploy-2026.pem ubuntu@<EC2_PUBLIC_IP> "echo 'New key verified'"
   ```

4. **Revoke Old Compromised Key:**
   - In `/home/ubuntu/.ssh/authorized_keys`, delete the line corresponding to `linkdin  brain.pem`.
   - In AWS Console -> EC2 Key Pairs -> delete the old key pair.

---

## 4. Unipile API Key & Webhook Secret Rotation Procedure

### Assessment
- Unipile gateway is the core bridge between WorkPilot and LinkedIn accounts.
- Unipile API key allows querying attendee chats, inviting contacts, and reading account profiles.

### Step-by-Step Operator Procedure

1. **Generate New Key in Unipile Dashboard:**
   - Log into [dashboard.unipile.com](https://dashboard.unipile.com) -> **Settings** -> **API Keys**.
   - Click **Generate New API Key**.
   - Note new API key and DSN endpoint.

2. **Generate New Webhook Secret:**
   - Generate a high-entropy 32-byte secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Update Webhook Registration on Unipile:**
   - Run the webhook update utility with the new credentials:
   ```bash
   UNIPILE_API_KEY="<NEW_KEY>" UNIPILE_WEBHOOK_SECRET="<NEW_SECRET>" node dist/scripts/setup-unipile-webhooks.js
   ```

4. **Update Production Environment:**
   - Update `UNIPILE_API_KEY` and `UNIPILE_WEBHOOK_SECRET` in production `.env` / AWS Secrets Manager.
   - Restart the server process (`docker compose restart server`).

5. **Revoke Old Unipile Key:**
   - In Unipile dashboard, delete the old API key.
   - Test sending a health probe or verifying live sync (`node dist/scripts/check-accounts.js`).

---

## 5. Rollback and Containment Strategy

If credential rotation causes unexpected service disruption:
1. **Database Fallback:** If the new role lacks unexpected permissions, temporarily update permissions (`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO workpilot_app;`) rather than reverting to a compromised credential.
2. **Configuration Rollback:** Maintain a backup copy of previous configurations in an encrypted vault (`/home/ubuntu/backup/.env.bak`).
3. **Session Invalidation:** Rotating `JWT_SECRET` intentionally invalidates all user browser sessions. Instruct active users to re-authenticate at `/login`.
