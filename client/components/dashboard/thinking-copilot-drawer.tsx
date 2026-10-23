"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Bot,
  X,
  Send,
  Loader2,
  Check,
  Copy,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Brain,
  Zap,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { conversationApi } from "@/lib/api";
import { ChatbotPersonalisationModal } from "./chatbot-personalisation-modal";

interface ThinkingCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
  contactRole?: string;
  contactCompany?: string;
  conversationHistory?: Array<{ sender: string; text: string }>;
  currentDraft?: string;
  onApplyReply: (reply: string) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "copilot";
  content: string;
  thinkingSteps?: string[];
  suggestedActions?: string[];
  domainReport?: any;
  timestamp: string;
}

export const ThinkingCopilotDrawer: React.FC<ThinkingCopilotDrawerProps> = ({
  isOpen,
  onClose,
  contactName,
  contactRole = "Executive",
  contactCompany = "",
  conversationHistory = [],
  currentDraft = "",
  onApplyReply,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedThinkingId, setExpandedThinkingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPersonalisationOpen, setIsPersonalisationOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with initial greeting & analysis if opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "intro",
          role: "copilot",
          content: `Hi! I'm your WorkPilot Thinking Copilot. I'm connected to the Outreach Brain and synced with ${contactName || "this prospect"}'s history. Ask me how to reply, request a specific angle, or ask to handle objections!`,
          suggestedActions: [
            "Suggest best reply",
            "Coordinate 15m call",
            "Handle objection",
            "Make draft shorter",
          ],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [isOpen, contactName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Step ticker animation during loading
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setActiveStepIndex(0);
      interval = setInterval(() => {
        setActiveStepIndex((prev) => (prev + 1) % 4);
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isOpen) return null;

  const handleSendPrompt = async (promptText?: string) => {
    const query = (promptText || inputQuery).trim();
    if (!query || isLoading) return;

    const userMsgId = `user_${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: "user",
        content: query,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];

    setMessages(newMessages);
    setInputQuery("");
    setIsLoading(true);

    try {
      const res = await conversationApi.chatWithCopilot({
        message: query,
        contactName,
        contactRole,
        contactCompany,
        history: conversationHistory,
        currentDraft,
      });

      const copilotMsgId = `copilot_${Date.now()}`;
      setMessages([
        ...newMessages,
        {
          id: copilotMsgId,
          role: "copilot",
          content: res.reply,
          thinkingSteps: res.thinkingSteps || [],
          suggestedActions: res.suggestedActions || [],
          domainReport: res.domainIntelligence,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setExpandedThinkingId(copilotMsgId);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          id: `err_${Date.now()}`,
          role: "copilot",
          content: `I couldn't complete the thought process: ${err?.message || "Please check your network or API connection."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const thinkingSimulationSteps = [
    `Analyzing persona for ${contactName || "prospect"}...`,
    `Querying Outreach Brain for cross-domain collisions...`,
    `Synthesizing peer-to-peer first-person response...`,
    `Verifying brevity, natural tone, and conversion power...`,
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/70 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-purple-950/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Brain className="w-4 h-4 text-cyan-200" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Thinking AI Copilot
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-blue-600/10 text-blue-700 dark:text-cyan-300 font-semibold border border-blue-500/20">
                Reasoning Model
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-white/50 truncate max-w-[280px]">
              {contactName ? `Assisting with ${contactName}` : "Context-aware reasoning assistant"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPersonalisationOpen(true)}
            className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white transition-colors cursor-pointer"
            title="Configure Chatbot Personalisation & Tone"
          >
            <Sliders className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white transition-colors cursor-pointer"
            title="Close Copilot"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Domain Intelligence Pill */}
      <div className="px-4 py-2 bg-slate-100/90 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-white/70">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold text-[11px]">Outreach Brain:</span>
          <span className="text-[11px] text-slate-600 dark:text-white/60 font-mono">
            {contactCompany ? `${contactCompany.toLowerCase().replace(/[^a-z0-9]/g, "")}.com` : "Domain Guard Active"}
          </span>
        </div>
        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
          Deduplication On
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40 dark:bg-slate-900/30 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-xl p-3.5 space-y-2 shadow-xs ${
                m.role === "user"
                  ? "bg-blue-600 text-white font-medium"
                  : "bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white/90 border border-slate-200/80 dark:border-white/10"
              }`}
            >
              {/* Thinking Steps Accordion (for Copilot responses) */}
              {m.thinkingSteps && m.thinkingSteps.length > 0 && (
                <div className="rounded-lg bg-blue-50/60 dark:bg-slate-900/80 border border-blue-200/70 dark:border-white/10 overflow-hidden text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedThinkingId(expandedThinkingId === m.id ? null : m.id)
                    }
                    className="w-full px-2.5 py-1.5 flex items-center justify-between text-blue-800 dark:text-cyan-300 font-semibold cursor-pointer hover:bg-blue-100/50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                      <span>Thought Process ({m.thinkingSteps.length} steps)</span>
                    </div>
                    {expandedThinkingId === m.id ? (
                      <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                    )}
                  </button>

                  {expandedThinkingId === m.id && (
                    <div className="p-2.5 pt-1 space-y-1.5 border-t border-blue-100 dark:border-white/5 font-mono text-[10px] text-slate-700 dark:text-white/70">
                      {m.thinkingSteps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                          <span className="text-blue-500 dark:text-cyan-400 font-bold shrink-0">
                            ✓
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Main Reply Body */}
              <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>

              {/* Action Buttons for drafted replies */}
              {m.role === "copilot" && m.id !== "intro" && (
                <div className="pt-2 flex items-center gap-2 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => onApplyReply(m.content)}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Insert into Composer</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(m.content, m.id)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white/80 text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedId === m.id ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === m.id ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Action Suggestion Pills */}
            {m.suggestedActions && m.suggestedActions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%]">
                {m.suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendPrompt(action)}
                    className="px-2 py-1 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 border border-blue-200/80 dark:border-blue-700/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium transition-colors cursor-pointer"
                  >
                    ⚡ {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Live Thinking Step Progress Bar when generating */}
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="max-w-[85%] rounded-xl p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 border border-blue-200/80 dark:border-white/10 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-blue-800 dark:text-cyan-300 font-semibold text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-cyan-400" />
                <span>Thinking in progress...</span>
              </div>
              <div className="p-2 rounded bg-white/70 dark:bg-slate-900/80 font-mono text-[10px] text-slate-700 dark:text-white/70 border border-blue-100 dark:border-white/5 animate-pulse">
                {thinkingSimulationSteps[activeStepIndex]}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Copilot (e.g. 'Draft a polite follow-up', 'Ask for demo')..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors cursor-pointer shrink-0 shadow-xs"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Chatbot Personalisation Modal */}
      <ChatbotPersonalisationModal
        isOpen={isPersonalisationOpen}
        onClose={() => setIsPersonalisationOpen(false)}
      />
    </div>
  );
};
