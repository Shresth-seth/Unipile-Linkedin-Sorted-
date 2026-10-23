"use client";

import React, { useState } from "react";
import { CheckCircle2, Circle, Sparkles, X, ArrowRight } from "lucide-react";

interface OnboardingChecklistProps {
  isLinkedInConnected: boolean;
  hasCampaign: boolean;
  onConnectLinkedIn: () => void;
  onNewCampaign: () => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  isLinkedInConnected,
  hasCampaign,
  onConnectLinkedIn,
  onNewCampaign,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (isLinkedInConnected && hasCampaign)) return null;

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/20 backdrop-blur-xl p-4 sm:p-5 shadow-lg relative select-none">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3.5 top-3.5 p-1 rounded-lg text-slate-400 hover:text-white"
        aria-label="Dismiss setup guide"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Workspace Setup Guide</span>
          </div>
          <p className="text-xs text-slate-300">
            Complete these two quick steps to begin autonomous outreach with verified safety.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Step 1: Account */}
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Account created</span>
          </div>

          {/* Step 2: LinkedIn */}
          {isLinkedInConnected ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>LinkedIn connected</span>
            </div>
          ) : (
            <button
              onClick={onConnectLinkedIn}
              className="flex items-center gap-1.5 text-cyan-300 hover:text-white font-medium underline underline-offset-2"
            >
              <Circle className="w-4 h-4 text-cyan-400" />
              <span>Connect LinkedIn</span>
            </button>
          )}

          {/* Step 3: Campaign */}
          {hasCampaign ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Campaign launched</span>
            </div>
          ) : (
            <button
              onClick={onNewCampaign}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white font-medium"
            >
              <Circle className="w-4 h-4 text-slate-500" />
              <span>Launch first campaign</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingChecklist;
