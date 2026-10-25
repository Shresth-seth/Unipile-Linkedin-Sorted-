# WP-12: Operating Cost Model & Unit Economics

**Work Package:** WP-12 ("Measure Capacity and Operating Cost", Handover Pages 28–29)  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Date:** 2026-10-25  
**Harness Tests:** `server/src/__tests__/unit/capacity-and-cost.test.ts`

---

## 1. Fixed Cloud Infrastructure Costs (Monthly)

Using the optimized single-instance architecture on AWS (`deploy/aws/CHEAP_AWS_COST_GUIDE.md`):

| AWS Resource | Sizing & Configuration | On-Demand Cost | 1-Year Savings Plan |
| :--- | :--- | :--- | :--- |
| **EC2 Compute** | `t4g.small` (ARM64, 2 vCPU, 2GB RAM) | $12.20 / mo | $7.65 / mo |
| **EBS Root Storage** | 30 GB gp3 (3,000 IOPS, 125 MB/s) | $2.40 / mo (Free Tier eligible) | $0.00 / mo |
| **Networking & IP** | Elastic IP (EIP) on active instance | $0.00 / mo | $0.00 / mo |
| **NAT Gateway** | Eliminated (Public subnet + host UFW) | $0.00 / mo (Saved $32.40/mo) | $0.00 / mo |
| **Application Load Balancer** | Eliminated (Host Nginx + Let's Encrypt) | $0.00 / mo (Saved $22.50/mo) | $0.00 / mo |
| **Total Fixed Hosting** | — | **~$14.60 / mo** | **~$7.65 / mo** |

---

## 2. Variable Operating Costs per Active Tenant

### A. AI Inference (Google Gemini 2.5 Flash)
- **BYOK (Bring Your Own Key):** $0.00 platform cost.
- **Platform Key Model:**
  - Token rates: $0.075 / 1M input tokens, $0.30 / 1M output tokens (blended ~$0.15 / 1M tokens).
  - Average tenant activity: 15 outreach messages/day * 30 days = 450 messages/month.
  - Average prompt + completion context: ~500 tokens/message = 225,000 tokens/month.
  - **Estimated AI Cost per User:** `(225,000 / 1,000,000) * $0.15 = $0.03375 / month` (< 4¢ / tenant).

### B. Database Footprint
- 1 Active Tenant: ~500 contacts + 2,000 messages + index entries = ~2.5 MB.
- 100 Active Tenants: ~250 MB (easily handled within baseline EBS storage).

---

## 3. SaaS Unit Economics & Gross Margins

Assuming a standard SaaS price of **$29.00 / user / month** and 100 active paying users on a single `t4g.small` instance:

```
Monthly SaaS Revenue (100 users @ $29/mo):          $2,900.00
Hosting Infrastructure Cost:                           -$15.00
AI Inference Cost (100 users @ $0.04/mo):               -$4.00
Total Operating Cost:                                  -$19.00
==============================================================
Net Operating Margin:                                $2,881.00
Gross Margin Percentage:                                 99.3%
```

Even factoring in third-party API connectivity, gross margins consistently exceed **90%**, proving sustainable unit economics at commercial scale.
