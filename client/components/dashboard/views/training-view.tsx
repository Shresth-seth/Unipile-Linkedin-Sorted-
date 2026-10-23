"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Save, Loader2, Bot, Zap, MessageSquarePlus } from "lucide-react";
import { agentApi } from "@/lib/api";

export const TrainingView = () => {
  const [personality, setPersonality] = useState<string>(
    "Act as a professional, direct, and thoughtful outreach partner. Write natural, concise LinkedIn messages and connection notes that spark authentic professional conversations. Never sound robotic or use aggressive sales pitches.",
  );
  const [companyKnowledge, setCompanyKnowledge] = useState<string>("");
  const [faq, setFaq] = useState<string>("");
  const [dailyQuota, setDailyQuota] = useState<number>(10);
  const [autoNewConnectionMessage, setAutoNewConnectionMessage] = useState<boolean>(true);
  const [newConnectionMessageTemplate, setNewConnectionMessageTemplate] = useState<string>("");

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await agentApi.getSettings();
        if (res?.data) {
          const s = res.data;
          if (s.personality) setPersonality(s.personality);
          if (s.companyKnowledge) setCompanyKnowledge(s.companyKnowledge);
          if (s.faq) setFaq(s.faq);
          if (s.dailyQuota !== undefined) setDailyQuota(s.dailyQuota);
          if (s.autoNewConnectionMessage !== undefined) setAutoNewConnectionMessage(s.autoNewConnectionMessage);
          if (s.newConnectionMessageTemplate) setNewConnectionMessageTemplate(s.newConnectionMessageTemplate);
        }
      } catch (err) {
        console.warn("Could not load agent settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await agentApi.saveSettings({
        personality: personality.trim(),
        companyKnowledge: companyKnowledge.trim(),
        faq: faq.trim(),
        dailyQuota,
        autoNewConnectionMessage,
        newConnectionMessageTemplate: newConnectionMessageTemplate.trim(),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save training:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Bot className="w-5 h-5" />
          </div>
          Agent Knowledge Base
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-white/60 max-w-2xl">
          Train your AI agent with everything it needs to represent your business authentically. 
          This knowledge is injected into every automated interaction.
        </p>
      </div>

      <div className="space-y-6">

        {/* NEW CONNECTION AUTO-MESSAGE CARD */}
        <div className="rounded-2xl bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex items-center justify-center shrink-0">
                <MessageSquarePlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Auto-Message New Connections
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
                  Automatically send a personalized opening message when someone accepts your connection request.
                </p>
              </div>
            </div>
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setAutoNewConnectionMessage(!autoNewConnectionMessage)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                autoNewConnectionMessage ? "bg-blue-600" : "bg-slate-300 dark:bg-white/15"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  autoNewConnectionMessage ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {autoNewConnectionMessage && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2 border border-amber-200 dark:border-amber-500/20">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>When left blank, Gemini AI will auto-generate a personalized message using your company knowledge above. Or define your own template below.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/60 mb-2">
                  Custom Template <span className="font-normal text-slate-400 dark:text-white/30">(optional — leave blank for AI-generated)</span>
                </label>
                <textarea
                  value={newConnectionMessageTemplate}
                  onChange={(e) => setNewConnectionMessageTemplate(e.target.value)}
                  rows={4}
                  placeholder={"Hi {{firstName}}, thanks for connecting! I noticed you're working on {{role}} — I'd love to catch up sometime.\n\nAvailable variables: {{firstName}}, {{name}}, {{company}}, {{role}}"}
                  className="w-full p-4 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* TONE OF VOICE */}
        <div className="rounded-2xl bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Tone of Voice & Personality Rules
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
                Instructions for how your AI should talk, reason, and write.
              </p>
            </div>
          </div>
          <textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            rows={5}
            placeholder="Describe your agent's personality, tone, and rules..."
            className="w-full p-4 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none"
          />
        </div>

        {/* COMPANY KNOWLEDGE */}
        <div className="rounded-2xl bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Company & Product Knowledge
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
                Facts, product details, pricing, and value propositions the agent should know when replying.
              </p>
            </div>
          </div>
          <textarea
            value={companyKnowledge}
            onChange={(e) => setCompanyKnowledge(e.target.value)}
            rows={6}
            placeholder={`Example:\nWe are Acme Corp. We sell enterprise software.\nPricing starts at $99/mo.\nOur main feature is AI-driven analytics.`}
            className="w-full p-4 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none"
          />
        </div>

        {/* FAQ */}
        <div className="rounded-2xl bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                FAQ & Objection Handling
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
                Guide the agent on handling common questions and pushback.
              </p>
            </div>
          </div>
          <textarea
            value={faq}
            onChange={(e) => setFaq(e.target.value)}
            rows={6}
            placeholder={`Example:\nQ: Not interested right now.\nA: Acknowledge politely and leave the door open.\n\nQ: Send me more info.\nA: Share the link and ask what specifically they are looking for.`}
            className="w-full p-4 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none"
          />
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 lg:bottom-10 right-6 lg:right-10 z-50">
        <button
          onClick={handleSave}
          disabled={isSaving || isSaved}
          className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm shadow-xl transition-all ${
            isSaved
              ? "bg-emerald-500 text-white"
              : isSaving
                ? "bg-slate-800 text-white/70"
                : "bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 active:scale-95 hover:shadow-blue-500/25"
          }`}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSaved ? (
            <Sparkles className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save All Settings"}
        </button>
      </div>
    </div>
  );
};
