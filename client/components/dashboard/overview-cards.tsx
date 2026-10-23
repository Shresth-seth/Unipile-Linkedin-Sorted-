"use client";

import React from "react";
import { Metrics } from "@/lib/mock-data";

interface OverviewCardsProps {
  metrics: Metrics;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ metrics }) => {
  const items = [
    {
      label: "Prospects",
      value: metrics.prospects,
      note: metrics.prospectsChange,
    },
    {
      label: "Connections",
      value: metrics.connections,
      note: metrics.connectionsRate,
    },
    {
      label: "Messages",
      value: metrics.messages,
      note: metrics.messagesDetail,
    },
    {
      label: "Replies",
      value: metrics.replies,
      note: metrics.repliesRate,
    },
  ];

  return (
    <div className="py-3.5 px-4 sm:px-6 rounded-xl bg-white dark:bg-white/1.5 border border-slate-200 dark:border-white/6 shadow-sm dark:shadow-none">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-white/5">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className={`${
              idx > 0 ? "pt-3 md:pt-0 md:pl-6" : ""
            } flex flex-col justify-center`}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white/95 tracking-tight font-heading">
                {item.value}
              </span>
              <span className="text-xs text-slate-600 dark:text-white/50 font-semibold">
                {item.label}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-white/35 mt-0.5 font-medium">
              {item.note}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OverviewCards;
