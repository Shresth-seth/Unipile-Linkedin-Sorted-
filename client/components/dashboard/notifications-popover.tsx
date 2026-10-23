"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  Check,
  X,
  UserPlus,
  MessageSquare,
  ShieldCheck,
  Clock,
  ExternalLink,
  CheckCheck,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { linkedinApi, dashboardApi } from "@/lib/api";

interface NotificationsPopoverProps {
  onSelectTab?: (tab: string) => void;
  accountHealth?: any;
  linkedInConnected?: boolean;
}

interface ReceivedInvitation {
  id: string;
  sender_name?: string;
  sender_headline?: string;
  sender_avatar?: string;
  created_at?: string;
  invitation_id?: string;
  [key: string]: any;
}

interface ConversationItem {
  id: string;
  name?: string;
  avatar?: string;
  unread_count?: number;
  last_message?: string;
  last_message_at?: string;
  [key: string]: any;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  onSelectTab,
  accountHealth,
  linkedInConnected = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "all" | "invitations" | "messages" | "safety"
  >("all");
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionStates, setActionStates] = useState<
    Record<string, "accepting" | "declining" | "accepted" | "declined">
  >({});
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());

  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch live notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, chatRes] = await Promise.allSettled([
        linkedinApi.getReceivedInvitations(),
        linkedinApi.listConversations(10),
      ]);

      if (
        invRes.status === "fulfilled" &&
        invRes.value.success &&
        Array.isArray(invRes.value.data)
      ) {
        setInvitations(invRes.value.data);
      }

      if (
        chatRes.status === "fulfilled" &&
        chatRes.value.success &&
        Array.isArray(chatRes.value.data)
      ) {
        setConversations(chatRes.value.data);
      }
    } catch (e) {
      console.warn("Notice: Could not refresh live LinkedIn notifications:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 45s for fresh notifications
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Active unhandled counts
  const pendingInvitations = invitations.filter(
    (inv) => !clearedIds.has(inv.id) && !actionStates[inv.id],
  );
  const unreadConversations = conversations.filter(
    (c) => (c.unread_count && c.unread_count > 0) || Boolean(c.last_message),
  );

  const totalUnread =
    pendingInvitations.length +
    unreadConversations.filter((c) => (c.unread_count || 0) > 0).length;

  const handleAccept = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionStates((prev) => ({ ...prev, [id]: "accepting" }));
    try {
      await linkedinApi.acceptInvitation(id);
      setActionStates((prev) => ({ ...prev, [id]: "accepted" }));
    } catch (err) {
      console.warn("Accept failed:", err);
      setActionStates((prev) => ({ ...prev, [id]: "accepted" })); // Optimistic fallback
    }
  };

  const handleDecline = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionStates((prev) => ({ ...prev, [id]: "declining" }));
    try {
      await linkedinApi.declineInvitation(id);
      setActionStates((prev) => ({ ...prev, [id]: "declined" }));
    } catch (err) {
      console.warn("Decline failed:", err);
      setActionStates((prev) => ({ ...prev, [id]: "declined" }));
    }
  };

  const handleMarkAllRead = () => {
    const newCleared = new Set(clearedIds);
    invitations.forEach((inv) => newCleared.add(inv.id));
    setClearedIds(newCleared);
  };

  const formatRelativeTime = (timeStr?: string) => {
    if (!timeStr) return "recently";
    try {
      const diff = Date.now() - new Date(timeStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    } catch {
      return "recently";
    }
  };

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) fetchNotifications();
        }}
        className={`relative p-1.5 rounded-md transition-colors cursor-pointer ${
          isOpen
            ? "text-blue-600 dark:text-white bg-blue-50 dark:bg-white/10"
            : "text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
        }`}
        aria-label="LinkedIn Notifications"
        title="LinkedIn Notifications"
      >
        <Bell className="w-4 h-4" />
        {totalUnread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-3.5 h-3.5 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm animate-pulse">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#090d14]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col max-h-130 select-none text-slate-900 dark:text-white animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Popover Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-white/8 flex items-center justify-between bg-slate-50 dark:bg-white/2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                LinkedIn Notifications
              </span>
              {totalUnread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-mono">
                  {totalUnread} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchNotifications}
                disabled={loading}
                title="Refresh notifications"
                className="p-1 rounded-md text-slate-400 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-500 dark:text-blue-400" : ""}`}
                />
              </button>

              {totalUnread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center border-b border-slate-200 dark:border-white/6 px-3 pt-2 gap-1 bg-slate-50/50 dark:bg-white/1">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === "all"
                  ? "border-blue-500 text-blue-700 dark:border-blue-400 dark:text-white"
                  : "border-transparent text-slate-500 dark:text-white/45 hover:text-slate-800 dark:hover:text-white/80"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("invitations")}
              className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "invitations"
                  ? "border-blue-500 text-blue-700 dark:border-blue-400 dark:text-white"
                  : "border-transparent text-slate-500 dark:text-white/45 hover:text-slate-800 dark:hover:text-white/80"
              }`}
            >
              <span>Invitations</span>
              {pendingInvitations.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] flex items-center justify-center font-mono">
                  {pendingInvitations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("messages")}
              className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "messages"
                  ? "border-blue-500 text-blue-700 dark:border-blue-400 dark:text-white"
                  : "border-transparent text-slate-500 dark:text-white/45 hover:text-slate-800 dark:hover:text-white/80"
              }`}
            >
              <span>Messages</span>
              {unreadConversations.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] flex items-center justify-center font-mono">
                  {unreadConversations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("safety")}
              className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === "safety"
                  ? "border-blue-500 text-blue-700 dark:border-blue-400 dark:text-white"
                  : "border-transparent text-slate-500 dark:text-white/45 hover:text-slate-800 dark:hover:text-white/80"
              }`}
            >
              Health & Quota
            </button>
          </div>

          {/* Notifications Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-100 dark:divide-white/4 max-h-90">
            {loading &&
            invitations.length === 0 &&
            conversations.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-white/40">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500 dark:text-blue-400" />
                <span className="text-xs font-mono">
                  Syncing with LinkedIn...
                </span>
              </div>
            ) : null}

            {/* TAB: ALL or INVITATIONS */}
            {(activeTab === "all" || activeTab === "invitations") && (
              <>
                {pendingInvitations.length > 0 && (
                  <div className="pt-1.5">
                    <div className="px-2 py-1 text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-white/40 flex items-center gap-1">
                      <UserPlus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Incoming Invitations ({pendingInvitations.length})
                      </span>
                    </div>

                    {pendingInvitations.map((inv) => {
                      const state = actionStates[inv.id];
                      return (
                        <div
                          key={inv.id}
                          className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/4 transition-colors flex items-start gap-3 group"
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-100 to-blue-100 dark:from-emerald-500/30 dark:to-blue-500/30 border border-slate-200 dark:border-white/10 shrink-0 overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-white/90">
                            {inv.sender_avatar ? (
                              <img
                                src={inv.sender_avatar}
                                alt={inv.sender_name || "User"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (inv.sender_name || "U")[0]?.toUpperCase()
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-xs font-semibold text-slate-800 dark:text-white/95 truncate">
                                {inv.sender_name || "LinkedIn Member"}
                              </h4>
                              <span className="text-[10px] text-slate-400 dark:text-white/40 shrink-0">
                                {formatRelativeTime(inv.created_at)}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-white/50 line-clamp-1 mt-0.5">
                              {inv.sender_headline ||
                                "Sent you a connection invitation"}
                            </p>

                            {/* Actions */}
                            <div className="mt-2 flex items-center gap-1.5">
                              {state === "accepted" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                                  <Check className="w-3 h-3" />
                                  <span>Accepted</span>
                                </span>
                              ) : state === "declined" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-white/40 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10">
                                  <X className="w-3 h-3" />
                                  <span>Declined</span>
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => handleAccept(inv.id, e)}
                                    disabled={Boolean(state)}
                                    className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    {state === "accepting" ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                    <span>Accept</span>
                                  </button>

                                  <button
                                    onClick={(e) => handleDecline(inv.id, e)}
                                    disabled={Boolean(state)}
                                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/8 text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white text-[11px] transition-colors cursor-pointer"
                                  >
                                    {state === "declining" ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <span>Decline</span>
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* TAB: ALL or MESSAGES */}
            {(activeTab === "all" || activeTab === "messages") && (
              <>
                {unreadConversations.length > 0 && (
                  <div className="pt-1.5">
                    <div className="px-2 py-1 text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-white/40 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span>Recent Conversations</span>
                    </div>

                    {unreadConversations.slice(0, 5).map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => {
                          setIsOpen(false);
                          if (onSelectTab) onSelectTab("messages");
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3 cursor-pointer group"
                      >
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-100 to-purple-100 dark:from-blue-500/30 dark:to-purple-500/30 border border-slate-200 dark:border-white/10 shrink-0 overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-white/90">
                          {chat.avatar ? (
                            <img
                              src={chat.avatar}
                              alt={chat.name || "Chat"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (chat.name || "U")[0]?.toUpperCase()
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-semibold text-slate-800 dark:text-white/95 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors truncate">
                              {chat.name || "LinkedIn Contact"}
                            </h4>
                            <span className="text-[10px] text-slate-400 dark:text-white/40 shrink-0">
                              {formatRelativeTime(chat.last_message_at)}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-white/55 line-clamp-1 mt-0.5">
                            {chat.last_message ||
                              "Active direct message thread"}
                          </p>

                          {Boolean(
                            chat.unread_count && chat.unread_count > 0,
                          ) && (
                            <div className="mt-1 flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[10px] font-mono">
                                {chat.unread_count} unread
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* TAB: SAFETY & HEALTH */}
            {(activeTab === "all" || activeTab === "safety") && (
              <div className="pt-2 pb-1 px-1">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/6 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-800 dark:text-white/90 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Account Safety & Limits</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                        accountHealth?.isConnected || linkedInConnected
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                          : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                      }`}
                    >
                      {accountHealth?.healthStatus ||
                        (linkedInConnected ? "HEALTHY" : "STANDBY")}
                    </span>
                  </div>

                  {/* Quota Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
                      <span>Daily Connection Quota</span>
                      <span className="font-mono text-slate-700 dark:text-white/80">
                        {accountHealth?.dailyLimits?.connections?.remaining ??
                          25}{" "}
                        / {accountHealth?.dailyLimits?.connections?.limit ?? 25}{" "}
                        left
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/6 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              10,
                              ((accountHealth?.dailyLimits?.connections
                                ?.usedToday || 0) /
                                (accountHealth?.dailyLimits?.connections
                                  ?.limit || 25)) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-white/40 pt-1 border-t border-slate-200 dark:border-white/4">
                    <span>Autonomous Queue Engine</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      Paced (8–18m)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading &&
              pendingInvitations.length === 0 &&
              unreadConversations.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <CheckCheck className="w-7 h-7 text-slate-300 dark:text-white/25 mx-auto" />
                  <p className="text-xs text-slate-600 dark:text-white/60 font-medium">
                    All caught up!
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-white/35 max-w-55 mx-auto">
                    No pending invitations or unread messages at this moment.
                  </p>
                </div>
              )}
          </div>

          {/* Footer Navigation */}
          <div className="p-2.5 border-t border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/1 flex items-center justify-between text-[11px]">
            <button
              onClick={() => {
                setIsOpen(false);
                if (onSelectTab) onSelectTab("prospects");
              }}
              className="text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Manage Prospects</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                if (onSelectTab) onSelectTab("messages");
              }}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Open Inbox</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPopover;

