"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { ActivityItem } from "@/lib/mock-data";

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  // Show only last 4–5 events
  const displayActivities = activities.slice(0, 5);

  return (
    <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-4 sm:p-5 shadow-sm dark:shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/5 mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">Recent activity</h3>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white/80 transition-colors cursor-pointer font-medium"
        >
          <span>View activity</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Events List */}
      <div className="divide-y divide-slate-100 dark:divide-white/3">
        {displayActivities.length === 0 ? (
          <div className="py-4 text-xs text-slate-500 dark:text-white/35">
            No recent activity yet.
          </div>
        ) : (
          displayActivities.map((item) => (
            <div
              key={item.id}
              className="py-2.5 flex items-center justify-between gap-4 text-xs group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/70 dark:bg-white/30 shrink-0" />
                <span className="text-slate-700 truncate group-hover:text-slate-900 dark:text-white/70 dark:group-hover:text-white/90 transition-colors font-medium">
                  {item.text}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-white/35 shrink-0 font-mono">
                {item.time}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
