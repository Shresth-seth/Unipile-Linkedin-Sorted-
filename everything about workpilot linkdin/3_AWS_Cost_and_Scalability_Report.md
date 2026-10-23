# WorkPilot - AWS Cost & Scalability Estimation Report

## 💰 AWS Cost Estimation (Paid Tier)
This estimate assumes a moderately scaled, fault-tolerant deployment using **AWS EC2 (Docker-Compose)** or **AWS ECS (Fargate)**, alongside a managed Database. 

### Option A: Standard Startup Deployment (EC2 + Neon Postgres)
Suitable for up to 5,000 active concurrent users.

1. **Compute (EC2)**
   - Instance: `t4g.medium` (ARM-based, 2 vCPU, 4GB RAM)
   - Monthly Cost: ~$25 - $30 / month.
2. **Database (Neon Serverless Postgres)**
   - Neon Scale-to-Zero (Launch Tier) or Pro Tier.
   - Monthly Cost: $0 to $19 / month (Usage based).
3. **Networking & Load Balancer (ALB)**
   - Monthly Cost: ~$20 - $25 / month.
4. **Storage & Backups (EBS & S3)**
   - ~30GB SSD Storage.
   - Monthly Cost: ~$5 / month.
5. **Route53 (DNS)**
   - Monthly Cost: ~$1 / month.

**Total Estimated Monthly Cost (EC2 Route):** ~$60 - $80 / month.

---

### Option B: High-Availability Enterprise Deployment (AWS ECS Fargate + AWS RDS)
Suitable for 10,000 to 50,000+ concurrent users with Auto-Scaling.

1. **Compute (AWS ECS Fargate)**
   - 2x Frontend Tasks (1 vCPU, 2GB RAM each) -> ~$30/month
   - 2x Backend Tasks (1 vCPU, 2GB RAM each) -> ~$30/month
   - Monthly Cost: ~$60 / month.
2. **Database (AWS RDS PostgreSQL - Single-AZ/Multi-AZ)**
   - Instance: `db.t4g.large` (2 vCPU, 8GB RAM).
   - Monthly Cost: ~$100 - $200 / month.
3. **Load Balancer & NAT Gateway**
   - Application Load Balancer + NAT Gateway for private subnets.
   - Monthly Cost: ~$60 / month.
4. **ElastiCache (Redis - for sessions/queues if added)**
   - `cache.t4g.micro` -> ~$15 / month.

**Total Estimated Monthly Cost (Fargate/RDS Route):** ~$235 - $335 / month.

---

## 📈 Capacity & Extent (How many users can we onboard?)

### With the Standard EC2 (`t4g.medium`) Setup:
- **Max Concurrent Users**: ~1,000 to 2,500 users simultaneously making requests.
- **Total Registered Users**: Unlimited (dependent on Database Storage, usually easily supporting 100,000+ profiles).
- **LinkedIn Automation Extent**: The bottleneck is **Unipile API rate limits**, not your server. If you schedule 50 messages/day per user, a standard server can easily manage a queue for 10,000 users.

### With Auto-Scaling (ECS Fargate + RDS):
- **Max Concurrent Users**: Horizontally scales. If traffic spikes, Fargate boots new containers in ~60 seconds. Can handle 50,000+ concurrent users seamlessly.
- **Total Registered Users**: 1 Million+ 
- **Database Extent**: RDS Postgres can scale up to 64TB of storage and 128 vCPUs, handling enterprise-grade analytical loads.

### Key Third-Party Bottlenecks to Watch:
1. **Unipile API Limits**: Ensure your API plan matches the volume of users connecting their LinkedIn accounts.
2. **Gemini AI Quotas**: Pay attention to RPM (Requests Per Minute) limits on the Google GenAI console.
3. **Neon Postgres Conn Limits**: Ensure connection pooling (PgBouncer) is active if deploying Serverless functions to avoid connection exhaustion.
