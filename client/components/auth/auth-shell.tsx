"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Sparkles,
  Shield,
  Compass,
  Zap,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import Logo from "@/app/Components/landing/Logo";
import { isAuthenticated } from "@/lib/storage";
import { useTheme } from "@/components/theme-provider";

interface AuthShellProps {
  children: React.ReactNode;
  type: "register" | "login";
}

export const AuthShell: React.FC<AuthShellProps> = ({ children, type }) => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-black text-slate-500 dark:text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-cyan-400" />
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Checking active session...
        </p>
      </div>
    );
  }
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white flex flex-col lg:flex-row select-none">
      {/* LEFT PANEL: Atmospheric Branding & Visuals (Desktop only) */}
      <div className="relative hidden lg:flex lg:w-[48%] xl:w-[45%] flex-col justify-between p-12 xl:p-16 bg-slate-100 dark:bg-WORKPILOT-dark border-r border-slate-200 dark:border-white/10 overflow-hidden">
        {/* Background Ambient Glows & Grid */}
        <div className="absolute top-1/3 left-1/3 w-125 h-125 bg-linear-to-tr from-cyan-600/20 via-blue-600/15 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />
        <div className="absolute inset-0 bg-grid-subtle opacity-30 pointer-events-none -z-10" />

        {/* Top Header with Brand */}
        <div className="flex items-center justify-between z-10">
          <Link href="/" className="inline-block" aria-label="WORKPILOT Home">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-blue-600" />
              )}
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to website</span>
            </Link>
          </div>
        </div>

        {/* Center Content & Value Proposition */}
        <div className="my-auto py-12 z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-500/25 backdrop-blur-md mb-6 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(0,229,255,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono font-semibold tracking-wider text-cyan-800 dark:text-cyan-300 uppercase">
              PROFESSIONAL WORKSPACE
            </span>
          </div>

          <h1 className="font-heading text-4xl xl:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15] mb-5">
            Turn conversations into opportunities.
          </h1>

          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
            Discover relevant people, organize outreach and keep every
            connection moving from one intelligent workspace.
          </p>

          {/* 3 Value Pillars */}
          <div className="space-y-3.5 mb-10">
            {[
              "Intelligent prospect discovery & matching",
              "Personalized outreach workflows with human pacing",
              "Campaign tracking & safe automated limits in one place",
            ].map((benefit) => (
              <div
                key={benefit}
                className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200"
              >
                <div className="w-5 h-5 rounded-full bg-cyan-100 dark:bg-cyan-500/15 border border-cyan-300 dark:border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                </div>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* Mini Live Preview Floating Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/60 backdrop-blur-xl p-4 shadow-lg dark:shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-[11px] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Live Campaign Engine Active
              </span>
              <span className="text-cyan-700 dark:text-cyan-300 font-mono text-[11px]">
                94% Match Quality
              </span>
            </div>
            <div className="pt-2.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>Arjun Mehta (Founder) · Dispatched</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono">
                Pacing Controls Enabled
              </span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="z-10 text-xs text-slate-500">
          © 2026 WORKPILOT. Controlled outreach workflows.
        </div>
      </div>

      {/* RIGHT PANEL: Auth Form Container */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-16 relative overflow-y-auto bg-slate-100/60 dark:bg-transparent">
        {/* Desktop Top Right Theme Toggle */}
        <div className="hidden lg:flex absolute top-8 right-8 items-center gap-3 z-20">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer shadow-xs"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-600" />
            )}
          </button>
        </div>

        {/* Mobile Header */}
        <div className="w-full max-w-md flex items-center justify-between mb-8 lg:hidden">
          <Link href="/" aria-label="WORKPILOT Home">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              className="w-7 h-7 rounded-full flex items-center justify-center border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-blue-600" />
              )}
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
          </div>
        </div>

        {/* Ambient Top Glow for Right Panel */}
        <div className="absolute top-0 right-1/4 w-100 h-75 bg-blue-500/10 dark:bg-cyan-950/20 rounded-full blur-[120px] pointer-events-none" />

        {/* Form Slot */}
        <div className="w-full max-w-md z-10">{children}</div>
      </div>
    </div>
  );
};

export default AuthShell;
