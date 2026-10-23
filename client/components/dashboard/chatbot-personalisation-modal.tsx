"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Bot,
  X,
  Save,
  Check,
  Power,
  ShieldCheck,
  Brain,
  Sliders,
  MessageSquare,
  BookOpen,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { conversationApi } from "@/lib/api";

interface ChatbotPersonalisationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: (isEnabled: boolean) => void;
}

const PERSONALITY_PRESETS = [
  {
    id: "concise",
    label: "Direct & Concise",
    desc: "Human peer tone, listens & answers in 1-2 compact sentences.",
    text: "Talk like an authentic human peer texting on LinkedIn. Actively listen and directly address what the other person actually said in 1-2 punchy, compact sentences. Zero AI fluff, no buzzwords, no corporate boilerplate.",
  },
  {
    id: "warm",
    label: "Warm & Conversational",
    desc: "Authentic, friendly, listens with empathy, 1-2 sentences.",
    text: "Warm, genuine human professional. Truly listen to what the other person shared, acknowledge their specific points with empathy, and keep replies compact (1-2 natural sentences). Never sound like an automated bot.",
  },
  {
    id: "technical",
    label: "Technical Founder",
    desc: "Engineer-to-engineer, direct answers, zero marketing fluff.",
    text: "Engineering founder peer. Actively listen to their technical questions and answer directly in 1-2 compact, natural sentences without marketing jargon or AI clichés.",
  },
  {
    id: "executive",
    label: "Executive Peer",
    desc: "High EQ, respectful, acknowledges context, compact.",
    text: "Senior executive leader. Directly acknowledge what the other person said, focus on practical outcomes, and keep replies concise, natural, and respectful (1-2 sentences).",
  },
];

export const ChatbotPersonalisationModal: React.FC<ChatbotPersonalisationModalProps> = ({
  isOpen,
  onClose,
  onStatusChanged,
}) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [replyMode, setReplyMode] = useState<"AUTO" | "DRAFT" | "OFF">("AUTO");
  const [personality, setPersonality] = useState(
    "Talk like an authentic human peer texting on LinkedIn. Actively listen and directly address what the other person actually said in 1-2 punchy, compact sentences. Zero AI fluff, no buzzwords, no corporate boilerplate.",
  );
  const [companyKnowledge, setCompanyKnowledge] = useState("");
  const [faq, setFaq] = useState("");
  const [networkingGoal, setNetworkingGoal] = useState(
    "explore collaboration and coordinate a meeting or quick demo call",
  );
  const [meetingLink, setMeetingLink] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState("");

  // Load existing settings
  useEffect(() => {
    if (!isOpen) return;

    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const res = await conversationApi.getChatbotStatus();
        if (res.success && res.data) {
          setIsEnabled(res.data.isEnabled);
          setReplyMode((res.data.replyMode as any) || "AUTO");
          if (res.data.personality) setPersonality(res.data.personality);
          if (res.data.companyKnowledge) setCompanyKnowledge(res.data.companyKnowledge);
          if (res.data.faq) setFaq(res.data.faq);
          if (res.data.networkingGoal) setNetworkingGoal(res.data.networkingGoal);
        }
      } catch (err) {
        console.warn("Could not fetch chatbot config:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTogglePower = () => {
    const nextState = !isEnabled;
    setIsEnabled(nextState);
    if (!nextState) {
      setReplyMode("OFF");
    } else {
      setReplyMode("AUTO");
    }
  };

  const handleApplyPreset = (presetText: string) => {
    setPersonality(presetText);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusFeedback("");
    try {
      const combinedFaq = meetingLink
        ? `${faq ? `${faq}\n` : ""}Meeting / Calendar Booking Link: ${meetingLink.trim()}`
        : faq;

      const res = await conversationApi.toggleChatbot({
        enabled: isEnabled,
        replyMode: isEnabled ? replyMode : "OFF",
        personality: personality.trim(),
        companyKnowledge: companyKnowledge.trim(),
        faq: combinedFaq.trim(),
        networkingGoal: networkingGoal.trim(),
      });

      if (res.success) {
        setSaveSuccess(true);
        setStatusFeedback(
          isEnabled
            ? "🚀 Chatbot Personalisation saved and turned ON."
            : "✋ Chatbot saved and turned OFF (Human takeover).",
        );
        onStatusChanged?.(isEnabled);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error("Save chatbot error:", err);
      setStatusFeedback(err.message || "Failed to save chatbot settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-purple-50/70 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-purple-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Bot className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Chatbot Personalisation & Master Controls
                </h2>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-700 dark:text-cyan-300 font-semibold border border-blue-500/20">
                  Gemini AI
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-white/50">
                Configure your AI Copilot personality, tone, objection handling, and switch it ON or OFF.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          {/* Section 1: Master ON / OFF Switch */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Chatbot Master Switch
                </span>
                {isEnabled ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>ON (Active)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-2 py-0.5 rounded-full">
                    <Power className="w-3 h-3 text-amber-500" />
                    <span>OFF (Human Takeover)</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-white/50 max-w-md">
                {isEnabled
                  ? "Chatbot is actively reasoning, personalizing messages, and assisting in conversation threads."
                  : "Chatbot is completely paused. No automated messages or draft replies will trigger until turned ON."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleTogglePower}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                isEnabled
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                  : "bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white"
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{isEnabled ? "Turn Chatbot OFF" : "Turn Chatbot ON"}</span>
            </button>
          </div>

          {/* Section 2: Mode Selector */}
          {isEnabled && (
            <div className="space-y-2">
              <label className="font-semibold text-slate-900 dark:text-white block">
                Operating Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReplyMode("AUTO")}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    replyMode === "AUTO"
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-600/10 dark:border-blue-500"
                      : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Auto-Pilot Mode</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-white/50 mt-1">
                    AI reasons and drafts replies directly on your behalf with human takeover safety.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setReplyMode("DRAFT")}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    replyMode === "DRAFT"
                      ? "border-purple-600 bg-purple-50/50 dark:bg-purple-600/10 dark:border-purple-500"
                      : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Co-Pilot Draft Only</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-white/50 mt-1">
                    Prepares high-context drafts with thinking steps for human review before sending.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Section 3: Personality Presets */}
          <div className="space-y-2.5">
            <label className="font-semibold text-slate-900 dark:text-white block">
              Personality & Communication Tone
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PERSONALITY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p.text)}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    personality === p.text
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-600/10"
                      : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {p.label}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-white/40 line-clamp-2 mt-0.5">
                    {p.desc}
                  </div>
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Describe your custom personality (e.g. tone, sentence length, behavior)..."
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 text-[11px] text-blue-700 dark:text-blue-300">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>
                <strong>Human-First Response Engine:</strong> WorkPilot actively listens to what the other person is saying, answers their exact points, bans robotic AI clichés, and keeps replies compact (1–2 sentences).
              </span>
            </div>
          </div>

          {/* Section 4: Company Knowledge & Objection Handling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                <span>Product / Company Knowledge</span>
              </label>
              <textarea
                rows={3}
                value={companyKnowledge}
                onChange={(e) => setCompanyKnowledge(e.target.value)}
                placeholder="What does your company do? Core value proposition, target customers, and product highlights..."
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-[11px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                <span>Objection Handling & FAQ</span>
              </label>
              <textarea
                rows={3}
                value={faq}
                onChange={(e) => setFaq(e.target.value)}
                placeholder="How to answer pricing questions, competition, implementation time, or common objections..."
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-[11px]"
              />
            </div>
          </div>

          {/* Section 5: Networking Goal & Calendar Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-900 dark:text-white block">
                Primary Conversational Goal
              </label>
              <input
                type="text"
                value={networkingGoal}
                onChange={(e) => setNetworkingGoal(e.target.value)}
                placeholder="e.g. Schedule a 15-min call, product demo, partnership discussion"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 text-[11px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>Booking / Meeting Link</span>
              </label>
              <input
                type="text"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://cal.com/your-name or https://calendly.com/..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 text-[11px]"
              />
            </div>
          </div>

          {/* Section 6: Outreach Brain Status Bar */}
          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold">Outreach Brain Deduplication Guard:</span>
                <span className="ml-1 text-[11px] text-emerald-700 dark:text-emerald-300/80">
                  Cross-domain collision prevention & pitch diversification enabled.
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400">
              Protected
            </span>
          </div>

          {statusFeedback && (
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-medium text-xs flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>{statusFeedback}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-md shadow-blue-500/20"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save & Apply"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
