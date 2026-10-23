"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  DollarSign,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowUpRight,
  Activity,
  Layers,
  Zap,
  Sparkles,
} from "lucide-react";
import { adminApi, AdminOverviewData, UnipileSettingsData, GeminiSettingsData } from "@/lib/api";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [settings, setSettings] = useState<UnipileSettingsData | null>(null);
  const [geminiSettings, setGeminiSettings] = useState<GeminiSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setError(null);
      const [overviewRes, settingsRes, geminiRes] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getUnipileSettings(),
        adminApi.getGeminiSettings().catch(() => ({ success: false, data: null })),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setData(overviewRes.data);
      }
      if (settingsRes.success && settingsRes.data) {
        setSettings(settingsRes.data);
      }
      if (geminiRes.success && geminiRes.data) {
        setGeminiSettings(geminiRes.data);
      }
    } catch (err: any) {
      console.error("Failed to load admin overview:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load dashboard metrics.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboard();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-white/4 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-white/3 border border-white/5 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const metrics = data?.metrics;
  const health = data?.healthBreakdown;
  const automation = data?.automationBreakdown;
  const recent = data?.recentActivity || [];

  return (
    <div className="space-y-8">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white/95">
            Admin Overview
          </h2>
          <p className="text-xs text-white/45 mt-0.5">
            Centralized billing, account health telemetry, and system telemetry
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/8 hover:border-white/20 bg-white/2 text-white/70 hover:text-white transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`}
            />
            <span>Refresh</span>
          </button>

          <Link
            href="/admin/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Unipile Settings</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-3">
          <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-5 rounded-xl bg-[#090b10] border border-white/6 hover:border-white/15 transition-all">
          <div className="flex items-center justify-between text-white/40 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">
              Total Users
            </span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {metrics?.totalUsers ?? 0}
          </div>
          <div className="mt-2 text-[11px] text-white/40 flex items-center justify-between">
            <span>Platform registrations</span>
            <Link href="/admin/users" className="text-cyan-400 hover:underline">
              View all
            </Link>
          </div>
        </div>

        {/* Connected LinkedIn Accounts */}
        <div className="p-5 rounded-xl bg-[#090b10] border border-white/6 hover:border-white/15 transition-all">
          <div className="flex items-center justify-between text-white/40 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">
              Active Accounts
            </span>
            <LinkedInIcon className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {metrics?.totalConnectedAccounts ?? 0}
          </div>
          <div className="mt-2 text-[11px] text-white/40 flex items-center justify-between">
            <span>{metrics?.totalDisconnectedAccounts ?? 0} disconnected</span>
            <Link
              href="/admin/accounts"
              className="text-blue-400 hover:underline"
            >
              Manage
            </Link>
          </div>
        </div>

        {/* Estimated Monthly Bill */}
        <div className="p-5 rounded-xl bg-[#090b10] border border-white/6 hover:border-white/15 transition-all">
          <div className="flex items-center justify-between text-white/40 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">
              Estimated Unipile Bill
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-400 font-mono">
            ${(metrics?.estimatedMonthlyBillUSD ?? 0).toFixed(2)}
          </div>
          <div className="mt-2 text-[11px] text-white/40">
            ${(metrics?.costPerAccountUSD ?? 8).toFixed(2)} / active account /
            mo
          </div>
        </div>

        {/* System Keys & AI Engine */}
        <div className="p-5 rounded-xl bg-[#090b10] border border-white/6 hover:border-white/15 transition-all">
          <div className="flex items-center justify-between text-white/40 mb-2.5">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">
              Gateway & AI Engine
            </span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60">Unipile:</span>
              <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${settings?.isConfigured ? "text-emerald-400" : "text-red-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${settings?.isConfigured ? "bg-emerald-400" : "bg-red-400"}`} />
                {settings?.isConfigured ? "Connected" : "Missing"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60">Gemini:</span>
              <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${geminiSettings?.isConfigured ? "text-purple-300" : "text-amber-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${geminiSettings?.isConfigured ? "bg-purple-400" : "bg-amber-400"}`} />
                {geminiSettings?.isConfigured ? (geminiSettings.source === "DATABASE" ? "DB Override" : "ENV Fallback") : "Missing"}
              </span>
            </div>
          </div>
          <div className="mt-2.5 text-[11px] font-mono text-white/40 flex items-center justify-between">
            <span className="truncate max-w-[120px]">{geminiSettings?.model || "gemini-2.5-flash"}</span>
            <Link href="/admin/settings" className="text-cyan-400 hover:underline">
              Configure
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Account Health & Unipile Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Health Status */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#090b10] border border-white/6">
          <div className="flex items-center justify-between pb-4 border-b border-white/6">
            <div>
              <h3 className="text-sm font-semibold text-white/90">
                LinkedIn Account Health
              </h3>
              <p className="text-xs text-white/40 mt-0.5">
                Real-time connection status across all tenant accounts
              </p>
            </div>
            <Link
              href="/admin/accounts"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
            >
              <span>View All Accounts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
            {/* Healthy */}
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">Healthy</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {health?.healthy ?? 0}
              </div>
              <span className="text-[10px] text-white/40">
                Ready to execute
              </span>
            </div>

            {/* Reconnect Required */}
            <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-medium">Needs Reconnect</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {health?.reconnectRequired ?? 0}
              </div>
              <span className="text-[10px] text-white/40">Session expired</span>
            </div>

            {/* Challenged */}
            <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-xs font-medium">Challenged</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {health?.challenged ?? 0}
              </div>
              <span className="text-[10px] text-white/40">
                Requires PIN / 2FA
              </span>
            </div>

            {/* Disconnected */}
            <div className="p-4 rounded-lg bg-white/2 border border-white/8">
              <div className="flex items-center gap-2 text-white/40 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Disconnected</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {health?.disconnected ?? 0}
              </div>
              <span className="text-[10px] text-white/40">
                No recurring billing
              </span>
            </div>
          </div>
        </div>

        {/* Automation Status Card */}
        <div className="p-6 rounded-xl bg-[#090b10] border border-white/6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white/90">
              Automation Dispatcher
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Active background worker queue status
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/2 border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-xs font-medium text-white/80">
                    Running Workers
                  </span>
                </div>
                <span className="font-mono text-sm font-bold text-cyan-400">
                  {automation?.running ?? 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-white/2 border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white/30" />
                  <span className="text-xs font-medium text-white/80">
                    Paused Workers
                  </span>
                </div>
                <span className="font-mono text-sm font-bold text-white/60">
                  {automation?.paused ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/6 mt-4">
            <Link
              href="/admin/queue"
              className="flex items-center justify-between text-xs text-white/60 hover:text-white"
            >
              <span>View Queue Telemetry</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Recent Activity Table */}
      <div className="p-6 rounded-xl bg-[#090b10] border border-white/6">
        <div className="flex items-center justify-between pb-4 border-b border-white/6">
          <div>
            <h3 className="text-sm font-semibold text-white/90">
              Recent Account Connections
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Latest LinkedIn profiles connected by workspace users
            </p>
          </div>
          <Link
            href="/admin/accounts"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
          >
            Manage All
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="py-12 text-center text-xs text-white/40">
            No connected accounts recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-white/40 font-mono text-[11px]">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">LinkedIn Profile</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Connected At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {recent.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/2">
                    <td className="py-3 px-3">
                      <div className="font-medium text-white/90">
                        {item.userName}
                      </div>
                      <div className="text-[11px] text-white/40 font-mono">
                        {item.userEmail}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-white/80">
                      {item.linkedinName}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-medium ${
                          item.healthStatus === "HEALTHY"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : item.healthStatus === "DISCONNECTED"
                              ? "bg-white/5 text-white/40 border border-white/10"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {item.healthStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-white/40 text-[11px]">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
