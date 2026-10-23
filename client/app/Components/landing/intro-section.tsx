"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "motion/react";
import { useTheme } from "@/components/theme-provider";

interface WordProps {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
  isHighlight?: boolean;
  isLight?: boolean;
}

const Word: React.FC<WordProps> = ({
  children,
  progress,
  range,
  isHighlight = false,
  isLight = false,
}) => {
  const opacity = useTransform(progress, range, isLight ? [0.45, 1] : [0.2, 1]);
  const color = useTransform(
    progress,
    range,
    isHighlight
      ? isLight
        ? ["#0284c7", "#0369a1"]
        : ["#334155", "#38BDF8"]
      : isLight
        ? ["#64748b", "#0f172a"]
        : ["#475569", "#FFFFFF"],
  );
  const glow = useTransform(
    progress,
    range,
    isHighlight
      ? [
          "drop-shadow(0 0 0px rgba(56,189,248,0))",
          isLight
            ? "drop-shadow(0 0 8px rgba(2,132,199,0.3))"
            : "drop-shadow(0 0 14px rgba(56,189,248,0.7))",
        ]
      : ["none", "none"],
  );

  return (
    <motion.span
      style={{ opacity, color, filter: glow }}
      className={`inline-block mr-[0.28em] transition-colors duration-150 ${
        isHighlight ? "font-semibold tracking-tight" : "font-medium"
      }`}
    >
      {children}
    </motion.span>
  );
};

export const IntroSection: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Parallax layers
  const orbY = useTransform(scrollYProgress, [0, 1], ["10%", "-30%"]);
  const orbScale = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [0.85, 1.25, 0.9],
  );
  const nodesY = useTransform(scrollYProgress, [0, 1], ["20%", "-40%"]);
  const gridOpacity = useTransform(
    scrollYProgress,
    [0, 0.4, 0.8, 1],
    [0.1, 0.35, 0.35, 0.1],
  );

  const statement1 =
    "Professional outreach shouldn't feel like repetitive work.".split(" ");
  const statement2 =
    "Tell WORKPILOT who you want to reach. Let the workflow handle the rest.".split(
      " ",
    );

  const allWords = [...statement1, ...statement2];
  const totalWords = allWords.length;

  // Highlight keywords
  const isKeyword = (word: string) => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    return ["outreach", "connect", "workflow", "relationships"].includes(clean);
  };

  return (
    <section
      ref={containerRef}
      className={`relative h-[160vh] w-full transition-colors duration-300 ${
        isLight ? "bg-slate-50 text-slate-900" : "bg-black text-white"
      }`}
    >
      {/* Top transition fade from Hero */}
      <div
        className={`absolute top-0 inset-x-0 h-32 pointer-events-none z-10 ${
          isLight
            ? "bg-linear-to-b from-slate-50 via-slate-50/80 to-transparent"
            : "bg-linear-to-b from-black via-black/80 to-transparent"
        }`}
      />

      {/* Sticky container pinned to viewport */}
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8">

        {/* 2. Medium Blurred Blue/Cyan Orb */}
        <motion.div
          style={{ y: orbY, scale: orbScale }}
          className={`absolute w-90 sm:w-170 h-90 sm:h-170 rounded-full blur-[120px] pointer-events-none -z-10 ${
            isLight
              ? "bg-linear-to-tr from-cyan-400/20 via-blue-400/20 to-indigo-400/10"
              : "bg-linear-to-tr from-cyan-600/15 via-blue-600/20 to-indigo-600/10"
          }`}
        />

        {/* 3. Slightly Faster Network Nodes & Paths */}
        <motion.div
          style={{ y: nodesY }}
          className="absolute inset-0 pointer-events-none -z-10 opacity-30"
        >
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <line
              x1="20%"
              y1="30%"
              x2="45%"
              y2="45%"
              stroke="#38BDF8"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1="45%"
              y1="45%"
              x2="80%"
              y2="35%"
              stroke="#38BDF8"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1="45%"
              y1="45%"
              x2="55%"
              y2="70%"
              stroke="#3B82F6"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle cx="20%" cy="30%" r="3" fill="#00E5FF" />
            <circle cx="45%" cy="45%" r="4" fill="#38BDF8" />
            <circle cx="80%" cy="35%" r="3" fill="#3B82F6" />
            <circle cx="55%" cy="70%" r="3.5" fill="#6366F1" />
          </svg>
        </motion.div>

        {/* Foreground Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
          {/* Small Cyan Eyebrow Label */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md mb-8 sm:mb-12 select-none ${
              isLight
                ? "bg-cyan-100/90 border border-cyan-400/40 text-cyan-900 shadow-sm"
                : "bg-cyan-950/40 border border-cyan-500/25 text-cyan-300 shadow-[0_0_20px_-3px_rgba(0,229,255,0.25)]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] sm:text-xs font-semibold tracking-widest uppercase">
              THE NEW WAY TO OUTREACH
            </span>
          </div>

          {/* Statement 1 - Primary Hook */}
          <h2 className="font-heading text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.2] mb-6 sm:mb-8 max-w-3xl">
            {statement1.map((word, i) => {
              const start = 0.08 + (i / totalWords) * 0.42;
              const end = start + 0.06;
              return (
                <Word
                  key={`s1-${i}`}
                  progress={scrollYProgress}
                  range={[start, end]}
                  isHighlight={isKeyword(word)}
                  isLight={isLight}
                >
                  {word}
                </Word>
              );
            })}
          </h2>

          {/* Statement 2 - Solution Hook */}
          <p
            className={`font-heading text-xl sm:text-2xl md:text-3xl font-medium tracking-tight leading-relaxed max-w-2xl ${
              isLight ? "text-slate-600" : "text-slate-400"
            }`}
          >
            {statement2.map((word, i) => {
              const globalIndex = statement1.length + i;
              const start =
                0.48 + ((globalIndex - statement1.length) / totalWords) * 0.45;
              const end = start + 0.06;
              return (
                <Word
                  key={`s2-${i}`}
                  progress={scrollYProgress}
                  range={[start, end]}
                  isHighlight={isKeyword(word)}
                  isLight={isLight}
                >
                  {word}
                </Word>
              );
            })}
          </p>
        </div>
      </div>

      {/* Bottom transition linear to Features */}
      <div
        className={`absolute bottom-0 inset-x-0 h-36 pointer-events-none z-10 ${
          isLight
            ? "bg-linear-to-t from-slate-50 via-slate-50/80 to-transparent"
            : "bg-linear-to-t from-black via-black/80 to-transparent"
        }`}
      />
    </section>
  );
};

export default IntroSection;
