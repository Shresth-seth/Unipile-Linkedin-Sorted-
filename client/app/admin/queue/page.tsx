"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  RefreshCw,
  Clock,
  PlayCircle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  SkipForward,
  Copy,
  Check,
  Cpu,
  Layers,
} from "lucide-react";
import { adminApi, AdminQueueStatsData } from "@/lib/api";

export default function AdminQueuePage() {
  const [stats, setStats] = useState<AdminQueueStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchQueueStats = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await adminApi.getQueueStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load queue stats:", err);
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load background queue statistics.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQueueStats();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date);
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/6 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold text-white">
              Queue Telemetry & System Workers
            </h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Operational
            </span>
          </div>
          <p className="text-xs text-white/50">
            Real-time background execution queue, dispatch latency, worker
            metrics, and circuit breaker health.
          </p>
        </div>

        <button
          onClick={() => fetchQueueStats(true)}
          disabled={isRefreshing || isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/9 border border-white/8 text-xs font-medium text-white/90 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`}
          />
          <span>{isRefreshing ? "Refreshing..." : "Refresh Telemetry"}</span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => fetchQueueStats(true)}
            className="underline hover:text-red-300 ml-4 font-mono"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Actions */}
        <div className="p-4 rounded-xl bg-[#0a0b0e] border border-white/6 relative overflow-hidden">
          <div className="flex items-center justify-between text-white/50 text-xs mb-2">
            <span>Total Actions Tracked</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {isLoading ? "..." : (stats?.totalActions ?? 0).toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-white/40">
            All-time database action records
          </div>
        </div>

        {/* Queued (Pending) */}
        <div className="p-4 rounded-xl bg-[#0a0b0e] border border-white/6 relative overflow-hidden">
          <div className="flex items-center justify-between text-white/50 text-xs mb-2">
            <span>Queued (Pending)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {isLoading
              ? "..."
              : (stats?.statusBreakdown?.queued ?? 0).toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-white/40">
            Awaiting worker rate limit interval
          </div>
        </div>

        {/* In Processing */}
        <div className="p-4 rounded-xl bg-[#0a0b0e] border border-white/6 relative overflow-hidden">
          <div className="flex items-center justify-between text-white/50 text-xs mb-2">
            <span>Active Processing</span>
            <PlayCircle className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {isLoading
              ? "..."
              : (stats?.statusBreakdown?.processing ?? 0).toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-white/40">
            Currently dispatched to Unipile
          </div>
        </div>

        {/* Today's Metrics */}
        <div className="p-4 rounded-xl bg-[#0a0b0e] border border-white/6 relative overflow-hidden">
          <div className="flex items-center justify-between text-white/50 text-xs mb-2">
            <span>Executed Today</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {isLoading
                ? "..."
                : (stats?.today?.completed ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-white/40 font-mono">completed</span>
          </div>
          <div className="mt-2 text-[11px] text-red-400/80 font-mono">
            {isLoading ? "..." : (stats?.today?.failed ?? 0).toLocaleString()}{" "}
            failed today
          </div>
        </div>
      </div>

      {/* Queue Breakdown & Worker Engine Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Queue Status Breakdown */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#0a0b0e] border border-white/6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Status Distribution
            </h2>
            <span className="text-[11px] text-white/40 font-mono">
              Action Queue Partitioning
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Queued */}
            <div className="p-3.5 rounded-lg bg-white/2 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-amber-300/80 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>QUEUED</span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {stats?.statusBreakdown?.queued ?? 0}
              </div>
            </div>

            {/* Processing */}
            <div className="p-3.5 rounded-lg bg-white/2 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-cyan-300/80 mb-1">
                <PlayCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>PROCESSING</span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {stats?.statusBreakdown?.processing ?? 0}
              </div>
            </div>

            {/* Completed */}
            <div className="p-3.5 rounded-lg bg-white/2 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-emerald-300/80 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>COMPLETED</span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {stats?.statusBreakdown?.completed ?? 0}
              </div>
            </div>

            {/* Failed */}
            <div className="p-3.5 rounded-lg bg-white/2 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-rose-300/80 mb-1">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>FAILED</span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {stats?.statusBreakdown?.failed ?? 0}
              </div>
            </div>

            {/* Paused */}
            <div className="p-3.5 rounded-lg bg-white/2 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-amber-300/80 mb-1">
                <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>PAUSED</span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {stats?.statusBreakdown?.paused ?? 0}
              </div>
            </div>

            {/* Skipped */}
            <div className="p-3.5 rounded-lg bg-white/2 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
                <SkipForward className="w-3.5 h-3.5 text-white/40" />
                <span>SKIPPED</span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {stats?.statusBreakdown?.skipped ?? 0}
              </div>
            </div>
          </div>

          {/* Ratio bar */}
          {stats && stats.totalActions > 0 && (
            <div className="pt-2">
              <div className="text-[11px] text-white/40 mb-1.5 flex justify-between">
                <span>Execution Ratio</span>
                <span className="font-mono">
                  {Math.round(
                    ((stats.statusBreakdown.completed || 0) /
                      (stats.totalActions || 1)) *
                      100,
                  )}
                  % Completion
                </span>
              </div>
              <div className="h-2 w-full bg-white/4 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      ((stats.statusBreakdown.completed || 0) /
                        stats.totalActions) *
                      100
                    }%`,
                  }}
                  title="Completed"
                />
                <div
                  className="bg-cyan-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      ((stats.statusBreakdown.processing || 0) /
                        stats.totalActions) *
                      100
                    }%`,
                  }}
                  title="Processing"
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      ((stats.statusBreakdown.queued || 0) /
                        stats.totalActions) *
                      100
                    }%`,
                  }}
                  title="Queued"
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      ((stats.statusBreakdown.failed || 0) /
                        stats.totalActions) *
                      100
                    }%`,
                  }}
                  title="Failed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Worker & Circuit Breaker Health */}
        <div className="p-5 rounded-xl bg-[#0a0b0e] border border-white/6 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Worker Engine</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-white/2 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-white/80 font-medium">Dispatcher Loop</div>
                <div className="text-[11px] text-white/40">Cron: Every 60s</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white/2 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-white/80 font-medium">Circuit Breaker</div>
                <div className="text-[11px] text-white/40">
                  Auto-pause on 3 consecutive fails
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                ARMED
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white/2 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-white/80 font-medium">
                  Anti-Detection Jitter
                </div>
                <div className="text-[11px] text-white/40">
                  45s – 180s between actions
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ENABLED
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white/2 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-white/80 font-medium">
                  Daily Quota Shield
                </div>
                <div className="text-[11px] text-white/40">
                  Max 25 connects / 50 msgs
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ENFORCED
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Failed Queue Actions Table */}
      <div className="rounded-xl bg-[#0a0b0e] border border-white/6 overflow-hidden">
        <div className="p-4 border-b border-white/6 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Recent Failed Dispatches
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Last 10 rejected or errored queue actions requiring review
            </p>
          </div>
          <span className="text-xs font-mono text-white/40">
            {stats?.recentFailed?.length || 0} Records
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-white/40">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
            Loading recent execution failures...
          </div>
        ) : !stats?.recentFailed || stats.recentFailed.length === 0 ? (
          <div className="p-12 text-center text-xs text-white/40">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/60" />
            <div className="text-white/80 font-medium">
              No Failed Dispatches
            </div>
            <p className="text-[11px] text-white/40 mt-1 max-w-sm mx-auto">
              The queue executor is performing without errors. All processed
              actions have reached completed status.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/2 border-b border-white/6 text-white/40 font-mono">
                <tr>
                  <th className="py-3 px-4 font-normal">Action ID</th>
                  <th className="py-3 px-4 font-normal">Type</th>
                  <th className="py-3 px-4 font-normal">Attempts</th>
                  <th className="py-3 px-4 font-normal">Error Details</th>
                  <th className="py-3 px-4 font-normal">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {stats.recentFailed.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-white/2 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-white/70">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-30" title={item.id}>
                          {item.id.slice(0, 8)}...
                        </span>
                        <button
                          onClick={() => handleCopy(item.id)}
                          className="text-white/30 hover:text-white transition-colors"
                          title="Copy Full Action ID"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {item.actionType}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-white/60">
                      <span className="text-red-400 font-semibold">
                        {item.attempts}
                      </span>{" "}
                      / 3 max
                    </td>

                    <td className="py-3 px-4 max-w-md">
                      <div
                        className="text-red-400/90 font-mono text-[11px] truncate"
                        title={item.errorMessage || "Unknown error"}
                      >
                        {item.errorMessage ||
                          "Execution error without description"}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-white/40 font-mono text-[11px] whitespace-nowrap">
                      {formatTimestamp(item.createdAt)}
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
