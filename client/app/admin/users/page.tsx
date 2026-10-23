"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Shield,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { adminApi, AdminUser } from "@/lib/api";

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchUsers = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await adminApi.getUsers({
        search: searchQuery.trim(),
        page,
        limit: 15,
      });

      if (res.success && res.data) {
        setUsers(res.data.users || []);
        setTotalUsers(res.data.pagination?.total || 0);
        setTotalPages(
          Math.max(1, Math.ceil((res.data.pagination?.total || 1) / 15)),
        );
      }
    } catch (err: any) {
      console.error("Failed to load users:", err);
      setErrorMessage(
        err?.response?.data?.message || "Failed to load platform users.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-white/95">
              Platform User Directory
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {totalUsers} Registered
            </span>
          </div>
          <p className="text-xs text-white/45 mt-0.5">
            Registered accounts, RBAC authority levels, and linked outreach
            channels
          </p>
        </div>

        <button
          onClick={() => fetchUsers(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/8 hover:border-white/20 bg-white/2 text-white/70 hover:text-white transition-colors"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-[#090b10] p-3 rounded-xl border border-white/6 flex items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-80 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/3 border border-white/8 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40"
          />
          <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-2.5 pointer-events-none" />
        </form>

        <span className="text-xs text-white/40 font-mono hidden sm:inline">
          Showing {users.length} of {totalUsers}
        </span>
      </div>

      {/* Users Table */}
      <div className="rounded-xl bg-[#090b10] border border-white/6 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-white/40 flex flex-col items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Loading user directory...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-xs text-white/40">
            No users found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/6 text-white/40 font-mono text-[11px] bg-white/1">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Linked Accounts</th>
                  <th className="py-3 px-4 text-right">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {users.map((u) => {
                  const isAdmin = u.role === "ADMIN";

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-white/1.5 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-white/90">
                          {u.name || "Unnamed"}
                        </div>
                        <div className="text-[11px] text-white/40 font-mono">
                          {u.email}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase ${
                            isAdmin
                              ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              : "bg-white/4 text-white/50 border border-white/8"
                          }`}
                        >
                          {isAdmin && <Shield className="w-2.5 h-2.5" />}
                          <span>{u.role || "USER"}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="flex items-center gap-1.5 text-white/80">
                          <LinkedInIcon className="w-3.5 h-3.5 text-blue-400" />
                          <span>{u.connectedAccountsCount} connected</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-white/40 text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
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
              Page {page} of {totalPages}
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
    </div>
  );
}
