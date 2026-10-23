"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Bot,
  Users,
  Play,
} from "lucide-react";
import { motion } from "motion/react";

export const ProductHeroPreview: React.FC = () => {
  return (
    <div className="relative rounded-2xl bg-[#07090e] border border-white/8 shadow-2xl overflow-hidden p-5 sm:p-7 backdrop-blur-xl">
      {/* Top OS Window Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/6 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-2 text-xs font-mono text-white/40">
            WORKPILOT.workspace / campaign-orchestrator
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            AI Reasoning Engine Online
          </span>
        </div>
      </div>

      {/* Main Command Composer Simulation */}
      <div className="rounded-xl bg-white/2 border border-white/7 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-blue-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask WORKPILOT</span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">
            Autonomous Intent Parser
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 font-mono text-xs sm:text-sm text-white/90 leading-relaxed">
          &quot;Find AI founders in India building developer tools and SaaS
          platforms, then prepare a 7-day contextual outreach campaign.&quot;
        </div>

        {/* Structured Results Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-white/2 border border-white/4">
            <span className="text-[10px] text-white/40 block">
              Discovery Query
            </span>
            <span className="text-xs font-semibold text-white/90">
              24 prospects found
            </span>
          </div>
          <div className="p-3 rounded-lg bg-white/2 border border-white/4">
            <span className="text-[10px] text-white/40 block">
              Safety Match Filter
            </span>
            <span className="text-xs font-semibold text-blue-400">
              18 qualified (≥88%)
            </span>
          </div>
          <div className="p-3 rounded-lg bg-white/2 border border-white/4">
            <span className="text-[10px] text-white/40 block">
              Campaign Sequence
            </span>
            <span className="text-xs font-semibold text-emerald-400">
              Campaign ready · 7 Days
            </span>
          </div>
        </div>
      </div>

      {/* Mini Prospect Cards Preview */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-semibold flex items-center justify-center text-xs">
              AM
            </div>
            <div>
              <div className="font-semibold text-white/90">Arjun Mehta</div>
              <div className="text-[11px] text-white/45">
                Founder at Nexa AI · Bengaluru
              </div>
            </div>
          </div>
          <span className="text-blue-400 font-mono font-semibold text-xs bg-blue-500/10 px-2 py-0.5 rounded">
            94% Match
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-400 font-semibold flex items-center justify-center text-xs">
              SV
            </div>
            <div>
              <div className="font-semibold text-white/90">Sara Verma</div>
              <div className="text-[11px] text-white/45">
                Lead AI Engineer at Neural Labs
              </div>
            </div>
          </div>
          <span className="text-blue-400 font-mono font-semibold text-xs bg-blue-500/10 px-2 py-0.5 rounded">
            91% Match
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductHeroPreview;
