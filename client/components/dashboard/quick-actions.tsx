"use client";

import React, { useState } from "react";
import { Plus, Upload, MessageSquare, Sparkles, Check } from "lucide-react";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";

interface QuickActionsProps {
  onNewCampaign: () => void;
  onConnectLinkedIn: () => void;
  isLinkedInConnected: boolean;
  onFilterReplies: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNewCampaign,
  onConnectLinkedIn,
  isLinkedInConnected,
  onFilterReplies,
}) => {
  const [importNotice, setImportNotice] = useState(false);

  const handleImportClick = () => {
    setImportNotice(true);
    setTimeout(() => setImportNotice(false), 2500);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* 1. New Campaign */}
      <button
        onClick={onNewCampaign}
        className="p-3.5 rounded-xl border border-white/10 bg-WORKPILOT-dark/85 hover:bg-white/4 hover:border-cyan-500/30 transition-all text-left group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono text-slate-400">Launch</span>
        </div>
        <div className="font-semibold text-white text-xs sm:text-sm">
          New Campaign
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          Orchestrate goal
        </div>
      </button>

      {/* 2. Import Prospects */}
      <button
        onClick={handleImportClick}
        className="p-3.5 rounded-xl border border-white/10 bg-WORKPILOT-dark/85 hover:bg-white/4 hover:border-cyan-500/30 transition-all text-left group cursor-pointer relative"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            {importNotice ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-400">CSV/List</span>
        </div>
        <div className="font-semibold text-white text-xs sm:text-sm">
          {importNotice ? "Sample CSV Ready" : "Import Prospects"}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {importNotice ? "12 profiles mapped" : "CSV or Sales Nav"}
        </div>
      </button>

      {/* 3. Connect LinkedIn */}
      <button
        onClick={onConnectLinkedIn}
        className="p-3.5 rounded-xl border border-white/10 bg-WORKPILOT-dark/85 hover:bg-white/4 hover:border-cyan-500/30 transition-all text-left group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-[#0077B5]/15 text-[#0077B5] group-hover:scale-110 transition-transform">
            <LinkedInIcon className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {isLinkedInConnected ? "Active" : "Proxy"}
          </span>
        </div>
        <div className="font-semibold text-white text-xs sm:text-sm truncate">
          {isLinkedInConnected ? "Account Connected" : "Connect LinkedIn"}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {isLinkedInConnected ? "Proxy 104.28.19.42" : "Cloud authorization"}
        </div>
      </button>

      {/* 4. View Replies */}
      <button
        onClick={onFilterReplies}
        className="p-3.5 rounded-xl border border-white/10 bg-WORKPILOT-dark/85 hover:bg-white/4 hover:border-cyan-500/30 transition-all text-left group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono text-slate-400">Inbox</span>
        </div>
        <div className="font-semibold text-white text-xs sm:text-sm">
          View Replies
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          4 conversations active
        </div>
      </button>
    </div>
  );
};

export default QuickActions;
