"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  PowerOff,
  Copy,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { adminApi, AdminLinkedinAccount } from "@/lib/api";

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AdminLinkedinAccount[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Health check loading state per account
  const [checkingHealthId, setCheckingHealthId] = useState<string | null>(null);

  // Disconnect modal state
  const [disconnectModalAccount, setDisconnectModalAccount] =
    useState<AdminLinkedinAccount | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchAccounts = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await adminApi.getLinkedinAccounts({
        status: statusFilter,
        search: searchQuery.trim(),
        page,
        limit: 15,
      });

      if (res.success && res.data) {
        setAccounts(res.data.accounts || []);
        setTotalAccounts(res.data.pagination?.total || 0);
        setTotalPages(
          Math.max(1, Math.ceil((res.data.pagination?.total || 1) / 15)),
        );
      }
    } catch (err: any) {
      console.error("Failed to load accounts:", err);
      setActionMessage({
        type: "error",
        text:
          err?.response?.data?.message || "Failed to load LinkedIn accounts.",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAccounts();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCheckHealth = async (account: AdminLinkedinAccount) => {
    setCheckingHealthId(account.id);
    setActionMessage(null);
    try {
      const res = await adminApi.checkAccountHealth(account.id);
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Health check completed: Status is ${res.data?.currentHealth || "UPDATED"}`,
        });
        // Update local list
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === account.id
              ? {
                  ...a,
                  healthStatus: res.data?.currentHealth || a.healthStatus,
                  isConnected: res.data?.currentHealth !== "DISCONNECTED",
                }
              : a,
          ),
        );
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text:
          err?.response?.data?.message ||
          "Failed to check account health with Unipile.",
      });
    } finally {
      setCheckingHealthId(null);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectModalAccount) return;
    setIsDisconnecting(true);
    setActionMessage(null);

    try {
      const res = await adminApi.disconnectAccount(disconnectModalAccount.id);
      if (res.success) {
        setActionMessage({
          type: "success",
          text:
            res.message ||
            "Account disconnected and purged from Unipile billing.",
        });
        // Update local state
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === disconnectModalAccount.id
              ? {
                  ...a,
                  isConnected: false,
                  healthStatus: "DISCONNECTED",
                  automationStatus: "PAUSED",
                  billableThisMonth: false,
                }
              : a,
          ),
        );
        setDisconnectModalAccount(null);
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.response?.data?.message || "Failed to disconnect account.",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-white/95">
              LinkedIn Account Supervision
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {totalAccounts} Accounts
            </span>
          </div>
          <p className="text-xs text-white/45 mt-0.5">
            Monitor active connections, vendor billable status, and force
            disconnect orphaned sessions
          </p>
        </div>

        <button
          onClick={() => fetchAccounts(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/8 hover:border-white/20 bg-white/2 text-white/70 hover:text-white transition-colors"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`}
          />
          <span>Refresh List</span>
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border border-red-500/20 text-red-300"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-white/40 hover:text-white text-xs px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[#090b10] p-3 rounded-xl border border-white/6">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: "ALL", label: "All Accounts" },
            { id: "HEALTHY", label: "Healthy" },
            { id: "NEEDS_ACTION", label: "Needs Action" },
            { id: "DISCONNECTED", label: "Disconnected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold"
                  : "text-white/50 hover:text-white hover:bg-white/3"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by user, email, or profile..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/3 border border-white/8 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40"
          />
          <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-2.5 pointer-events-none" />
        </form>
      </div>

      {/* Accounts Table */}
      <div className="rounded-xl bg-[#090b10] border border-white/6 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-white/40 flex flex-col items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Loading accounts...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-16 text-center text-xs text-white/40">
            No LinkedIn accounts matched your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/6 text-white/40 font-mono text-[11px] bg-white/1">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">LinkedIn Profile</th>
                  <th className="py-3 px-4">Unipile Account ID</th>
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4">Automation</th>
                  <th className="py-3 px-4">Billing</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {accounts.map((account) => {
                  const isHealthy = account.healthStatus === "HEALTHY";
                  const isDisconnected =
                    account.healthStatus === "DISCONNECTED";

                  return (
                    <tr
                      key={account.id}
                      className="hover:bg-white/1.5 transition-colors"
                    >
                      {/* User */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-white/90">
                          {account.userName}
                        </div>
                        <div className="text-[11px] text-white/40 font-mono">
                          {account.userEmail}
                        </div>
                      </td>

                      {/* LinkedIn Profile */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-white/90">
                          {account.linkedinName || "Unnamed Profile"}
                        </div>
                        {account.linkedinEmail && (
                          <div className="text-[11px] text-white/40 font-mono">
                            {account.linkedinEmail}
                          </div>
                        )}
                      </td>

                      {/* Unipile ID */}
                      <td className="py-3 px-4 font-mono text-[11px] text-white/60">
                        {account.unipileAccountId ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="truncate max-w-30"
                              title={account.unipileAccountId}
                            >
                              {account.unipileAccountId}
                            </span>
                            <button
                              onClick={() =>
                                handleCopy(account.unipileAccountId!)
                              }
                              title="Copy ID"
                              className="text-white/30 hover:text-white"
                            >
                              {copiedId === account.unipileAccountId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-white/30">N/A</span>
                        )}
                      </td>

                      {/* Health Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-medium ${
                            isHealthy
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : isDisconnected
                                ? "bg-white/5 text-white/40 border border-white/10"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {account.healthStatus}
                        </span>
                      </td>

                      {/* Automation Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                            account.automationStatus === "RUNNING"
                              ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20"
                              : "text-white/40 bg-white/2"
                          }`}
                        >
                          {account.automationStatus}
                        </span>
                      </td>

                      {/* Billable */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {account.billableThisMonth ? (
                          <span className="text-emerald-400 font-medium">
                            Active ($8/mo)
                          </span>
                        ) : (
                          <span className="text-white/30">Inactive</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleCheckHealth(account)}
                            disabled={
                              checkingHealthId === account.id || isDisconnected
                            }
                            title="Trigger live health check with Unipile API"
                            className="p-1.5 rounded-lg border border-white/8 hover:border-white/20 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${
                                checkingHealthId === account.id
                                  ? "animate-spin text-cyan-400"
                                  : ""
                              }`}
                            />
                          </button>

                          {!isDisconnected && (
                            <button
                              onClick={() => setDisconnectModalAccount(account)}
                              title="Force disconnect from Unipile to stop recurring billing"
                              className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 transition-colors"
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-white/6 flex items-center justify-between text-xs text-white/50">
            <span>
              Page {page} of {totalPages} ({totalAccounts} accounts total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-white/8 hover:border-white/20 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-white/8 hover:border-white/20 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Force Disconnect Modal */}
      {disconnectModalAccount && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0b0d13] border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <PowerOff className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Force Disconnect Account
                </h3>
                <p className="text-xs text-white/50">
                  Unipile Billing Termination
                </p>
              </div>
            </div>

            <div className="text-xs text-white/70 space-y-2 bg-white/2 p-3.5 rounded-xl border border-white/6">
              <p>You are about to disconnect and delete LinkedIn account:</p>
              <div className="font-mono text-white/90">
                • Profile:{" "}
                <span className="text-cyan-400">
                  {disconnectModalAccount.linkedinName || "Unnamed"}
                </span>
              </div>
              <div className="font-mono text-white/90">
                • User:{" "}
                <span className="text-white/80">
                  {disconnectModalAccount.userEmail}
                </span>
              </div>
              <div className="font-mono text-white/90">
                • Unipile ID:{" "}
                <span className="text-white/80">
                  {disconnectModalAccount.unipileAccountId || "N/A"}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-red-300/80 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
              ⚠️ This will call Unipile API to delete the remote account
              session, terminating the ~$8/month recurring vendor charge. The
              user will need to reconnect if they wish to resume outreach.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDisconnectModalAccount(null)}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-white/8 hover:border-white/20 text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {isDisconnecting && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Confirm Disconnect</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
