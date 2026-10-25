# WP-14: Operator Deployment & Handover Guide

**Work Package:** WP-14 ("Validate the Release and Hand Over", Handover Pages 32–33)  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Date:** 2026-10-25  

---

## 1. Quick-Start Production Deployment (AWS EC2)

### Step 1: Provision EC2 Instance
- **Instance Type:** `t4g.small` (ARM64, 2 vCPU, 2GB RAM) or `t3.medium` (x86_64).
- **AMI:** Ubuntu Server 24.04 LTS.
- **Root Volume:** 30 GB gp3 SSD.
- **User Data:** Paste [`deploy/aws/ec2-user-data.sh`](file:///c:/Users/Admin/OneDrive/Desktop/unipile/deploy/aws/ec2-user-data.sh).
- **Security Group:** Inbound ports 22 (SSH), 80 (HTTP), 443 (HTTPS).

### Step 2: Configure Environment Secrets (.env)
Create `/home/ubuntu/app/.env` with production credentials:
```ini
PORT=4000
NODE_ENV=production
CLIENT_URL=https://app.workpilot.io
DATABASE_URL=postgresql://workpilot_admin:PASSWORD@your-rds-endpoint:5432/workpilot?sslmode=require
JWT_SECRET=your_generated_64_character_cryptographic_secret
UNIPILE_DSN=https://api1.unipile.com:13200
UNIPILE_API_KEY=your_unipile_api_key
UNIPILE_WEBHOOK_SECRET=your_unipile_webhook_secret
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_SERVER_URL=https://api.workpilot.io
```

### Step 3: Trigger Automated Deployment
Run deployment via AWS Systems Manager (SSM) or SSH:
```bash
# On the EC2 instance under user ubuntu:
cd /home/ubuntu/app
bash scripts/deploy-production.sh
```

---

## 2. Post-Deployment Verification Commands

Once deployment completes, verify all system health probes:
```bash
# 1. Backend Liveness & Memory Telemetry
curl -s http://127.0.0.1:4000/api/health/liveness | jq .

# 2. Database Connectivity & Readiness Probe
curl -s http://127.0.0.1:4000/api/health/readiness | jq .

# 3. Frontend Standalone Web Service
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/

# 4. Reverse Proxy Ingress (Port 80)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/
```

---

## 3. Emergency Operations

- **Instant Automation Killswitch:**
  Call `POST /api/dashboard/emergency-pause` with tenant JWT to freeze outbound queue actions immediately.
- **Stale Lock Recovery:**
  Automatically handled every worker cycle (stale jobs > 5 mins are retried; jobs >= 3 retries are marked `FAILED`).
- **Emergency Restart:**
  `sudo systemctl restart workpilot-server` or `docker compose restart server client`.
