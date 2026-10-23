"use client";

import React, { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

export const CampaignLifecycle: React.FC = () => {
  const [activeStage, setActiveStage] = useState(2); // Connected active

  const stages = [
    {
      id: 0,
      name: "Discovered",
      metric: "24 Prospects",
      desc: "Prospects retrieved by semantic relevance against target industry and company stage.",
    },
    {
      id: 1,
      name: "Qualified",
      metric: "18 Verified",
      desc: "Safety heuristics verify intent signals, active post history, and match scores ≥85%.",
    },
    {
      id: 2,
      name: "Connected",
      metric: "8 Requests Sent",
      desc: "Outreach is queued with configurable daily limits and randomized pacing intervals.",
    },
    {
      id: 3,
      name: "Engaged",
      metric: "4 Responses",
      desc: "Instant inbox alerts triggered when candidates accept or respond with positive intent.",
    },
    {
      id: 4,
      name: "Follow-up",
      metric: "Scheduled",
      desc: "Contextual nudge queued 48 hours post-acceptance if no initial response received.",
    },
  ];

  return (
    <div className="rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/8 p-6 sm:p-8 space-y-8 shadow-sm">
      {/* Horizontal Lifecycle Stages Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {stages.map((stage) => {
          const isCompleted = stage.id < activeStage;
          const isCurrent = stage.id === activeStage;

          return (
            <button
              key={stage.name}
              type="button"
              onClick={() => setActiveStage(stage.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                isCurrent
                  ? "bg-blue-50 border-blue-400 dark:bg-blue-500/10 dark:border-blue-500/40 shadow-xs"
                  : isCompleted
                    ? "bg-slate-50 border-slate-200 dark:bg-white/2 dark:border-white/8"
                    : "bg-slate-50/50 border-slate-200/60 dark:bg-white/1 dark:border-white/4 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-blue-700 dark:bg-blue-400 animate-pulse" />
                ) : (
                  <Circle className="w-3 h-3 text-slate-400 dark:text-white/30" />
                )}
                <span className="text-xs font-bold text-slate-950 dark:text-white/90">
                  {stage.name}
                </span>
              </div>
              <span className="text-[11px] font-mono text-blue-700 dark:text-blue-400 font-semibold block">
                {stage.metric}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Stage Detail Card */}
      <div className="p-5 rounded-xl bg-slate-50 dark:bg-white/1.5 border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-slate-950 dark:text-white/90 text-sm">
            Stage {activeStage + 1}: {stages[activeStage].name}
          </div>
          <p className="text-slate-700 dark:text-white/60 leading-relaxed max-w-xl font-medium">
            {stages[activeStage].desc}
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400 font-mono text-xs font-semibold shrink-0 self-start sm:self-auto">
          Automated by WORKPILOT Engine
        </div>
      </div>
    </div>
  );
};

export default CampaignLifecycle;
