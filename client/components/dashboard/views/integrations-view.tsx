"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Plus,
  Loader2,
  X,
  Mail,
  Database,
  Webhook,
  Sparkles,
} from "lucide-react";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { User } from "@/lib/mock-data";

import { linkedinApi, settingsApi } from "@/lib/api";
import { LinkedInConnectModal } from "../linkedin-connect-modal";
import { GeminiIntegrationModal } from "../gemini-integration-modal";

interface IntegrationsViewProps {
  user: User;
  linkedInConnected: boolean;
  onUpdateConnection: (connected: boolean) => void;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  user,
  linkedInConnected,
  onUpdateConnection,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [geminiModalOpen, setGeminiModalOpen] = useState(false);
  const [geminiCustom, setGeminiCustom] = useState(false);
  const [geminiMaskedKey, setGeminiMaskedKey] = useState<string | null>(null);

  const fetchGeminiStatus = async () => {
    try {
      const res = await settingsApi.getGeminiConfig();
      if (res.success && res.data) {
        setGeminiCustom(res.data.isCustom);
        setGeminiMaskedKey(res.data.maskedKey);
      }
    } catch (e) {
      console.warn("Could not fetch Gemini integration status:", e);
    }
  };

  React.useEffect(() => {
    fetchGeminiStatus();
  }, []);

  const handleDisconnect = async () => {
    try {
      await linkedinApi.disconnect();
      onUpdateConnection(false);
    } catch (e: any) {
      console.warn("Disconnect error:", e);
      alert(
        e.response?.data?.message ||
          e.message ||
          "Failed to disconnect account.",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-white/5">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white/90 tracking-tight">
          Integrations & Connected Platforms
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-white/45 mt-1">
          Manage integrations for sourcing, profile authorization, and CRM
          synchronization.
        </p>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. LinkedIn (Primary) */}
        <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-[#0A66C2]/15 flex items-center justify-center text-[#0A66C2] mb-3 border border-blue-100 dark:border-transparent">
                <LinkedInIcon className="w-5 h-5" />
              </div>
              {linkedInConnected ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-transparent">
                  Connected
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/4 dark:text-white/40 dark:border-transparent">
                  Not Connected
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">
              LinkedIn Account
            </h3>
            <p className="text-xs text-slate-600 dark:text-white/45 mt-1 leading-relaxed">
              Connect your account to discover prospects, send contextual
              connection requests, and automate follow-ups safely.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/4 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-white/35 font-medium">
              {linkedInConnected
                ? `Linked as ${user.name}`
                : "Hosted Connection Protection"}
            </span>

            {/* VIBRANT BLUE LINKEDIN CONNECT BUTTON */}
            {linkedInConnected ? (
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-white/8 hover:border-red-500/30 text-slate-600 dark:text-white/60 hover:text-red-600 dark:hover:text-red-400 text-xs transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-white-force font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <LinkedInIcon className="w-3.5 h-3.5 text-white" />
                <span>Connect LinkedIn</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Google Gemini AI (BYOK) */}
        <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/15 via-indigo-500/15 to-cyan-500/15 flex items-center justify-center text-blue-600 dark:text-cyan-400 mb-3 border border-blue-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              {geminiCustom ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-transparent">
                  Personal Key Active
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-transparent">
                  Workspace Default
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">
              Google Gemini AI
            </h3>
            <p className="text-xs text-slate-600 dark:text-white/45 mt-1 leading-relaxed">
              Configure your personal Google Gemini API key to power autonomous replies, outreach personalization, and Copilot chats on your own private Google AI quota.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/4 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-white/35 font-medium">
              {geminiMaskedKey ? `Key: ${geminiMaskedKey}` : "Personal or Default Quota"}
            </span>

            <button
              onClick={() => setGeminiModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-transparent text-slate-700 dark:text-white/70 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 text-xs transition-colors cursor-pointer shadow-xs font-medium flex items-center gap-1.5"
            >
              <span>Configure API Key</span>
            </button>
          </div>
        </div>

        {/* 3. Sales Navigator */}
        <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3 border border-blue-100 dark:border-transparent">
                <Database className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-transparent">
                Ready to Sync
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">
              Sales Navigator
            </h3>
            <p className="text-xs text-slate-600 dark:text-white/45 mt-1 leading-relaxed">
              Import custom lead lists and saved searches directly into
              WORKPILOT outreach campaigns.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/4 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-white/35 font-medium">
              Advanced search filtering
            </span>
            <button
              onClick={() =>
                alert(
                  "Sales Navigator integration is configured with your LinkedIn session.",
                )
              }
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-transparent text-slate-700 dark:text-white/70 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 text-xs transition-colors cursor-pointer shadow-xs font-medium"
            >
              Configure
            </button>
          </div>
        </div>

        {/* 3. CRM Export roadmap */}
        <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3 border border-amber-100 dark:border-transparent">
                <Layers className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-white/4 dark:text-white/40 dark:border-transparent">
                Roadmap
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">
              CRM data export
            </h3>
            <p className="text-xs text-slate-600 dark:text-white/45 mt-1 leading-relaxed">
              Export qualified leads into a structured format for your CRM workflow.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/4 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-white/35 font-medium">
              Not yet available
            </span>
            <button
              disabled
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-transparent text-slate-400 dark:text-white/30 text-xs shadow-xs font-medium cursor-not-allowed"
            >
              Coming soon
            </button>
          </div>
        </div>

        {/* 4. Custom Webhooks */}
        <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 space-y-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3 border border-purple-100 dark:border-transparent">
                <Webhook className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-transparent">
                Roadmap
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">
              Webhook Notifications
            </h3>
            <p className="text-xs text-slate-600 dark:text-white/45 mt-1 leading-relaxed">
              Deliver signed prospect events to an endpoint you control.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/4 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 dark:text-white/35 font-medium">
              Not yet available
            </span>
            <button
              disabled
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-transparent text-slate-400 dark:text-white/30 text-xs shadow-xs font-medium cursor-not-allowed"
            >
              Coming soon
            </button>
          </div>
        </div>
      </div>

      {/* LinkedIn Connect Modal */}
      <LinkedInConnectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => onUpdateConnection(true)}
      />

      {/* Google Gemini AI BYOK Modal */}
      <GeminiIntegrationModal
        isOpen={geminiModalOpen}
        onClose={() => setGeminiModalOpen(false)}
        onConfigChanged={fetchGeminiStatus}
      />
    </div>
  );
};

export default IntegrationsView;
