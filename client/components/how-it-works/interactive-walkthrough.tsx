"use client";

import React, { useState } from "react";
import { CheckCircle2, Play } from "lucide-react";

export const InteractiveWalkthrough: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      num: "01",
      title: "Set your goal",
      desc: "Tell WORKPILOT who you want to meet and what you want to accomplish in natural language.",
      previewTitle: "Goal Prompt Input",
      renderPreview: () => (
        <div className="space-y-3">
          <div className="text-xs font-mono text-blue-400">
            Step 1: Input Goal
          </div>
          <div className="p-4 rounded-xl bg-black/40 border border-white/8 font-mono text-xs sm:text-sm text-white/90 leading-relaxed">
            &quot;Find AI engineers in India working on generative AI and LLM
            evaluation architectures.&quot;
          </div>
          <div className="text-[11px] text-white/40">
            No complex Boolean queries required. Describe intent naturally.
          </div>
        </div>
      ),
    },
    {
      num: "02",
      title: "Define the audience",
      desc: "WORKPILOT parses key entities, seniority levels, geographic filters, and technical sub-disciplines.",
      previewTitle: "Extracted Targeting Profile",
      renderPreview: () => (
        <div className="space-y-2.5">
          <div className="text-xs font-mono text-blue-400">
            Step 2: Extracted Criteria
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-lg bg-white/2 border border-white/4">
              <span className="text-[10px] text-white/40 block">
                Target Role
              </span>
              <span className="font-semibold text-white/90">
                AI & ML Engineer
              </span>
            </div>
            <div className="p-3 rounded-lg bg-white/2 border border-white/4">
              <span className="text-[10px] text-white/40 block">Location</span>
              <span className="font-semibold text-white/90">
                India (Tech Hubs)
              </span>
            </div>
            <div className="p-3 rounded-lg bg-white/2 border border-white/4">
              <span className="text-[10px] text-white/40 block">Topics</span>
              <span className="font-semibold text-blue-400">
                LLMs, GenAI, Evals
              </span>
            </div>
            <div className="p-3 rounded-lg bg-white/2 border border-white/4">
              <span className="text-[10px] text-white/40 block">
                Experience
              </span>
              <span className="font-semibold text-white/90">
                Senior & Staff
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: "03",
      title: "Discover prospects",
      desc: "WORKPILOT scans public professional profiles, publications, and verified networking channels.",
      previewTitle: "Live Candidate Discovery",
      renderPreview: () => (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-400 font-mono">
              Step 3: Candidates Found
            </span>
            <span className="text-white/40">28 profiles discovered</span>
          </div>
          <div className="space-y-2">
            {[
              {
                name: "Arjun Mehta",
                company: "Nexa AI",
                role: "Founder",
                loc: "Bengaluru",
              },
              {
                name: "Sara Verma",
                company: "Neural Labs",
                role: "AI Engineer",
                loc: "Hyderabad",
              },
              {
                name: "Priya Shah",
                company: "Orbit AI",
                role: "CTO",
                loc: "Pune",
              },
            ].map((p) => (
              <div
                key={p.name}
                className="p-2.5 rounded-lg bg-white/2 border border-white/4 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-medium text-white/90">{p.name}</span>
                  <span className="text-white/40 text-[11px] block">
                    {p.role} · {p.company}
                  </span>
                </div>
                <span className="text-blue-400 font-mono text-[11px]">
                  Ready for review
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      num: "04",
      title: "Review relevance",
      desc: "Deep scoring evaluates shared context and activity intent to prioritize the highest-probability connections.",
      previewTitle: "Scoring & Qualification",
      renderPreview: () => (
        <div className="space-y-3">
          <div className="text-xs font-mono text-blue-400">
            Step 4: Match Verification
          </div>
          <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white/90">
                Arjun Mehta · Nexa AI
              </span>
              <span className="font-mono text-blue-400 font-bold">
                94% Relevance
              </span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Match reasons: Published latency evals on agent workflows, active
              within last 48 hours, mutual connection in developer tools.
            </p>
            <div className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded inline-block">
              Qualified for automated dispatch
            </div>
          </div>
        </div>
      ),
    },
    {
      num: "05",
      title: "Create personalized outreach",
      desc: "Generate concise, tailored connection notes referencing their exact work without generic formulas.",
      previewTitle: "Contextual Copy Crafting",
      renderPreview: () => (
        <div className="space-y-3">
          <div className="text-xs font-mono text-blue-400">
            Step 5: Message Synthesis
          </div>
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/6 text-xs text-white/80 leading-relaxed space-y-1.5">
            <p>
              Hey Arjun, came across Nexa AI while researching developer tooling
              for LLM architectures.
            </p>
            <p>
              Your recent breakdown on evaluation latency caught my eye — would
              love to trade notes on edge agent orchestration!
            </p>
          </div>
          <div className="text-[10px] text-white/40">
            Within 300 characters · Zero generic sales buzzwords
          </div>
        </div>
      ),
    },
    {
      num: "06",
      title: "Launch the campaign",
      desc: "Review your campaign parameters, daily limits, and pacing rules before queuing safe execution.",
      previewTitle: "Campaign Orchestration",
      renderPreview: () => (
        <div className="space-y-3">
          <div className="text-xs font-mono text-blue-400">
            Step 6: Campaign Ready
          </div>
          <div className="p-4 rounded-xl bg-white/2 border border-white/6 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white/90">
                AI Founders — India
              </span>
              <span className="text-emerald-400 font-mono">
                Ready to Launch
              </span>
            </div>
            <div className="text-white/50 text-[11px]">
              Duration: 7 Days · Volume: 20/day · Pacing: Randomized 45s-120s
            </div>
            <div className="pt-2">
              <button
                type="button"
                className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start Campaign</span>
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: "07",
      title: "Track what happens next",
      desc: "Monitor accepted requests, replies received, and automatic follow-up triggers in one place.",
      previewTitle: "Pipeline Velocity",
      renderPreview: () => (
        <div className="space-y-3">
          <div className="text-xs font-mono text-blue-400">
            Step 7: Activity Tracking
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-lg bg-white/2 border border-white/4">
              <span className="text-sm font-semibold text-white/90">18</span>
              <span className="text-[10px] text-white/40 block">Qualified</span>
            </div>
            <div className="p-3 rounded-lg bg-white/2 border border-white/4">
              <span className="text-sm font-semibold text-blue-400">8</span>
              <span className="text-[10px] text-white/40 block">Connected</span>
            </div>
            <div className="p-3 rounded-lg bg-white/2 border border-white/4">
              <span className="text-sm font-semibold text-emerald-400">4</span>
              <span className="text-[10px] text-white/40 block">Replies</span>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-300 text-[11px] flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Rohan Jain replied · Review in Messages inbox</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left: Sticky Preview Panel on Desktop */}
      <div className="lg:col-span-6 lg:sticky lg:top-24 rounded-2xl bg-[#07090e] border border-white/8 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-xs font-mono text-white/50">
              Interactive Workflow Stage
            </span>
          </div>
          <span className="text-xs font-mono text-blue-400 font-semibold">
            {steps[activeStep].num} / 07
          </span>
        </div>

        {/* Dynamic Step Content */}
        <div className="min-h-55 flex flex-col justify-center">
          {steps[activeStep].renderPreview()}
        </div>

        <div className="pt-3 border-t border-white/4 flex items-center justify-between text-xs text-white/40">
          <span>Click any step to inspect the workflow</span>
          <span className="text-blue-400 font-mono">Autonomous Execution</span>
        </div>
      </div>

      {/* Right: Chronological Steps List */}
      <div className="lg:col-span-6 space-y-3">
        {steps.map((s, idx) => {
          const isCurrent = idx === activeStep;

          return (
            <button
              key={s.num}
              type="button"
              onClick={() => setActiveStep(idx)}
              className={`w-full p-5 rounded-xl border text-left transition-all cursor-pointer ${
                isCurrent
                  ? "bg-white dark:bg-white/4 border-blue-600 dark:border-blue-500/40 shadow-sm ring-1 ring-blue-600/20"
                  : "bg-white dark:bg-white/1.5 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/3"
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`font-mono text-sm font-bold shrink-0 ${
                    isCurrent
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-slate-400 dark:text-white/30"
                  }`}
                >
                  {s.num}
                </span>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white/95">
                    {s.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-white/50 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default InteractiveWalkthrough;
