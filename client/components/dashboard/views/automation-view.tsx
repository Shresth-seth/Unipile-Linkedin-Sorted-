"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  Zap,
  Users,
  MessageSquare,
  Save,
  Loader2,
  CheckCircle2,
  Sparkles,
  Target,
  SlidersHorizontal,
  Send,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Info,
  Briefcase,
  Code2,
  TrendingUp,
  ShoppingBag,
  Heart,
  Cpu,
  BookOpen,
  Globe,
  AlertCircle,
} from "lucide-react";
import AxiosInstance from "@/config/AxiosInstance";

// ─── Types ─────────────────────────────────────────────────────────────────

interface AgentPersona {
  talkingStyle: string;
  goal: string;
  tone: string;
  customInstructions: string;
  replyMode: "AUTO" | "DRAFT" | "OFF";
}

interface OutreachJob {
  niche: string;
  customNiche: string;
  count: number;
  messageTemplate: string;
  status: "idle" | "running" | "done" | "error";
  result?: string;
}

const TONE_OPTIONS = [
  { id: "professional", label: "Professional", emoji: "💼" },
  { id: "friendly", label: "Friendly", emoji: "😊" },
  { id: "casual", label: "Casual", emoji: "😎" },
  { id: "direct", label: "Direct", emoji: "🎯" },
  { id: "curious", label: "Curious", emoji: "🔍" },
  { id: "enthusiastic", label: "Enthusiastic", emoji: "🚀" },
];

const GOAL_OPTIONS = [
  { id: "book_meeting", label: "Book a meeting / demo call" },
  { id: "generate_leads", label: "Generate warm leads" },
  { id: "brand_awareness", label: "Build brand awareness" },
  { id: "partnerships", label: "Find partnership opportunities" },
  { id: "recruitment", label: "Recruit talent" },
  { id: "sales", label: "Direct sales outreach" },
];

const NICHE_OPTIONS = [
  { id: "founders", label: "Founders & CEOs", icon: Briefcase },
  { id: "developers", label: "Developers & Engineers", icon: Code2 },
  { id: "marketers", label: "Marketers & Growth", icon: TrendingUp },
  { id: "sales", label: "Sales Professionals", icon: ShoppingBag },
  { id: "hr", label: "HR & Recruiters", icon: Heart },
  { id: "product", label: "Product Managers", icon: Cpu },
  { id: "educators", label: "Educators & Coaches", icon: BookOpen },
  { id: "consultants", label: "Consultants & Advisors", icon: Globe },
];

const REPLY_MODE_INFO: Record<string, { color: string; bg: string; desc: string }> = {
  AUTO: {
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
    desc: "AI will automatically reply to incoming messages in real-time.",
  },
  DRAFT: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
    desc: "AI drafts a suggested reply for you to review & send manually.",
  },
  OFF: {
    color: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20",
    desc: "Automation is off. Messages are saved but no reply is generated.",
  },
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const AutomationView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<"persona" | "outreach">("persona");

  // ── Agent Persona state ──
  const [persona, setPersona] = useState<AgentPersona>({
    talkingStyle: "",
    goal: "book_meeting",
    tone: "professional",
    customInstructions: "",
    replyMode: "DRAFT",
  });
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaSaved, setPersonaSaved] = useState(false);
  const [personaError, setPersonaError] = useState("");

  // ── Outreach Job state ──
  const [outreach, setOutreach] = useState<OutreachJob>({
    niche: "founders",
    customNiche: "",
    count: 10,
    messageTemplate: "",
    status: "idle",
  });
  const [outreachError, setOutreachError] = useState("");

  // Load existing settings on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await AxiosInstance.get<{
          success: boolean;
          data?: {
            replyMode?: string;
            agentTone?: string;
            agentGoal?: string;
            agentInstructions?: string;
            personality?: string;
          };
        }>("/api/agent/settings");
        if (res.data?.data) {
          const s = res.data.data;
          setPersona((p) => ({
            ...p,
            replyMode: (s.replyMode as AgentPersona["replyMode"]) || "DRAFT",
            tone: s.agentTone || "professional",
            goal: s.agentGoal || "book_meeting",
            customInstructions: s.agentInstructions || s.personality || "",
          }));
        }
      } catch {
        // No existing settings – use defaults
      }
    })();
  }, []);

  // ── Save Persona ──
  const handleSavePersona = async () => {
    setPersonaSaving(true);
    setPersonaError("");
    try {
      await AxiosInstance.post("/api/agent/settings", {
        replyMode: persona.replyMode,
        agentTone: persona.tone,
        agentGoal: persona.goal,
        agentInstructions: persona.customInstructions || persona.talkingStyle,
      });
      setPersonaSaved(true);
      setTimeout(() => setPersonaSaved(false), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setPersonaError(error?.response?.data?.message || "Failed to save settings. Try again.");
    } finally {
      setPersonaSaving(false);
    }
  };

  // ── Launch Outreach ──
  const handleLaunchOutreach = async () => {
    if (outreach.status === "running") return;
    setOutreachError("");
    const niche = outreach.niche === "custom" ? outreach.customNiche : outreach.niche;
    if (!niche.trim()) {
      setOutreachError("Please select or enter a niche to target.");
      return;
    }
    setOutreach((o) => ({ ...o, status: "running", result: undefined }));
    try {
      const res = await AxiosInstance.post<{ success: boolean; message?: string; sent?: number }>("/api/agent/outreach-connections", {
        niche,
        count: outreach.count,
        messageTemplate: outreach.messageTemplate || undefined,
      });
      setOutreach((o) => ({
        ...o,
        status: "done",
        result: res.data?.message || `Successfully queued outreach to ${res.data?.sent ?? outreach.count} connections!`,
      }));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setOutreach((o) => ({
        ...o,
        status: "error",
        result: error?.response?.data?.message || "Failed to launch outreach. Please try again.",
      }));
    }
  };

  const modeInfo = REPLY_MODE_INFO[persona.replyMode];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white/90 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            Automation Control Center
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/40">
            Configure your AI agent&apos;s personality, and run targeted outreach to your existing connections.
          </p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/4 rounded-xl w-fit">
        {[
          { id: "persona", label: "Agent Persona", icon: Bot },
          { id: "outreach", label: "Connection Outreach", icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as "persona" | "outreach")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeSection === tab.id
                  ? "bg-white dark:bg-white/8 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── SECTION 1: Agent Persona ─────────────────────────────────────── */}
      {activeSection === "persona" && (
        <div className="space-y-5">

          {/* Reply Mode Card */}
          <div className="bg-white dark:bg-[#060708] border border-slate-200 dark:border-white/6 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ToggleRight className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white/90">Auto-Reply Mode</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/40">
              Controls how the AI responds when someone sends you a message on LinkedIn.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["AUTO", "DRAFT", "OFF"] as const).map((mode) => {
                const info = REPLY_MODE_INFO[mode];
                const isSelected = persona.replyMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setPersona((p) => ({ ...p, replyMode: mode }))}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      isSelected
                        ? `${info.bg} border-current`
                        : "border-slate-200 dark:border-white/6 hover:border-slate-300 dark:hover:border-white/10 bg-white dark:bg-[#060708]"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${info.color}`} />
                      </span>
                    )}
                    <div className={`text-sm font-bold mb-1 ${isSelected ? info.color : "text-slate-700 dark:text-white/70"}`}>
                      {mode === "AUTO" ? "🟢 AUTO" : mode === "DRAFT" ? "🟡 DRAFT" : "⚫ OFF"}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-white/40 leading-relaxed">{info.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone Selection */}
          <div className="bg-white dark:bg-[#060708] border border-slate-200 dark:border-white/6 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white/90">Conversation Tone</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/40">
              How should the AI sound when it talks to people?
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPersona((p) => ({ ...p, tone: t.id }))}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    persona.tone === t.id
                      ? "bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300"
                      : "border-slate-200 dark:border-white/6 text-slate-600 dark:text-white/50 hover:border-slate-300 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/3"
                  }`}
                >
                  <span className="text-base">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Goal Selection */}
          <div className="bg-white dark:bg-[#060708] border border-slate-200 dark:border-white/6 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white/90">Primary Goal</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/40">
              What is the main objective when the AI engages in a conversation?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setPersona((p) => ({ ...p, goal: g.id }))}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all text-left cursor-pointer ${
                    persona.goal === g.id
                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-200 dark:border-white/6 text-slate-600 dark:text-white/50 hover:border-slate-300 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/3"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${persona.goal === g.id ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/20"}`} />
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="bg-white dark:bg-[#060708] border border-slate-200 dark:border-white/6 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white/90">Custom Instructions</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/40">
              Tell the AI anything specific. E.g. &quot;Always mention WorkPilot&apos;s key feature X&quot;, &quot;Never discuss pricing&quot;,
              &quot;Focus on pain points around [topic]&quot;.
            </p>
            <textarea
              value={persona.customInstructions}
              onChange={(e) => setPersona((p) => ({ ...p, customInstructions: e.target.value }))}
              rows={4}
              placeholder="E.g. Always introduce yourself as 'Vedic from WorkPilot'. Keep messages under 3 sentences. If someone asks about pricing, say 'Let's hop on a quick call!'"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/6 rounded-xl text-xs text-slate-800 dark:text-white/80 placeholder-slate-400 dark:placeholder-white/20 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/60 focus:ring-1 focus:ring-blue-400/30 resize-none leading-relaxed transition"
            />
          </div>

          {/* Save Button */}
          {personaError && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {personaError}
            </div>
          )}
          <button
            onClick={handleSavePersona}
            disabled={personaSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            {personaSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : personaSaved ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {personaSaved ? "Saved!" : personaSaving ? "Saving..." : "Save Agent Persona"}
          </button>
        </div>
      )}

      {/* ─── SECTION 2: Connection Outreach ───────────────────────────────── */}
      {activeSection === "outreach" && (
        <div className="space-y-5">

          {/* Info Banner */}
          <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-500/8 border border-blue-200 dark:border-blue-500/20 rounded-xl">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              This sends a personalized message to your <strong>existing LinkedIn connections</strong> who match the selected niche.
              The AI will craft a contextual message using your persona settings above.
            </p>
          </div>

          {/* Niche Selection */}
          <div className="bg-white dark:bg-[#060708] border border-slate-200 dark:border-white/6 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white/90">Target Niche</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/40">
              Which type of professionals from your existing connections should receive this message?
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {NICHE_OPTIONS.map((n) => {
                const Icon = n.icon;
                const isSelected = outreach.niche === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setOutreach((o) => ({ ...o, niche: n.id }))}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/30 text-blue-700 dark:text-blue-300"
                        : "border-slate-200 dark:border-white/6 text-slate-600 dark:text-white/50 hover:border-slate-300 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/3"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? "text-blue-500" : "text-slate-400 dark:text-white/30"}`} />
                    <span className="text-[11px] font-medium leading-tight">{n.label}</span>
                  </button>
                );
              })}

              {/* Custom niche */}
              <button
                onClick={() => setOutreach((o) => ({ ...o, niche: "custom" }))}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center cursor-pointer ${
                  outreach.niche === "custom"
                    ? "bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/30 text-blue-700 dark:text-blue-300"
                    : "border-dashed border-slate-300 dark:border-white/10 text-slate-500 dark:text-white/30 hover:border-slate-400 dark:hover:border-white/20"
                }`}
              >
                <SlidersHorizontal className={`w-5 h-5 ${outreach.niche === "custom" ? "text-blue-500" : "text-slate-400 dark:text-white/30"}`} />
                <span className="text-[11px] font-medium leading-tight">Custom...</span>
              </button>
            </div>

            {outreach.niche === "custom" && (
              <input
                type="text"
                value={outreach.customNiche}
                onChange={(e) => setOutreach((o) => ({ ...o, customNiche: e.target.value }))}
                placeholder="e.g. SaaS startup CTOs, VC partners, AI researchers..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/6 rounded-xl text-xs text-slate-800 dark:text-white/80 placeholder-slate-400 dark:placeholder-white/20 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/60 focus:ring-1 focus:ring-blue-400/30 transition"
              />
            )}
          </div>

          {/* Count Slider */}
          <div className="bg-white dark:bg-[#060708] border border-slate-200 dark:border-white/6 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white/90">How Many People?</h3>
              </div>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{outreach.count}</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={outreach.count}
              onChange={(e) => setOutreach((o) => ({ ...o, count: parseInt(e.target.value) }))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-white/25">
              <span>1 person</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100 people</span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-white/30 flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              LinkedIn rate limits apply. We recommend ≤ 20–30 per day to stay safe.
            </p>
          </div>

          {/* Optional Custom Message */}
          <div className="bg-white dark:bg-[#060708] border border-slate-200 dark:border-white/6 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white/90">
                Message Template <span className="text-[10px] font-normal text-slate-400 dark:text-white/30">(Optional)</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/40">
              Leave blank to let the AI write a fully personalized message based on your persona. Or provide a template the AI will adapt per person.
            </p>
            <textarea
              value={outreach.messageTemplate}
              onChange={(e) => setOutreach((o) => ({ ...o, messageTemplate: e.target.value }))}
              rows={3}
              placeholder="Hi {name}, I noticed you work in {niche} and wanted to reach out because..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/6 rounded-xl text-xs text-slate-800 dark:text-white/80 placeholder-slate-400 dark:placeholder-white/20 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/60 focus:ring-1 focus:ring-blue-400/30 resize-none leading-relaxed transition"
            />
          </div>

          {/* Error */}
          {outreachError && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {outreachError}
            </div>
          )}

          {/* Result Banner */}
          {outreach.result && (
            <div
              className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs border ${
                outreach.status === "done"
                  ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400"
              }`}
            >
              {outreach.status === "done" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{outreach.result}</span>
            </div>
          )}

          {/* Launch Button */}
          <button
            onClick={handleLaunchOutreach}
            disabled={outreach.status === "running"}
            className="flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm shadow-blue-500/20 w-full sm:w-auto justify-center"
          >
            {outreach.status === "running" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Launching outreach...</>
            ) : outreach.status === "done" ? (
              <><CheckCircle2 className="w-4 h-4" /> Launch Another Outreach</>
            ) : (
              <><Send className="w-4 h-4" /> Launch Outreach to {outreach.count} Connections</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default AutomationView;
