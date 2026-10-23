"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

interface FinalProductCTAProps {
  title?: string;
  subtitle?: string;
  primaryText?: string;
  primaryHref?: string;
  secondaryText?: string;
  secondaryHref?: string;
}

export const FinalProductCTA: React.FC<FinalProductCTAProps> = ({
  title = "Ready to build your first campaign?",
  subtitle = "Join founders, recruiters, and growth leaders turning natural language intent into structured outreach.",
  primaryText = "Get Started Free",
  primaryHref = "/register",
  secondaryText = "See Pricing",
  secondaryHref = "/pricing",
}) => {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-50 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/8 p-8 sm:p-12 text-center relative overflow-hidden backdrop-blur-sm shadow-xl dark:shadow-none">
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-[linear-linear(to_right,#00000005_1px,transparent_1px),linear-linear(to_bottom,#00000005_1px,transparent_1px)] dark:bg-[linear-linear(to_right,#ffffff05_1px,transparent_1px),linear-linear(to_bottom,#ffffff05_1px,transparent_1px)] bg-size-[2rem_2rem] pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-mono select-none">
              <Sparkles className="w-3.5 h-3.5" />
              <span>START CONNECTING WITH PURPOSE</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-bold font-heading text-slate-950 dark:text-white tracking-tight leading-tight">
              {title}
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-white/60 leading-relaxed max-w-xl mx-auto">
              {subtitle}
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href={primaryHref}
                className="w-full sm:w-auto h-11 px-7 rounded-full bg-blue-600 hover:bg-blue-500 text-white dark:bg-white dark:text-black dark:hover:bg-slate-100 font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 dark:shadow-[0_0_20px_-3px_rgba(255,255,255,0.4)] group cursor-pointer"
              >
                <span>{primaryText}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                href={secondaryHref}
                className="w-full sm:w-auto h-11 px-6 rounded-full bg-white hover:bg-slate-600 hover:text-white text-slate-800 border border-slate-900 dark:bg-white/4 dark:hover:bg-white/8 dark:text-white/80 dark:hover:text-white dark:border-white/10 text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer shadow-xs"
              >
                {secondaryText}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalProductCTA;
