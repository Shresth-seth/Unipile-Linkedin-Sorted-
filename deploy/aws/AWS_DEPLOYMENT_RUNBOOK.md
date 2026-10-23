# 🚀 WorkPilot — AWS Production Deployment Runbook

> **Target Cloud**: Amazon Web Services (AWS)  
> **Production Grade**: Grade A+ (Multi-Tenant Isolation, Non-Root Containers, Zero-Downtime CI/CD)  
> **Supported Architectures**: 
> 1. **Option A (Recommended for Startups)**: AWS EC2 + Docker Compose + Nginx + Let's Encrypt SSL
> 2. **Option B (Recommended for Enterprise)**: AWS ECS Fargate + Application Load Balancer + AWS RDS + Secrets Manager

---

## 📑 Table of Contents

1. [Architectural Overview](#-1-architectural-overview)
2. [Prerequisites & Checklist](#-2-prerequisites--checklist)
3. [Strategy 1: AWS EC2 Docker Deployment (Step-by-Step)](#-3-strategy-1-aws-ec2-deployment)
4. [Strategy 2: AWS ECS Fargate Deployment (Step-by-Step)](#-4-strategy-2-aws-ecs-fargate-deployment)
5. [Database Migrations on AWS RDS](#-5-database-migrations-on-aws-rds)
6. [Automated CI/CD via GitHub Actions (OIDC + SSM)](#-6-automated-cicd-via-github-actions-oidc--ssm)
7. [Post-Deployment Smoke Tests & Health Probes](#-7-post-deployment-smoke-tests--health-probes)
8. [Troubleshooting & Emergency Operations](#-8-troubleshooting--emergency-operations)

---

## 🏛️ 1. Architectural Overview

### Option A: AWS EC2 (Single-Instance with Docker Compose)
- **Compute**: Single EC2 instance (`t4g.small` or `t3.medium`, Ubuntu 24.04 LTS).
- **Reverse Proxy**: Nginx container handling SSL termination, HTTP/2, gzip compression, and WebSocket upgrade.
- **Backend Service**: Express API running on port 4000 (non-root `expressjs` user).
- **Frontend Service**: Next.js 16 Standalone running on port 3000 (non-root `nextjs` user).
- **Database**: AWS RDS PostgreSQL or internal containerized PostgreSQL with persistent volume.
- **Cache / Queue**: AWS ElastiCache Redis or internal containerized Redis.

### Option B: AWS ECS Fargate (Serverless Containers)
- **Ingress**: AWS Application Load Balancer (ALB) with AWS Certificate Manager (ACM) SSL.
  - Path `/api/*` ➔ Backend Target Group (Port 4000, Healthcheck: `/api/health/liveness`).
  - Path `/*` ➔ Frontend Target Group (Port 3000, Healthcheck: `/`).
- **Compute**: AWS ECS Fargate Tasks running `workpilot-server` and `workpilot-client`.
- **Secrets**: AWS Secrets Manager automatically injecting secrets into containers at launch.

---

## 📋 2. Prerequisites & Checklist

Before starting, ensure you have:
- [ ] An active **AWS Account** with administrative permissions.
- [ ] A domain name (e.g., `workpilot.io`) with DNS managed via Route 53 or Cloudflare.
- [ ] A **Unipile Account** (DSN and API Key from [developer.unipile.com](https://developer.unipile.com)).
- [ ] A **Google Gemini AI API Key** (from [aistudio.google.com](https://aistudio.google.com)).
- [ ] A cryptographically strong **JWT Secret** (64+ characters: `openssl rand -hex 32`).

---

## 🖥️ 3. Strategy 1: AWS EC2 Deployment

### Step 1: Launch an EC2 Instance
1. In the AWS Management Console, navigate to **EC2** ➔ **Launch Instances**.
2. **Name**: `workpilot-production`
3. **AMI**: `Ubuntu Server 24.04 LTS` (or `22.04 LTS`)
4. **Instance Type**: `t3.medium` (2 vCPU, 4GB RAM) or `t4g.small` (ARM64)
5. **Key Pair**: Select or create an SSH key pair.
6. **Network Settings / Security Group**:
   - Allow **SSH (22)** from your IP.
   - Allow **HTTP (80)** from Anywhere (`0.0.0.0/0`).
   - Allow **HTTPS (443)** from Anywhere (`0.0.0.0/0`).
7. **Advanced Details ➔ User Data**:
   Paste the contents of [`deploy/aws/ec2-user-data.sh`](file:///e:/WORKPILOT-main/deploy/aws/ec2-user-data.sh).  
   *(This automatically installs Docker, Compose, AWS CLI, and SSM Agent on first boot)*.
8. Click **Launch Instance**.
9. Assign an **Elastic IP (EIP)** to the instance so the public IP remains static.

### Step 2: Clone and Configure the Application
Connect to your EC2 instance via SSM or SSH:
```bash
# Connect to instance
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Verify user-data completed
cat /var/log/user-data.log | grep "Complete"

# Clone your repository
cd /home/ubuntu/app
git clone https://github.com/YOUR_ORG/WORKPILOT.git .

# Configure production environment variables
cp .env.production.example .env
nano .env
```
Ensure your `.env` contains:
```ini
PORT=4000
NODE_ENV=production
CLIENT_URL=https://app.workpilot.io
DATABASE_URL=postgresql://workpilot_admin:PASSWORD@your-rds-endpoint:5432/workpilot?sslmode=require
JWT_SECRET=your_generated_64_character_secret
UNIPILE_DSN=https://api1.unipile.com:13200
UNIPILE_API_KEY=your_unipile_api_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_SERVER_URL=https://api.workpilot.io
NEXT_PUBLIC_API_URL=https://api.workpilot.io
```

### Step 3: Run Initial Deployment
```bash
# Run the zero-downtime deployment script
bash scripts/deploy-production.sh
```
This automatically:
- Builds optimized production images for both backend and frontend.
- Runs database migrations via `npm run db:migrate:prod`.
- Starts container services with automatic restart policies.
- Validates internal and public health checks.

### Step 4: Configure Nginx & SSL Certificate
```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Configure Nginx using deploy/aws/nginx.conf
sudo cp deploy/aws/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl restart nginx

# Obtain free Let's Encrypt SSL certificates
sudo certbot --nginx -d app.workpilot.io -d api.workpilot.io
```

---

## ☁️ 4. Strategy 2: AWS ECS Fargate Deployment

### Step 1: Create ECR Repositories & Build Images
```bash
# Export configuration
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Run the automated ECS deployment script
bash deploy/aws/deploy-ecs.sh
```

### Step 2: Configure Secrets in AWS Secrets Manager
Create the secret keys referenced in [`deploy/aws/ecs-task-definition.json`](file:///e:/WORKPILOT-main/deploy/aws/ecs-task-definition.json):
```bash
aws secretsmanager create-secret --name "workpilot/DATABASE_URL" --secret-string "postgresql://..."
aws secretsmanager create-secret --name "workpilot/JWT_SECRET" --secret-string "your_jwt_secret"
aws secretsmanager create-secret --name "workpilot/UNIPILE_DSN" --secret-string "https://..."
aws secretsmanager create-secret --name "workpilot/UNIPILE_API_KEY" --secret-string "your_unipile_key"
aws secretsmanager create-secret --name "workpilot/GEMINI_API_KEY" --secret-string "your_gemini_key"
```

### Step 3: Create ALB & ECS Service
1. Create an **Application Load Balancer (ALB)** in your public subnets with an HTTPS listener.
2. Create Target Group for Backend: Port 4000, Health check path: `/api/health/liveness`.
3. Create Target Group for Frontend: Port 3000, Health check path: `/`.
4. Register the rendered task definition:
   ```bash
   aws ecs register-task-definition --cli-input-json file://deploy/aws/ecs-task-definition.json
   ```
5. Create the ECS Fargate service pointing to the task definition and target groups.

---

## 🗄️ 5. Database Migrations on AWS RDS

WorkPilot includes a standalone, production-compiled migration runner that executes directly with Node.js without requiring TypeScript or devDependencies in production:

```bash
# Inside the container or EC2 host:
cd server
npm run db:migrate:prod
```

If connecting to AWS RDS PostgreSQL:
1. Ensure your RDS Security Group allows inbound TCP port `5432` from your EC2 / ECS security group.
2. Ensure SSL is enabled by appending `?sslmode=require` to `DATABASE_URL`.
3. To view database schema visually:
   ```bash
   npm run db:studio
   ```

---

## 🤖 6. Automated CI/CD via GitHub Actions (OIDC + SSM)

The repository includes a production deployment workflow in [`.github/workflows/deploy-production.yml`](file:///e:/WORKPILOT-main/.github/workflows/deploy-production.yml).

### Configure GitHub Repository Variables
In GitHub ➔ **Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ **Variables**:

| Variable Name     | Example Value                                                 | Purpose                                         |
| :---------------- | :------------------------------------------------------------ | :---------------------------------------------- |
| `AWS_ROLE_ARN`    | `arn:aws:iam::123456789012:role/GitHubActionsDeploymentRole`   | IAM Role assumed via GitHub OIDC                |
| `AWS_REGION`      | `us-east-1` (or `eu-north-1`)                                 | Target AWS region                               |
| `AWS_INSTANCE_ID` | `i-08531a9572271b45e`                                         | Target EC2 Instance ID                          |
| `AWS_DEPLOY_PATH` | `/home/ubuntu/app`                                            | Path on EC2 instance                            |
| `EC2_PUBLIC_IP`   | `51.20.93.72` (or domain `workpilot.io`)                      | Target host for post-deployment health check    |

### GitHub OIDC IAM Trust Policy
To allow GitHub Actions to deploy to AWS without saving long-lived AWS keys, attach this trust policy to `GitHubActionsDeploymentRole`:
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
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/WORKPILOT:*"
        }
      }
    }
  ]
}
```

---

## 🔍 7. Post-Deployment Smoke Tests & Health Probes

Run these checks against your production deployment:

### 1. Backend Liveness Healthcheck
```bash
curl -i https://api.workpilot.io/api/health/liveness
# Expected:
# HTTP/1.1 200 OK
# {"status":"ok","version":"<COMMIT_SHA>","timestamp":"..."}
```

### 2. Backend Database Readiness Check
```bash
curl -i https://api.workpilot.io/api/health/readiness
# Expected:
# HTTP/1.1 200 OK
# {"status":"ready","database":"connected","timestamp":"..."}
```

### 3. Frontend Landing Page Check
```bash
curl -i https://app.workpilot.io/
# Expected:
# HTTP/1.1 200 OK
```

### 4. Tenant Security Verification
```bash
curl -i https://api.workpilot.io/api/dashboard/overview
# Expected:
# HTTP/1.1 401 Unauthorized (Protected from unauthorized access)
```

---

## 🛠️ 8. Troubleshooting & Emergency Operations

### View Real-Time Container Logs
```bash
# Docker Compose logs
docker compose logs -f server
docker compose logs -f client

# Specific service log tail
docker logs --tail 100 workpilot_server
docker logs --tail 100 workpilot_client
```

### Disk Space Alert (`No space left on device`)
If the EC2 instance runs low on disk space:
```bash
# Prune dangling Docker images and build cache
docker system prune -af --volumes

# Verify log rotation is active in docker-compose.yml:
# logging.driver: json-file, max-size: "10m", max-file: "3"
```

### Emergency Restart
```bash
cd /home/ubuntu/app
docker compose down
docker compose up -d
```
