"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  description: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  children?: React.ReactNode;
  align?: "center" | "left";
}

export const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  title,
  titleAccent,
  description,
  primaryAction,
  secondaryAction,
  children,
  align = "center",
}) => {
  const isCentered = align === "center";

  return (
    <section className="relative pt-8 sm:pt-12 pb-16 sm:pb-20 overflow-hidden">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-62.5 bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          className={`max-w-3xl ${
            isCentered
              ? "mx-auto text-center flex flex-col items-center"
              : "text-left"
          }`}
        >
          {/* Eyebrow */}
          {eyebrow && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-mono font-semibold uppercase tracking-wider mb-5 select-none shadow-xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              <span>{eyebrow}</span>
            </motion.div>
          )}

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-bold font-heading text-slate-950 dark:text-white tracking-tight leading-[1.15]"
          >
            <span>{title} </span>
            {titleAccent && (
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-700 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-sky-300 dark:to-white">
                {titleAccent}
              </span>
            )}
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300/90 leading-relaxed max-w-2xl font-normal"
          >
            {description}
          </motion.p>

          {/* Action CTAs */}
          {(primaryAction || secondaryAction) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className={`mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto ${
                isCentered ? "justify-center" : "justify-start"
              }`}
            >
              {primaryAction && (
                <Link
                  href={primaryAction.href}
                  className="w-full sm:w-auto h-11 px-6 rounded-full bg-blue-600 hover:bg-blue-500 text-white dark:bg-white dark:text-black dark:hover:bg-slate-100 font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 dark:shadow-[0_0_20px_-3px_rgba(255,255,255,0.4)] group cursor-pointer"
                >
                  <span>{primaryAction.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}

              {secondaryAction && (
                <Link
                  href={secondaryAction.href}
                  className="w-full sm:w-auto h-11 px-6 rounded-full bg-white hover:bg-slate-900 hover:text-white text-slate-800 border border-slate-900 dark:bg-white/4 dark:hover:bg-white/8 dark:text-white/80 dark:hover:text-white dark:border-white/10 text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                >
                  {secondaryAction.label}
                </Link>
              )}
            </motion.div>
          )}
        </div>

        {/* Optional Interactive Visual / Preview */}
        {children && (
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 sm:mt-16 max-w-5xl mx-auto"
          >
            {children}
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default PageHero;
