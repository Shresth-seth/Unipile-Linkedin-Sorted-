"use client";

import React, { useState } from "react";
import { ActivityItem } from "@/lib/mock-data";

interface ActivityViewProps {
  activities: ActivityItem[];
}

export const ActivityView: React.FC<ActivityViewProps> = ({ activities }) => {
  const [filter, setFilter] = useState<string>("all");

  const filtered = activities.filter((a) => {
    if (filter === "all") return true;
    return a.type === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white/90 tracking-tight">
              Activity & Audit History
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
              Live Log
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/45 mt-1 font-medium">
            Real-time chronology of candidate evaluations, connections, and
            campaign events.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: "all", label: "All Events" },
            { id: "connect", label: "Connections" },
            { id: "reply", label: "Replies" },
            { id: "qualify", label: "Evaluations" },
            { id: "start", label: "Campaign" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === tab.id
                  ? "bg-blue-600 text-white font-semibold shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/80 dark:bg-white/2 dark:text-white/50 dark:hover:text-white/80 dark:hover:bg-white/4 dark:border-transparent font-medium"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 shadow-xs">
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-white/40 font-medium">
              No activity logged yet. Action events, connection triggers, and
              replies will appear here in real-time.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3.5 pb-3 border-b border-slate-100 dark:border-white/4 last:border-0 last:pb-0"
              >
                <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                </div>

                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="text-xs text-slate-800 dark:text-white/85 leading-relaxed">
                    <span>{item.text}</span>
                    {item.highlight && (
                      <span className="text-blue-700 dark:text-blue-400 font-semibold ml-1.5">
                        [{item.highlight}]
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-white/35 font-mono shrink-0 font-medium">
                    {item.time}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityView;
