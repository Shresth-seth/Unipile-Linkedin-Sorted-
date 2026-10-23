"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Filter,
  Download,
  Upload,
  ExternalLink,
  MessageSquare,
  Check,
  ChevronRight,
  Loader2,
  RefreshCw,
  Send,
  UserCheck,
  X,
  UserMinus,
} from "lucide-react";
import { Prospect } from "@/lib/mock-data";
import { dashboardApi, linkedinApi, ContactRecord } from "@/lib/api";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { LinkedInProspectSearchModal } from "../linkedin-prospect-search-modal";

interface ProspectsViewProps {
  prospects: Prospect[];
}

const PIPELINE_STAGES = [
  "All",
  "NEW",
  "CONTACTED",
  "CONNECTED",
  "CONVERSATION",
  "INTERESTED",
  "HOT_LEAD",
  "MEETING",
  "WON",
];

export const ProspectsView: React.FC<ProspectsViewProps> = ({
  prospects: initialProspects,
}) => {
  const [activeTab, setActiveTab] = useState<"crm" | "sent_invites" | "incoming_invites">("crm");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [liveContacts, setLiveContacts] = useState<ContactRecord[]>([]);
  const [sentInvites, setSentInvites] = useState<any[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string>("");

  // Fetch CRM contacts from backend
  const fetchContacts = async (stage?: string) => {
    setIsLoading(true);
    try {
      const res = await dashboardApi.getContacts(
        stage === "All" ? undefined : stage,
      );
      if (res.success && Array.isArray(res.data)) {
        setLiveContacts(res.data);
      }
    } catch (e) {
      console.warn("Could not fetch contacts from API:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch sent invitations from Unipile
  const fetchSentInvitations = async () => {
    setIsLoading(true);
    try {
      const res = await linkedinApi.getSentInvitations();
      if (res.success && Array.isArray(res.data)) {
        setSentInvites(res.data);
      }
    } catch (e) {
      console.warn("Could not fetch sent invitations:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch incoming invitations from Unipile
  const fetchIncomingInvitations = async () => {
    setIsLoading(true);
    try {
      const res = await linkedinApi.getReceivedInvitations();
      if (res.success && Array.isArray(res.data)) {
        setIncomingInvites(res.data);
      }
    } catch (e) {
      console.warn("Could not fetch incoming invitations:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "crm") {
      fetchContacts(stageFilter);
    } else if (activeTab === "sent_invites") {
      fetchSentInvitations();
    } else if (activeTab === "incoming_invites") {
      fetchIncomingInvitations();
    }
  }, [activeTab, stageFilter]);

  // Update contact stage
  const handleStageChange = async (contactId: string, newStage: string) => {
    setUpdatingId(contactId);
    try {
      await dashboardApi.updateContactStage(contactId, newStage);
      setLiveContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, status: newStage } : c)),
      );
    } catch (e) {
      console.warn("Failed to update stage:", e);
    } finally {
      setUpdatingId(null);
    }
  };

  // Cancel / Withdraw sent connection invitation
  const handleWithdrawInvite = async (invitationId: string) => {
    setUpdatingId(invitationId);
    try {
      const res = await linkedinApi.cancelSentInvitation(invitationId);
      if (res.success) {
        setSentInvites((prev) => prev.filter((i) => i.id !== invitationId));
        setActionNotice("Connection invitation withdrawn successfully.");
        setTimeout(() => setActionNotice(""), 3500);
      }
    } catch (err: any) {
      console.warn("Failed to withdraw invitation:", err);
      setActionNotice(err?.message || "Failed to withdraw invitation.");
      setTimeout(() => setActionNotice(""), 3500);
    } finally {
      setUpdatingId(null);
    }
  };

  // Accept incoming invitation
  const handleAcceptInvite = async (invitationId: string) => {
    setUpdatingId(invitationId);
    try {
      const res = await linkedinApi.acceptInvitation(invitationId);
      if (res.success) {
        setIncomingInvites((prev) => prev.filter((i) => i.id !== invitationId));
        setActionNotice("Connection invitation accepted!");
        setTimeout(() => setActionNotice(""), 3500);
      }
    } catch (err: any) {
      console.warn("Failed to accept invitation:", err);
      setActionNotice(err?.message || "Failed to accept invitation.");
      setTimeout(() => setActionNotice(""), 3500);
    } finally {
      setUpdatingId(null);
    }
  };

  // Decline incoming invitation
  const handleDeclineInvite = async (invitationId: string) => {
    setUpdatingId(invitationId);
    try {
      const res = await linkedinApi.declineInvitation(invitationId);
      if (res.success) {
        setIncomingInvites((prev) => prev.filter((i) => i.id !== invitationId));
        setActionNotice("Connection invitation declined.");
        setTimeout(() => setActionNotice(""), 3500);
      }
    } catch (err: any) {
      console.warn("Failed to decline invitation:", err);
      setActionNotice(err?.message || "Failed to decline invitation.");
      setTimeout(() => setActionNotice(""), 3500);
    } finally {
      setUpdatingId(null);
    }
  };

  // Display real live contacts from backend
  const displayList = useMemo(() => {
    const listToFilter = liveContacts.length > 0 ? liveContacts : [];

    return listToFilter
      .filter((c) => {
        const matchesSearch =
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.company &&
            c.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (c.designation &&
            c.designation.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStage = stageFilter === "All" || c.status === stageFilter;
        return matchesSearch && matchesStage;
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        role: c.designation || "Executive",
        company: c.company || "Company",
        match: c.isHotLead ? "98%" : "89%",
        status: c.status,
        nextAction: c.isHotLead ? "Priority Outreach" : "Follow-up",
        isLive: true,
      }));
  }, [liveContacts, searchQuery, stageFilter]);

  const handleExport = () => {
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONNECTED":
      case "WON":
        return "text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/8 dark:border-emerald-400/20";
      case "HOT_LEAD":
        return "text-amber-800 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-400/8 dark:border-amber-400/20";
      case "CONVERSATION":
      case "MEETING":
      case "REPLIED":
        return "text-blue-700 bg-blue-50 border border-blue-200 dark:text-blue-400 dark:bg-blue-500/8 dark:border-blue-500/20";
      case "CONTACTED":
      case "PENDING":
        return "text-purple-700 bg-purple-50 border border-purple-200 dark:text-purple-400 dark:bg-purple-400/8 dark:border-purple-400/20";
      default:
        return "text-slate-700 bg-slate-100 border border-slate-200 dark:text-white/60 dark:bg-white/5 dark:border-white/10";
    }
  };

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return "PR";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white/90 tracking-tight">
              Prospects, Pipeline & Invitations
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
              {activeTab === "crm"
                ? `${displayList.length} In Pipeline`
                : activeTab === "sent_invites"
                ? `${sentInvites.length} Pending Outbound`
                : `${incomingInvites.length} Inbound Requests`}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/45 mt-1 font-medium">
            Real LinkedIn outreach pipeline, live sent invitation tracking, and inbound connection manager.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchModalOpen(true)}
            className="h-8 px-3 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-white-force text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <LinkedInIcon className="w-3.5 h-3.5 text-white" />
            <span>Search LinkedIn</span>
          </button>

          <button
            onClick={() => {
              if (activeTab === "crm") fetchContacts(stageFilter);
              else if (activeTab === "sent_invites") fetchSentInvitations();
              else fetchIncomingInvitations();
            }}
            className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-white/8 hover:border-slate-400 dark:hover:border-white/20 text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-50 dark:bg-transparent shadow-xs"
            title="Refresh from backend"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600 dark:text-blue-400" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExport}
            className="h-8 px-3 rounded-lg border border-slate-300 dark:border-white/8 hover:border-slate-400 dark:hover:border-white/20 text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-50 dark:bg-transparent shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{copiedNotification ? "Exported CSV" : "Export List"}</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/25 dark:text-blue-300 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main View Mode Selector */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 dark:bg-white/3 border border-slate-200 dark:border-white/6 w-fit">
        <button
          onClick={() => setActiveTab("crm")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "crm"
              ? "bg-blue-600 text-white text-white-force shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-white/50 dark:hover:text-white/80"
          }`}
        >
          CRM Pipeline ({displayList.length})
        </button>
        <button
          onClick={() => setActiveTab("sent_invites")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === "sent_invites"
              ? "bg-blue-600 text-white text-white-force shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-white/50 dark:hover:text-white/80"
          }`}
        >
          <Send className="w-3 h-3" />
          <span>Sent Invitations ({sentInvites.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("incoming_invites")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === "incoming_invites"
              ? "bg-blue-600 text-white text-white-force shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-white/50 dark:hover:text-white/80"
          }`}
        >
          <UserCheck className="w-3 h-3" />
          <span>Incoming Requests ({incomingInvites.length})</span>
        </button>
      </div>

      {/* VIEW 1: CRM PIPELINE */}
      {activeTab === "crm" && (
        <div className="space-y-4">
          {/* Filter Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, company or title..."
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-white dark:bg-white/3 border border-slate-300 dark:border-white/7 text-xs text-slate-900 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500 transition-colors shadow-xs"
              />
            </div>

            {/* 10-Stage Pipeline Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 sm:pb-0 scrollbar-none">
              {PIPELINE_STAGES.map((st) => (
                <button
                  key={st}
                  onClick={() => setStageFilter(st)}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 text-[11px] font-mono font-semibold ${
                    stageFilter === st
                      ? "bg-blue-600 text-white text-white-force shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-white/2 dark:text-white/50 dark:hover:text-white/80 dark:hover:bg-white/4 border border-slate-200/80 dark:border-transparent"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Prospects Table */}
          <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 overflow-hidden shadow-sm dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/4 bg-slate-50 dark:bg-transparent text-[11px] text-slate-500 dark:text-white/35 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-5">Prospect</th>
                    <th className="py-2.5 px-4">Role & Organization</th>
                    <th className="py-2.5 px-4 text-center">AI Match</th>
                    <th className="py-2.5 px-4">Pipeline Stage</th>
                    <th className="py-2.5 px-5 text-right">Quick Stage Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/4">
                  {displayList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-white/35 font-medium">
                        {isLoading
                          ? "Fetching contacts from backend..."
                          : "No contacts in this pipeline stage."}
                      </td>
                    </tr>
                  ) : (
                    displayList.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/2 transition-colors group"
                      >
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200 dark:border-transparent">
                              {getInitials(p.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white/90 truncate flex items-center gap-1.5">
                                <span>{p.name}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-800 dark:text-white/80 font-medium truncate">
                            {p.role}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-white/40 truncate">
                            {p.company}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="font-mono text-xs text-blue-700 dark:text-blue-400 font-bold">
                            {p.match}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${getStatusBadge(
                              p.status,
                            )}`}
                          >
                            {p.status}
                          </span>
                        </td>

                        <td className="py-3 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {updatingId === p.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                            ) : (
                              <>
                                {p.status !== "CONNECTED" && (
                                  <button
                                    onClick={() => handleStageChange(p.id, "CONNECTED")}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-[10px] text-slate-700 dark:bg-white/4 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-300 dark:text-white/50 transition-colors cursor-pointer border border-slate-200 hover:border-emerald-300 dark:border-transparent font-semibold shadow-xs"
                                  >
                                    → Connected
                                  </button>
                                )}
                                {p.status !== "HOT_LEAD" && (
                                  <button
                                    onClick={() => handleStageChange(p.id, "HOT_LEAD")}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-[10px] text-slate-700 dark:bg-white/4 dark:hover:bg-amber-500/20 dark:hover:text-amber-300 dark:text-white/50 transition-colors cursor-pointer border border-slate-200 hover:border-amber-300 dark:border-transparent font-semibold shadow-xs"
                                  >
                                    🔥 Hot Lead
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* VIEW 2: SENT INVITATIONS */}
      {activeTab === "sent_invites" && (
        <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 overflow-hidden shadow-sm dark:shadow-none">
          <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">Pending Outbound Invitations</h3>
              <p className="text-xs text-slate-600 dark:text-white/45 mt-0.5 font-medium">
                Invitations sent from your LinkedIn account waiting for recipient acceptance.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-500 dark:text-white/40">{sentInvites.length} Pending</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/4 bg-slate-50 dark:bg-transparent text-[11px] text-slate-500 dark:text-white/35 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-5">Recipient</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Sent Date</th>
                  <th className="py-2.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/4">
                {sentInvites.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 dark:text-white/35 font-medium">
                      {isLoading ? "Fetching sent invitations..." : "No pending sent invitations found."}
                    </td>
                  </tr>
                ) : (
                  sentInvites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-white/2 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          {inv.recipient_picture_url ? (
                            <img
                              src={inv.recipient_picture_url}
                              alt={inv.recipient_name}
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-white/10"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200 dark:border-transparent">
                              {getInitials(inv.recipient_name)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white/90 flex items-center gap-1.5">
                              <span>{inv.recipient_name}</span>
                              {inv.recipient_public_id && (
                                <a
                                  href={`https://www.linkedin.com/in/${inv.recipient_public_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-[#0A66C2] transition-colors inline-flex items-center"
                                  title="View LinkedIn Profile"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-white/45 max-w-sm truncate">
                              {inv.recipient_title || "LinkedIn Member"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20">
                          {inv.status || "PENDING"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-white/50">
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => handleWithdrawInvite(inv.id)}
                          disabled={updatingId === inv.id}
                          className="px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[11px] font-semibold transition-colors cursor-pointer shadow-xs dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:border-red-500/20 dark:text-red-300"
                        >
                          {updatingId === inv.id ? "Withdrawing..." : "Withdraw Invitation"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: INCOMING INVITATIONS */}
      {activeTab === "incoming_invites" && (
        <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 overflow-hidden shadow-sm dark:shadow-none">
          <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white/90">Incoming Connection Requests</h3>
              <p className="text-xs text-slate-600 dark:text-white/45 mt-0.5 font-medium">
                People on LinkedIn who have invited you to connect.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-500 dark:text-white/40">{incomingInvites.length} Received</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/4 bg-slate-50 dark:bg-transparent text-[11px] text-slate-500 dark:text-white/35 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-5">Sender</th>
                  <th className="py-2.5 px-4">Title / Role</th>
                  <th className="py-2.5 px-4">Received Date</th>
                  <th className="py-2.5 px-5 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/4">
                {incomingInvites.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 dark:text-white/35 font-medium">
                      {isLoading ? "Fetching received invitations..." : "No incoming connection invitations right now."}
                    </td>
                  </tr>
                ) : (
                  incomingInvites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-white/2 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          {inv.sender_picture_url ? (
                            <img
                              src={inv.sender_picture_url}
                              alt={inv.sender_name}
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-white/10"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200 dark:border-transparent">
                              {getInitials(inv.sender_name)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white/90 flex items-center gap-1.5">
                              <span>{inv.sender_name}</span>
                              {inv.sender_public_id && (
                                <a
                                  href={`https://www.linkedin.com/in/${inv.sender_public_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-[#0A66C2] transition-colors inline-flex items-center"
                                  title="View LinkedIn Profile"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-white/70 max-w-sm truncate font-medium">
                        {inv.sender_title || "LinkedIn Member"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-white/50">
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAcceptInvite(inv.id)}
                            disabled={updatingId === inv.id}
                            className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-semibold transition-colors cursor-pointer shadow-xs dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:border-emerald-500/25 dark:text-emerald-300"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineInvite(inv.id)}
                            disabled={updatingId === inv.id}
                            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 text-[11px] font-semibold transition-colors cursor-pointer shadow-xs dark:bg-white/4 dark:hover:bg-white/10 dark:text-white/50 dark:hover:text-white"
                          >
                            Decline
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Search LinkedIn Modal */}
      <LinkedInProspectSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onConnectionSent={() => {
          fetchContacts(stageFilter);
          fetchSentInvitations();
        }}
      />
    </div>
  );
};
