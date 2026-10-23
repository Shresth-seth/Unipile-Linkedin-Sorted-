"use client";

import React, { useEffect, useState } from "react";
import { BadgeIndianRupee, CalendarClock, Check, Loader2, ShieldCheck } from "lucide-react";
import { billingApi, SubscriptionSummary } from "@/lib/api";
import { isAxiosError } from "axios";

function errorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function BillingCard() {
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"checkout" | "cancel" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve()
      .then(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("plan") === "pro") {
          setCycle(params.get("cycle") === "yearly" ? "yearly" : "monthly");
          setMessage("Your Pro selection is ready. Review the billing cycle and continue to secure checkout.");
        }
        return billingApi.getSubscription();
      })
      .then((result) => setSubscription(result.subscription))
      .catch(() => setMessage("Billing details are temporarily unavailable."))
      .finally(() => setLoading(false));
  }, []);

  const startCheckout = async () => {
    setAction("checkout");
    setMessage(null);
    try {
      const result = await billingApi.createCheckout("PRO", cycle);
      if (!result.checkoutUrl) throw new Error(result.message || "Checkout is unavailable.");
      window.location.assign(result.checkoutUrl);
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Checkout could not be started."));
      setAction(null);
    }
  };

  const cancelPlan = async () => {
    if (!window.confirm("Cancel renewal at the end of the current billing period?")) return;
    setAction("cancel");
    setMessage(null);
    try {
      const result = await billingApi.cancel();
      setMessage(result.message);
      setSubscription((current) => current ? { ...current, cancelAtPeriodEnd: true } : current);
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Cancellation could not be scheduled."));
    } finally {
      setAction(null);
    }
  };

  const isPaid = subscription?.plan === "PRO" || subscription?.plan === "TEAM";
  const renewal = subscription?.currentPeriodEnd
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(subscription.currentPeriodEnd))
    : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/8 dark:bg-white/2" aria-labelledby="billing-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
            <BadgeIndianRupee className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="billing-heading" className="text-sm font-bold text-slate-900 dark:text-white">Plan and billing</h3>
              {!loading && (
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                  {subscription?.plan || "STARTER"}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-white/45">
              Manage automation access, renewal, and billing status for this workspace.
            </p>
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {!loading && !isPaid && (
        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-white/8">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-950 dark:text-white">₹{cycle === "monthly" ? "3,499" : "2,799"}</span>
                <span className="text-xs text-slate-500 dark:text-white/40">per month{cycle === "yearly" ? ", billed annually" : ""}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700 dark:text-white/60">
                {['Autonomous campaigns', '500 prospects monthly', 'Automated follow-ups'].map((feature) => (
                  <span key={feature} className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" />{feature}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-black/30">
                {(['monthly', 'yearly'] as const).map((item) => (
                  <button key={item} type="button" onClick={() => setCycle(item)} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${cycle === item ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-500 dark:text-white/45'}`}>{item}</button>
                ))}
              </div>
              <button type="button" onClick={startCheckout} disabled={action === "checkout"} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {action === "checkout" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && isPaid && (
        <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/8">
          <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-white/50">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" />{subscription?.status}</span>
            {renewal && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />{subscription?.cancelAtPeriodEnd ? `Access ends ${renewal}` : `Renews ${renewal}`}</span>}
          </div>
          {!subscription?.cancelAtPeriodEnd && (
            <button type="button" onClick={cancelPlan} disabled={action === "cancel"} className="self-start text-xs font-semibold text-slate-600 underline-offset-4 hover:text-red-600 hover:underline dark:text-white/50 dark:hover:text-red-400">Cancel renewal</button>
          )}
        </div>
      )}
      {message && <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-white/5 dark:text-white/60">{message}</p>}
    </section>
  );
}
