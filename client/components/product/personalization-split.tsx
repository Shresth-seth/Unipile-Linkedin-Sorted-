"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export const PersonalizationSplit: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      {/* Left: Candidate Profile Context */}
      <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/8 p-6 sm:p-7 space-y-5 flex flex-col justify-between shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/6">
            <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Prospect Contextual Signal
            </span>
            <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-transparent px-2 py-0.5 rounded-full font-bold">
              94% Match
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-600/20 dark:text-blue-400 dark:border-transparent font-bold text-sm flex items-center justify-center">
              AM
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white/95">
                Arjun Mehta
              </h3>
              <p className="text-xs text-slate-600 dark:text-white/50 font-medium">
                Founder & CEO at Nexa AI · Bengaluru
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-200/80 dark:border-white/4 space-y-2 text-xs">
            <div className="font-bold text-slate-900 dark:text-white/80">
              Extracted Public Context:
            </div>
            <ul className="space-y-1.5 text-slate-700 dark:text-white/60 text-[11px] list-disc list-inside font-medium">
              <li>
                Building low-latency agent orchestration tooling for enterprise
                LLMs
              </li>
              <li>
                Recent post: &quot;Published benchmarks comparing synchronous
                evals vs edge queues&quot;
              </li>
              <li>Background: Ex-Staff ML Engineer, founded team in 2024</li>
            </ul>
          </div>
        </div>

        <div className="pt-2 text-[11px] text-slate-600 dark:text-white/40 flex items-center gap-2 font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-700 dark:bg-blue-400 animate-pulse" />
          <span>
            WORKPILOT synthesizes personalized relevance without canned
            templates
          </span>
        </div>
      </div>

      {/* Right: AI Generated Message */}
      <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/8 p-6 sm:p-7 space-y-4 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/6 mb-4">
            <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tailored Outreach Note</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-white/35 font-mono font-medium">
              278 chars · Within LinkedIn 300-char limit
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 text-xs sm:text-sm text-slate-900 dark:text-white/90 leading-relaxed font-sans space-y-2.5 font-medium">
            <p>Hey Arjun,</p>
            <p>
              Came across Nexa AI while researching developer tooling for LLM
              architectures.
            </p>
            <p>
              Your recent breakdown on evaluation latency caught my eye — we
              tackled a very similar challenge by decoupling pacing queues from
              model inference at WORKPILOT.
            </p>
            <p>
              Would love to connect and trade notes on edge agent orchestration!
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-white/4 flex items-center justify-between text-xs text-slate-600 dark:text-white/50">
          <span>
            Human review required:{" "}
            <strong className="text-slate-900 dark:text-white font-semibold">
              False (Safe threshold met)
            </strong>
          </span>
          <span className="text-blue-700 dark:text-blue-400 font-mono font-bold">
            Ready to queue
          </span>
        </div>
      </div>
    </div>
  );
};

export default PersonalizationSplit;
