"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Play, ShieldCheck } from "lucide-react";
import { DEFAULT_LANDING_CONFIG, LandingConfig } from "./landing-editor-modal";
import { useTheme } from "@/components/theme-provider";

export const Hero: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [landingConfig, setLandingConfig] = useState<LandingConfig>(
    DEFAULT_LANDING_CONFIG,
  );
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    try {
      const stored = localStorage.getItem("WORKPILOT_landing_customization");
      if (stored) {
        setLandingConfig(JSON.parse(stored));
      }
    } catch {}

    const handleUpdate = (e: any) => {
      if (e.detail) {
        setLandingConfig(e.detail);
      }
    };

    window.addEventListener("WORKPILOT_landing_updated", handleUpdate);
    return () =>
      window.removeEventListener("WORKPILOT_landing_updated", handleUpdate);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.95;
      if (videoRef.current.readyState >= 2) {
        setIsVideoLoaded(true);
      }
      if (isDark) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isDark]);

  return (
    <section
      id="hero"
      className={`relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28 ${
        isDark ? "bg-black text-white" : "bg-slate-50 text-slate-950"
      }`}
    >
      {/* 1. Background Video Layer (Dark Mode Only) */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onLoadedData={() => setIsVideoLoaded(true)}
          onCanPlay={() => setIsVideoLoaded(true)}
          style={{ display: isDark ? "block" : "none" }}
          className={`hidden dark:block absolute inset-0 w-full h-full object-cover object-center scale-105 transition-opacity duration-700 ${
            isDark
              ? isVideoLoaded
                ? "opacity-85"
                : "opacity-40"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <source src="/vidoes/blue-light-glow.mp4" type="video/mp4" />
          <source
            src="https://strvid.nyc3.cdn.digitaloceanspaces.com/motionsite/blue-light-glow.mp4"
            type="video/mp4"
          />
        </video>

        {/* Ambient Radial Vignette & Glow */}
        <div
          className={`absolute inset-0 pointer-events-none ${
            isDark
              ? "bg-radial-at-c from-sky-950/25 via-black/70 to-black"
              : "bg-radial-at-c from-cyan-400/15 via-white/60 to-slate-50"
          }`}
        />
      </div>

      {/* Top Transition Fade */}
      <div
        className={`absolute top-0 inset-x-0 h-44 pointer-events-none z-10 ${
          isDark
            ? "bg-linear-to-b from-black via-black/80 to-transparent"
            : "bg-linear-to-b from-slate-50 via-slate-50/80 to-transparent"
        }`}
      />

      {/* Central Soft Ambient Cyan Glow */}
      <div
        className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-160 h-80 sm:h-120 rounded-full blur-3xl pointer-events-none z-10 ${
          isDark ? "bg-cyan-500/10" : "bg-cyan-400/15"
        }`}
      />

      {/* Bottom Transition Fade */}
      <div
        className={`absolute bottom-0 inset-x-0 h-48 sm:h-64 pointer-events-none z-10 ${
          isDark
            ? "bg-linear-to-t from-black via-black/85 to-transparent"
            : "bg-linear-to-t from-slate-50 via-slate-50/80 to-transparent"
        }`}
      />

      {/* 2. Primary Hero Content */}
      <div className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col items-center text-center">
        {/* Top Eyebrow Badge */}
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md mb-6 sm:mb-8 transition-transform hover:scale-[1.02] select-none ${
            isDark
              ? "bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_-3px_rgba(0,229,255,0.25)]"
              : "bg-cyan-100/80 border border-cyan-400/40 text-cyan-800 shadow-sm"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500" />
          </span>
          <span className="text-[11px] sm:text-xs font-semibold tracking-widest uppercase">
            {landingConfig.badge}
          </span>
        </div>

        {/* Hero Headline */}
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] xl:text-[4.75rem] font-bold tracking-tight leading-[1.1] max-w-6xl">
          <span
            className={`block ${
              isDark
                ? "text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
                : "text-slate-950 drop-shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
            }`}
          >
            {landingConfig.headline1}
          </span>
          <span
            className={`block bg-clip-text text-transparent ${
              isDark
                ? "bg-linear-to-r from-white via-slate-100 to-sky-300 drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
                : "bg-linear-to-r from-blue-700 via-indigo-600 to-sky-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
            }`}
          >
            {landingConfig.headline2}
          </span>
        </h1>

        {/* Hero Description */}
        <p
          className={`mt-6 sm:mt-8 text-base sm:text-lg md:text-xl max-w-2xl leading-relaxed font-normal ${
            isDark
              ? "text-slate-200 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
              : "text-slate-600"
          }`}
        >
          {landingConfig.description}
        </p>

        {/* Action Buttons */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto">
          <Link
            href="/register"
            className={`w-full sm:w-auto px-8 py-3.5 rounded-full font-semibold text-sm sm:text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2 group cursor-pointer ${
              isDark
                ? "bg-white text-black hover:bg-slate-100 shadow-[0_0_25px_-4px_rgba(255,255,255,0.45)] hover:shadow-[0_0_35px_-2px_rgba(255,255,255,0.65)]"
                : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/25"
            }`}
          >
            <span>{landingConfig.ctaText}</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>

          <Link
            href="#how-it-works"
            className={`w-full sm:w-auto px-7 py-3.5 rounded-full font-medium text-sm sm:text-base backdrop-blur-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2.5 group cursor-pointer ${
              isDark
                ? "border border-white/20 hover:border-white/40 bg-black/60 hover:bg-black/80 text-white"
                : "border border-slate-300 hover:border-slate-400 bg-white/80 hover:bg-white text-slate-800 shadow-xs"
            }`}
          >
            <Play
              className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 ${
                isDark
                  ? "text-cyan-400 fill-cyan-400/20"
                  : "text-blue-600 fill-blue-600/20"
              }`}
            />
            <span>See How It Works</span>
          </Link>
        </div>

        {/* Trust Note */}
        <div
          className={`mt-7 flex items-center justify-center gap-2 text-xs sm:text-sm select-none ${
            isDark ? "text-slate-300" : "text-slate-600"
          }`}
        >
          <ShieldCheck
            className={`w-4 h-4 shrink-0 ${
              isDark ? "text-cyan-400" : "text-blue-600"
            }`}
          />
          <span className="font-medium">
            Human-paced workflows • Configurable daily limits • Emergency pause controls
          </span>
        </div>
      </div>
    </section>
  );
};

export default Hero;
