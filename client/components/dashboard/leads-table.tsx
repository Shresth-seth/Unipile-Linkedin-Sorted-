"use client";

import React, { useState, useMemo } from "react";
import { Search, ChevronRight } from "lucide-react";
import { Prospect } from "@/lib/mock-data";

interface LeadsTableProps {
  prospects: Prospect[];
}

export const LeadsTable: React.FC<LeadsTableProps> = ({ prospects }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "All" || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [prospects, searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONNECTED":
      case "WON":
        return "text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/8 dark:border-transparent font-semibold";
      case "HOT_LEAD":
        return "text-amber-800 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-400/8 dark:border-transparent font-semibold";
      case "CONVERSATION":
      case "REPLIED":
      case "MEETING":
        return "text-blue-700 bg-blue-50 border border-blue-200 dark:text-blue-400 dark:bg-blue-500/8 dark:border-transparent font-semibold";
      case "CONTACTED":
      case "PENDING":
        return "text-purple-700 bg-purple-50 border border-purple-200 dark:text-purple-400 dark:bg-purple-400/8 dark:border-transparent font-semibold";
      case "QUALIFIED":
      case "NEW":
        return "text-slate-700 bg-slate-100 border border-slate-200 dark:text-white/70 dark:bg-white/5 dark:border-transparent font-semibold";
      default:
        return "text-slate-500 bg-slate-100 border border-slate-200 dark:text-white/40 dark:bg-white/4 dark:border-transparent font-medium";
    }
  };

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return "LK";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 overflow-hidden shadow-sm dark:shadow-none">
      {/* Header: Title, Search, Filter */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white/90">
            Prospects
          </h3>
          <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
            People in your active campaign
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/35" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 pl-8 pr-3 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/6 text-xs text-slate-900 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500 w-36 sm:w-44 transition-colors shadow-xs"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/6 text-xs text-slate-700 dark:text-white/70 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-xs"
          >
            <option value="All" className="bg-white dark:bg-[#090a0d] text-slate-900 dark:text-white">
              All status
            </option>
            <option value="Connected" className="bg-white dark:bg-[#090a0d] text-slate-900 dark:text-white">
              Connected
            </option>
            <option value="Pending" className="bg-white dark:bg-[#090a0d] text-slate-900 dark:text-white">
              Pending
            </option>
            <option value="Replied" className="bg-white dark:bg-[#090a0d] text-slate-900 dark:text-white">
              Replied
            </option>
            <option value="Qualified" className="bg-white dark:bg-[#090a0d] text-slate-900 dark:text-white">
              Qualified
            </option>
          </select>

          <button
            type="button"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white/80 transition-colors ml-1 cursor-pointer font-medium"
          >
            <span>View all</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/4 text-[11px] text-slate-500 dark:text-white/35 font-semibold uppercase tracking-wider bg-slate-50/50 dark:bg-transparent">
              <th className="py-2.5 px-5">Person</th>
              <th className="py-2.5 px-4">Role / Company</th>
              <th className="py-2.5 px-4 text-center">Match</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-5 text-right">Next Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/4">
            {filteredProspects.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-white/60">No prospects in current pipeline</p>
                  <p className="text-[11px] text-slate-400 dark:text-white/35">
                    Launch an outreach campaign or search LinkedIn to populate your live prospects.
                  </p>
                </td>
              </tr>
            ) : (
              filteredProspects.map((p) => {
                const matchNum = parseInt(p.match, 10);
                const isHighMatch = !isNaN(matchNum) && matchNum >= 90;

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/2.5 transition-colors group"
                  >
                    {/* Person */}
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/6 text-slate-700 dark:text-white/70 flex items-center justify-center text-[10px] font-bold shrink-0 border border-slate-200 dark:border-transparent">
                          {getInitials(p.name)}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white/90">
                          {p.name}
                        </span>
                      </div>
                    </td>

                    {/* Role / Company */}
                    <td className="py-3 px-4 text-slate-600 dark:text-white/60">
                      <span className="font-medium text-slate-800 dark:text-white/80">{p.role}</span>
                      <span className="text-slate-300 dark:text-white/25 mx-1.5">·</span>
                      <span className="text-slate-500 dark:text-white/40">{p.company}</span>
                    </td>

                    {/* Match */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`font-mono text-xs ${
                          isHighMatch
                            ? "text-blue-600 dark:text-blue-400 font-bold"
                            : "text-slate-600 dark:text-white/50 font-medium"
                        }`}
                      >
                        {p.match}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold inline-block ${getStatusBadge(
                          p.status,
                        )}`}
                      >
                        {p.status}
                      </span>
                    </td>

                    {/* Next Action */}
                    <td className="py-3 px-5 text-right text-slate-600 dark:text-white/45 text-xs font-medium">
                      {p.nextAction}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-white/4">
        {filteredProspects.length === 0 ? (
          <div className="py-6 text-center text-slate-500 dark:text-white/35 text-xs">
            No prospects matching current query.
          </div>
        ) : (
          filteredProspects.map((p) => (
            <div key={p.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/6 text-slate-700 dark:text-white/70 flex items-center justify-center text-[10px] font-bold shrink-0 border border-slate-200 dark:border-transparent">
                    {getInitials(p.name)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white/90 text-xs">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-white/45">
                      {p.role} · {p.company}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadge(
                    p.status,
                  )}`}
                >
                  {p.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-white/40 pt-1">
                <span>
                  Match:{" "}
                  <strong className="text-blue-600 dark:text-blue-400 font-mono font-bold">{p.match}</strong>
                </span>
                <span className="font-medium">Next: {p.nextAction}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LeadsTable;
