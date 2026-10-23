"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Shield,
  Bell,
  User,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Cookie,
  Database,
  AlertCircle,
  Loader2,
  X,
  Check,
  Lock,
  Sparkles,
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  Bot,
  Zap,
} from "lucide-react";
import { User as UserType } from "@/lib/mock-data";
import { authApi, linkedinApi, settingsApi } from "@/lib/api";
import { logout as clearStoredAuth } from "@/lib/storage";
import { BillingCard } from "@/components/dashboard/billing-card";

interface SettingsViewProps {
  user: UserType;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onLogout,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [company, setCompany] = useState(user.company || "WORKPILOT Workspace");
  const [saved, setSaved] = useState(false);

  // LinkedIn Cookie & Login Deletion State
  const [isDeletingCookies, setIsDeletingCookies] = useState(false);
  const [showDeleteCookieModal, setShowDeleteCookieModal] = useState(false);
  const [deleteCookieSuccess, setDeleteCookieSuccess] = useState(false);
  const [deleteCookieError, setDeleteCookieError] = useState("");

  // Account Deletion State
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");

  // Gemini AI BYOK State
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [isCustomGemini, setIsCustomGemini] = useState(false);
  const [geminiMaskedKey, setGeminiMaskedKey] = useState<string | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [isRevertingGemini, setIsRevertingGemini] = useState(false);
  const [geminiSuccess, setGeminiSuccess] = useState<string | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  const fetchGeminiConfig = async () => {
    try {
      const res = await settingsApi.getGeminiConfig();
      if (res.success && res.data) {
        setIsCustomGemini(res.data.isCustom);
        setGeminiMaskedKey(res.data.maskedKey);
        if (res.data.model) setGeminiModel(res.data.model);
      }
    } catch (e) {
      console.warn("Could not load Gemini settings:", e);
    }
  };

  useEffect(() => {
    fetchGeminiConfig();
  }, []);

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiSuccess(null);
    setGeminiError(null);
    try {
      const res = await settingsApi.testGeminiConfig({
        apiKey: geminiApiKey.trim() || undefined,
        model: geminiModel,
      });
      if (res.success) {
        setGeminiSuccess(res.message || "Connection verified!");
      }
    } catch (e: any) {
      setGeminiError(e.response?.data?.message || e.message || "Failed to reach Google Gemini API.");
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleSaveGemini = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGemini(true);
    setGeminiSuccess(null);
    setGeminiError(null);
    try {
      const res = await settingsApi.updateGeminiConfig({
        apiKey: geminiApiKey.trim() || undefined,
        model: geminiModel,
      });
      if (res.success) {
        setIsCustomGemini(res.data.isCustom);
        setGeminiMaskedKey(res.data.maskedKey);
        setGeminiApiKey("");
        setGeminiSuccess("✨ Gemini configuration verified and saved!");
        setTimeout(() => setGeminiSuccess(null), 4000);
      }
    } catch (e: any) {
      setGeminiError(e.response?.data?.message || e.message || "Failed to save Gemini configuration.");
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleRevertGemini = async () => {
    if (!confirm("Revert back to workspace default Gemini key?")) return;
    setIsRevertingGemini(true);
    setGeminiSuccess(null);
    setGeminiError(null);
    try {
      const res = await settingsApi.deleteGeminiConfig();
      if (res.success) {
        setIsCustomGemini(false);
        setGeminiMaskedKey(null);
        setGeminiApiKey("");
        if (res.data?.model) setGeminiModel(res.data.model);
        setGeminiSuccess("Reverted to workspace default key.");
        setTimeout(() => setGeminiSuccess(null), 4000);
      }
    } catch (e: any) {
      setGeminiError(e.response?.data?.message || e.message || "Failed to reset key.");
    } finally {
      setIsRevertingGemini(false);
    }
  };

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setCompany(user.company || "WORKPILOT Workspace");
  }, [user]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteLinkedInCookiesAndLogin = async () => {
    setIsDeletingCookies(true);
    setDeleteCookieError("");
    setDeleteCookieSuccess(false);

    try {
      await linkedinApi.deleteSavedCookiesAndLogin();
      setDeleteCookieSuccess(true);
      setShowDeleteCookieModal(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("WORKPILOT_storage_update"));
        window.dispatchEvent(new Event("storage"));
      }
      setTimeout(() => setDeleteCookieSuccess(false), 5000);
    } catch (err: any) {
      setDeleteCookieError(
        err.response?.data?.message ||
          err.message ||
          "Failed to delete LinkedIn login and saved cookies from database.",
      );
    } finally {
      setIsDeletingCookies(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== "DELETE") return;

    setIsDeletingAccount(true);
    setDeleteAccountError("");

    try {
      await authApi.deleteAccount();
      clearStoredAuth();
      setShowDeleteAccountModal(false);
      onLogout();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } catch (err: any) {
      setDeleteAccountError(
        err.response?.data?.message ||
          err.message ||
          "Failed to delete account.",
      );
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-white/5">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white/90 tracking-tight">
          Workspace Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-white/45 mt-1">
          Manage your account profile, safety defaults, cookie storage, and
          account preferences.
        </p>
      </div>

      {/* Account Info Form */}
      <form
        onSubmit={handleSave}
        className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-4 shadow-sm"
      >
        <h3 className="text-sm font-bold text-slate-900 dark:text-white/90 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Profile Information</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-white/60">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-black shadow-xs transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-white/60">
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-black shadow-xs transition-colors"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-white/60">
              Organization / Team
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-black shadow-xs transition-colors"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/4">
          <span className="text-[11px] text-slate-500 dark:text-white/35">
            Current Plan:{" "}
            <strong className="text-blue-600 dark:text-blue-400 font-bold">
              {user.plan}
            </strong>
          </span>

          <button
            type="submit"
            className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-white-force font-semibold text-xs transition-colors cursor-pointer shadow-xs"
          >
            {saved ? "Saved" : "Update Profile"}
          </button>
        </div>
      </form>

      <BillingCard />

      {/* Google Gemini AI Configuration Card */}
      <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">
                  Google Gemini AI (BYOK)
                </h3>
                {isCustomGemini ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-transparent">
                    Personal Key Active
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-transparent">
                    Workspace Default
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-white/45 mt-0.5">
                Configure your own Google Gemini API key to run outreach, autonomous messaging, and Copilot chats on your personal quota.
              </p>
            </div>
          </div>
        </div>

        {geminiSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{geminiSuccess}</span>
          </div>
        )}

        {geminiError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{geminiError}</span>
          </div>
        )}

        <form onSubmit={handleSaveGemini} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-white/70 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>API Key</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Get free API key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showGeminiKey ? "text" : "password"}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder={
                  isCustomGemini && geminiMaskedKey
                    ? `Configured (${geminiMaskedKey}) — enter new key to change`
                    : "Enter Gemini API Key (starts with AIzaSy...)"
                }
                className="w-full h-9 pl-3 pr-10 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-black shadow-xs transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-white/35">
              Each user can set their own independent key. Leave empty to use the shared workspace key.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-white/70 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Model Selection</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Ultra-fast live messaging" },
                { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", desc: "Lightweight & responsive" },
                { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", desc: "Deep context reasoning" },
                { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", desc: "High-capability flagship" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setGeminiModel(m.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                    geminiModel === m.id
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10"
                      : "border-slate-200 dark:border-white/6 hover:border-slate-300 dark:hover:border-white/10"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-white/90">
                      {m.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-white/40">{m.desc}</div>
                  </div>
                  {geminiModel === m.id && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/4 gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestGemini}
                disabled={isTestingGemini || (!geminiApiKey.trim() && !isCustomGemini)}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                {isTestingGemini ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                <span>Test Connection</span>
              </button>

              {isCustomGemini && (
                <button
                  type="button"
                  onClick={handleRevertGemini}
                  disabled={isRevertingGemini}
                  className="h-8 px-3 rounded-lg text-slate-500 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Revert to Default</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSavingGemini}
              className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSavingGemini ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save AI Settings</span>
            </button>
          </div>
        </form>
      </div>

      {/* Safety & Compliance Card */}
      <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-3 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white/90 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Safety & Compliance Protocol</span>
        </h3>
        <p className="text-xs text-slate-600 dark:text-white/50 leading-relaxed">
          WORKPILOT operates with strict human-pacing heuristics. Account
          activities automatically pause if LinkedIn warns of elevated velocity
          or if weekend suppression is enabled.
        </p>
        <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
          <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-transparent font-mono text-[11px] font-semibold">
            Hosted connection provider: Active
          </span>
          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-transparent font-mono text-[11px] font-semibold">
            Warmup Mode: Completed
          </span>
        </div>
      </div>

      {/* LinkedIn Cookie & Login Management Card */}
      <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white/90 flex items-center gap-2">
                <Cookie className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Saved LinkedIn Cookies & Login</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 font-semibold">
                Database Storage
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-white/50 leading-relaxed">
              Permanently deletes saved LinkedIn authentication cookies (
              <code className="font-mono text-slate-800 dark:text-white/70 bg-slate-100 dark:bg-white/5 px-1 py-0.2 rounded">
                li_at
              </code>
              ,{" "}
              <code className="font-mono text-slate-800 dark:text-white/70 bg-slate-100 dark:bg-white/5 px-1 py-0.2 rounded">
                li_a
              </code>
              ), stored credentials, and account login records directly from the
              database.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteCookieModal(true)}
            className="px-3.5 py-2 rounded-lg border border-amber-300 dark:border-amber-500/30 hover:border-amber-500 bg-amber-50 dark:bg-amber-500/5 hover:bg-amber-100 dark:hover:bg-amber-500/10 text-amber-900 dark:text-amber-300 text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 cursor-pointer self-start sm:self-auto shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Saved Cookies & Login</span>
          </button>
        </div>

        {deleteCookieSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-400 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">
              Saved LinkedIn session cookies and login credentials have been
              permanently deleted from the database.
            </span>
          </div>
        )}

        {deleteCookieError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-700 dark:text-red-400 flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{deleteCookieError}</span>
          </div>
        )}
      </div>

      {/* Danger Zone: Account Deletion */}
      <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/2 p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Danger Zone: Delete Account</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-white/50 leading-relaxed max-w-xl">
              Permanently delete your WORKPILOT account, workspace settings,
              contacts, campaigns, LinkedIn connection, and queued automations.
              This action cannot be reversed.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirmationText("");
              setDeleteAccountError("");
              setShowDeleteAccountModal(true);
            }}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-white-force text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Modal: Confirm Delete Saved LinkedIn Cookies & Login */}
      {showDeleteCookieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d0e14] shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white/95">
                  Delete Saved Cookies & Login from Database?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteCookieModal(false)}
                disabled={isDeletingCookies}
                className="text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
              This will permanently delete all stored LinkedIn session cookies (
              <code className="font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-transparent px-1 py-0.2 rounded">
                li_at
              </code>
              ,{" "}
              <code className="font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-transparent px-1 py-0.2 rounded">
                li_a
              </code>
              ), saved login credentials, and account connection records from
              the database.
            </p>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-300 font-medium">
              ⚠️ Your LinkedIn login will be completely erased from the
              database. All automations and campaigns will pause until you
              connect again.
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowDeleteCookieModal(false)}
                disabled={isDeletingCookies}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteLinkedInCookiesAndLogin}
                disabled={isDeletingCookies}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-white-force text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isDeletingCookies ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting from Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete from Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Account */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-500/20 bg-white dark:bg-[#0d0e14] shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white/95">
                  Permanently Delete Account?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
                className="text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-white/60 leading-relaxed">
              <p>
                This action is{" "}
                <strong className="text-red-600 dark:text-red-400">
                  permanent and irreversible
                </strong>
                .
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-white/50 text-[11px]">
                <li>All contacts and leads will be wiped</li>
                <li>
                  Active campaigns and queue dispatches will be terminated
                </li>
                <li>
                  Your LinkedIn connection and stored cookies will be cleared
                </li>
                <li>You will be immediately logged out</li>
              </ul>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-white/70">
                Please type{" "}
                <strong className="font-mono text-red-600 dark:text-red-400">
                  DELETE
                </strong>{" "}
                to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                disabled={isDeletingAccount}
                className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-black border border-red-300 dark:border-red-500/30 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500 focus:bg-white dark:focus:bg-black font-mono tracking-wider shadow-xs transition-colors"
              />
            </div>

            {deleteAccountError && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{deleteAccountError}</span>
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={
                  deleteConfirmationText !== "DELETE" || isDeletingAccount
                }
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-white-force text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-red-600/20"
              >
                {isDeletingAccount ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Account...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
