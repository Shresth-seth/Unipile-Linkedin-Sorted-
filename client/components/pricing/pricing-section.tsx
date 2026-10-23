"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  PRICING_PLANS,
  COMPARISON_FEATURES,
  PRICING_FAQS,
} from "@/lib/pricing";

export const PricingSection: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-20 sm:space-y-24">
      {/* 1. Monthly / Yearly Toggle */}
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="p-1 rounded-full bg-slate-200/80 dark:bg-white/4 border border-slate-300 dark:border-white/8 flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
              billingCycle === "monthly"
                ? "bg-blue-600 text-white dark:bg-white dark:text-black font-semibold shadow-sm"
                : "text-slate-700 hover:text-black dark:text-white/60 dark:hover:text-white"
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
              billingCycle === "yearly"
                ? "bg-blue-600 text-white dark:bg-white dark:text-black font-semibold shadow-sm"
                : "text-slate-700 hover:text-black dark:text-white/60 dark:hover:text-white"
            }`}
          >
            <span>Annual Billing</span>
            <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/15 px-1.5 py-0.2 rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* 2. Three Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {PRICING_PLANS.map((plan) => {
          const price =
            billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all relative ${
                plan.popular
                  ? "bg-white dark:bg-white/3 border-2 border-blue-600 dark:border-blue-500/40 shadow-xl shadow-blue-600/10 dark:shadow-blue-950/20"
                  : "bg-white dark:bg-white/1.5 border border-slate-200 dark:border-white/7 hover:border-slate-300 dark:hover:border-white/12 shadow-sm"
              }`}
            >
              {/* Badge for Pro */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white font-mono text-[10px] font-bold uppercase tracking-wider shadow-sm">
                  {plan.badge}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-white/95 font-heading">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-white/50 mt-1 leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                {/* Price Display */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white tracking-tight font-heading">
                      {plan.currency}
                      {price.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-white/40 font-mono">
                      / month
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-white/35 block mt-0.5">
                    {billingCycle === "yearly"
                      ? "Billed annually"
                      : "Billed monthly"}
                  </span>
                </div>

                {/* Feature List */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-white/40 uppercase tracking-wider block font-semibold">
                    What&apos;s Included
                  </span>
                  {plan.features.map((feat) => (
                    <div
                      key={feat}
                      className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-white/75"
                    >
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA Button */}
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-white/5">
                <Link
                  href={plan.id === "pro" ? `${plan.ctaHref}?plan=pro&cycle=${billingCycle}` : plan.ctaHref}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    plan.popular
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25"
                      : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-slate-100 shadow-sm"
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Detailed Comparison Table */}
      <div className="space-y-6 pt-10 border-t border-slate-200 dark:border-white/6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-950 dark:text-white">
            Compare plans & capabilities
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/50">
            A granular overview of limits, personalization depth, and proxy
            safety rules.
          </p>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-xl bg-white dark:bg-white/1.5 border border-slate-200 dark:border-white/6 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 text-[11px] font-mono text-slate-500 dark:text-white/40 uppercase tracking-wider bg-slate-50 dark:bg-transparent">
                <th className="py-3.5 px-5">Feature</th>
                <th className="py-3.5 px-5">Starter</th>
                <th className="py-3.5 px-5 text-blue-600 dark:text-blue-400 font-semibold">
                  Pro (Recommended)
                </th>
                <th className="py-3.5 px-5">Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/4">
              {COMPARISON_FEATURES.map((row) => (
                <tr
                  key={row.feature}
                  className="hover:bg-slate-50/80 dark:hover:bg-white/2 transition-colors"
                >
                  <td className="py-3 px-5 font-semibold text-slate-800 dark:text-white/80">
                    {row.feature}
                  </td>
                  <td className="py-3 px-5 text-slate-600 dark:text-white/60">
                    {typeof row.starter === "boolean" ? (
                      row.starter ? (
                        <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <span className="text-slate-400 dark:text-white/25">
                          —
                        </span>
                      )
                    ) : (
                      row.starter
                    )}
                  </td>
                  <td className="py-3 px-5 text-blue-600 dark:text-blue-300 font-semibold">
                    {typeof row.pro === "boolean" ? (
                      row.pro ? (
                        <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <span className="text-slate-400 dark:text-white/25">
                          —
                        </span>
                      )
                    ) : (
                      row.pro
                    )}
                  </td>
                  <td className="py-3 px-5 text-slate-600 dark:text-white/60">
                    {typeof row.team === "boolean" ? (
                      row.team ? (
                        <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <span className="text-slate-400 dark:text-white/25">
                          —
                        </span>
                      )
                    ) : (
                      row.team
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Accordion / Cards */}
        <div className="md:hidden space-y-2.5">
          {COMPARISON_FEATURES.map((row) => (
            <div
              key={row.feature}
              className="p-3.5 rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 text-xs space-y-2 shadow-xs"
            >
              <div className="font-semibold text-slate-900 dark:text-white/90">
                {row.feature}
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-white/60 pt-1 border-t border-slate-100 dark:border-white/4">
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-white/30 block">
                    Starter
                  </span>
                  <span>{String(row.starter)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-semibold">
                    Pro
                  </span>
                  <span className="text-blue-600 dark:text-blue-300 font-medium">
                    {String(row.pro)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-white/30 block">
                    Team
                  </span>
                  <span>{String(row.team)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Frequently Asked Questions */}
      <div className="space-y-6 pt-10 border-t border-slate-200 dark:border-white/6 max-w-3xl mx-auto">
        <div className="text-center space-y-2">
          <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-950 dark:text-white">
            Frequently asked questions
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/50">
            Clear answers on billing, LinkedIn accounts, and proxy safety.
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5 rounded-xl bg-white dark:bg-white/1.5 border border-slate-200 dark:border-white/6 shadow-sm">
          {PRICING_FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;

            return (
              <div key={faq.question} className="p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between text-left text-xs sm:text-sm font-semibold text-slate-900 dark:text-white/90 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 dark:text-white/40 shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 dark:text-white/40 shrink-0 ml-2" />
                  )}
                </button>

                {isOpen && (
                  <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-white/60 leading-relaxed">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PricingSection;
