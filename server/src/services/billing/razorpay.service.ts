import crypto from "node:crypto";

export type PaidPlan = "PRO";
export type BillingCycle = "monthly" | "yearly";

interface RazorpaySubscription {
  id: string;
  status: string;
  short_url?: string;
  current_end?: number;
}

class RazorpayService {
  private get credentials() {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret) {
      throw new Error("Billing is not configured yet.");
    }
    return { keyId, keySecret };
  }

  private planId(plan: PaidPlan, cycle: BillingCycle): string {
    const envName = `RAZORPAY_PLAN_${plan}_${cycle.toUpperCase()}`;
    const id = process.env[envName]?.trim();
    if (!id) throw new Error(`${envName} is not configured.`);
    return id;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const { keyId, keySecret } = this.credentials;
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const body = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      throw new Error(body?.error?.description || "Billing provider request failed.");
    }
    return body as T;
  }

  async createSubscription(input: {
    userId: string;
    email: string;
    plan: PaidPlan;
    cycle: BillingCycle;
  }): Promise<RazorpaySubscription> {
    return this.request<RazorpaySubscription>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: this.planId(input.plan, input.cycle),
        total_count: input.cycle === "monthly" ? 120 : 10,
        quantity: 1,
        customer_notify: 1,
        notes: {
          workpilot_user_id: input.userId,
          workpilot_plan: input.plan,
          billing_cycle: input.cycle,
          customer_email: input.email,
        },
      }),
    });
  }

  async getSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
    return this.request<RazorpaySubscription>(`/subscriptions/${subscriptionId}`, { method: "GET" });
  }

  async cancelSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
    return this.request<RazorpaySubscription>(`/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancel_at_cycle_end: 1 }),
    });
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!secret || !signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const actual = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
  }
}

export const razorpayService = new RazorpayService();
