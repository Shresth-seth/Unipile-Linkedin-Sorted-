"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  Check,
  Key,
  ShieldCheck,
  ExternalLink,
  Loader2,
  AlertCircle,
  RotateCcw,
  Eye,
  EyeOff,
  Bot,
  Zap,
} from "lucide-react";
import { settingsApi } from "@/lib/api";

interface GeminiIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

const GEMINI_MODELS = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash (Recommended)",
    desc: "Ultra-fast latency, high throughput, perfect for live LinkedIn chat & auto-replies.",
    tag: "Recommended",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    desc: "Lightweight, reliable, and cost-effective for daily lead triage.",
    tag: "Fast",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    desc: "Deep analytical reasoning, multi-turn context, and nuanced company profiling.",
    tag: "High Reasoning",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    desc: "Flagship intelligence model for high-stakes executive outreach and complex accounts.",
    tag: "Flagship",
  },
];

export const GeminiIntegrationModal: React.FC<GeminiIntegrationModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [isCustom, setIsCustom] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadConfig = async () => {
      setIsLoading(true);
      setTestSuccess(null);
      setTestError(null);
      setStatusMessage(null);
      try {
        const res = await settingsApi.getGeminiConfig();
        if (res.success && res.data) {
          setIsCustom(res.data.isCustom);
          setMaskedKey(res.data.maskedKey);
          if (res.data.model) {
            setSelectedModel(res.data.model);
          }
        }
      } catch (err) {
        console.warn("Could not load user Gemini config:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestSuccess(null);
    setTestError(null);

    try {
      const res = await settingsApi.testGeminiConfig({
        apiKey: apiKey.trim() || undefined,
        model: selectedModel,
      });

      if (res.success) {
        setTestSuccess(res.message || "Gemini connection verified successfully!");
      } else {
        setTestError("Connection test failed. Please verify your API key.");
      }
    } catch (err: any) {
      setTestError(
        err.response?.data?.message || err.message || "Failed to reach Google Gemini API.",
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTestSuccess(null);
    setTestError(null);

    try {
      const res = await settingsApi.updateGeminiConfig({
        apiKey: apiKey.trim() || undefined,
        model: selectedModel,
      });

      if (res.success) {
        setIsCustom(res.data.isCustom);
        setMaskedKey(res.data.maskedKey);
        setApiKey("");
        setStatusMessage("✨ Gemini configuration saved and verified!");
        onConfigChanged?.();
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err: any) {
      setTestError(
        err.response?.data?.message || err.message || "Failed to save Gemini configuration.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertToDefault = async () => {
    if (!confirm("Revert back to the workspace default Gemini API key?")) return;

    setIsReverting(true);
    setTestSuccess(null);
    setTestError(null);

    try {
      const res = await settingsApi.deleteGeminiConfig();
      if (res.success) {
        setIsCustom(false);
        setMaskedKey(null);
        setApiKey("");
        if (res.data?.model) setSelectedModel(res.data.model);
        setStatusMessage("Reverted to workspace default Gemini key.");
        onConfigChanged?.();
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err: any) {
      setTestError(err.response?.data?.message || err.message || "Failed to reset key.");
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-white/6 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Google Gemini AI Settings
                </h2>
                {isCustom ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    Personal Key Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                    Workspace Default
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                Configure your personal Google Gemini API key for private quotas & custom models.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-cyan-400" />
              <span className="text-xs">Loading AI settings...</span>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              {/* BYOK Info Banner */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/15 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Multi-Tenant Key Isolation:
                  </span>{" "}
                  Your API key is securely isolated to your account. All autonomous replies, outreach personalization, and Copilot chats will execute exclusively on your private Gemini quota.
                </div>
              </div>

              {/* Status Feedback Banners */}
              {statusMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {testSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{testSuccess}</span>
                </div>
              )}

              {testError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{testError}</span>
                </div>
              )}

              {/* API Key Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-white/80 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                    <span>Gemini API Key</span>
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>Get free key at Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      isCustom && maskedKey
                        ? `Configured (${maskedKey}) — enter new key to replace`
                        : "AIzaSy..."
                    }
                    className="w-full pl-3 pr-10 py-2.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-white/40">
                  Leave blank to retain your currently saved key or use the workspace default.
                </p>
              </div>

              {/* Preferred Model Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-white/80 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  <span>Gemini Model Engine</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {GEMINI_MODELS.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between ${
                          isSelected
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-xs"
                            : "border-slate-200 dark:border-white/6 hover:border-slate-300 dark:hover:border-white/10 bg-white dark:bg-white/[0.02]"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold ${
                                isSelected
                                  ? "text-blue-700 dark:text-cyan-300"
                                  : "text-slate-800 dark:text-white/85"
                              }`}
                            >
                              {m.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 dark:bg-white/6 text-slate-600 dark:text-white/50">
                              {m.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-white/45">
                            {m.desc}
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 dark:border-cyan-400 dark:bg-cyan-400 text-white dark:text-black"
                              : "border-slate-300 dark:border-white/20"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || (!apiKey.trim() && !isCustom)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-white/4 transition-colors flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>Test Connection</span>
                  </button>

                  {isCustom && (
                    <button
                      type="button"
                      onClick={handleRevertToDefault}
                      disabled={isReverting}
                      className="px-3 py-2 rounded-xl border border-transparent text-xs font-medium text-slate-500 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Revert to Default</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Save API Key</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
