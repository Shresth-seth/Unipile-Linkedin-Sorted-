"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { ArrowRight, Compass, Sparkles } from "lucide-react";

interface MagneticButtonProps {
  children: React.ReactNode;
  href: string;
  className?: string;
}

const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  href,
  className = "",
}) => {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!btnRef.current) return;
    const { left, top, width, height } = btnRef.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const deltaX = (e.clientX - centerX) * 0.15;
    const deltaY = (e.clientY - centerY) * 0.15;
    setPosition({
      x: Math.max(-8, Math.min(8, deltaX)),
      y: Math.max(-8, Math.min(8, deltaY)),
    });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 250, damping: 18 }}
    >
      <Link
        ref={btnRef}
        href={href}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        {children}
      </Link>
    </motion.div>
  );
};

export const FinalCTA: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={containerRef}
      className="relative min-h-[80vh] w-full flex flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-black py-24 sm:py-32 px-4 sm:px-6 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={
          isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }
        }
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute w-150 sm:w-225 h-112.5 sm:h-150 rounded-full bg-linear-to-tr from-sky-600/20 via-cyan-500/25 to-blue-700/15 blur-[160px] pointer-events-none -z-10"
      />

      <div className="absolute inset-0 bg-grid-subtle opacity-25 pointer-events-none -z-10" />

      <div className="absolute inset-0 pointer-events-none -z-10 opacity-40">
        <svg className="w-full h-full" viewBox="0 0 1200 600" fill="none">
          <ellipse
            cx="600"
            cy="300"
            rx="500"
            ry="220"
            stroke="#38BDF8"
            strokeWidth="0.8"
            strokeDasharray="6 8"
            className="opacity-30"
          />
          <ellipse
            cx="600"
            cy="300"
            rx="320"
            ry="140"
            stroke="#00E5FF"
            strokeWidth="0.8"
            strokeDasharray="4 6"
            className="opacity-40"
          />
          <circle cx="280" cy="300" r="3" fill="#00E5FF" />
          <circle cx="920" cy="300" r="3" fill="#3B82F6" />
          <circle cx="600" cy="80" r="3.5" fill="#38BDF8" />
          <circle cx="600" cy="520" r="2.5" fill="#6366F1" />
        </svg>
      </div>

      <div className="absolute top-0 inset-x-0 h-32 bg-linear-to-b from-slate-50 dark:from-black to-transparent z-10 pointer-events-none" />

      <div className="relative z-20 max-w-4xl mx-auto text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-100/80 dark:bg-cyan-950/40 border border-cyan-400/40 dark:border-cyan-500/25 backdrop-blur-md mb-6 sm:mb-8 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(0,229,255,0.2)] select-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="text-[11px] sm:text-xs font-semibold tracking-widest text-cyan-800 dark:text-cyan-300 uppercase">
            READY WHEN YOU ARE
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 50, filter: "blur(8px)" }}
          animate={
            isInView
              ? { opacity: 1, y: 0, filter: "blur(0px)" }
              : { opacity: 0, y: 50, filter: "blur(8px)" }
          }
          transition={{ duration: 0.8, delay: 0.15 }}
          className="font-heading text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]"
        >
          <span className="block text-slate-900 dark:text-white">
            Turn outreach into a workflow.
          </span>
          <span className="block bg-linear-to-r from-blue-700 via-indigo-600 to-cyan-600 dark:from-white dark:via-slate-100 dark:to-sky-300 bg-clip-text text-transparent">
            Start connecting with purpose.
          </span>
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300/90 max-w-2xl leading-relaxed font-normal"
        >
          Create your first WORKPILOT campaign and bring discovery,
          personalization and follow-up into one workspace.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
        >
          <MagneticButton
            href="/register"
            className="w-full sm:w-auto px-9 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white dark:bg-white dark:text-black dark:hover:bg-slate-100 font-semibold text-base transition-all duration-200 shadow-lg shadow-blue-600/30 dark:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)] inline-flex items-center justify-center gap-2 group"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </MagneticButton>

          <Link
            href="#product"
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/15 backdrop-blur-md transition-all duration-200 inline-flex items-center justify-center gap-2.5 font-semibold shadow-xs"
          >
            <span>Explore Product</span>
          </Link>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-28 bg-linear-to-t from-slate-50 to-transparent dark:from-black dark:to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default FinalCTA;
