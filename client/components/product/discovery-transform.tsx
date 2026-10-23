"use client";

import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

export const DiscoveryTransform: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      {/* Left: Unstructured Intent */}
      <div className="lg:col-span-6 space-y-4">
        <div className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
          Input: Natural Language Goal
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/8 relative overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/50 mb-3 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>Unstructured User Prompt</span>
          </div>
          <p className="font-heading text-base sm:text-lg text-slate-950 dark:text-white font-semibold leading-relaxed">
            &quot;Connect me with founders of seed to Series A AI infrastructure
            companies across India who have recently posted about LLM evaluation
            or agent frameworks.&quot;
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-600 dark:text-white/50 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-700 dark:bg-blue-400" />
            <span>Parsed semantically by Gemini LLM engine</span>
          </div>
        </div>
      </div>

      {/* Middle Arrow for Desktop */}
      <div className="hidden lg:flex lg:col-span-1 justify-center">
        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center shadow-xs">
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>

      {/* Right: Structured Targeting Profile */}
      <div className="lg:col-span-5 space-y-4">
        <div className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
          Output: Structured Pipeline Criteria
        </div>
        <div className="rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/8 p-5 space-y-3 shadow-sm">
          {[
            {
              label: "Target Audience",
              value: "Founders, Co-Founders, Technical CEOs",
            },
            {
              label: "Target Industry",
              value: "Artificial Intelligence, LLM Infra, Developer Tooling",
            },
            {
              label: "Company Stage",
              value: "Seed to Series A (10–50 Employees)",
            },
            {
              label: "Geography",
              value: "India (Bengaluru, NCR, Hyderabad, Remote)",
            },
            {
              label: "Activity Intent Trigger",
              value: "Recent posts matching 'evals' or 'agents'",
            },
            {
              label: "Recommended Campaign",
              value: "7-Day Human-Paced Cycle (20/day)",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="p-2.5 rounded-lg bg-slate-50 dark:bg-white/2 border border-slate-200/80 dark:border-white/4 flex items-center justify-between text-xs"
            >
              <span className="text-slate-600 dark:text-white/45 font-mono text-[11px] font-medium">
                {item.label}
              </span>
              <span className="font-bold text-slate-950 dark:text-white/90 text-right max-w-50 truncate">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscoveryTransform;
