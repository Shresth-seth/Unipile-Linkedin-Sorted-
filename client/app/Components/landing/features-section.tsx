"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";
import {
  Compass,
  Sparkles,
  ShieldCheck,
  BarChart3,
  GitBranch,
  Search,
  Check,
  MessageSquareText,
  Send,
} from "lucide-react";

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = "",
  delay = 0,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-WORKPILOT-dark/85 backdrop-blur-xl p-6 sm:p-8 overflow-hidden transition-all duration-300 shadow-sm dark:shadow-none hover:border-blue-300 dark:hover:border-cyan-500/30 hover:shadow-md dark:hover:shadow-[0_0_35px_-8px_rgba(56,189,248,0.2)] ${className}`}
    >
      {/* Soft Cyan Spotlight Effect */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(420px circle at ${mousePos.x}px ${mousePos.y}px, rgba(56, 189, 248, 0.12), transparent 75%)`,
        }}
      />

      {/* Subtle top edge specular highlight */}
      <div className="absolute top-0 inset-x-8 h-px bg-linear-to-r from-transparent via-slate-200 dark:via-white/15 to-transparent pointer-events-none" />

      <div className="relative z-10 h-full flex flex-col justify-between">
        {children}
      </div>
    </motion.div>
  );
};

export const FeaturesSection: React.FC = () => {
  const scoreRef = useRef<HTMLDivElement>(null);
  const isScoreInView = useInView(scoreRef, { once: true, margin: "-50px" });
  const [matchScore, setMatchScore] = useState(0);

  useEffect(() => {
    if (isScoreInView) {
      let current = 0;
      const target = 92;
      const timer = setInterval(() => {
        current += 2;
        if (current >= target) {
          setMatchScore(target);
          clearInterval(timer);
        } else {
          setMatchScore(current);
        }
      }, 25);
      return () => clearInterval(timer);
    }
  }, [isScoreInView]);

  return (
    <section
      id="features"
      className="relative w-full bg-slate-50 dark:bg-black py-28 sm:py-36 px-4 sm:px-6 lg:px-8"
    >
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-175 h-125 bg-blue-500/10 dark:bg-cyan-950/15 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-100/80 dark:bg-cyan-950/40 border border-cyan-400/40 dark:border-cyan-500/25 backdrop-blur-md mb-5 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(0,229,255,0.2)] select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[11px] sm:text-xs font-semibold tracking-widest text-cyan-800 dark:text-cyan-300 uppercase">
              ONE INTELLIGENT WORKSPACE
            </span>
          </div>

          <h2 className="font-heading text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
            <span>Everything your outreach needs.</span>{" "}
            <span className="bg-linear-to-r from-blue-700 via-indigo-600 to-cyan-600 dark:from-white dark:via-slate-200 dark:to-sky-300 bg-clip-text text-transparent">
              Without the repetitive work.
            </span>
          </h2>

          <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300/90 leading-relaxed font-normal">
            Discover, understand, personalize and manage professional outreach
            from one connected workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <SpotlightCard
            className="lg:col-span-7 flex flex-col min-h-115"
            delay={0.05}
          >
            <div>
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-cyan-400 mb-3">
                <Compass className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-cyan-300">
                  Precision Discovery
                </span>
              </div>
              <h3 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Smart Discovery
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300/90 max-w-lg leading-relaxed">
                Describe the people you want to reach and transform that intent
                into a focused prospecting workflow.
              </p>
            </div>

            {/* Interactive Mock: Natural Language Search & Results */}
            <div className="mt-8 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/60 p-4 space-y-3 shadow-inner dark:shadow-inner">
              {/* Fake Search Input */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-mono">
                <Search className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                <span className="text-slate-800 dark:text-slate-200 truncate">
                  Find AI founders in India working on SaaS products
                </span>
                <span className="w-1.5 h-4 bg-blue-500 dark:bg-cyan-400 animate-pulse ml-auto shrink-0" />
              </div>

              {/* Profile Result Rows */}
              <div className="space-y-2 pt-1">
                {[
                  {
                    name: "Arjun Mehta",
                    role: "Founder",
                    company: "AI SaaS",
                    match: "98% Match",
                  },
                  {
                    name: "Priya Shah",
                    role: "Co-Founder",
                    company: "Generative AI",
                    match: "95% Match",
                  },
                  {
                    name: "Rahul Jain",
                    role: "CEO",
                    company: "Developer Tools",
                    match: "93% Match",
                  },
                ].map((item, idx) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + idx * 0.15 }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/2 hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-100 dark:border-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-linear-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                        {item.name[0]}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.role} • {item.company}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-500/30 px-2 py-0.5 rounded-full">
                      {item.match}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard
            className="lg:col-span-5 flex flex-col justify-between"
            delay={0.12}
          >
            <div ref={scoreRef}>
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-cyan-400 mb-3">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-cyan-300">
                  Target Verification
                </span>
              </div>
              <h3 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Intelligent Qualification
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300/90 leading-relaxed">
                Focus on the people who actually match your campaign criteria.
              </p>
            </div>

            <div className="my-6 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/60 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Prospect Quality
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-blue-600 dark:text-cyan-300 dark:drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                  {matchScore}% MATCH
                </span>
              </div>

              <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-linear-to-r from-cyan-400 to-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${matchScore}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                {[
                  "Founder ✓",
                  "Artificial AI ✓",
                  "India ✓",
                  "Relevant Company ✓",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/3 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-medium"
                  >
                    <Check className="w-3 h-3 text-blue-600 dark:text-cyan-400 shrink-0" />
                    <span className="truncate">{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard
            className="lg:col-span-5 flex flex-col justify-between"
            delay={0.18}
          >
            <div>
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-cyan-400 mb-3">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-cyan-300">
                  Dynamic Intros
                </span>
              </div>
              <h3 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Personalized Outreach
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300/90 leading-relaxed">
                Turn context into natural, relevant connection messages.
              </p>
            </div>

            <div className="mt-6 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/60 shadow-inner dark:shadow-inner">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-white/10 mb-3 text-xs text-slate-500 dark:text-slate-400">
                <MessageSquareText className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span className="font-mono">Context-Synthesized Invite</span>
                <span className="ml-auto text-[10px] text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950 px-2 py-0.5 rounded">
                  Ready
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-white/3 border border-slate-100 dark:border-white/5 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                <p className="text-slate-600 dark:text-slate-300">
                  &ldquo;Hey Arjun, came across what you&apos;re building in the
                  AI space. Really liked your work around autonomous workflow
                  orchestration...&rdquo;
                </p>
              </div>
              <div className="flex items-center justify-between pt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Personalized for Arjun Mehta</span>
                <span className="text-blue-600 dark:text-cyan-400 flex items-center gap-1">
                  <Send className="w-3 h-3" /> Auto-queued
                </span>
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard
            className="lg:col-span-3 flex flex-col justify-between"
            delay={0.24}
          >
            <div>
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-cyan-400 mb-3">
                <BarChart3 className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-cyan-300">
                  Analytics
                </span>
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Campaign Control
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300/90 leading-relaxed">
                Know what is happening, what comes next and where every
                relationship stands.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/60 text-center">
              <div className="p-2 rounded-lg bg-white dark:bg-white/2 border border-slate-100 dark:border-white/5">
                <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                  32
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Prospects
                </div>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-white/2 border border-slate-100 dark:border-white/5">
                <div className="text-lg sm:text-xl font-bold font-mono text-blue-600 dark:text-cyan-300">
                  18
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Connected
                </div>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-white/2 border border-slate-100 dark:border-white/5">
                <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                  7
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Replies
                </div>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-white/2 border border-slate-100 dark:border-white/5">
                <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  4
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Interested
                </div>
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard
            className="lg:col-span-4 flex flex-col justify-between"
            delay={0.3}
          >
            <div>
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-cyan-400 mb-3">
                <GitBranch className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-cyan-300">
                  State Engine
                </span>
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Workflow Memory
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300/90 leading-relaxed">
                Every lead keeps its own context, history and next action.
              </p>
            </div>

            <div className="mt-6 p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/60 space-y-2">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200 dark:border-white/10">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Rahul Sharma
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Lead State
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto py-1">
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 shrink-0">
                  CONNECTED
                </span>
                <span className="text-slate-400 dark:text-slate-500 shrink-0">
                  →
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 shrink-0">
                  INTRO SENT
                </span>
                <span className="text-slate-400 dark:text-slate-500 shrink-0">
                  →
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/40 shrink-0 animate-pulse">
                  FOLLOW-UP
                </span>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
