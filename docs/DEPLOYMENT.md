# WorkPilot Production Deployment & CI/CD Guide

This document explains the automated production CI/CD pipeline for WorkPilot, including architecture, setup instructions for AWS OIDC/SSM and SSH fallback, rollback procedures, and troubleshooting.

---

## 1. Pipeline Architecture & Workflow

The entire deployment lifecycle is automated through GitHub Actions and the production deployment engine (`scripts/deploy-production.sh`).

```text
                     Developer pushes to `main`
                                ↓
                 GitHub Actions Triggered Automatically
                                ↓
                ┌────────────────────────────────┐
                │        CI Validation Job       │
                ├────────────────────────────────┤
                │ 1. Setup Node.js 20 & Caching  │
                │ 2. Backend: npm ci             │
                │ 3. Backend: npm run typecheck  │
                │ 4. Backend: npm run build      │
                │ 5. Frontend: npm ci            │
                │ 6. Frontend: npm run lint      │
                │ 7. Frontend: npm run typecheck │
                │ 8. Frontend: npm run build     │
                └────────────────────────────────┘
                                ↓
                     Did any check fail?
                     ├── YES ──> [DEPLOYMENT HALTED / FAILS CLEARLY]
                     └── NO
                                ↓
                ┌────────────────────────────────┐
                │    Production Deployment Job   │
                │   (Concurrency Protection)     │
                ├────────────────────────────────┤
                │ Connect via AWS OIDC + SSM     │
                │ (or Fallback via SSH Key)      │
                └────────────────────────────────┘
                                ↓
              Execute `scripts/deploy-production.sh` on EC2:
                                ↓
     1. Verify deployment directory (`~/WORKPILOT`) & git repo
     2. Record current commit SHA for automatic rollback
     3. Fetch and hard-reset to exact target `main` commit
     4. Stamp version metadata (`.deploy-version`)
     5. Build new Docker images while old containers serve traffic
     6. Verify PostgreSQL readiness and run Drizzle migrations
     7. Recreate containers with zero unnecessary downtime
     8. Multi-stage Health Checks (Liveness, Readiness, Frontend)
                                ↓
                     Did health check pass?
                     ├── NO  ──> [AUTOMATIC ROLLBACK TO PREVIOUS COMMIT]
                     └── YES
                                ↓
                 Deployment Successful (HTTP 200 OK)
```

---

## 2. GitHub Secrets & Variables Reference

Go to your repository settings on GitHub:
**Settings** → **Secrets and variables** → **Actions**

### Strategy A: AWS OIDC + SSM (Recommended & Secure)

No long-lived access keys or private SSH keys are stored in GitHub. Authentication happens via cryptographic OIDC tokens exchanged with AWS STS.

| Name | Type | Value / Purpose |
| :--- | :--- | :--- |
| `AWS_ROLE_ARN` | **Secret** | The ARN of the IAM role to assume (e.g. `arn:aws:iam::123456789012:role/WorkPilotGitHubDeployRole`) |
| `AWS_REGION` | **Variable** or **Secret** | AWS Region of your EC2 instance (e.g., `ap-south-1` or `us-east-1`) |
| `AWS_INSTANCE_ID` | **Variable** or **Secret** | EC2 Instance ID hosting the application (e.g., `i-0abcdef1234567890`) |
| `AWS_DEPLOY_PATH` | **Variable** or **Secret** | Application directory on EC2 (Default: `~/WORKPILOT`) |

---

### Strategy B: SSH Key Fallback (Already Supported)

If you have an existing SSH key pair and have not yet configured AWS OIDC, the workflow automatically falls back to SSH execution:

| Name | Type | Value / Purpose |
| :--- | :--- | :--- |
| `EC2_HOST` or `AWS_HOST` | **Secret** | Public IP or DNS of the EC2 instance (e.g., `13.235.xxx.xxx`) |
| `EC2_USER` or `AWS_USER` | **Secret** or **Var** | SSH username (Default: `ubuntu`) |
| `EC2_SSH_KEY` or `AWS_DEPLOY_PRIVATE_KEY` | **Secret** | OpenSSH Private Key (`.pem` format) with access to the EC2 instance |
| `AWS_DEPLOY_PATH` | **Variable** or **Secret** | Directory on EC2 where repository lives (Default: `~/WORKPILOT`) |

> [!NOTE]
> When `AWS_ROLE_ARN` is present in GitHub Secrets, the pipeline automatically uses Strategy A (OIDC + SSM). If `AWS_ROLE_ARN` is absent, it seamlessly uses Strategy B (SSH Key).

---

## 3. Step-by-Step AWS OIDC + SSM Configuration

To eliminate SSH keys and enable OIDC + Systems Manager, follow these steps in the AWS Console:

### Step 1: Create GitHub OIDC Identity Provider in AWS IAM (One-time)
1. Open the **IAM Console** → **Identity providers** → **Add provider**.
2. Select **OpenID Connect**.
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Click **Add provider**.

---

### Step 2: Create the IAM Deployment Role
1. Open **IAM Console** → **Roles** → **Create role**.
2. Select **Custom trust policy** and paste the following (replace `YOUR_GITHUB_ORG/YOUR_REPO` with your repository, e.g. `201Harsh/IRIS-Connect`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:201Harsh/IRIS-Connect:*"
        }
      }
    }
  ]
}
```

3. Attach the following least-privilege permission policy to the role (e.g. named `WorkPilotDeployPolicy`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SSMCommandExecution",
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand"
      ],
      "Resource": [
        "arn:aws:ssm:*:*:document/AWS-RunShellScript",
        "arn:aws:ec2:*:*:instance/YOUR_INSTANCE_ID"
      ]
    },
    {
      "Sid": "SSMCommandTracking",
      "Effect": "Allow",
      "Action": [
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations",
        "ssm:DescribeInstanceInformation"
      ],
      "Resource": "*"
    }
  ]
}
```

4. Save the Role and copy the Role ARN (e.g., `arn:aws:iam::123456789012:role/WorkPilotGitHubDeployRole`) into GitHub Secret `AWS_ROLE_ARN`.

---

### Step 3: Ensure EC2 Has SSM Permissions & SSM Agent
1. The EC2 instance must have an IAM Instance Profile attached with `AmazonSSMManagedInstanceCore`.
2. On Ubuntu 20.04/22.04/24.04, the SSM Agent is pre-installed. Verify with:
   ```bash
   sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent.service
   ```
3. Verify that the instance appears as "Online" in the AWS Systems Manager Fleet Manager.

---

## 4. How Deployment Works Under the Hood

When `scripts/deploy-production.sh` runs on the EC2 server, it performs:

1. **Path & Environment Check**:
   Resolves `~/WORKPILOT` and confirms Docker Compose and Git are installed.
2. **Safety State Capture**:
   Stashes any local modifications to tracked files (preserving untracked files like `.env`, logs, and database volumes).
   Captures the current stable commit SHA for rollback protection.
3. **Deterministic Git Sync**:
   Runs:
   ```bash
   git fetch origin main --tags --prune
   git checkout main
   git reset --hard <target-commit-sha>
   ```
4. **Version Stamping**:
   Writes `.deploy-version` with commit SHA, timestamp, and deployer info. The backend exposes this through `/api/health`.
5. **Zero-Downtime Image Build**:
   Runs `docker compose build --pull`. Current application containers continue running and serving users while images build.
6. **Database Migration**:
   Checks PostgreSQL readiness and executes:
   ```bash
   docker compose run --rm server npm run db:migrate
   ```
   If migrations fail, the pipeline halts immediately.
7. **Container Recreation**:
   Runs `docker compose up -d --remove-orphans`. Docker gracefully swaps old containers for the newly built images.
8. **Multi-Stage Health Probing**:
   Runs up to 15 health checks (every 4 seconds) against:
   - Backend Liveness: `http://localhost:4000/api/health/liveness` (HTTP 200)
   - Backend Readiness: `http://localhost:4000/api/health/readiness` (DB connectivity check - HTTP 200)
   - Frontend Health: `http://localhost:3000/` (HTTP 200 or 307)
9. **Disk Housekeeping**:
   Prunes dangling Docker images (`docker image prune -f`) to prevent disk exhaustion.

---

## 5. Automatic & Manual Rollback

### Automatic Rollback
If the application fails health checks within 60 seconds after deployment:
1. The script immediately catches the failure.
2. It checks out the previously recorded stable commit (`PREVIOUS_COMMIT`).
3. It rebuilds and brings up the previous stable containers.
4. It logs the rollback status and exits with code 1 so GitHub Actions shows a clear alert.

### Manual Rollback (If needed)
If you ever need to manually revert to an older commit:

```bash
cd ~/WORKPILOT
git fetch origin
git checkout <PREVIOUS_STABLE_COMMIT_SHA>
docker compose build
docker compose up -d --remove-orphans
curl -i http://localhost:4000/api/health/liveness
```

---

## 6. How to Manually Trigger a Deployment

If you want to trigger a redeployment without pushing a new commit:
1. Navigate to the repository on GitHub.
2. Click the **Actions** tab.
3. In the left sidebar, click **Production CI/CD Pipeline**.
4. Click **Run workflow** dropdown on the right.
5. Select the `main` branch and click **Run workflow**.

---

## 7. How to View Logs & Troubleshoot

### 1. GitHub Actions Logs
- Open the **Actions** tab on GitHub.
- Click the running or completed workflow run.
- Click on `CI Validation` to view backend/frontend build logs.
- Click on `Deploy to Production` to view real-time streaming deployment logs.

### 2. EC2 Server Container Logs
If you SSH into the server to inspect runtime logs:

```bash
cd ~/WORKPILOT

# View running container status
docker compose ps

# View backend server logs
docker compose logs -f server --tail=100

# View frontend client logs
docker compose logs -f client --tail=100

# View database logs
docker compose logs -f postgres --tail=50

# Test health checks directly
curl -s http://localhost:4000/api/health | jq .
curl -s http://localhost:4000/api/health/readiness | jq .
```

### 3. Check Current Deployed Version
To confirm which commit is currently active on the server:

```bash
cat ~/WORKPILOT/.deploy-version
```
Or via HTTP:
```bash
curl -s https://app.workpilot.io/api/health | jq .
```
Response:
```json
{
  "status": "ok",
  "service": "workpilot-backend",
  "version": "1.0.0",
  "commit": "a1b2c3d4e5f6...",
  "timestamp": "2026-09-08T00:00:00.000Z"
}
```

---

## 8. Summary Checklist for Future Pushes

Now that the pipeline is active, your deployment workflow is:

```bash
git add .
git commit -m "update agent feature"
git push origin main
```

That's it! GitHub Actions handles dependency installation, linting, typechecking, building, AWS connection, container updates, migrations, and health verification automatically.
