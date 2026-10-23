"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Compass,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface CampaignBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchCampaign: (name: string, query: string, durationDays: number, type?: "DISCOVERY" | "ENGAGEMENT", dailyLimit?: number) => Promise<void>;
}

export const CampaignBuilder: React.FC<CampaignBuilderProps> = ({
  isOpen,
  onClose,
  onLaunchCampaign,
}) => {
  const [campaignType, setCampaignType] = useState<"DISCOVERY" | "ENGAGEMENT">("DISCOVERY");
  const [name, setName] = useState("Q3 AI Founder Outreach");
  const [targetAudience, setTargetAudience] = useState("AI Founders & CTOs");
  const [goal, setGoal] = useState(
    "Contextual networking and introductory outreach",
  );
  const [duration, setDuration] = useState(7);
  const [dailyLimit, setDailyLimit] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      await onLaunchCampaign(name.trim(), targetAudience.trim(), duration, campaignType, dailyLimit);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Campaign could not be launched.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0c0d12] p-6 sm:p-8 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border border-blue-100 dark:border-transparent">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                Create New Campaign
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Define campaign intent and automated safety limits.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campaign Type Toggle */}
          <div className="flex bg-slate-100 dark:bg-black/40 p-1 rounded-xl border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setCampaignType("DISCOVERY");
                setTargetAudience("AI Founders & CTOs");
                setName("Q3 AI Founder Outreach");
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                campaignType === "DISCOVERY"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              Discovery (New Leads)
            </button>
            <button
              type="button"
              onClick={() => {
                setCampaignType("ENGAGEMENT");
                setTargetAudience("All 1st Degree Connections");
                setName("Q3 Network Nurturing");
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                campaignType === "ENGAGEMENT"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              Engagement (Existing)
            </button>
          </div>

          {/* Campaign Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Campaign Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={campaignType === "DISCOVERY" ? "e.g. AI Founders & Engineers" : "e.g. Network Nurturing"}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/15 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-black/60 shadow-xs transition-all"
            />
          </div>

          {/* Audience / Query */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {campaignType === "DISCOVERY" 
                ? "Who do you want to reach? (Target Roles & Industry)" 
                : "Filter existing connections (e.g., 'CTO', 'Founders') or leave blank for all"}
            </label>
            <textarea
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              required={campaignType === "DISCOVERY"}
              rows={2}
              placeholder={campaignType === "DISCOVERY" 
                ? "e.g. AI Founders, Lead Engineers, SaaS Tech Executives in India..." 
                : "e.g. Filter by role or industry among your 1st-degree connections..."}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/15 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-black/60 shadow-xs transition-all resize-none"
            />
          </div>

          {/* Outreach Goal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              What is your primary goal?
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Discuss collaboration, partnership, or product feedback"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/15 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-black/60 shadow-xs transition-all"
            />
          </div>

          {/* Duration & Daily Limit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Cycle Duration
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[3, 7, 14].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                      duration === d
                        ? "bg-blue-50 text-blue-700 border border-blue-300 shadow-xs dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-500/40"
                        : "bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    }`}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Daily Action Limit</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                  Guardrails enabled
                </span>
              </label>
              <input
                type="number"
                min={5}
                max={30}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/15 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-black/60 shadow-xs"
              />
            </div>
          </div>

          {/* Safety note */}
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-cyan-950/20 border border-blue-200 dark:border-cyan-500/20 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">
              Actions are paced through configured daily limits and can be
              paused from the automation control center.
            </span>
          </div>

          {/* Buttons */}
          {submitError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {submitError}
            </p>
          )}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-full border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-white-force dark:bg-white dark:text-black dark:hover:bg-slate-100 font-semibold text-xs sm:text-sm transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span>{submitting ? "Launching..." : "Launch Campaign"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CampaignBuilder;
