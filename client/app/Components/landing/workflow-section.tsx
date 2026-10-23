"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";
import {
  Search,
  Sparkles,
  Users,
  CheckCircle2,
  Clock,
  Bot,
  Zap,
} from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Tell it who you're looking for.",
    description:
      "Start with natural language instead of dozens of filters. WORKPILOT parses role seniority, geography, company stage, and intent.",
    prompt:
      "Find founders and AI engineers in India building products around LLMs or agents.",
  },
  {
    step: "02",
    title: "Find and understand the right people.",
    description:
      "Turn the campaign goal into relevant prospects and structured context. Every profile is scored for campaign relevance before outreach.",
    prospects: [
      {
        name: "Ankit Sharma",
        score: "94%",
        role: "Founder • SaaS",
        bio: "Building autonomous developer tooling",
      },
      {
        name: "Sara Verma",
        score: "91%",
        role: "AI Engineer",
        bio: "Distributed LLM serving & agent workflows",
      },
      {
        name: "Rohan Jain",
        score: "87%",
        role: "Co-Founder",
        bio: "Enterprise workflow automation",
      },
    ],
  },
  {
    step: "03",
    title: "Personalize every interaction.",
    description:
      "Generate contextual outreach based on the individual and campaign objective. No generic templates or robot-like messages.",
    message: {
      recipient: "Sara Verma",
      headline: "MESSAGE READY",
      text: "Hey Sara, saw your work around LLM infrastructure and autonomous agents. Really impressed by the recent benchmarks you published — would love to connect and follow your work.",
    },
  },
  {
    step: "04",
    title: "Keep the workflow moving.",
    description:
      "Track every prospect and know exactly what should happen next. Control throttled schedules, follow-up queues, and safe limits automatically.",
    pipeline: [
      { label: "DISCOVERED", status: "completed" },
      { label: "QUALIFIED", status: "completed" },
      { label: "CONNECTED", status: "completed" },
      { label: "MESSAGE READY", status: "active" },
      { label: "WAITING FOR REPLY", status: "queued" },
    ],
  },
];

export const WorkflowSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Calculate active step (0, 1, 2, 3) from scroll
  useEffect(() => {
    return scrollYProgress.on("change", (latest) => {
      if (latest < 0.28) {
        setActiveStep(0);
      } else if (latest < 0.55) {
        setActiveStep(1);
      } else if (latest < 0.82) {
        setActiveStep(2);
      } else {
        setActiveStep(3);
      }
    });
  }, [scrollYProgress]);

  const progressLineHeight = useTransform(
    scrollYProgress,
    [0, 1],
    ["0%", "100%"],
  );

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="relative w-full bg-slate-50 dark:bg-black py-20 lg:py-0 lg:h-[340vh]"
    >
      {/* Top boundary fade */}
      <div className="absolute top-0 inset-x-0 h-32 bg-linear-to-b from-slate-50 dark:from-black via-slate-50/80 dark:via-black/80 to-transparent z-10 pointer-events-none" />

      {/* Ambient background illumination */}
      <div className="absolute top-1/3 left-1/4 w-150 h-150 bg-blue-500/10 dark:bg-cyan-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Desktop Sticky Stage Container */}
      <div className="lg:sticky lg:top-0 lg:h-screen w-full flex flex-col justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 lg:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-100/80 dark:bg-cyan-950/40 border border-cyan-400/40 dark:border-cyan-500/25 backdrop-blur-md mb-4 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(0,229,255,0.2)] select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[11px] sm:text-xs font-semibold tracking-widest text-cyan-800 dark:text-cyan-300 uppercase">
              FROM INTENT TO CONNECTION
            </span>
          </div>

          <h2 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            One goal.{" "}
            <span className="bg-linear-to-r from-blue-700 via-indigo-600 to-cyan-600 dark:from-white dark:via-slate-200 dark:to-sky-300 bg-clip-text text-transparent">
              One intelligent workflow.
            </span>
          </h2>

          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300/90 leading-relaxed max-w-xl mx-auto">
            Tell WORKPILOT what you want to achieve and let the workflow
            organize everything that follows.
          </p>
        </div>

        {/* DESKTOP SPLIT: Sticky Preview (Left) + Step Details (Right) */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-10 items-center">
          {/* LEFT: Morphing Product Interface Preview (7 cols) */}
          <div className="lg:col-span-7">
            <div className="relative rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-WORKPILOT-dark/90 backdrop-blur-2xl p-6 sm:p-8 shadow-xl dark:shadow-2xl dark:shadow-black/90 min-h-115 flex flex-col justify-between overflow-hidden">
              {/* Window Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-white/20" />
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-white/20" />
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-white/20" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    WORKPILOT // step-{steps[activeStep].step}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-blue-600 dark:text-cyan-400 font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-cyan-400 animate-ping" />
                  <span>STEP {activeStep + 1} OF 4</span>
                </div>
              </div>

              {/* Dynamic Animated Content based on activeStep */}
              <div className="my-auto py-6">
                <AnimatePresence mode="wait">
                  {/* STATE 01: Natural Language Prompt */}
                  {activeStep === 0 && (
                    <motion.div
                      key="step-01"
                      initial={{ opacity: 0, y: 20, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.98 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-4"
                    >
                      <div className="text-xs font-mono uppercase tracking-wider text-blue-600 dark:text-cyan-400 flex items-center gap-2">
                        <Bot className="w-4 h-4" /> Intent Specification
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/10">
                        <div className="flex items-start gap-3">
                          <Search className="w-4 h-4 text-blue-600 dark:text-cyan-400 mt-1 shrink-0" />
                          <p className="font-mono text-sm sm:text-base text-slate-900 dark:text-white leading-relaxed">
                            &ldquo;{steps[0].prompt}&rdquo;
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/2 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                            TARGET ROLES
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            Founders & AI Eng
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/2 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                            LOCATION
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            India (HQ)
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/2 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                            TECH FOCUS
                          </span>
                          <span className="font-medium text-blue-600 dark:text-cyan-300">
                            LLMs / Agents
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STATE 02: Candidate Discovery & Scoring */}
                  {activeStep === 1 && (
                    <motion.div
                      key="step-02"
                      initial={{ opacity: 0, y: 20, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.98 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-3"
                    >
                      <div className="text-xs font-mono uppercase tracking-wider text-blue-600 dark:text-cyan-400 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Qualified Prospects Found
                        (24 Total)
                      </div>

                      {steps[1].prospects?.map((p, idx) => (
                        <motion.div
                          key={p.name}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-cyan-500/30 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-linear-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                              {p.name[0]}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                {p.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {p.role} • {p.bio}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-500/30 px-2.5 py-1 rounded-full">
                            {p.score} Match
                          </span>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {/* STATE 03: Personalized Outreach Message */}
                  {activeStep === 2 && (
                    <motion.div
                      key="step-03"
                      initial={{ opacity: 0, y: 20, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.98 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-blue-600 dark:text-cyan-400 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" /> RECIPIENT: SARA VERMA
                          (91%)
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded text-[10px]">
                          MESSAGE READY
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
                        <p className="text-slate-600 dark:text-slate-300">
                          &ldquo;{steps[2].message?.text}&rdquo;
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                        <span>Pacing: Human-like delay (4m 12s)</span>
                        <span className="text-blue-600 dark:text-cyan-400 font-medium">
                          Ready for dispatch
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {/* STATE 04: Continuous Campaign Workflow */}
                  {activeStep === 3 && (
                    <motion.div
                      key="step-04"
                      initial={{ opacity: 0, y: 20, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.98 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-4"
                    >
                      <div className="text-xs font-mono uppercase tracking-wider text-blue-600 dark:text-cyan-400 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Live Lifecycle Flow
                      </div>

                      <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/10">
                        {steps[3].pipeline?.map((item, idx) => (
                          <div
                            key={item.label}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono transition-colors ${
                              item.status === "completed"
                                ? "bg-slate-100 dark:bg-white/2 text-slate-600 dark:text-slate-300"
                                : item.status === "active"
                                  ? "bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(56,189,248,0.3)]"
                                  : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {item.status === "completed" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                              ) : item.status === "active" ? (
                                <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-cyan-400 animate-ping" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                              )}
                              <span>{item.label}</span>
                            </span>
                            <span className="text-[10px] uppercase">
                              {item.status === "active"
                                ? "Processing"
                                : item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Window Footer / Safety note */}
              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{" "}
                  Account limits protected
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  WORKPILOT v2.4
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Step Indicators & Narrative (5 cols) */}
          <div className="lg:col-span-5 relative pl-6">
            {/* Background Vertical Guide Line */}
            <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-slate-200 dark:bg-white/10" />

            {/* Glowing Active Scroll Progress Indicator */}
            <motion.div
              style={{ height: progressLineHeight }}
              className="absolute left-0 top-3 w-0.5 bg-linear-to-b from-blue-500 dark:from-cyan-400 via-sky-400 dark:via-sky-300 to-blue-600 dark:to-blue-500 shadow-[0_0_12px_rgba(56,189,248,0.8)]"
            />

            <div className="space-y-10">
              {steps.map((item, idx) => {
                const isActive = activeStep === idx;
                const isPassed = activeStep > idx;

                return (
                  <div
                    key={item.step}
                    className={`relative transition-all duration-300 ${
                      isActive ? "opacity-100 translate-x-1" : "opacity-40"
                    }`}
                  >
                    {/* Node Dot on Line */}
                    <div
                      className={`absolute -left-7.75 top-1 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                        isActive
                          ? "bg-blue-500 dark:bg-cyan-400 border-white dark:border-white shadow-[0_0_12px_rgba(56,189,248,0.9)] scale-110"
                          : isPassed
                            ? "bg-blue-100 dark:bg-cyan-950 border-blue-500 dark:border-cyan-400"
                            : "bg-slate-100 dark:bg-black border-slate-300 dark:border-white/30"
                      }`}
                    />

                    <div className="text-xs font-mono font-semibold tracking-wider text-blue-600 dark:text-cyan-400 uppercase mb-1">
                      STEP {item.step}
                    </div>
                    <h3 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* MOBILE FALLBACK: Clean vertical stacking (No sticky bugs) */}
        <div className="lg:hidden space-y-8 mt-6">
          {steps.map((item) => (
            <div
              key={`mob-${item.step}`}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-WORKPILOT-dark/90 p-5 space-y-3 shadow-sm dark:shadow-none"
            >
              <div className="text-xs font-mono font-semibold text-blue-600 dark:text-cyan-400">
                STEP {item.step}
              </div>
              <h3 className="font-heading text-xl font-bold text-slate-900 dark:text-white">
                {item.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-linear-to-t from-slate-50 dark:from-black via-slate-50/80 dark:via-black/80 to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default WorkflowSection;
