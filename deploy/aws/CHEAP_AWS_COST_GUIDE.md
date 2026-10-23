# 💰 WorkPilot — Ultra-Low-Cost AWS Deployment Guide
### How to Run Production WorkPilot on AWS for $0 to $12 / Month (Saving >90%)

---

## 📊 1. The Cost Comparison: Enterprise vs. Low-Cost AWS

A typical "AWS Enterprise Best Practice" architecture is shockingly expensive for startups, solo founders, and early deployments:

| AWS Component | Traditional AWS Setup | Monthly Cost | WorkPilot Low-Cost Setup | Low-Cost Monthly Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Compute** | AWS ECS Fargate (2 tasks) | ~$28.00 | **EC2 `t4g.micro` or `t3.micro`** | **$0.00 – $6.10** |
| **Load Balancer** | AWS Application Load Balancer (ALB) | ~$22.50 | **Nginx Container + Certbot SSL** | **$0.00 (FREE)** |
| **Database** | AWS RDS PostgreSQL (`db.t4g.small`) | ~$34.00 | **Docker Postgres or Neon.tech Free** | **$0.00 (FREE)** |
| **Cache / Queue** | AWS ElastiCache Redis | ~$15.50 | **Docker Redis or Upstash Free** | **$0.00 (FREE)** |
| **Networking** | AWS NAT Gateway | ~$32.40 | **Public Subnet + Elastic IP** | **$0.00 (FREE)** |
| **Storage** | 50GB EBS + RDS Storage | ~$12.00 | **30GB EBS gp3 (Free Tier)** | **$0.00 (FREE)** |
| **ESTIMATED TOTAL** | | **~$144.40 / month** | | **$0.00 – $6.10 / month** |

> **Savings**: You save **over $138 every month** while maintaining 100% functionality and isolation.

---

## 🎯 2. The 2 Low-Cost Production Strategies

### Strategy A: The $0.00 "Zero-Dollar" Stack (AWS Free Tier + Free Serverless)
If your AWS account is in its first 12 months (or using Free Tier credits):

1. **EC2 Instance**: Launch a `t3.micro` instance (750 hours/month FREE in AWS Free Tier).
   - If using AWS Graviton: `t4g.small` (frequently offered with a 750-hour free trial).
2. **Database (Neon.tech)**:
   - Sign up for a free PostgreSQL database at [neon.tech](https://neon.tech).
   - Generous free tier: 0.5 GB storage, built-in connection pooler, automated daily backups, SSL support.
   - Copy connection string to `.env` as `DATABASE_URL`.
3. **Redis Cache (Upstash.com)**:
   - Sign up for a free serverless Redis at [upstash.com](https://upstash.com).
   - Free tier: 10,000 commands per day.
   - Copy Redis URL to `.env` as `REDIS_URL`.
4. **Proxy & SSL**:
   - Nginx runs on the EC2 instance with Let's Encrypt Certbot.
5. **Expected AWS Bill: $0.00 / month!**

---

### Strategy B: The $6 - $12 "Self-Contained Box" (All Docker Containers on 1 EC2)
If you prefer everything self-contained in a single AWS server without any third-party accounts:

1. **EC2 Instance**: Launch an AWS Graviton `t4g.micro` ($6.10/mo) or `t4g.small` ($12.20/mo).
   - *Tip*: Graviton (`t4g`) is **20% cheaper** and **40% faster** than Intel (`t3`).
2. **Orchestration**: `docker-compose -f docker-compose.yml up -d`.
   - Runs PostgreSQL, Redis, Express server, Next.js client, and Nginx on the same machine.
3. **Memory Hardening**:
   - The included [`deploy/aws/ec2-user-data.sh`](file:///e:/WORKPILOT-main/deploy/aws/ec2-user-data.sh) automatically creates a **4GB Swap File** on NVMe SSD.
   - Even on a 1GB RAM instance, your total available memory is **5GB**, preventing Out-Of-Memory (OOM) crashes during builds or traffic spikes.
   - Tuned memory parameters:
     - PostgreSQL memory is tuned to ~80MB (`shared_buffers=128MB`, `max_connections=50`).
     - Redis is capped at 128MB (`--maxmemory 128mb --maxmemory-policy allkeys-lru`).
     - Express heap is capped at 384MB (`--max-old-space-size=384`).
     - Next.js heap is capped at 400MB (`--max-old-space-size=400`).
4. **Expected AWS Bill: ~$6.10 to $12.20 / month!**

---

## 💡 3. Five AWS Tricks to Keep Your Bill at Absolute Minimum

### 1. Never Launch an AWS NAT Gateway
- An AWS NAT Gateway costs **$32.40/month** just to exist, plus $0.045 per GB transferred.
- Instead, place your EC2 instance in a public subnet with a free Elastic IP (EIP). Configure the host firewall with `ufw` (which [`deploy/aws/ec2-user-data.sh`](file:///e:/WORKPILOT-main/deploy/aws/ec2-user-data.sh) does automatically).

### 2. Never Use an Application Load Balancer (ALB) for Single Instances
- An AWS ALB costs **$16 to $25/month** minimum.
- Instead, use the included [`deploy/aws/nginx.conf`](file:///e:/WORKPILOT-main/deploy/aws/nginx.conf) or [`deploy/aws/nginx-single-domain.conf`](file:///e:/WORKPILOT-main/deploy/aws/nginx-single-domain.conf) with free Let's Encrypt SSL certificates.

### 3. Use AWS 1-Year Compute Savings Plans
- Once your instance is running, commit to a 1-year EC2 Savings Plan in the AWS Billing Console.
- This gives you an immediate **30% to 40% discount**, reducing a $12/month `t4g.small` to **~$7.50/month**.

### 4. Enable EBS gp3 Storage (Not gp2 or io2)
- Allocate **30GB gp3** for your root volume (30GB is covered under AWS Free Tier).
- `gp3` gives you 3,000 baseline IOPS and 125 MB/s throughput for free, whereas `io2` charges hundreds of dollars.

### 5. Put Cloudflare in Front of Your EC2 Instance (100% Free)
- Point your domain's nameservers to Cloudflare (Free Plan).
- Turn on the Orange Cloud (Proxy).
- Cloudflare will:
  - Cache Next.js static assets (`/_next/static/*`) at the edge, drastically reducing CPU/RAM load on your EC2 instance.
  - Provide free DDoS protection.
  - Provide free TLS encryption between visitors and Cloudflare.

---

## 🛠️ 4. Quick-Start Deployment for the Cheap Stack

```bash
# 1. Connect to your EC2 instance
ssh -i key.pem ubuntu@<YOUR_EC2_IP>

# 2. Run the instant setup (provisions Docker, 4GB Swap, SSM Agent)
sudo bash deploy/aws/setup-ec2.sh

# 3. Configure your environment
cd /home/ubuntu/app
cp .env.production.example .env
nano .env

# 4. Deploy all services
bash scripts/deploy-production.sh
```

Your services will start up, stay within memory bounds, and run reliably 24/7 without costly AWS managed services.
