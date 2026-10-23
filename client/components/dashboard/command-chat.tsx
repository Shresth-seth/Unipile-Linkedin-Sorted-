"use client";

import React, { useState, useRef } from "react";
import {
  Sparkles,
  ArrowUp,
  Loader2,
  ChevronDown,
  RotateCcw,
  Check,
} from "lucide-react";
import { Campaign } from "@/lib/mock-data";
import { agentApi } from "@/lib/api";

interface CommandChatProps {
  onLaunchCampaign: (
    name: string,
    targetQuery: string,
    durationDays: number,
  ) => void;
  activeCampaign: Campaign | null;
}

const examplePrompts = [
  {
    label: "AI engineers in India",
    query:
      "Find AI engineers in India who work on generative AI and create a 7-day outreach campaign",
  },
  {
    label: "SaaS founders",
    query:
      "Connect with SaaS founders in North America building developer tools",
  },
  {
    label: "Technical recruiters",
    query:
      "Find technical recruiters hiring for machine learning engineering roles",
  },
];

export const CommandChat: React.FC<CommandChatProps> = ({
  onLaunchCampaign,
}) => {
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState<
    "People" | "Companies" | "Connections"
  >("People");
  const [duration, setDuration] = useState<number>(7);
  const [personalization, setPersonalization] = useState<
    "Basic" | "Contextual" | "High"
  >("Contextual");

  // Dropdown menus
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const [showPersonalizationMenu, setShowPersonalizationMenu] = useState(false);

  // Workflow states
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepText, setStepText] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<{
    name: string;
    target: string;
    location: string;
    focus: string[];
    durationDays: number;
    estimatedProspects: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setGeneratedPlan(null);
    setStepText("WORKPILOT Agent reasoning with Gemini & LinkedIn tools...");

    try {
      await agentApi.chat({
        messages: [{ role: "user", content: prompt }],
      });
    } catch (err) {
      console.warn("Agent reasoning notice:", err);
    }

    const hasIndia = /india/i.test(prompt);
    const hasAI = /ai|ml|engineer|generative/i.test(prompt);
    const hasSaaS = /saas|founder/i.test(prompt);

    const targetRole = hasAI
      ? "AI & ML Engineers"
      : hasSaaS
        ? "SaaS Founders & Leaders"
        : "Target Industry Professionals";

    const location = hasIndia ? "India" : "Global / Verified Remote";

    setGeneratedPlan({
      name: `${targetRole} — ${location}`,
      target: targetRole,
      location: location,
      focus: ["Automated prospect ingestion", "8–18m human-paced scheduling"],
      durationDays: duration,
      estimatedProspects: "15–25 qualified leads",
    });

    setIsGenerating(false);
  };

  const handleStartCampaign = () => {
    if (!generatedPlan) return;
    onLaunchCampaign(generatedPlan.name, prompt, generatedPlan.durationDays);
    setGeneratedPlan(null);
    setPrompt("");
  };

  const handleReset = () => {
    setGeneratedPlan(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Main Composer Box */}
      <div className="relative rounded-2xl bg-white/2 border border-white/8 hover:border-white/12 focus-within:border-white/18 transition-all p-4 sm:p-5">
        {/* Header line: ✦ Ask WORKPILOT */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-1.5 text-white/70 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Ask WORKPILOT</span>
          </div>
          {isGenerating && (
            <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
              <span>{stepText}</span>
            </div>
          )}
        </div>

        {/* Input Textarea */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe who you want to reach and what you want to achieve..."
          className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/30 resize-none outline-none min-h-21.25 sm:min-h-22.5 leading-relaxed"
          rows={3}
          disabled={isGenerating}
        />

        {/* Bottom Controls & Send Button */}
        <div className="flex items-center justify-between pt-3 border-t border-white/4">
          {/* Neutral Pills: Audience, Duration, Personalization */}
          <div className="flex items-center gap-1.5 text-[11px]">
            {/* Audience */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAudienceMenu(!showAudienceMenu);
                  setShowDurationMenu(false);
                  setShowPersonalizationMenu(false);
                }}
                className={`px-2.5 py-1 rounded-md border text-white/60 hover:text-white/90 transition-colors flex items-center gap-1 ${
                  showAudienceMenu
                    ? "bg-white/8 border-white/20 text-white"
                    : "bg-white/3 border-white/6 hover:bg-white/5"
                }`}
              >
                <span>{audience}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showAudienceMenu && (
                <div className="absolute bottom-full left-0 mb-1.5 w-32 py-1 rounded-lg bg-[#0d0e12] border border-white/10 shadow-xl z-30">
                  {(["People", "Companies", "Connections"] as const).map(
                    (opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setAudience(opt);
                          setShowAudienceMenu(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-between"
                      >
                        <span>{opt}</span>
                        {audience === opt && (
                          <Check className="w-3 h-3 text-cyan-400" />
                        )}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowDurationMenu(!showDurationMenu);
                  setShowAudienceMenu(false);
                  setShowPersonalizationMenu(false);
                }}
                className={`px-2.5 py-1 rounded-md border text-white/60 hover:text-white/90 transition-colors flex items-center gap-1 ${
                  showDurationMenu
                    ? "bg-white/8 border-white/20 text-white"
                    : "bg-white/3 border-white/6 hover:bg-white/5"
                }`}
              >
                <span>{duration} days</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showDurationMenu && (
                <div className="absolute bottom-full left-0 mb-1.5 w-32 py-1 rounded-lg bg-[#0d0e12] border border-white/10 shadow-xl z-30">
                  {[1, 3, 7, 14].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDuration(d);
                        setShowDurationMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-between"
                    >
                      <span>{d} days</span>
                      {duration === d && (
                        <Check className="w-3 h-3 text-cyan-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Personalization */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  setShowPersonalizationMenu(!showPersonalizationMenu);
                  setShowAudienceMenu(false);
                  setShowDurationMenu(false);
                }}
                className={`px-2.5 py-1 rounded-md border text-white/60 hover:text-white/90 transition-colors flex items-center gap-1 ${
                  showPersonalizationMenu
                    ? "bg-white/8 border-white/20 text-white"
                    : "bg-white/3 border-white/6 hover:bg-white/5"
                }`}
              >
                <span>{personalization}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showPersonalizationMenu && (
                <div className="absolute bottom-full left-0 mb-1.5 w-36 py-1 rounded-lg bg-[#0d0e12] border border-white/10 shadow-xl z-30">
                  {(["Basic", "Contextual", "High"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPersonalization(p);
                        setShowPersonalizationMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-between"
                    >
                      <span>{p}</span>
                      {personalization === p && (
                        <Check className="w-3 h-3 text-cyan-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Send Button: 36x36 / 40x40 rounded button with ArrowUp */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!prompt.trim() || isGenerating}
            aria-label="Send prompt"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              prompt.trim() && !isGenerating
                ? "bg-white text-black hover:bg-white/90 shadow-sm cursor-pointer"
                : "bg-white/6 text-white/30 cursor-not-allowed"
            }`}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            ) : (
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </div>

      {/* Generated Campaign Plan Preview (Clean & Minimal) */}
      {generatedPlan && (
        <div className="p-4 rounded-xl bg-white/2 border border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white/90">
                {generatedPlan.name}
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">
                Ready to launch
              </span>
            </div>
            <p className="text-white/40 text-[11px]">
              {generatedPlan.durationDays} days ·{" "}
              {generatedPlan.estimatedProspects} · Focus:{" "}
              {generatedPlan.focus.join(", ")}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-white/8 text-white/60 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Edit</span>
            </button>
            <button
              onClick={handleStartCampaign}
              className="px-4 py-1.5 rounded-lg bg-white text-black font-medium text-xs hover:bg-white/90 transition-colors"
            >
              Start Campaign
            </button>
          </div>
        </div>
      )}

      {/* Suggested Prompts Line: Max 3 subtle text suggestions */}
      {!generatedPlan && (
        <div className="px-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/40">
          <span>Try:</span>
          {examplePrompts.map((item, idx) => (
            <React.Fragment key={item.label}>
              <button
                type="button"
                onClick={() => setPrompt(item.query)}
                className="hover:text-white/80 transition-colors text-white/50 text-left"
              >
                {item.label}
              </button>
              {idx < examplePrompts.length - 1 && (
                <span className="text-white/20">·</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommandChat;
