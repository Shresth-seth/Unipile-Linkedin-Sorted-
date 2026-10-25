# WP-12: Capacity, Resource Budgets & Concurrency Architecture

**Work Package:** WP-12 ("Measure Capacity and Operating Cost", Handover Pages 28–29)  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Date:** 2026-10-25  
**Harness Tests:** `server/src/__tests__/unit/capacity-and-cost.test.ts`

---

## 1. Process & Memory Budgets

All services in WorkPilot are bounded by strict memory limits to guarantee zero Out-Of-Memory (OOM) crashes on lean AWS EC2 instances (`t4g.small` / `t3.medium`):

| Component | Allocation | Enforcement Mechanism | Purpose |
| :--- | :--- | :--- | :--- |
| **Express Backend** | 384 MB | `NODE_OPTIONS="--max-old-space-size=384"` | Prevents API worker heap bloat |
| **Next.js Frontend** | 400 MB | `NODE_OPTIONS="--max-old-space-size=400"` | Bounded server-side rendering |
| **Redis Cache / Queue** | 128 MB | `--maxmemory 128mb --maxmemory-policy allkeys-lru` | LRU eviction under memory pressure |
| **PostgreSQL Internal** | ~128 MB | `shared_buffers=128MB -c max_connections=50` | Contained buffer cache |
| **Host Swap Memory** | 4,096 MB (4 GB) | NVMe SSD Swap configured in `setup-ec2.sh` | Absorbs traffic & build memory spikes |
| **Total System Footprint** | **~1,040 MB** | Fits comfortably within 2 GB RAM + 4 GB Swap | Zero OOM crashes |

---

## 2. Database Connection Pooling & Sizing

In `server/src/db/index.ts`:
```typescript
const poolMax = parseInt(process.env.DB_POOL_MAX || "10", 10);
const idleTimeout = parseInt(process.env.DB_IDLE_TIMEOUT || "20", 10);
const connectTimeout = parseInt(process.env.DB_CONNECT_TIMEOUT || "10", 10);

activeClient = postgres(databaseUrl, {
  prepare: false,
  max: poolMax,
  idle_timeout: idleTimeout,
  connect_timeout: connectTimeout,
});
```
- **Connection Ceiling:** 10 connections per Express node.
- **PostgreSQL Capacity:** 50 concurrent connections (supports up to 4 Express replica containers or background workers without pool starvation).

---

## 3. Concurrency Limits & Queue Throughput

- **Action Queue Worker:** Processed in batches of 10 (`dueJobs = await db.select().from(actionQueue).where(...).limit(10)`).
- **Daily Agent Execution:** Runs sequentially per tenant or staggered across business hours.
- **Safety Daily Quota:**
  - Maximum 25 new connections per day per LinkedIn account.
  - Maximum 50 direct messages per day per LinkedIn account.
  - Guarantees compliance with LinkedIn commercial usage limits.
