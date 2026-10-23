"use client";

import React from "react";
import {
  Compass,
  Plus,
  Play,
  Pause,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Filter,
} from "lucide-react";
import { Campaign } from "@/lib/mock-data";

interface CampaignsViewProps {
  campaign: Campaign | null;
  onPauseToggle: () => void;
  onNewCampaign: () => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaign,
  onPauseToggle,
  onNewCampaign,
}) => {
  const isRunning = campaign?.status === "Running";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white/90 tracking-tight">
            Campaigns
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/45 mt-1 font-medium">
            Manage your active and completed outreach campaigns.
          </p>
        </div>

        <button
          onClick={onNewCampaign}
          className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-white-force font-semibold text-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Active Campaign Card */}
      {campaign ? (
        <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 sm:p-6 space-y-5 shadow-sm dark:shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider">
                  Active Campaign
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isRunning
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-transparent"
                      : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-transparent"
                  }`}
                >
                  {campaign.status}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white/95">
                {campaign.name}
              </h2>
              <p className="text-xs text-slate-600 dark:text-white/45 mt-0.5 font-medium">
                Target: {campaign.targetQuery}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onPauseToggle}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/8 hover:border-slate-400 dark:hover:border-white/20 text-slate-700 hover:text-slate-900 dark:text-white/70 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-50 dark:bg-transparent shadow-xs"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Resume</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress Strip */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-white/60 font-medium">
                Cycle Progress: Day {campaign.currentDay} of{" "}
                {campaign.totalDays}
              </span>
              <span className="text-blue-700 dark:text-blue-400 font-mono font-bold">
                {Math.round((campaign.currentDay / campaign.totalDays) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isRunning ? "bg-blue-600" : "bg-amber-500"
                }`}
                style={{
                  width: `${Math.round(
                    (campaign.currentDay / campaign.totalDays) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Stat Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-white/4">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/1.5 border border-slate-200 dark:border-white/4">
              <span className="text-[11px] text-slate-500 dark:text-white/40 block font-medium">
                Discovered
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-white/90 font-heading">
                {campaign.discovered}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/1.5 border border-slate-200 dark:border-white/4">
              <span className="text-[11px] text-slate-500 dark:text-white/40 block font-medium">Qualified</span>
              <span className="text-base font-bold text-blue-700 dark:text-blue-400 font-heading">
                {campaign.qualified}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/1.5 border border-slate-200 dark:border-white/4">
              <span className="text-[11px] text-slate-500 dark:text-white/40 block font-medium">Connected</span>
              <span className="text-base font-bold text-slate-900 dark:text-white/90 font-heading">
                {campaign.connected}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/1.5 border border-slate-200 dark:border-white/4">
              <span className="text-[11px] text-slate-500 dark:text-white/40 block font-medium">Replies</span>
              <span className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-heading">
                {campaign.replies}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 text-center space-y-3 shadow-sm dark:shadow-none">
          <Compass className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">
            No Active Campaigns
          </h3>
          <p className="text-xs text-slate-600 dark:text-white/40 max-w-sm mx-auto font-medium">
            Launch your first intelligent outreach campaign to discover verified
            prospects.
          </p>
          <button
            onClick={onNewCampaign}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-white-force font-semibold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Campaign</span>
          </button>
        </div>
      )}

      {/* Historical Campaigns List */}
      <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-4 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">
          Previous Campaigns
        </h3>
        <div className="py-6 text-center text-xs text-slate-500 dark:text-white/40 font-medium">
          No archived campaigns yet. As your cycles finish, completed campaign
          runs will be logged here.
        </div>
      </div>
    </div>
  );
};

export default CampaignsView;
