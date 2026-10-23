"use client";

import React from "react";
import { Play, Pause, ArrowRight } from "lucide-react";
import { Campaign } from "@/lib/mock-data";

interface CampaignCardProps {
  campaign: Campaign | null;
  onPauseToggle: () => void;
  onFocusChat: () => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  onPauseToggle,
  onFocusChat,
}) => {
  if (!campaign) {
    return (
      <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 h-full flex flex-col justify-between shadow-sm dark:shadow-none">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider mb-3">
            Current Campaign
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white/90">
              No active campaign
            </h4>
            <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
              Describe your outreach goal in the composer above to begin.
            </p>
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={onFocusChat}
            className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Create first campaign</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const isRunning = campaign.status === "Running";
  const progressPercent = Math.min(
    100,
    Math.round((campaign.currentDay / campaign.totalDays) * 100),
  );

  return (
    <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 flex flex-col justify-between gap-4 shadow-sm dark:shadow-none">
      {/* Top row: Label + Title + Status */}
      <div>
        <div className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider mb-2">
          Current Campaign
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white/90">
              {campaign.name}
            </h3>
            <div className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              Day {campaign.currentDay} of {campaign.totalDays}
            </div>
          </div>

          {/* Minimal status badge */}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
              isRunning
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-transparent"
                : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-transparent"
            }`}
          >
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/6 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isRunning ? "bg-blue-600 dark:bg-blue-500" : "bg-amber-500 dark:bg-amber-400/60"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-white/40 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
          <span>{campaign.discovered} prospects</span>
          <span>·</span>
          <span>{campaign.qualified} qualified</span>
          <span>·</span>
          <span>{campaign.connected} connected</span>
          <span>·</span>
          <span>{campaign.replies} replies</span>
        </div>
      </div>

      {/* Footer: Next check & Action button */}
      <div className="pt-2 border-t border-slate-200 dark:border-white/4 flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-white/40 text-[11px]">
          Next check {campaign.nextCheckTime.toLowerCase()}
        </span>

        <button
          onClick={onPauseToggle}
          className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-white/8 hover:border-slate-400 dark:hover:border-white/20 bg-white hover:bg-slate-50 dark:bg-transparent dark:hover:bg-transparent text-slate-700 hover:text-slate-900 dark:text-white/70 dark:hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
        >
          {isRunning ? (
            <>
              <Pause className="w-3 h-3 text-amber-500" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 text-emerald-500" />
              <span>Resume</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CampaignCard;
