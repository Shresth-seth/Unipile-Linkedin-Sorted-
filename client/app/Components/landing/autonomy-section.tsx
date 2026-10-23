"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  Calendar,
  Users,
  Share2,
  MessageSquare,
  CheckCircle,
  TrendingUp,
  Activity,
  ArrowRight,
  Shield,
  Layers,
} from "lucide-react";

const stackCards = [
  {
    day: "DAY 01",
    title: "Discover",
    summary:
      "Campaign initialized with criteria. Prospects filtered, scored, and queued into the staging pipeline.",
    metrics: ["24 Prospects Discovered", "18 Qualified", "6 Skipped"],
    accent: "from-cyan-500/20 to-blue-500/10",
    badgeColorLight: "text-cyan-800 border-cyan-300 bg-cyan-50",
    badgeColorDark: "text-cyan-300 border-cyan-500/30 bg-cyan-950/40",
  },
  {
    day: "DAY 02–03",
    title: "Connect",
    summary:
      "Qualified prospects organized. Connection workflows dispatched via dedicated cloud proxies with human pacing.",
    metrics: [
      "Connection Workflows Prepared",
      "Safe Limits Monitored",
      "Campaign State Synced",
    ],
    accent: "from-blue-500/20 to-indigo-500/10",
    badgeColorLight: "text-sky-800 border-sky-300 bg-sky-50",
    badgeColorDark: "text-sky-300 border-sky-500/30 bg-sky-950/40",
  },
  {
    day: "DAY 04–05",
    title: "Engage",
    summary:
      "Personalized connection follow-ups and messages synthesized. Incoming replies organized by intent.",
    metrics: [
      "Contextual Intros Delivered",
      "Replies Parsed & Tagged",
      "High-Intent Leads Surfaced",
    ],
    accent: "from-indigo-500/20 to-purple-500/10",
    badgeColorLight: "text-indigo-800 border-indigo-300 bg-indigo-50",
    badgeColorDark: "text-indigo-300 border-indigo-500/30 bg-indigo-950/40",
  },
  {
    day: "DAY 06–07",
    title: "Continue",
    summary:
      "Follow-up sequences tracked and scheduled. Inactive workflows gracefully finalized while generating insights.",
    metrics: [
      "Automated Follow-ups Sent",
      "Conversation History Preserved",
      "Campaign Insights Synthesized",
    ],
    accent: "from-cyan-500/25 to-teal-500/10",
    badgeColorLight: "text-teal-800 border-teal-300 bg-teal-50",
    badgeColorDark: "text-teal-300 border-teal-500/30 bg-teal-950/40",
  },
];

const marqueeRow1 = [
  "DISCOVER",
  "QUALIFY",
  "CONNECT",
  "ENGAGE",
  "DISCOVER",
  "QUALIFY",
  "CONNECT",
  "ENGAGE",
  "DISCOVER",
  "QUALIFY",
  "CONNECT",
  "ENGAGE",
];

const marqueeRow2 = [
  "PERSONALIZE",
  "ORGANIZE",
  "FOLLOW UP",
  "LEARN",
  "PERSONALIZE",
  "ORGANIZE",
  "FOLLOW UP",
  "LEARN",
  "PERSONALIZE",
  "ORGANIZE",
  "FOLLOW UP",
  "LEARN",
];

export const AutonomySection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const marquee1X = useTransform(scrollYProgress, [0, 1], ["0%", "-35%"]);
  const marquee2X = useTransform(scrollYProgress, [0, 1], ["-35%", "0%"]);

  return (
    <section
      ref={containerRef}
      className="relative w-full bg-slate-50 dark:bg-black py-28 sm:py-36 overflow-hidden"
    >
      {/* Top transition */}
      <div className="absolute top-0 inset-x-0 h-32 bg-linear-to-b from-slate-50 dark:from-black via-slate-50/80 dark:via-black/80 to-transparent z-10 pointer-events-none" />

      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-150 bg-blue-500/10 dark:bg-blue-950/15 rounded-full blur-[180px] pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-100/80 dark:bg-cyan-950/40 border border-cyan-400/40 dark:border-cyan-500/25 backdrop-blur-md mb-5 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(0,229,255,0.2)] select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[11px] sm:text-xs font-semibold tracking-widest text-cyan-800 dark:text-cyan-300 uppercase">
              BUILT FOR CONTINUITY
            </span>
          </div>

          <h2 className="font-heading text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
            <span>Outreach doesn&apos;t happen in one click.</span>{" "}
            <span className="bg-linear-to-r from-blue-700 via-indigo-600 to-cyan-600 dark:from-white dark:via-slate-200 dark:to-sky-300 bg-clip-text text-transparent">
              Your workflow shouldn&apos;t stop at one either.
            </span>
          </h2>

          <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300/90 leading-relaxed font-normal max-w-2xl mx-auto">
            Keep campaigns organized across discovery, connections,
            conversations and follow-ups.
          </p>
        </div>

        {/* Scroll Stack of Cards */}
        <div className="relative space-y-8 sm:space-y-10 pb-16">
          {stackCards.map((card, idx) => (
            <div
              key={card.day}
              style={{
                top: `calc(100px + ${idx * 28}px)`,
              }}
              className="sticky rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-WORKPILOT-dark/95 backdrop-blur-2xl p-6 sm:p-10 shadow-xl dark:shadow-2xl dark:shadow-black/80 transition-all duration-300 overflow-hidden"
            >
              {/* Subtle top inner linear */}
              <div
                className={`absolute inset-0 bg-linear-to-br ${card.accent} pointer-events-none opacity-40`}
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* Left details */}
                <div className="max-w-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-mono font-bold tracking-wider px-3 py-1 rounded-full border ${card.badgeColorLight} dark:${card.badgeColorDark}`}
                    >
                      {card.day}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />{" "}
                      Stage {idx + 1} of 4
                    </span>
                  </div>

                  <h3 className="font-heading text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                    {card.title}
                  </h3>

                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300/90 leading-relaxed">
                    {card.summary}
                  </p>
                </div>

                {/* Right metrics visual box */}
                <div className="w-full md:w-80 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/60 p-4 space-y-2.5 shadow-inner shrink-0">
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <span>Campaign State</span>
                    <span className="text-blue-600 dark:text-cyan-400 flex items-center gap-1">
                      <Activity className="w-3 h-3 animate-pulse" /> Live
                    </span>
                  </div>

                  {card.metrics.map((metric) => (
                    <div
                      key={metric}
                      className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200"
                    >
                      <CheckCircle className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                      <span>{metric}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* END-OF-SECTION METRICS: Horizontal Scroll Velocity Marquee */}
        <div className="mt-20 sm:mt-28 relative py-8 border-y border-slate-300 dark:border-white/15 bg-slate-100/60 dark:bg-white/4 overflow-hidden select-none">
          <div className="absolute inset-y-0 left-0 w-24 bg-linear-to-r from-slate-50 dark:from-black to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-linear-to-l from-slate-50 dark:from-black to-transparent z-10 pointer-events-none" />

          {/* Marquee Row 1 */}
          <motion.div
            style={{ x: marquee1X }}
            className="flex items-center gap-8 whitespace-nowrap text-xs sm:text-sm font-mono font-bold tracking-[0.25em] text-slate-800 dark:text-slate-100 mb-4"
          >
            {marqueeRow1.map((item, i) => (
              <span key={`r1-${i}`} className="flex items-center gap-8">
                <span>{item}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-cyan-400" />
              </span>
            ))}
          </motion.div>

          {/* Marquee Row 2 (Opposing direction) */}
          <motion.div
            style={{ x: marquee2X }}
            className="flex items-center gap-8 whitespace-nowrap text-xs sm:text-sm font-mono font-bold tracking-[0.25em] text-blue-700 dark:text-cyan-300"
          >
            {marqueeRow2.map((item, i) => (
              <span key={`r2-${i}`} className="flex items-center gap-8">
                <span>{item}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 dark:bg-white/80" />
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-linear-to-t from-slate-50 dark:from-black via-slate-50/80 dark:via-black/80 to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default AutonomySection;
