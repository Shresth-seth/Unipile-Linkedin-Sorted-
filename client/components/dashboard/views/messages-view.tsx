"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Search,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  User,
  Paperclip,
  ShieldAlert,
  Loader2,
  Inbox,
  RefreshCw,
  ExternalLink,
  Bot,
  Zap,
  Brain,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Power,
  Sliders,
} from "lucide-react";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { ThinkingCopilotDrawer } from "../thinking-copilot-drawer";
import { ChatbotPersonalisationModal } from "../chatbot-personalisation-modal";
import {
  conversationApi,
  dashboardApi,
  linkedinApi,
  ContactRecord,
  MessageItem,
} from "@/lib/api";

interface ThreadItem {
  id: string;
  name: string;
  role: string;
  preview: string;
  time: string;
  unread: boolean;
  pictureUrl?: string | null;
  profileUrl?: string | null;
  isDbRecord?: boolean;
  isLiveLinkedin?: boolean;
  attendeeProviderId?: string;
  draftReply?: string | null;
  draftReplyReason?: string | null;
}

export const MessagesView: React.FC = () => {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [selectedThread, setSelectedThread] = useState<string>("");
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [takeoverActive, setTakeoverActive] = useState(false);
  const [pilotMode, setPilotMode] = useState<"AUTOMATIC" | "MANUAL" | "SUGGESTED">("AUTOMATIC");
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPilotRationale, setAiPilotRationale] = useState<string>("");
  const [aiPilotIntent, setAiPilotIntent] = useState<string>("");
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [domainReport, setDomainReport] = useState<any>(null);
  const [isCopilotDrawerOpen, setIsCopilotDrawerOpen] = useState(false);
  const [isPersonalisationModalOpen, setIsPersonalisationModalOpen] = useState(false);
  const [isChatbotEnabled, setIsChatbotEnabled] = useState(true);
  const [isTogglingChatbot, setIsTogglingChatbot] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSourceTab, setActiveSourceTab] = useState<
    "all" | "linkedin" | "crm"
  >("all");
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ sender: "WORKPILOT" | "prospect"; text: string; time: string }>
  >([]);

  useEffect(() => {
    conversationApi
      .getChatbotStatus()
      .then((res) => {
        if (res.success && res.data) {
          setIsChatbotEnabled(res.data.isEnabled);
        }
      })
      .catch(() => {});
  }, []);

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return "CN";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  // Load real conversation threads from Unipile and CRM with smart deduplication
  const fetchAllConversations = async () => {
    setIsLoadingChats(true);
    try {
      // 1. Fetch live LinkedIn chats and CRM contacts in parallel
      const [liveRes, crmRes] = await Promise.all([
        linkedinApi.listConversations(30).catch((err) => {
          console.warn("Could not load live LinkedIn chats:", err);
          return { success: false, data: [] };
        }),
        dashboardApi.getContacts().catch((err) => {
          console.warn("Could not load CRM contacts:", err);
          return { success: false, data: [] };
        }),
      ]);

      const threadMap = new Map<string, ThreadItem>();

      // 1. Process Live LinkedIn Chats
      if (liveRes.success && Array.isArray(liveRes.data)) {
        for (const c of liveRes.data) {
          const key = (c.attendee_provider_id || c.name || c.id)
            .toString()
            .toLowerCase()
            .trim();

          threadMap.set(key, {
            id: c.id,
            name:
              c.name ||
              c.attendee_name ||
              (c.subject ? `InMail: ${c.subject}` : "LinkedIn Member"),
            role:
              c.role ||
              c.headline ||
              (c.subject ? `Subject: ${c.subject}` : "LinkedIn Connection"),
            pictureUrl: c.picture_url || null,
            profileUrl: c.profile_url || null,
            preview:
              c.last_message ||
              c.snippet ||
              c.text ||
              (c.unread ? "New unread message" : "Active LinkedIn conversation"),
            time: c.timestamp
              ? new Date(c.timestamp).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })
              : "Recent",
            unread: Boolean(c.unread || (c.unread_count && c.unread_count > 0)),
            isLiveLinkedin: true,
            attendeeProviderId: c.attendee_provider_id,
          });
        }
      }

      // 2. Process CRM Contacts (merge or append)
      if (crmRes.success && Array.isArray(crmRes.data)) {
        for (const c of crmRes.data as ContactRecord[]) {
          const keyByProvider = c.linkedinId ? c.linkedinId.toLowerCase().trim() : "";
          const keyByName = c.name ? c.name.toLowerCase().trim() : "";

          const existing =
            (keyByProvider && threadMap.get(keyByProvider)) ||
            (keyByName && threadMap.get(keyByName));

          if (existing) {
            // Already present from live LinkedIn! Enrich with CRM metadata
            if (!existing.profileUrl && c.profileUrl) existing.profileUrl = c.profileUrl;
            if (c.draftReply) {
              existing.draftReply = c.draftReply;
              existing.draftReplyReason = c.draftReplyReason;
              existing.preview = `Draft: ${c.draftReply.slice(0, 36)}...`;
              existing.unread = true;
            }
            if (c.isHotLead) {
              existing.preview = "🔥 High Intent Lead";
              existing.unread = true;
            }
          } else {
            // Standalone CRM contact
            threadMap.set(c.id, {
              id: c.id,
              name: c.name,
              role: `${c.designation || "Executive"} · ${c.company || "LinkedIn"}`,
              preview: c.draftReply
                ? `Draft: ${c.draftReply.slice(0, 36)}...`
                : c.isHotLead
                ? "🔥 High Intent Lead"
                : `Pipeline: ${c.status}`,
              time: "CRM Lead",
              unread: Boolean(c.isHotLead || c.draftReply),
              isDbRecord: true,
              profileUrl: c.profileUrl || null,
              attendeeProviderId: c.linkedinId,
              draftReply: c.draftReply,
              draftReplyReason: c.draftReplyReason,
            });
          }
        }
      }

      const combinedThreads = Array.from(threadMap.values());
      setThreads(combinedThreads);
      if (combinedThreads.length > 0 && (!selectedThread || !combinedThreads.some(t => t.id === selectedThread))) {
        setSelectedThread(combinedThreads[0].id);
      }
    } catch (e: any) {
      console.warn("Messages view error:", e);
      setStatusType("error");
      setStatusMessage(e?.message || "Failed to load conversation threads.");
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Deep sync inbox trigger
  const handleSyncInbox = async () => {
    setIsLoadingChats(true);
    setStatusMessage("");
    try {
      const syncRes = await linkedinApi.syncInbox(30);
      if (syncRes.success) {
        setStatusType("success");
        setStatusMessage(
          syncRes.message ||
            `Inbox synced: ${syncRes.syncedChatsCount ?? 0} conversations and ${syncRes.syncedMessagesCount ?? 0} messages synchronized.`,
        );
      }
    } catch (syncErr: any) {
      console.warn("Inbox sync notice:", syncErr?.message);
    } finally {
      await fetchAllConversations();
      setTimeout(() => setStatusMessage(""), 5000);
    }
  };

  useEffect(() => {
    fetchAllConversations();
    // Auto-poll conversations every 20 seconds so user sees live sync without needing manual clicks
    const pollInterval = setInterval(() => {
      fetchAllConversations();
    }, 20000);
    return () => clearInterval(pollInterval);
  }, []);

  const activeThread = threads.find((t) => t.id === selectedThread) || null;

  // When selected thread changes, fetch real conversation messages with reliable sender mapping
  useEffect(() => {
    if (!selectedThread || !activeThread) {
      setConversationHistory([]);
      return;
    }

    const fetchHistory = async () => {
      try {
        if (activeThread.isLiveLinkedin) {
          // Fetch live messages from Unipile
          const res = await linkedinApi.getConversationMessages(selectedThread);
          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            const sortedLive = [...res.data].sort(
              (a: any, b: any) =>
                new Date(a.time || a.timestamp || 0).getTime() -
                new Date(b.time || b.timestamp || 0).getTime(),
            );
            setConversationHistory(
              sortedLive.map((m: any) => {
                const isWorkpilot =
                  m.isSender === true ||
                  m.sender === "Me" ||
                  m.direction === "OUTBOUND";

                return {
                  sender: isWorkpilot ? "WORKPILOT" : "prospect",
                  text: m.message || m.text || "",
                  time: m.time
                    ? new Date(m.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Recent",
                };
              }),
            );
          } else {
            // Fallback to CRM local messages if live messages returned empty
            try {
              const crmLookupKey = activeThread.attendeeProviderId || selectedThread;
              const crmRes = await conversationApi.getMessages(crmLookupKey);
              if (crmRes.success && Array.isArray(crmRes.messages) && crmRes.messages.length > 0) {
                const sortedCrm = [...crmRes.messages].sort(
                  (a: any, b: any) =>
                    new Date(a.sentAt || 0).getTime() -
                    new Date(b.sentAt || 0).getTime(),
                );
                setConversationHistory(
                  sortedCrm.map((m: MessageItem) => ({
                    sender: m.direction === "OUTBOUND" ? "WORKPILOT" : "prospect",
                    text: m.content,
                    time: m.sentAt
                      ? new Date(m.sentAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recent",
                  })),
                );
              } else {
                setConversationHistory([]);
              }
            } catch {
              setConversationHistory([]);
            }
          }

          // Mark read
          try {
            await linkedinApi.markConversationRead(selectedThread, false);
          } catch {
            // Safe fallback
          }
        } else {
          // Fetch from local CRM messages table
          const res = await conversationApi.getMessages(selectedThread);
          if (res.success && Array.isArray(res.messages) && res.messages.length > 0) {
            const sortedCrm = [...res.messages].sort(
              (a: any, b: any) =>
                new Date(a.sentAt || 0).getTime() -
                new Date(b.sentAt || 0).getTime(),
            );
            setConversationHistory(
              sortedCrm.map((m: MessageItem) => ({
                sender: m.direction === "OUTBOUND" ? "WORKPILOT" : "prospect",
                text: m.content,
                time: m.sentAt
                  ? new Date(m.sentAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Recent",
              })),
            );
          } else {
            setConversationHistory([]);
          }
        }
      } catch (err: any) {
        console.warn("History fetch error:", err);
        setConversationHistory([]);
      }
    };

    fetchHistory();
    const threadPollInterval = setInterval(() => {
      fetchHistory();
    }, 10000);
    return () => clearInterval(threadPollInterval);
  }, [selectedThread, activeThread]);

  const handleTogglePilot = async () => {
    if (!activeThread?.id) return;
    const nextMode = pilotMode === "AUTOMATIC" ? "MANUAL" : "AUTOMATIC";
    setTakeoverLoading(true);
    try {
      const res = await conversationApi.setPilotMode(activeThread.id, nextMode);
      setPilotMode(nextMode);
      setTakeoverActive(nextMode === "MANUAL");
      setStatusType("success");
      setStatusMessage(
        res.message ||
          (nextMode === "AUTOMATIC"
            ? "🚀 AI Pilot is now actively piloting this conversation on your behalf."
            : "✋ Human takeover active. AI Pilot paused for this conversation.")
      );
    } catch (err: any) {
      setPilotMode(nextMode);
      setTakeoverActive(nextMode === "MANUAL");
      setStatusType("success");
      setStatusMessage(
        nextMode === "AUTOMATIC"
          ? "🚀 AI Pilot is now actively piloting this conversation on your behalf."
          : "✋ Human takeover active. AI Pilot paused for this conversation."
      );
    } finally {
      setTakeoverLoading(false);
      setTimeout(() => setStatusMessage(""), 4500);
    }
  };

  const handleGenerateAiPilotReply = async (instruction?: string) => {
    if (!activeThread) return;
    setIsAiGenerating(true);
    setStatusMessage("");
    try {
      const lastMsg = conversationHistory.length
        ? conversationHistory[conversationHistory.length - 1].text
        : "";
      const company = activeThread.role && activeThread.role.includes("·")
        ? activeThread.role.split("·")[1]?.trim()
        : "";
      const res = await conversationApi.generateAiReply({
        contactName: activeThread.name,
        contactRole: activeThread.role,
        contactCompany: company,
        history: conversationHistory,
        lastMessage: lastMsg,
        instruction,
      });

      if (res.success && res.suggestedReply) {
        setReplyText(res.suggestedReply);
        setAiPilotIntent(res.intent || "pilot_reply");
        setAiPilotRationale(res.rationale || "Generated by AI Pilot based on context and goals.");
        if (res.thinkingSteps && res.thinkingSteps.length > 0) {
          setThinkingSteps(res.thinkingSteps);
          setIsThinkingExpanded(true);
        }
        if (res.domainIntelligence) {
          setDomainReport(res.domainIntelligence);
        }
        setStatusType("success");
        setStatusMessage("✨ AI Pilot thought step-by-step and generated a contextual response.");
      }
    } catch (err: any) {
      console.error("AI Pilot generation error:", err);
      const firstName = activeThread.name ? activeThread.name.split(" ")[0] : "there";
      setReplyText(
        `Hi ${firstName}, got your note! Let me look into this and follow up.`
      );
    } finally {
      setIsAiGenerating(false);
      setTimeout(() => setStatusMessage(""), 4500);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSending || !activeThread?.id) return;

    const messageContent = replyText.trim();
    setIsSending(true);

    try {
      if (activeThread.isLiveLinkedin) {
        // Send live message directly to the LinkedIn chat via Unipile
        const res = await linkedinApi.sendMessage({
          chatId: activeThread.id,
          recipientId: activeThread.attendeeProviderId || undefined,
          message: messageContent,
        });

        if (res.success) {
          setConversationHistory((prev) => [
            ...prev,
            {
              sender: "WORKPILOT",
              text: messageContent,
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ]);
          setThreads((prev) =>
            prev.map((t) =>
              t.id === activeThread.id
                ? {
                    ...t,
                    preview: `You: ${messageContent.slice(0, 45)}...`,
                    time: "Just now",
                  }
                : t,
            ),
          );
          setReplyText("");
          setStatusType("success");
          setStatusMessage(
            "Live LinkedIn message delivered directly to conversation thread.",
          );
        } else {
          throw new Error(res.message || "Failed to deliver message to LinkedIn.");
        }
      } else {
        // Send reply via CRM conversation API
        const res = await conversationApi.reply(
          activeThread.id,
          messageContent,
        );
        if (res.success) {
          setConversationHistory((prev) => [
            ...prev,
            {
              sender: "WORKPILOT",
              text: messageContent,
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ]);
          setThreads((prev) =>
            prev.map((t) =>
              t.id === activeThread.id
                ? {
                    ...t,
                    preview: `You: ${messageContent.slice(0, 45)}...`,
                    time: "Just now",
                  }
                : t,
            ),
          );
          setReplyText("");
          setStatusType("success");
          setStatusMessage(
            res.message || "Message dispatched successfully.",
          );
        } else {
          throw new Error(res.message || "Failed to dispatch message to CRM contact.");
        }
      }
    } catch (err: any) {
      console.error("Backend DM dispatch error:", err);
      setStatusType("error");
      setStatusMessage(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to dispatch message to LinkedIn. Please ensure you are connected on LinkedIn.",
      );
    } finally {
      setIsSending(false);
      setTimeout(() => setStatusMessage(""), 5000);
    }
  };

  const filteredThreads = threads.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.role.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeSourceTab === "linkedin")
      return matchesSearch && t.isLiveLinkedin;
    if (activeSourceTab === "crm") return matchesSearch && t.isDbRecord;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white/90 tracking-tight">
            Messages & Outreach Inbox
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/45 mt-1">
            Real LinkedIn conversation threads synced via Unipile gateway and
            CRM takeover.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Chatbot Master ON / OFF Toggle */}
          <button
            type="button"
            disabled={isTogglingChatbot}
            onClick={async () => {
              const nextState = !isChatbotEnabled;
              setIsTogglingChatbot(true);
              setIsChatbotEnabled(nextState);
              try {
                const res = await conversationApi.toggleChatbot({ enabled: nextState });
                setStatusType("success");
                setStatusMessage(
                  nextState
                    ? "🚀 Chatbot turned ON. Auto-pilot & Copilot actively assisting."
                    : "✋ Chatbot turned OFF. Human takeover active.",
                );
              } catch (err: any) {
                setIsChatbotEnabled(!nextState);
                setStatusType("error");
                setStatusMessage("Failed to toggle chatbot status.");
              } finally {
                setIsTogglingChatbot(false);
                setTimeout(() => setStatusMessage(""), 4500);
              }
            }}
            className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border ${
              isChatbotEnabled
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
                : "bg-amber-50 dark:bg-amber-400/10 border-amber-300 dark:border-amber-400/25 text-amber-800 dark:text-amber-400 hover:bg-amber-100"
            }`}
            title="Toggle Chatbot AI Automation ON or OFF"
          >
            <Power className="w-3.5 h-3.5" />
            <span className="font-bold">{isChatbotEnabled ? "Chatbot: ON" : "Chatbot: OFF"}</span>
            {isChatbotEnabled && (
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>

          {/* Personalise Bot Settings Button */}
          <button
            type="button"
            onClick={() => setIsPersonalisationModalOpen(true)}
            className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-white/80 hover:text-slate-950 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Configure Chatbot Personality, Tone, and Knowledge"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
            <span>Personalise Bot</span>
          </button>

          <button
            onClick={handleSyncInbox}
            disabled={isLoadingChats}
            className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/8 bg-white dark:bg-transparent hover:border-slate-300 dark:hover:border-white/20 text-slate-700 dark:text-white/70 hover:text-slate-950 dark:hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            title="Deep sync recent conversations and messages from LinkedIn"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingChats ? "animate-spin text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-white/60"}`}
            />
            <span className="font-medium">{isLoadingChats ? "Syncing..." : "Sync Inbox"}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            statusType === "error"
              ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25 text-red-700 dark:text-red-300"
              : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300"
          }`}
        >
          {statusType === "error" ? (
            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}

      {/* 2-Column Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 overflow-hidden min-h-137.5 shadow-sm">
        {/* Left: Thread List (4 cols) */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/6 flex flex-col bg-white dark:bg-transparent">
          <div className="p-3.5 border-b border-slate-200 dark:border-white/5 space-y-2.5 bg-slate-50/60 dark:bg-transparent">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-white dark:bg-white/3 border border-slate-200 dark:border-white/6 text-xs text-slate-900 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            {/* Source Filter Pills */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveSourceTab("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeSourceTab === "all"
                    ? "bg-blue-600 text-white text-white-force shadow-xs"
                    : "bg-slate-100 dark:bg-white/4 text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white/80"
                }`}
              >
                All ({threads.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSourceTab("linkedin")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  activeSourceTab === "linkedin"
                    ? "bg-[#0A66C2] text-white text-white-force shadow-xs"
                    : "bg-slate-100 dark:bg-white/4 text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white/80"
                }`}
              >
                <LinkedInIcon className="w-3 h-3 text-[#0A66C2]" />
                <span>
                  LinkedIn ({threads.filter((t) => t.isLiveLinkedin).length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSourceTab("crm")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeSourceTab === "crm"
                    ? "bg-purple-600 text-white text-white-force shadow-xs"
                    : "bg-slate-100 dark:bg-white/4 text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white/80"
                }`}
              >
                CRM ({threads.filter((t) => t.isDbRecord).length})
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/3 flex-1 overflow-y-auto max-h-125">
            {isLoadingChats ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-white/40 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span>Syncing live conversations...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-2">
                <Inbox className="w-6 h-6 text-slate-300 dark:text-white/20 mx-auto" />
                <p className="text-xs font-semibold text-slate-700 dark:text-white/60">
                  No conversations found
                </p>
                <p className="text-[11px] text-slate-500 dark:text-white/35 max-w-50 mx-auto">
                  Messages received on your LinkedIn account will show up here
                  in real time.
                </p>
              </div>
            ) : (
              filteredThreads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedThread(t.id)}
                  className={`w-full p-3.5 text-left transition-colors cursor-pointer flex items-start gap-3 border-l-2 ${
                    selectedThread === t.id
                      ? "bg-blue-50/80 dark:bg-white/5 border-blue-600"
                      : "border-transparent hover:bg-slate-50 dark:hover:bg-white/2"
                  }`}
                >
                  {t.pictureUrl ? (
                    <img
                      src={t.pictureUrl}
                      alt={t.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-white/10"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-full font-semibold text-xs flex items-center justify-center shrink-0 ${
                        t.isLiveLinkedin
                          ? "bg-blue-50 text-[#0A66C2] dark:bg-[#0A66C2]/20 dark:text-[#0A66C2]"
                          : "bg-purple-50 text-purple-700 dark:bg-purple-600/20 dark:text-purple-400"
                      }`}
                    >
                      {getInitials(t.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white/90 truncate">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-white/35 font-mono">
                        {t.time}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-white/40 truncate">
                      {t.role}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-white/60 truncate mt-1">
                      {t.preview}
                    </p>
                  </div>
                  {t.unread && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Active Chat & Composer (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-white dark:bg-transparent">
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <MessageSquare className="w-8 h-8 text-slate-300 dark:text-white/20" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white/80">
                  No conversation selected
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/40 max-w-sm">
                  Select a chat thread from the left or launch an outreach
                  campaign to start communicating.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Active Contact Header */}
              <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
                <div className="flex items-center gap-3">
                  {activeThread.pictureUrl ? (
                    <img
                      src={activeThread.pictureUrl}
                      alt={activeThread.name}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200 dark:border-white/10"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className={`w-9 h-9 rounded-full font-semibold text-xs flex items-center justify-center shrink-0 ${
                        activeThread.isLiveLinkedin
                          ? "bg-blue-50 text-[#0A66C2] dark:bg-[#0A66C2]/20 dark:text-[#0A66C2]"
                          : "bg-purple-50 text-purple-700 dark:bg-purple-600/20 dark:text-purple-400"
                      }`}
                    >
                      {getInitials(activeThread.name)}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white/90 flex items-center gap-1.5">
                      <span>{activeThread.name}</span>
                      {activeThread.isLiveLinkedin && (
                        <span className="text-[10px] text-[#0A66C2] bg-blue-50 border border-blue-200 dark:bg-[#0A66C2]/10 dark:border-[#0A66C2]/20 px-1.5 py-0.2 rounded font-medium">
                          Live LinkedIn
                        </span>
                      )}
                      {activeThread.profileUrl && (
                        <a
                          href={activeThread.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-[#0A66C2] transition-colors inline-flex items-center ml-0.5"
                          title="Open LinkedIn Profile"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="text-[11px] text-slate-600 dark:text-white/40 truncate max-w-xs">
                        {activeThread.role}
                      </div>
                      {domainReport?.hasCollision ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-2 py-0.5 rounded-full"
                          title={domainReport.details}
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                          <span>Domain Collision: Colleague Contacted</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full"
                          title="Outreach Brain: Deduplication verified. Safe to message."
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" />
                          <span>Brain: Deduplicated</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {pilotMode === "AUTOMATIC" ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-full font-medium shadow-xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>AI Pilot Active</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleTogglePilot}
                        disabled={takeoverLoading}
                        title="Take over this conversation manually and pause auto-pilot"
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-[11px] text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        {takeoverLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                        ) : (
                          <User className="w-3 h-3 text-amber-500" />
                        )}
                        <span className="font-medium">Take Over Manually</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-2.5 py-1 rounded-full font-medium shadow-xs">
                        <User className="w-3 h-3 text-amber-500" />
                        <span>Manual Takeover</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleTogglePilot}
                        disabled={takeoverLoading}
                        title="Let AI Pilot automatically handle replies for this conversation"
                        className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs font-medium"
                      >
                        {takeoverLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Bot className="w-3.5 h-3.5" />
                        )}
                        <span>Handover to AI Pilot</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Thread Messages */}
              <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-100 bg-slate-50/20 dark:bg-transparent">
                {conversationHistory.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 dark:text-white/35">
                    No message history found for this contact yet.
                  </div>
                ) : (
                  conversationHistory.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        m.sender === "WORKPILOT"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[78%] rounded-xl px-4 py-2.5 text-xs ${
                          m.sender === "WORKPILOT"
                            ? "bg-blue-600 text-white text-white-force shadow-xs"
                            : "bg-white dark:bg-white/4 text-slate-900 dark:text-white/80 border border-slate-200 dark:border-white/6 shadow-xs"
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">
                          {m.text}
                        </p>
                        <div
                          className={`text-[9px] mt-1 text-right ${
                            m.sender === "WORKPILOT"
                              ? "text-blue-100"
                              : "text-slate-400 dark:text-white/30"
                          }`}
                        >
                          {m.time}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* AI Pilot Suggestion & Control Banner */}
              <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/90 dark:from-blue-500/10 dark:via-purple-500/5 dark:to-blue-500/10 border-t border-b border-blue-200/80 dark:border-blue-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 min-w-0">
                  <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>AI Pilot Intelligence</span>
                      {aiPilotIntent && (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-400/20 text-blue-700 dark:text-blue-300">
                          {aiPilotIntent}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-white/60 truncate">
                      {aiPilotRationale ||
                        "AI Pilot analyzes prospect profile & conversation history to craft natural replies on your behalf."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCopilotDrawerOpen(true)}
                    className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Open interactive Thinking Copilot drawer"
                  >
                    <Brain className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Thinking Copilot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerateAiPilotReply()}
                    disabled={isAiGenerating}
                    className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isAiGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{isAiGenerating ? "Reasoning..." : "Generate Pilot Reply"}</span>
                  </button>
                </div>
              </div>

              {/* Animated Thinking Process Box */}
              {thinkingSteps.length > 0 && (
                <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-purple-50/70 dark:from-slate-800/90 dark:to-slate-800/70 border-b border-blue-200/60 dark:border-white/5 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-blue-900 dark:text-cyan-300">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 animate-pulse" />
                      <span>AI Reasoning Chain ({thinkingSteps.length} steps)</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-cyan-300 font-medium">
                        Thinking Mode
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                      className="text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-200 text-[11px] font-medium flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{isThinkingExpanded ? "Hide Steps" : "View Steps"}</span>
                      {isThinkingExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  {isThinkingExpanded && (
                    <div className="mt-2 pt-2 border-t border-blue-200/40 dark:border-white/5 space-y-1 font-mono text-[11px] text-slate-700 dark:text-white/70">
                      {thinkingSteps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="text-blue-600 dark:text-cyan-400 font-bold shrink-0">
                            ✓
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI Pilot Staged Draft Banner */}
              {activeThread?.draftReply && (
                <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 dark:from-blue-500/10 dark:to-indigo-500/10 border-t border-blue-200/80 dark:border-blue-500/20 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-blue-900 dark:text-cyan-300 flex items-center gap-1.5">
                        <span>AI Pilot Staged Draft</span>
                        {activeThread.draftReplyReason && (
                          <span className="text-[10px] text-slate-500 dark:text-white/50 font-normal truncate">
                            ({activeThread.draftReplyReason})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-white/80 italic truncate max-w-md">
                        &quot;{activeThread.draftReply}&quot;
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setReplyText(activeThread.draftReply || "")}
                      className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      title="Insert this staged draft into the composer input"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Use Draft</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Reply Composer Form */}
              <form
                onSubmit={handleSendReply}
                className="p-3.5 border-t border-slate-200 dark:border-white/5 flex items-center gap-2 bg-white dark:bg-transparent"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type message directly to LinkedIn or click Pilot..."
                    className="w-full h-9 pl-3 pr-8 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/6 text-xs text-slate-900 dark:text-white/85 placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors shadow-xs"
                  />
                  <button
                    type="button"
                    title="Attach file / voice note"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/70 transition-colors cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateAiPilotReply(replyText || undefined)}
                  disabled={isAiGenerating}
                  title="Ask AI Pilot to draft or refine reply"
                  className="h-9 px-2.5 rounded-lg border border-blue-300 dark:border-blue-500/30 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isAiGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Pilot</span>
                </button>
                <button
                  type="submit"
                  disabled={isSending || !replyText.trim()}
                  className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-white-force text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-xs"
                >
                  {isSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Thinking Copilot Drawer */}
      <ThinkingCopilotDrawer
        isOpen={isCopilotDrawerOpen}
        onClose={() => setIsCopilotDrawerOpen(false)}
        contactName={activeThread?.name || ""}
        contactRole={activeThread?.role || ""}
        contactCompany={
          activeThread?.role && activeThread.role.includes("·")
            ? activeThread.role.split("·")[1]?.trim()
            : ""
        }
        conversationHistory={conversationHistory}
        currentDraft={replyText}
        onApplyReply={(suggested) => {
          setReplyText(suggested);
          setIsCopilotDrawerOpen(false);
          setStatusType("success");
          setStatusMessage("✨ Copilot reply inserted into composer.");
        }}
      />

      {/* Chatbot Personalisation & Master Toggle Modal */}
      <ChatbotPersonalisationModal
        isOpen={isPersonalisationModalOpen}
        onClose={() => setIsPersonalisationModalOpen(false)}
        onStatusChanged={(status) => setIsChatbotEnabled(status)}
      />
    </div>
  );
};
