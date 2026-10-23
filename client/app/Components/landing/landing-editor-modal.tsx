"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, RotateCcw, Check, Edit3, Palette } from "lucide-react";

export interface LandingConfig {
  badge: string;
  headline1: string;
  headline2: string;
  description: string;
  ctaText: string;
}

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  badge: "SAFE & CLOUD-BASED LINKEDIN AUTOMATION",
  headline1: "Full LinkedIn Automation.",
  headline2: "Built to Scale Safely.",
  description:
    "Organize connection requests, follow-ups, and profile visits with configurable pacing and account-level controls. Keep every campaign visible, reviewable, and easy to pause.",
  ctaText: "Start Automating Free",
};

interface LandingEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LandingEditorModal: React.FC<LandingEditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<LandingConfig>(DEFAULT_LANDING_CONFIG);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("WORKPILOT_landing_customization");
      if (stored) {
        setConfig(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      localStorage.setItem(
        "WORKPILOT_landing_customization",
        JSON.stringify(config),
      );
      window.dispatchEvent(
        new CustomEvent("WORKPILOT_landing_updated", { detail: config }),
      );
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 700);
    } catch {
      // ignore
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_LANDING_CONFIG);
    try {
      localStorage.removeItem("WORKPILOT_landing_customization");
      window.dispatchEvent(
        new CustomEvent("WORKPILOT_landing_updated", {
          detail: DEFAULT_LANDING_CONFIG,
        }),
      );
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 700);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 dark:bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl my-auto rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#090d16] text-slate-900 dark:text-white shadow-2xl p-5 sm:p-7 overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-1/4 w-72 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-500/15 border border-cyan-300 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Customize Landing Page
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/25">
                  Live Editor
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Edit header taglines, hero headline, and call-to-action in real
                time.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Edit Form Fields */}
        <div className="space-y-4 py-5 max-h-[60vh] overflow-y-auto pr-1">
          {/* Announcement Badge */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Top Announcement Badge
            </label>
            <input
              type="text"
              value={config.badge}
              onChange={(e) => setConfig({ ...config, badge: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-blue-500/30 dark:focus:ring-cyan-400/30 transition-all font-mono"
              placeholder="e.g. SAFE & CLOUD-BASED LINKEDIN AUTOMATION"
            />
          </div>

          {/* Headline Line 1 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Main Headline (Line 1)
            </label>
            <input
              type="text"
              value={config.headline1}
              onChange={(e) =>
                setConfig({ ...config, headline1: e.target.value })
              }
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-blue-500/30 dark:focus:ring-cyan-400/30 transition-all"
              placeholder="e.g. Full LinkedIn Automation."
            />
          </div>

          {/* Headline Line 2 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Headline Accent (Line 2)
            </label>
            <input
              type="text"
              value={config.headline2}
              onChange={(e) =>
                setConfig({ ...config, headline2: e.target.value })
              }
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-blue-500/30 dark:focus:ring-cyan-400/30 transition-all"
              placeholder="e.g. Built to Scale Safely."
            />
          </div>

          {/* Subtitle / Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Hero Subtitle & Description
            </label>
            <textarea
              rows={3}
              value={config.description}
              onChange={(e) =>
                setConfig({ ...config, description: e.target.value })
              }
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-blue-500/30 dark:focus:ring-cyan-400/30 transition-all resize-none leading-relaxed"
              placeholder="Describe your value proposition..."
            />
          </div>

          {/* Primary CTA Label */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Primary CTA Button Label
            </label>
            <input
              type="text"
              value={config.ctaText}
              onChange={(e) =>
                setConfig({ ...config, ctaText: e.target.value })
              }
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-blue-500/30 dark:focus:ring-cyan-400/30 transition-all"
              placeholder="e.g. Start Automating Free"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10 text-xs">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-blue-600 dark:bg-cyan-400 hover:bg-blue-500 dark:hover:bg-cyan-300 text-white dark:text-black font-semibold shadow-md shadow-blue-600/25 dark:shadow-[0_0_15px_-2px_rgba(6,182,212,0.5)] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Applied!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingEditorModal;
