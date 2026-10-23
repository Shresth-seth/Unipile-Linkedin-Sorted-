"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Database,
  Zap,
  Sparkles,
  KeyRound,
  Bot,
} from "lucide-react";
import { adminApi, UnipileSettingsData, GeminiSettingsData } from "@/lib/api";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"gemini" | "unipile">("gemini");
  const [isLoading, setIsLoading] = useState(true);

  // ─────────────────────────────────────────────
  // 1. Google Gemini State
  // ─────────────────────────────────────────────
  const [geminiSettings, setGeminiSettings] = useState<GeminiSettingsData | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{
    success: boolean;
    message: string;
    model?: string;
  } | null>(null);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [geminiSaveFeedback, setGeminiSaveFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // ─────────────────────────────────────────────
  // 2. Unipile State
  // ─────────────────────────────────────────────
  const [unipileSettings, setUnipileSettings] = useState<UnipileSettingsData | null>(null);
  const [unipileDsn, setUnipileDsn] = useState("");
  const [unipileApiKey, setUnipileApiKey] = useState("");
  const [costPerAccount, setCostPerAccount] = useState("8.00");
  const [showUnipileKey, setShowUnipileKey] = useState(false);
  const [isTestingUnipile, setIsTestingUnipile] = useState(false);
  const [unipileTestResult, setUnipileTestResult] = useState<{
    success: boolean;
    message: string;
    status?: number;
    accountCount?: number;
  } | null>(null);
  const [isSavingUnipile, setIsSavingUnipile] = useState(false);
  const [unipileSaveFeedback, setUnipileSaveFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fetchAllSettings = async () => {
    setIsLoading(true);
    try {
      const [geminiRes, unipileRes] = await Promise.all([
        adminApi.getGeminiSettings().catch(() => ({ success: false, data: null })),
        adminApi.getUnipileSettings().catch(() => ({ success: false, data: null })),
      ]);

      if (geminiRes.success && geminiRes.data) {
        setGeminiSettings(geminiRes.data);
        setGeminiModel(geminiRes.data.model || "gemini-2.5-flash");
      }

      if (unipileRes.success && unipileRes.data) {
        setUnipileSettings(unipileRes.data);
        setUnipileDsn(unipileRes.data.dsn || "");
        setCostPerAccount(String(unipileRes.data.estimatedCostPerAccount || "8.00"));
      }
    } catch (err: any) {
      console.error("Failed to load admin settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  // ─────────────────────────────────────────────
  // Gemini Handlers
  // ─────────────────────────────────────────────
  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult(null);
    setGeminiSaveFeedback(null);

    try {
      const res = await adminApi.testGeminiConnection({
        apiKey: geminiApiKey.trim() || undefined,
        model: geminiModel.trim() || undefined,
      });

      setGeminiTestResult({
        success: res.success,
        message: res.message,
        model: res.model,
      });
    } catch (err: any) {
      setGeminiTestResult({
        success: false,
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Gemini connection test failed.",
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleSaveGemini = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGemini(true);
    setGeminiSaveFeedback(null);

    try {
      const payload: { apiKey?: string; model?: string } = {
        model: geminiModel.trim(),
      };
      if (geminiApiKey.trim()) {
        payload.apiKey = geminiApiKey.trim();
      }

      const res = await adminApi.updateGeminiSettings(payload);
      if (res.success) {
        setGeminiSaveFeedback({
          success: true,
          message: "Gemini AI configuration updated successfully. All agent workflows will now use these credentials.",
        });
        setGeminiApiKey("");
        const fresh = await adminApi.getGeminiSettings();
        if (fresh.success && fresh.data) {
          setGeminiSettings(fresh.data);
        }
      }
    } catch (err: any) {
      setGeminiSaveFeedback({
        success: false,
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update Gemini settings.",
      });
    } finally {
      setIsSavingGemini(false);
    }
  };

  // ─────────────────────────────────────────────
  // Unipile Handlers
  // ─────────────────────────────────────────────
  const handleTestUnipile = async () => {
    setIsTestingUnipile(true);
    setUnipileTestResult(null);
    setUnipileSaveFeedback(null);

    try {
      const res = await adminApi.testUnipileConnection({
        dsn: unipileDsn.trim() || undefined,
        apiKey: unipileApiKey.trim() || undefined,
      });

      setUnipileTestResult({
        success: res.success,
        message: res.message,
        status: res.unipileStatus,
        accountCount: res.remoteAccountCount,
      });
    } catch (err: any) {
      setUnipileTestResult({
        success: false,
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Test connection failed.",
      });
    } finally {
      setIsTestingUnipile(false);
    }
  };

  const handleSaveUnipile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUnipile(true);
    setUnipileSaveFeedback(null);

    try {
      const payload: {
        dsn?: string;
        apiKey?: string;
        estimatedCostPerAccount?: number;
      } = {
        dsn: unipileDsn.trim(),
        estimatedCostPerAccount: parseFloat(costPerAccount) || 8.0,
      };

      if (unipileApiKey.trim()) {
        payload.apiKey = unipileApiKey.trim();
      }

      const res = await adminApi.updateUnipileSettings(payload);
      if (res.success) {
        setUnipileSaveFeedback({
          success: true,
          message: "Unipile configuration updated successfully.",
        });
        setUnipileApiKey("");
        const fresh = await adminApi.getUnipileSettings();
        if (fresh.success && fresh.data) {
          setUnipileSettings(fresh.data);
        }
      }
    } catch (err: any) {
      setUnipileSaveFeedback({
        success: false,
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update Unipile settings.",
      });
    } finally {
      setIsSavingUnipile(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-xs text-white/40 flex flex-col items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
        <span>Loading system configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white/95">
            System Master Configuration
          </h2>
          <p className="text-xs text-white/45 mt-0.5">
            Manage AI reasoning models, API keys, and Unipile LinkedIn gateway routing
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center p-1 rounded-xl bg-white/4 border border-white/8">
          <button
            onClick={() => setActiveTab("gemini")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "gemini"
                ? "bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-sm"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Google Gemini AI</span>
          </button>

          <button
            onClick={() => setActiveTab("unipile")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "unipile"
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm"
                : "text-white/60 hover:text-white"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            <span>Unipile LinkedIn</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: GOOGLE GEMINI AI CONFIGURATION */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "gemini" && (
        <div className="space-y-6">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-semibold text-white/95">
                Google Gemini Intelligence Engine
              </h3>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                  geminiSettings?.isConfigured
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {geminiSettings?.isConfigured ? "Connected" : "Missing Key"}
              </span>
            </div>
            <span className="text-[11px] font-mono text-white/40">
              Active Model: <span className="text-purple-300 font-semibold">{geminiSettings?.model || "gemini-2.5-flash"}</span>
            </span>
          </div>

          {/* Feedback Messages */}
          {geminiSaveFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
                geminiSaveFeedback.success
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border border-red-500/20 text-red-300"
              }`}
            >
              <span>{geminiSaveFeedback.message}</span>
              <button
                onClick={() => setGeminiSaveFeedback(null)}
                className="text-white/40 hover:text-white text-xs px-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Test Connection Results */}
          {geminiTestResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                geminiTestResult.success
                  ? "bg-emerald-500/7 border-emerald-500/30 text-emerald-200"
                  : "bg-red-500/7 border-red-500/30 text-red-200"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {geminiTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span>{geminiTestResult.message}</span>
              </div>
              {geminiTestResult.model && (
                <p className="font-mono text-[11px] text-white/70 pl-6">
                  Verified with model: {geminiTestResult.model}
                </p>
              )}
            </div>
          )}

          {/* Active Source Card */}
          <div className="p-4 rounded-xl bg-[#090b10] border border-white/6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white/90">
                  Active Credential Provider
                </div>
                <div className="text-[11px] text-white/40 font-mono">
                  Source:{" "}
                  {geminiSettings?.source === "DATABASE" ? (
                    <span className="text-purple-400 font-medium">Database (Dynamic Admin Override)</span>
                  ) : (
                    <span className="text-amber-400/80 font-medium">Environment Variables (.env Fallback)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] text-white/40">Active Key Mask</div>
              <div className="text-xs font-mono text-purple-300">
                {geminiSettings?.apiKeyMasked || "None"}
              </div>
            </div>
          </div>

          {/* Gemini Form */}
          <form
            onSubmit={handleSaveGemini}
            className="p-6 rounded-xl bg-[#090b10] border border-white/6 space-y-6"
          >
            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1.5 font-mono uppercase tracking-wider">
                  Google Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type={showGeminiKey ? "text" : "password"}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder={
                      geminiSettings?.apiKeyMasked
                        ? `Current: ${geminiSettings.apiKeyMasked}`
                        : "AIzaSy..."
                    }
                    className="w-full h-10 pl-3 pr-10 rounded-lg bg-white/3 border border-white/8 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-3 text-white/40 hover:text-white"
                  >
                    {showGeminiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-white/40 mt-1">
                  Setting this overrides the environment variable. Leave blank to preserve the currently saved API key or use .env fallback.
                </p>
              </div>

              {/* Model Selector */}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1.5 font-mono uppercase tracking-wider">
                  Inference Model
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Recommended: Ultra fast & cost-efficient" },
                    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Deep reasoning & complex synthesis" },
                    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", desc: "Standard production fallback" },
                  ].map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setGeminiModel(m.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        geminiModel === m.id
                          ? "bg-purple-500/15 border-purple-500/40 text-white"
                          : "bg-white/2 border-white/6 hover:border-white/15 text-white/70"
                      }`}
                    >
                      <div className="text-xs font-medium">{m.label}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{m.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5">
                  <input
                    type="text"
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    placeholder="Custom model identifier (e.g. gemini-2.5-flash)"
                    className="w-full h-9 px-3 rounded-lg bg-white/2 border border-white/6 text-xs font-mono text-white/80 focus:outline-none focus:border-purple-500/40"
                  />
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-4 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestGemini}
                disabled={isTestingGemini}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-white/10 hover:border-white/25 bg-white/2 text-white/80 hover:text-white transition-colors"
              >
                {isTestingGemini ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span>{isTestingGemini ? "Testing Gemini..." : "Test Connection"}</span>
              </button>

              <button
                type="submit"
                disabled={isSavingGemini}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs bg-purple-500 hover:bg-purple-400 text-white font-semibold transition-colors shadow-lg shadow-purple-500/20"
              >
                {isSavingGemini ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Gemini Configuration</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: UNIPILE LINKEDIN CONFIGURATION */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "unipile" && (
        <div className="space-y-6">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-semibold text-white/95">
                Unipile Master Gateway
              </h3>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                  unipileSettings?.isConfigured
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {unipileSettings?.isConfigured ? "Connected" : "Not Configured"}
              </span>
            </div>
            <span className="text-[11px] font-mono text-white/40">
              Estimated: <span className="text-cyan-300 font-semibold">${costPerAccount}</span> / account / mo
            </span>
          </div>

          {/* Feedback Messages */}
          {unipileSaveFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
                unipileSaveFeedback.success
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border border-red-500/20 text-red-300"
              }`}
            >
              <span>{unipileSaveFeedback.message}</span>
              <button
                onClick={() => setUnipileSaveFeedback(null)}
                className="text-white/40 hover:text-white text-xs px-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Test Connection Results */}
          {unipileTestResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                unipileTestResult.success
                  ? "bg-emerald-500/7 border-emerald-500/30 text-emerald-200"
                  : "bg-red-500/7 border-red-500/30 text-red-200"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {unipileTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span>{unipileTestResult.message}</span>
              </div>
              {unipileTestResult.success && unipileTestResult.accountCount !== undefined && (
                <p className="font-mono text-[11px] text-white/70 pl-6">
                  Verified: {unipileTestResult.accountCount} remote accounts active in Unipile tenant.
                </p>
              )}
            </div>
          )}

          {/* Active Source Card */}
          <div className="p-4 rounded-xl bg-[#090b10] border border-white/6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white/90">
                  Active Credential Provider
                </div>
                <div className="text-[11px] text-white/40 font-mono">
                  Source:{" "}
                  {unipileSettings?.source === "DATABASE" ? (
                    <span className="text-cyan-400 font-medium">Database (Dynamic override)</span>
                  ) : (
                    <span className="text-amber-400/80 font-medium">Environment Variables (.env)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] text-white/40">Current Key</div>
              <div className="text-xs font-mono text-cyan-300">
                {unipileSettings?.apiKeyMasked || "None"}
              </div>
            </div>
          </div>

          {/* Unipile Form */}
          <form
            onSubmit={handleSaveUnipile}
            className="p-6 rounded-xl bg-[#090b10] border border-white/6 space-y-6"
          >
            <div className="space-y-4">
              {/* DSN Endpoint */}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1.5 font-mono uppercase tracking-wider">
                  Unipile DSN Endpoint
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={unipileDsn}
                    onChange={(e) => setUnipileDsn(e.target.value)}
                    placeholder="https://api6.unipile.com:13474"
                    className="w-full h-10 px-3 rounded-lg bg-white/3 border border-white/8 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40"
                    required
                  />
                </div>
                <p className="text-[11px] text-white/40 mt-1">
                  Your Unipile cluster URL (found on your Unipile dashboard).
                </p>
              </div>

              {/* Master API Key */}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1.5 font-mono uppercase tracking-wider">
                  Master API Key
                </label>
                <div className="relative">
                  <input
                    type={showUnipileKey ? "text" : "password"}
                    value={unipileApiKey}
                    onChange={(e) => setUnipileApiKey(e.target.value)}
                    placeholder={
                      unipileSettings?.apiKeyMasked
                        ? `Current: ${unipileSettings.apiKeyMasked}`
                        : "Enter new API key..."
                    }
                    className="w-full h-10 pl-3 pr-10 rounded-lg bg-white/3 border border-white/8 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnipileKey(!showUnipileKey)}
                    className="absolute right-3 top-3 text-white/40 hover:text-white"
                  >
                    {showUnipileKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-white/40 mt-1">
                  Leave blank to preserve the currently saved API key.
                </p>
              </div>

              {/* Cost per Account */}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1.5 font-mono uppercase tracking-wider">
                  Estimated Monthly Cost Per Connected Account (USD)
                </label>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={costPerAccount}
                    onChange={(e) => setCostPerAccount(e.target.value)}
                    placeholder="8.00"
                    className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/3 border border-white/8 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40"
                  />
                  <span className="absolute left-3 top-3 text-white/40 text-xs font-mono">
                    $
                  </span>
                </div>
                <p className="text-[11px] text-white/40 mt-1">
                  Used on the admin overview to calculate projected monthly Unipile bills based on active connections.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-4 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestUnipile}
                disabled={isTestingUnipile}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-white/10 hover:border-white/25 bg-white/2 text-white/80 hover:text-white transition-colors"
              >
                {isTestingUnipile ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{isTestingUnipile ? "Testing Gateway..." : "Test Connection"}</span>
              </button>

              <button
                type="submit"
                disabled={isSavingUnipile}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-semibold transition-colors"
              >
                {isSavingUnipile ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Unipile Configuration</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
