"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sliders,
  CheckCircle2,
  Sparkles,
  Save,
  Clock,
  AlertCircle,
  Loader2,
  X,
  Terminal,
  Wrench,
  Send,
  Layers,
  Check,
  Cpu,
  UserPlus,
  Square,
  Users,
  AlertTriangle,
  Trash2,
  MessageSquarePlus,
  Radio,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { User, Campaign } from "@/lib/mock-data";
import { linkedinApi, dashboardApi, agentApi, AgentTask } from "@/lib/api";
import { LinkedInConnectModal } from "../linkedin-connect-modal";

interface AgentViewProps {
  user: User;
  campaign: Campaign | null;
  linkedInConnected: boolean;
  onUpdateConnection: (connected: boolean) => void;
}

const REGISTERED_TOOLS = [
  {
    name: "search_linkedin_leads",
    label: "Lead Search",
    description:
      "Searches LinkedIn to discover verified professionals by role, company, location, and industry.",
    schema: "role: string, location?: string, company?: string, limit?: number",
    category: "Discovery",
  },
  {
    name: "send_connection_request",
    label: "Connection Invite",
    description:
      "Sends an outbound invitation with an optional tailored note (<300 chars) directly to the prospect's profile.",
    schema: "linkedinId: string, note?: string, name?: string",
    category: "Outreach",
  },
  {
    name: "batch_send_connection_requests",
    label: "Batch Outreach",
    description:
      "Dispatches connection requests across multiple prospects with custom note policies (e.g. 2 with notes, 3 blank) via the Batch Outreach Subgraph.",
    schema:
      "candidates: array, withNoteCount?: number, withoutNoteCount?: number",
    category: "Campaign",
  },
  {
    name: "research_and_batch_connect",
    label: "Auto Research & Connect",
    description:
      "End-to-end autonomous workflow: discovers verified LinkedIn leads via the Research Subgraph, then executes batch connection requests with personalized & blank note strategies.",
    schema:
      "role: string, totalCount?: number, withNoteCount?: number, withoutNoteCount?: number",
    category: "Campaign",
  },
  {
    name: "send_linkedin_message",
    label: "Direct Message",
    description:
      "Sends a 1-on-1 direct message to an existing connection or active messaging thread.",
    schema: "recipientId: string, message: string",
    category: "Outreach",
  },
  {
    name: "schedule_autonomous_campaign",
    label: "Autonomous Campaign",
    description:
      "Discovers leads and enqueues outbound connection requests with 8–18m humanized delays & business-hour pacing.",
    schema:
      "role: string, location?: string, limit?: number, personalizedNote?: string",
    category: "Campaign",
  },
  {
    name: "get_account_safety_and_limits",
    label: "Safety & Limits",
    description:
      "Retrieves account health status, daily connection limits (25/day), message limits (50/day), and queue stats.",
    schema: "userId?: string",
    category: "Safety",
  },
  {
    name: "get_pending_invitations",
    label: "Pending Invites",
    description:
      "Fetches sent invitations waiting for acceptance or received requests awaiting approval.",
    schema: "type: 'sent' | 'received', limit?: number",
    category: "Network",
  },
  {
    name: "manage_invitation",
    label: "Manage Invitation",
    description:
      "Executes accept or decline on incoming invites, or withdraws sent outbound invitations.",
    schema: "action: 'accept' | 'decline' | 'withdraw', invitationId: string",
    category: "Network",
  },
  {
    name: "get_inbox_conversations",
    label: "Inbox Threads",
    description:
      "Fetches recent conversation threads enriched with attendee profiles, PFPs, headlines, and last messages.",
    schema: "limit?: number",
    category: "Inbox",
  },
  {
    name: "emergency_pause_automation",
    label: "Emergency Freeze",
    description:
      "Circuit breaker that instantly pauses all outbound actions, invites, and follow-ups across the system.",
    schema: "reason?: string",
    category: "Safety",
  },
  {
    name: "resume_automation",
    label: "Resume Automation",
    description:
      "Resumes outbound queue dispatching and campaign sequence execution.",
    schema: "userId?: string",
    category: "Safety",
  },
  {
    name: "get_own_profile_and_rating",
    label: "Profile Audit & Rating",
    description:
      "Fetches own LinkedIn profile, evaluates headline/about sections, and returns an audit score (0-100) with recommendations.",
    schema: "accountId?: string",
    category: "Profile",
  },
  {
    name: "update_profile_headline",
    label: "Edit Headline",
    description:
      "Updates your LinkedIn profile headline directly and syncs to local workspace.",
    schema: "headline: string, accountId?: string",
    category: "Profile",
  },
  {
    name: "create_linkedin_post",
    label: "Publish Post",
    description:
      "Publishes a new text post (with optional media attachments) directly to your LinkedIn feed.",
    schema: "text: string, attachments?: any[], accountId?: string",
    category: "Content",
  },
  {
    name: "get_own_posts",
    label: "My Recent Posts",
    description:
      "Fetches recent posts published by the user on LinkedIn, including engagement likes and comments counts.",
    schema: "limit?: number, accountId?: string",
    category: "Content",
  },
];

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const parseInline = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    const regex =
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.slice(lastIdx, match.index));
      }
      if (match[1] && match[2]) {
        parts.push(
          <a
            key={match.index}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-500 dark:text-cyan-400 dark:hover:text-cyan-300 underline font-semibold inline-flex items-center gap-0.5"
          >
            {match[1]}
          </a>,
        );
      } else if (match[3]) {
        parts.push(
          <strong
            key={match.index}
            className="text-slate-950 dark:text-white font-bold"
          >
            {match[3]}
          </strong>,
        );
      } else if (match[4]) {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-blue-700 dark:text-cyan-300 border border-slate-400 dark:border-white/10 font-mono text-[11px]"
          >
            {match[4]}
          </code>,
        );
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx));
    }
    return parts.length > 0 ? parts : text;
  };

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = (key: number) => {
    if (tableRows.length === 0) return null;
    const header = tableRows[0] || [];
    const rows = tableRows.slice(1);
    const tableEl = (
      <div
        key={`table_${key}`}
        className="my-2.5 overflow-x-auto rounded-lg border border-slate-400 dark:border-white/10 bg-white dark:bg-black/30 shadow-xs"
      >
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-400 dark:border-white/8 text-slate-700 dark:text-white/70 font-semibold">
            <tr>
              {header.map((col, ci) => (
                <th
                  key={ci}
                  className="px-3 py-1.5 font-semibold whitespace-nowrap"
                >
                  {parseInline(col.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-800 dark:text-white/85">
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors"
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-1.5">
                    {parseInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    return tableEl;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableRow = line.trim().startsWith("|") && line.trim().endsWith("|");

    if (isTableRow) {
      const isSep = /^\|(\s*:?-+:?\s*\|)+$/.test(line.trim());
      if (!isSep) {
        const cols = line.trim().split("|").slice(1, -1);
        tableRows.push(cols);
      }
      inTable = true;
    } else {
      if (inTable && tableRows.length > 0) {
        elements.push(flushTable(i));
        inTable = false;
      }
      if (line.trim().startsWith("### ")) {
        elements.push(
          <h4
            key={i}
            className="text-xs font-bold text-slate-900 dark:text-white/95 mt-2 mb-1"
          >
            {parseInline(line.replace("### ", ""))}
          </h4>,
        );
      } else if (line.trim().startsWith("## ")) {
        elements.push(
          <h3
            key={i}
            className="text-sm font-bold text-slate-900 dark:text-white mt-2.5 mb-1"
          >
            {parseInline(line.replace("## ", ""))}
          </h3>,
        );
      } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        elements.push(
          <div key={i} className="flex items-start gap-1.5 ml-1 my-0.5">
            <span className="text-blue-600 dark:text-cyan-400 mt-1 text-[8px]">
              ●
            </span>
            <span>{parseInline(line.replace(/^[-*]\s+/, ""))}</span>
          </div>,
        );
      } else if (line.trim() === "---") {
        elements.push(
          <hr key={i} className="border-slate-400 dark:border-white/8 my-2" />,
        );
      } else if (line.trim() === "") {
        elements.push(<div key={i} className="h-1.5" />);
      } else {
        elements.push(
          <div key={i} className="leading-relaxed">
            {parseInline(line)}
          </div>,
        );
      }
    }
  }

  if (tableRows.length > 0) {
    elements.push(flushTable(lines.length));
  }

  return <div className="space-y-0.5">{elements}</div>;
};

// ---------------------------------------------------------------------------
// Rich Chat Cards for Autonomous Connection Requests, Queues & Pacing
// ---------------------------------------------------------------------------

interface ConnectionCardProps {
  data: {
    title?: string;
    name: string;
    headline?: string;
    profileUrl?: string;
    avatarUrl?: string;
    status: "sent" | "failed" | "queued" | "pending";
    withNote?: boolean;
    note?: string;
    index?: number;
    total?: number;
    timestamp?: string;
    error?: string;
  };
}

const ConnectionRequestCard: React.FC<ConnectionCardProps> = ({ data }) => {
  const isSuccess = data.status === "sent";
  const initials = data.name
    ? data.name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "LI";

  return (
    <div className="w-full sm:min-w-85 max-w-md my-1.5 rounded-2xl bg-linear-to-b from-white via-slate-50/90 to-slate-100/60 dark:from-slate-900/95 dark:via-[#091629] dark:to-black/90 border border-slate-400/90 dark:border-cyan-500/30 shadow-md dark:shadow-xl dark:shadow-cyan-950/30 overflow-hidden transition-all duration-200 hover:border-blue-400 dark:hover:border-cyan-400/50">
      {/* Top Banner with LinkedIn Branding */}
      <div className="px-3.5 py-2 bg-linear-to-r from-[#0A66C2] via-blue-600 to-indigo-600 text-white flex items-center justify-between text-[11px] font-semibold">
        <div className="flex items-center gap-1.5">
          <LinkedInIcon className="w-3.5 h-3.5 fill-current" />
          <span>{data.title || "LinkedIn Connection Request"}</span>
          {data.index !== undefined && data.total !== undefined && (
            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-mono font-bold">
              #{data.index} of {data.total}
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/80 font-mono">
          {data.timestamp || "Just now"}
        </span>
      </div>

      {/* Main Profile Info & Status */}
      <div className="p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Avatar with authentic LinkedIn badge */}
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-linear-to-br from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-sm border border-white dark:border-slate-800">
                {initials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0A66C2] flex items-center justify-center text-white shadow-xs border border-white dark:border-slate-900">
                <LinkedInIcon className="w-2.5 h-2.5 fill-current" />
              </div>
            </div>

            {/* Name & Headline */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white tracking-tight truncate">
                  {data.name}
                </h4>
                {data.profileUrl && (
                  <a
                    href={data.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors inline-flex items-center"
                    title="Open LinkedIn Profile"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-white/60 line-clamp-2 mt-0.5 leading-snug font-medium">
                {data.headline || "LinkedIn Member"}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {isSuccess ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 shadow-xs">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Sent</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">
                <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Notice</span>
              </span>
            )}
          </div>
        </div>

        {/* Strategy Details Box */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-400/70 dark:border-white/6 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-white/40 font-medium">
              Strategy:
            </span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-md text-[10px] ${
                data.withNote
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30"
                  : "bg-slate-200 text-slate-800 dark:bg-white/10 dark:text-white/80"
              }`}
            >
              {data.withNote ? "✍️ Personalized Note" : "✉️ Blank (No Note)"}
            </span>
          </div>

          {data.withNote && data.note && (
            <div className="mt-1 pt-1.5 border-t border-slate-400/60 dark:border-white/5">
              <p className="text-[10px] text-slate-500 dark:text-white/40 italic mb-0.5">
                Attached Note:
              </p>
              <p className="text-[11px] text-slate-800 dark:text-white/90 bg-white/80 dark:bg-black/40 p-2 rounded-lg border border-slate-400/50 dark:border-white/5 font-sans leading-relaxed">
                &ldquo;{data.note}&rdquo;
              </p>
            </div>
          )}

          {!data.withNote && (
            <p className="text-[10px] text-slate-500 dark:text-white/40">
              Clean invitation dispatched without text to maximize acceptance
              rates.
            </p>
          )}

          {data.error && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium pt-1">
              Details: {data.error}
            </p>
          )}
        </div>

        {/* Protection & Action Footer */}
        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 dark:text-white/45">
          <div className="flex items-center gap-1 font-medium text-sky-700 dark:text-cyan-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Configurable activity pacing</span>
          </div>

          {data.profileUrl ? (
            <a
              href={data.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 hover:text-blue-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline flex items-center gap-1"
            >
              <span>View Profile</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span className="font-mono text-[9px] text-slate-400 dark:text-white/30">
              Dispatched by Agent
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface OutreachQueueProps {
  data: {
    total: number;
    candidates: Array<{
      name: string;
      headline?: string;
      profileUrl?: string;
      withNote?: boolean;
    }>;
    withNoteCount?: number;
    withoutNoteCount?: number;
    dailyLimit?: number;
    delaySeconds?: number;
  };
}

const OutreachQueueCard: React.FC<OutreachQueueProps> = ({ data }) => {
  return (
    <div className="w-full sm:min-w-85 max-w-md sm:max-w-lg my-2 rounded-2xl bg-linear-to-b from-white via-sky-50/30 to-slate-50 dark:from-slate-900/95 dark:via-[#091526] dark:to-black/90 border border-sky-200/80 dark:border-cyan-500/30 shadow-md dark:shadow-xl dark:shadow-cyan-950/20 p-4 space-y-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-400/80 dark:border-white/8">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white">
              Outreach Queue Initialized
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-white/50">
              Discovered verified prospects ready for paced dispatch
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-blue-100 text-blue-800 dark:bg-cyan-500/20 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/30">
          {data.total} Candidates
        </span>
      </div>

      {/* Safety Tags */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {data.dailyLimit !== undefined && (
          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/20 font-medium flex items-center gap-1">
            🔒 Daily Cap: {data.dailyLimit}/day
          </span>
        )}
        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 dark:bg-cyan-500/10 dark:text-cyan-300 border border-sky-200/80 dark:border-cyan-500/20 font-medium flex items-center gap-1">
          Pacing delay: {data.delaySeconds || 20}s
        </span>
        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/20 font-medium flex items-center gap-1">
          🚀 Outreach Subgraph
        </span>
      </div>

      {/* Candidates List Preview */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {data.candidates.map((cand, idx) => {
          const initials = cand.name
            ? cand.name
                .split(" ")
                .filter(Boolean)
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            : "LI";

          return (
            <div
              key={idx}
              className="p-2 rounded-xl bg-white dark:bg-white/3 border border-slate-400/70 dark:border-white/6 flex items-center justify-between gap-2.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-white/30 shrink-0 w-4">
                  #{idx + 1}
                </span>
                <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate text-[11px]">
                    {cand.name}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-white/50 truncate">
                    {cand.headline || "LinkedIn Professional"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    cand.withNote
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300"
                      : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/70"
                  }`}
                >
                  {cand.withNote ? "✍️ With Note" : "✉️ Blank"}
                </span>
                <span className="text-[9px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-500/20">
                  ⏳ Queued
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface PacingCardProps {
  data: {
    delaySeconds: number;
    nextCandidate?: string;
    nextDispatchTime?: string;
  };
}

const PacingDelayCard: React.FC<PacingCardProps> = ({ data }) => {
  return (
    <div className="w-full sm:min-w-85 max-w-md my-1.5 rounded-2xl bg-linear-to-r from-amber-50/90 via-sky-50/50 to-blue-50/70 dark:from-[#1b1506] dark:via-[#091526] dark:to-[#050c18] border border-amber-200/80 dark:border-amber-500/25 p-3.5 shadow-sm space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 animate-spin" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Activity pacing delay active</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] font-mono font-bold">
                {data.delaySeconds}s Cooldown
              </span>
            </h4>
            <p className="text-[10px] text-slate-600 dark:text-white/50">
              Organic human pacing between requests to protect account health
            </p>
          </div>
        </div>
      </div>

      {data.nextCandidate && (
        <div className="p-2 rounded-xl bg-white/80 dark:bg-black/40 border border-amber-200/50 dark:border-white/5 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-white/50 font-medium">
            Next Target:
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            {data.nextCandidate}
          </span>
          {data.nextDispatchTime && (
            <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 font-semibold">
              at {data.nextDispatchTime}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

function parseMessageSpecialCard(msg: {
  role: string;
  content: string;
  toolCalls?: Array<{ tool: string; input: any; output?: any }>;
  timestamp?: string;
}): {
  type: "connection_request" | "queue" | "pacing" | "none";
  data?: any;
} {
  // 1. Check toolCalls first
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    const connTc = msg.toolCalls.find(
      (tc) =>
        tc.tool === "send_connection_request" ||
        tc.tool === "send_linkedin_message" ||
        tc.tool === "batch_send_messages",
    );
    if (connTc) {
      return {
        type: "connection_request",
        data: {
          title:
            connTc.tool === "batch_send_messages"
              ? "Batch Direct Message"
              : connTc.tool === "send_linkedin_message"
              ? "Direct Message"
              : "LinkedIn Connection Request",
          name:
            connTc.input?.name ||
            connTc.input?.target ||
            connTc.input?.recipientId ||
            "Recipient",
          headline: connTc.input?.headline,
          profileUrl: connTc.input?.profileUrl,
          withNote:
            connTc.input?.withNote !== undefined
              ? connTc.input?.withNote
              : Boolean(connTc.input?.note),
          note: connTc.input?.note,
          status:
            connTc.input?.status === "failed" ||
            connTc.output?.success === false
              ? "failed"
              : "sent",
          error: connTc.output?.message,
          timestamp: msg.timestamp,
        },
      };
    }

    const queueTc = msg.toolCalls.find((tc) => tc.tool === "queue_prospects");
    if (queueTc) {
      return {
        type: "queue",
        data: {
          total: queueTc.input?.total || queueTc.input?.candidates?.length || 0,
          candidates: queueTc.input?.candidates || [],
          withNoteCount: queueTc.input?.withNoteCount,
          withoutNoteCount: queueTc.input?.withoutNoteCount,
        },
      };
    }

    const pacingTc = msg.toolCalls.find((tc) => tc.tool === "pacing_cooldown");
    if (pacingTc) {
      return {
        type: "pacing",
        data: {
          delaySeconds: pacingTc.input?.delaySeconds || 20,
          nextCandidate: pacingTc.input?.nextCandidate,
          nextDispatchTime: pacingTc.input?.nextDispatchTime,
        },
      };
    }
  }

  // 2. Check content patterns (e.g. from live stream or reloaded DB history)
  if (
    msg.content.includes("Connection Request Dispatched") ||
    msg.content.includes("Connection Request to") ||
    msg.content.includes("Sent connection request to")
  ) {
    const idxMatch = msg.content.match(/\[(\d+)\/(\d+)\]/);
    const prospectMatch = msg.content.match(
      /\*\*Prospect\*\*:\s*\*\*?([^*\n]+)\*\*?/,
    );
    const headlineMatch = msg.content.match(/\*\*Headline\*\*:\s*([^\n]+)/);
    const stratMatch = msg.content.match(/\*\*Strategy\*\*:\s*([^\n]+)/);
    const statusMatch = msg.content.match(/\*\*Status\*\*:\s*([^\n]+)/);
    const timeMatch = msg.content.match(/\*\*Time\*\*:\s*([^\n]+)/);
    const reasonMatch = msg.content.match(/\*\*Reason\*\*:\s*([^\n]+)/);

    const name = prospectMatch
      ? prospectMatch[1].trim()
      : msg.content
          .match(/to\s+([A-Z][a-zA-Z\s]+?)(?:\s+could|\.|\n|$)/)?.[1]
          ?.trim() || "LinkedIn Member";

    const isWithNote = stratMatch
      ? stratMatch[1].toLowerCase().includes("note") &&
        !stratMatch[1].toLowerCase().includes("blank") &&
        !stratMatch[1].toLowerCase().includes("no note")
      : false;

    const isFailed =
      (statusMatch && statusMatch[1].toLowerCase().includes("fail")) ||
      msg.content.includes("could not be sent") ||
      msg.content.includes("Error dispatching");

    return {
      type: "connection_request",
      data: {
        name,
        headline: headlineMatch ? headlineMatch[1].trim() : undefined,
        index: idxMatch ? parseInt(idxMatch[1], 10) : undefined,
        total: idxMatch ? parseInt(idxMatch[2], 10) : undefined,
        withNote: isWithNote,
        status: isFailed ? "failed" : "sent",
        error: reasonMatch ? reasonMatch[1].trim() : undefined,
        timestamp: timeMatch ? timeMatch[1].trim() : msg.timestamp,
      },
    };
  }

  if (msg.content.includes("Outreach Queue Initialized")) {
    const totalMatch = msg.content.match(
      /Initialized\s*\((\d+)\s*Prospects?\)/i,
    );
    const dailyCapMatch = msg.content.match(/\*\*(\d+)\s*requests\/day\*\*/i);
    const delayMatch = msg.content.match(/\*\*(\d+)s\*\*\s*delay/i);

    const rows = msg.content
      .split("\n")
      .filter(
        (l) =>
          l.startsWith("|") &&
          !l.includes("---") &&
          !l.includes("Prospect Name"),
      );
    const candidates = rows
      .map((r) => {
        const parts = r
          .split("|")
          .map((p) => p.trim())
          .filter(Boolean);
        const cleanName = (parts[1] || "").replace(/\*\*/g, "").trim();
        const cleanHeadline = parts[2] || "";
        const withNote =
          (parts[3] || "").includes("Note") &&
          !(parts[3] || "").includes("Blank");
        return {
          name: cleanName,
          headline: cleanHeadline,
          withNote,
        };
      })
      .filter((c) => c.name);

    return {
      type: "queue",
      data: {
        total: totalMatch ? parseInt(totalMatch[1], 10) : candidates.length,
        candidates,
        dailyLimit: dailyCapMatch ? parseInt(dailyCapMatch[1], 10) : undefined,
        delaySeconds: delayMatch ? parseInt(delayMatch[1], 10) : 20,
      },
    };
  }

  if (msg.content.includes("Safety Pacing Delay Active")) {
    const delayMatch = msg.content.match(/Active\s*\((\d+)s\s*Cooldown\)/i);
    const nextMatch = msg.content.match(
      /\*\*Next in Queue\*\*:\s*\*\*?([^*\n]+)\*\*?/i,
    );
    const dispatchMatch = msg.content.match(
      /\*\*Scheduled Dispatch\*\*:\s*\*\*?([^*\n]+)\*\*?/i,
    );

    return {
      type: "pacing",
      data: {
        delaySeconds: delayMatch ? parseInt(delayMatch[1], 10) : 20,
        nextCandidate: nextMatch ? nextMatch[1].trim() : undefined,
        nextDispatchTime: dispatchMatch ? dispatchMatch[1].trim() : undefined,
      },
    };
  }

  return { type: "none" };
}

export const AgentView: React.FC<AgentViewProps> = ({
  user,

  campaign,
  linkedInConnected,
  onUpdateConnection,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"console" | "settings">("console");

  // Interactive Agent Chat State
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant" | "system";
      content: string;
      toolCalls?: Array<{ tool: string; input: any; output?: any }>;
      isSummary?: boolean;
      timestamp: string;
    }>
  >([
    {
      id: "initial",
      role: "assistant",
      content:
        "**WORKPILOT Autonomous AI Agent** is online and ready.\n\nAll 16 modular LinkedIn outreach & automation tools are active with continuous session memory.\n\nYou can ask me to search verified leads, run multi-step batch outreach (e.g. 2 with personalized note, 3 blank), audit your profile & headline rating, publish LinkedIn posts, schedule autonomous campaigns with humanized delays (8–18m), or inspect safety quotas.",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load chat history from PostgreSQL long-term memory on mount/refresh
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await agentApi.getMessages();
      if (res?.data && res.data.length > 0) {
        setChatMessages(
          res.data.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
            toolCalls: m.toolCalls,
            isSummary: m.isSummary,
            timestamp: new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })),
        );
      }
    } catch (err: any) {
      console.warn("Failed to load agent message history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user.id]);

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [isClearingDb, setIsClearingDb] = useState(false);

  const handleConfirmNewChat = async () => {
    setIsClearingDb(true);
    try {
      await agentApi.clearMessages();
    } catch (err: any) {
      console.warn("Failed to clear DB history:", err);
    } finally {
      setIsClearingDb(false);
      setShowNewChatModal(false);
    }
    setChatMessages([
      {
        id: "fresh",
        role: "assistant",
        content:
          "✨ Fresh chat session started. Previous conversation messages and LangGraph memory have been deleted from the database. What would you like to accomplish today?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  const handleClearHistory = () => {
    setShowNewChatModal(true);
  };

  // Settings State - strictly personality and dailyQuota (1 to 20), isolated per user
  const storageKey = `workpilot_agent_settings_${user.id || "default"}`;
  const [personality, setPersonality] = useState<string>(
    "Act as a professional, direct, and thoughtful outreach partner. Write natural, concise LinkedIn messages and connection notes that spark authentic professional conversations. Never sound robotic or use aggressive sales pitches.",
  );
  const [companyKnowledge, setCompanyKnowledge] = useState<string>("");
  const [faq, setFaq] = useState<string>("");
  const [dailyQuota, setDailyQuota] = useState<number>(10);
  const [campaignType, setCampaignType] = useState<"DISCOVERY" | "ENGAGEMENT">("DISCOVERY");
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount / user change (sync from user-scoped localStorage and backend)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (typeof window !== "undefined") {
          const local = localStorage.getItem(storageKey);
          if (local) {
            const parsed = JSON.parse(local);
            if (parsed.personality) setPersonality(parsed.personality);
            if (parsed.companyKnowledge) setCompanyKnowledge(parsed.companyKnowledge);
            if (parsed.faq) setFaq(parsed.faq);
            if (parsed.dailyQuota !== undefined) {
              setDailyQuota(
                Math.min(Math.max(Number(parsed.dailyQuota), 1), 20),
              );
            }
            if (parsed.campaignType) setCampaignType(parsed.campaignType);
          }
        }
        const res = await agentApi.getSettings();
        if (res?.data) {
          const s = res.data;
          if (s.personality) setPersonality(s.personality);
          if (s.companyKnowledge) setCompanyKnowledge(s.companyKnowledge);
          if (s.faq) setFaq(s.faq);
          if (s.dailyQuota !== undefined) {
            setDailyQuota(Math.min(Math.max(Number(s.dailyQuota), 1), 20));
          }
          if (s.campaignType) setCampaignType(s.campaignType);
          if (s.isLocked || s.isOutreachRunning) {
            setIsOutreachRunning(true);
          }
        }
      } catch (err) {
        console.warn("Could not load agent settings from server:", err);
      }
    };
    loadSettings();
  }, [user.id, storageKey]);

  // Active Background Tasks from Subgraphs & Real-Time SSE Stream
  const [activeTasks, setActiveTasks] = useState<AgentTask[]>([]);
  const [isOutreachRunning, setIsOutreachRunning] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch of active background tasks
    agentApi
      .getTasks()
      .then((res) => {
        if (res?.data) {
          setActiveTasks(res.data);
          const hasRunningOutreach = res.data.some(
            (t: AgentTask) => t.type === "outreach" && t.status === "running",
          );
          setIsOutreachRunning(hasRunningOutreach);
        }
      })
      .catch(() => {});

    // Establish constant Server-Sent Events (SSE) stream
    let eventSource: EventSource | null = null;
    let token = "";
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || "";
      if (!token) {
        const match = document.cookie.match(new RegExp("(^| )token=([^;]+)"));
        if (match) token = match[2];
      }
    }

    const apiBase =
      typeof window !== "undefined" && (!window.location.port || window.location.port === "80" || window.location.port === "443")
        ? `${window.location.protocol}//${window.location.hostname}`
        : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const sseUrl = `${apiBase.replace(/\/+$/, "")}/api/agent/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    try {
      eventSource = new EventSource(sseUrl, { withCredentials: true });

      eventSource.addEventListener("initial_state", (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (Array.isArray(parsed.tasks)) {
            setActiveTasks(parsed.tasks);
            const hasRunningOutreach = parsed.tasks.some(
              (t: AgentTask) => t.type === "outreach" && t.status === "running",
            );
            setIsOutreachRunning(hasRunningOutreach);
          }
        } catch (err) {
          console.warn("Failed to parse SSE initial_state:", err);
        }
      });

      eventSource.addEventListener("task_created", (e: MessageEvent) => {
        try {
          const newTask: AgentTask = JSON.parse(e.data);
          setActiveTasks((prev) => [
            newTask,
            ...prev.filter((t) => t.id !== newTask.id),
          ]);
          if (newTask.type === "outreach" && newTask.status === "running") {
            setIsOutreachRunning(true);
          }
        } catch (err) {
          console.warn("Failed to parse SSE task_created:", err);
        }
      });

      eventSource.addEventListener("task_updated", (e: MessageEvent) => {
        try {
          const updated: AgentTask = JSON.parse(e.data);
          setActiveTasks((prev) => {
            const next = prev.map((t) => (t.id === updated.id ? updated : t));
            const hasRunningOutreach = next.some(
              (t) => t.type === "outreach" && t.status === "running",
            );
            setIsOutreachRunning(hasRunningOutreach);
            return next;
          });
        } catch (err) {
          console.warn("Failed to parse SSE task_updated:", err);
        }
      });

      eventSource.addEventListener("task_log", (e: MessageEvent) => {
        try {
          const { taskId, log } = JSON.parse(e.data);
          setActiveTasks((prev) =>
            prev.map((t) => {
              if (t.id === taskId) {
                return {
                  ...t,
                  logs: [...(t.logs || []), log],
                };
              }
              return t;
            }),
          );
        } catch (err) {
          console.warn("Failed to parse SSE task_log:", err);
        }
      });

      eventSource.addEventListener("chat_message", (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        } catch (err) {
          console.warn("Failed to parse SSE chat_message:", err);
        }
      });
    } catch (sseErr) {
      console.warn("Failed to establish SSE connection:", sseErr);
    }

    return () => {
      eventSource?.close();
    };
  }, [user.id]);

  const handleStopTask = async (taskId: string) => {
    try {
      await agentApi.stopTask(taskId);
      setActiveTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "stopped" as const } : t,
        ),
      );
      const remainingOutreach = activeTasks.some(
        (t) =>
          t.id !== taskId && t.type === "outreach" && t.status === "running",
      );
      setIsOutreachRunning(remainingOutreach);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_task_stop_${Date.now()}`,
          role: "assistant",
          content: `⏸️ **Subagent stopped.** Active background task \`${taskId}\` was halted by user request.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (err) {
      console.warn("Failed to stop task:", err);
    }
  };

  // Killswitch state
  const [isPaused, setIsPaused] = useState(false);
  const [killswitchLoading, setKillswitchLoading] = useState(false);
  const [killswitchMsg, setKillswitchMsg] = useState("");

  // LinkedIn Modal inside Agent View
  const [modalOpen, setModalOpen] = useState(false);

  // Human-in-the-Loop (HITL) Interrupt state with 10s auto-countdown
  const [pendingInterrupt, setPendingInterrupt] = useState<{
    action: string;
    target?: string;
    name?: string;
    note?: string;
    threadId: string;
    secondsLeft: number;
    rawInputText?: string;
    total?: number;
    withNoteCount?: number;
    withoutNoteCount?: number;
    candidates?: Array<{
      name: string;
      headline?: string;
      withNote: boolean;
      note?: string;
    }>;
  } | null>(null);

  const [isStopping, setIsStopping] = useState(false);

  const handleStopAgent = async () => {
    const threadId = user.id ? `thread_${user.id}` : "default";
    setIsStopping(true);
    try {
      await agentApi.stop(threadId);
      setActiveTasks((prev) =>
        prev.map((t) => ({ ...t, status: "stopped" as const })),
      );
      setIsOutreachRunning(false);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_stop_${Date.now()}`,
          role: "assistant",
          content:
            "⏸️ **Agent stopped.** All reasoning, background outreach subagents, and inbox auto-reply monitors have been cleanly halted.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      setPendingInterrupt(null);
    } catch (err: any) {
      console.warn("Failed to stop agent:", err);
    } finally {
      setIsStopping(false);
      setIsChatting(false);
    }
  };

  useEffect(() => {
    if (activeTab === "console") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab, pendingInterrupt]);

  // 10-Second Auto-Countdown Timer for Connection Request HITL
  useEffect(() => {
    if (!pendingInterrupt) return;

    if (pendingInterrupt.secondsLeft <= 0) {
      // 10 seconds expired without user override: automatically proceed with personalized note or batch
      handleResumeInterrupt({ withNote: true });
      return;
    }

    const timer = setTimeout(() => {
      setPendingInterrupt((prev) =>
        prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null,
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [pendingInterrupt]);

  const handleResumeInterrupt = async (decision: {
    withNote?: boolean;
    allWithNote?: boolean;
    cancel?: boolean;
  }) => {
    if (!pendingInterrupt) return;
    const current = pendingInterrupt;
    setPendingInterrupt(null);

    if (decision.cancel) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: `Connection outreach was cancelled by user.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      return;
    }

    setIsChatting(true);

    try {
      const currentSettingsPayload = {
        personality: personality.trim(),
        companyKnowledge: companyKnowledge.trim(),
        faq: faq.trim(),
        dailyQuota,
      };

      let res: any;
      if (current.rawInputText) {
        // Direct intent flow: dispatch prompt with chosen note flag
        const noteFlag =
          decision.withNote === false ? " without note" : " with note";
        res = await agentApi.chat({
          messages: [
            ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: `${current.rawInputText}${noteFlag}` },
          ],
          threadId: current.threadId,
          agentSettings: currentSettingsPayload,
        });
      } else {
        // LangGraph resume flow using Command({ resume })
        res = await agentApi.chat({
          resume: decision,
          threadId: current.threadId,
          agentSettings: currentSettingsPayload,
        });
      }

      if (res?.data?.interrupted && res?.data?.interrupt) {
        const interruptData = res.data.interrupt;
        setPendingInterrupt({
          action: interruptData.action || "send_connection_request",
          target: interruptData.target || interruptData.name || "Recipient",
          name: interruptData.name || interruptData.target || "Recipient",
          note:
            interruptData.note ||
            "Hi, I came across your profile and would love to connect!",
          threadId: res.data.threadId || current.threadId,
          secondsLeft: 10,
          total: interruptData.total,
          withNoteCount: interruptData.withNoteCount,
          withoutNoteCount: interruptData.withoutNoteCount,
          candidates: interruptData.candidates,
        });
        return;
      }

      const reply = res?.data?.reply || "Connection outreach processed.";
      const toolCalls = res?.data?.toolCallsExecuted || [];

      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: reply,
          toolCalls,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_err_${Date.now()}`,
          role: "assistant",
          content: `Agent notice: ${err?.response?.data?.message || err.message || "Failed to execute connection request"}.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleSave = async () => {
    if (isOutreachRunning) {
      alert(
        "Daily outreach quota is locked while an autonomous outreach campaign is actively running. Please stop or wait for the campaign to finish before modifying limits.",
      );
      return;
    }

    setIsSaving(true);
    const payload = {
      personality: personality.trim(),
      companyKnowledge: companyKnowledge.trim(),
      faq: faq.trim(),
      dailyQuota: Math.min(Math.max(Number(dailyQuota) || 10, 1), 20),
      campaignType,
    };

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      }
      await agentApi.saveSettings(payload);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Could not save settings to server.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectClick = () => {
    setModalOpen(true);
  };

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

  const handleToggleKillswitch = async () => {
    setKillswitchLoading(true);
    try {
      if (!isPaused) {
        const res = await dashboardApi.emergencyPause(
          "Manual emergency safety freeze from Agent View",
        );
        setIsPaused(true);
        setKillswitchMsg(
          res.message || "Emergency pause active: automation frozen.",
        );
      } else {
        const res = await dashboardApi.resume();
        setIsPaused(false);
        setKillswitchMsg(res.message || "Automation resumed.");
      }
    } catch (err: any) {
      setKillswitchMsg(
        err.response?.data?.error || err.message || "Action updated.",
      );
    } finally {
      setKillswitchLoading(false);
      setTimeout(() => setKillswitchMsg(""), 3500);
    }
  };

  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = (presetText || chatInput).trim();
    if (!textToSend || isChatting) return;

    const userMsg = {
      id: `u_${Date.now()}`,
      role: "user" as const,
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!presetText) setChatInput("");
    setIsChatting(true);

    try {
      const history = [...chatMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const threadId = user.id ? `thread_${user.id}` : "default";
      const res = await agentApi.chat({
        messages: history,
        threadId,
        agentSettings: {
          personality: personality.trim(),
          companyKnowledge: companyKnowledge.trim(),
          faq: faq.trim(),
          dailyQuota,
          campaignType,
        },
      });

      // Check if LangGraph returned an interrupt (HITL)
      if (res?.data?.interrupted && res?.data?.interrupt) {
        const interruptData = res.data.interrupt;
        setPendingInterrupt({
          action: interruptData.action || "send_connection_request",
          target: interruptData.target || interruptData.name || "Recipient",
          name: interruptData.name || interruptData.target || "Recipient",
          note:
            interruptData.note ||
            "Hi, I came across your profile and would love to connect!",
          threadId: res.data.threadId || threadId,
          secondsLeft: 10,
          total: interruptData.total,
          withNoteCount: interruptData.withNoteCount,
          withoutNoteCount: interruptData.withoutNoteCount,
          candidates: interruptData.candidates,
        });
        return;
      }

      const reply = res?.data?.reply || "Action processed successfully.";
      const toolCalls = res?.data?.toolCallsExecuted || [];

      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: reply,
          toolCalls,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_err_${Date.now()}`,
          role: "assistant",
          content: `Agent notice: ${err?.response?.data?.message || err.message || "Failed to execute request"}.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Architecture Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-400 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white/90 tracking-tight">
              WORKPILOT Autonomous AI Agent
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-sky-50 text-sky-800 border border-sky-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20 flex items-center gap-1 font-semibold">
              <Cpu className="w-3 h-3 text-sky-600 dark:text-cyan-400" />
              WORKPILOT Intelligence Core
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 font-semibold">
              Autonomous Outreach Engine
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/45 mt-1 font-medium">
            Autonomous multi-turn agent with {REGISTERED_TOOLS.length} discrete
            LinkedIn tools, human-paced scheduling, and persistent state memory.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-white/3 border border-slate-400 dark:border-white/6 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("console")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "console"
                ? "bg-white text-slate-900 shadow-sm border border-slate-400/80 dark:border-transparent dark:text-black"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/4"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Interactive Console</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "settings"
                ? "bg-white text-slate-900 shadow-sm border border-slate-400/80 dark:border-transparent dark:text-black"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/4"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings & Rules</span>
          </button>
        </div>
      </div>

      {/* TAB 1: INTERACTIVE AGENT CONSOLE & TOOL INSPECTOR */}
      {activeTab === "console" && (
        <div className="space-y-5">
          {/* Agent Architecture Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white dark:bg-white/2 border border-slate-400 dark:border-white/6 shadow-xs dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-white/40 text-[11px] font-medium">
                  Agent Core
                </span>
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              </div>
              <p className="text-xs font-mono font-bold text-slate-900 dark:text-white/90 mt-1">
                WORKPILOT Intelligence Core
              </p>
              <span className="text-[10px] text-slate-500 dark:text-white/40">
                Adaptive reasoning engine
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-white/2 border border-slate-400 dark:border-white/6 shadow-xs dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-white/40 text-[11px] font-medium">
                  State Memory
                </span>
                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs font-mono font-bold text-slate-900 dark:text-white/90 mt-1">
                WORKPILOT State Checkpointer
              </p>
              <span className="text-[10px] text-slate-500 dark:text-white/40">
                Multi-turn thread persistence
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-white/2 border border-slate-400 dark:border-white/6 shadow-xs dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-white/40 text-[11px] font-medium">
                  Registered Tools
                </span>
                <Wrench className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {REGISTERED_TOOLS.length} Active Tools
                </p>
                <button
                  onClick={() => setShowToolsDrawer(!showToolsDrawer)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 dark:text-white/50 dark:hover:text-white underline cursor-pointer font-medium"
                >
                  {showToolsDrawer ? "Hide" : "Inspect"}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-white/40 font-mono">
                server/src/tools/tools.ts
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-white/2 border border-slate-400 dark:border-white/6 shadow-xs dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-white/40 text-[11px] font-medium">
                  Human Pacing Delay
                </span>
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 mt-1">
                8m – 18m Jitter
              </p>
              <span className="text-[10px] text-slate-500 dark:text-white/40">
                8:30 AM – 7:30 PM working window
              </span>
            </div>
          </div>

          {/* Live Autonomous Subagents & Subgraphs Panel */}
          {activeTasks.length > 0 ? (
            <div className="rounded-2xl bg-white dark:bg-white/2 border border-slate-400 dark:border-white/8 p-4 sm:p-5 space-y-3.5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-300 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {activeTasks.some((t) => t.status === "running") && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        activeTasks.some((t) => t.status === "running")
                          ? "bg-emerald-500"
                          : "bg-slate-400"
                      }`}
                    ></span>
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                    <span>Autonomous Subagents &amp; Background Tasks</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-semibold flex items-center gap-1">
                      <Radio className="w-3 h-3 text-blue-500 animate-pulse" />
                      Real-Time SSE Stream Active
                    </span>
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500 dark:text-white/40 font-mono">
                    {activeTasks.filter((t) => t.status === "running").length}{" "}
                    active subagent
                    {activeTasks.filter((t) => t.status === "running")
                      .length === 1
                      ? ""
                      : "s"}
                  </span>
                  {activeTasks.some((t) => t.status === "running") && (
                    <button
                      type="button"
                      onClick={handleStopAgent}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Stop All
                    </button>
                  )}
                </div>
              </div>

              {/* Subagent Tasks Cards */}
              <div className="space-y-2.5">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-400/80 dark:border-white/5 space-y-2.5 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg shrink-0">
                          {task.type === "outreach"
                            ? "🚀"
                            : task.type === "auto_reply"
                              ? "📬"
                              : "⚙️"}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {task.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                task.status === "running"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 animate-pulse"
                                  : task.status === "completed"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
                                    : "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/60"
                              }`}
                            >
                              {task.status}
                            </span>
                            {task.details.dailyQuota && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                🔒 Daily Cap: {task.details.dailyQuota}/day
                              </span>
                            )}
                          </div>
                          {task.details.currentCandidate && (
                            <p className="text-[11px] text-slate-600 dark:text-white/60 mt-0.5 truncate">
                              Targeting:{" "}
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {task.details.currentCandidate}
                              </span>
                            </p>
                          )}
                          {task.details.repliedCount !== undefined &&
                            task.details.repliedCount > 0 && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                                Auto-replied to {task.details.repliedCount}{" "}
                                contact
                                {task.details.repliedCount === 1 ? "" : "s"}
                              </p>
                            )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {task.status === "running" && (
                          <button
                            type="button"
                            onClick={() => handleStopTask(task.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-[11px] transition-colors cursor-pointer shadow-xs"
                          >
                            Stop Subagent
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTaskId(
                              expandedTaskId === task.id ? null : task.id,
                            )
                          }
                          className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          {expandedTaskId === task.id
                            ? "Hide Logs"
                            : `Logs (${task.logs?.length || 0})`}
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/45 font-mono">
                        <span>
                          {task.progress.current} of {task.progress.total}{" "}
                          {task.type === "outreach"
                            ? "requests processed"
                            : "threads checked"}
                        </span>
                        <span>{task.progress.percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 dark:bg-cyan-400 transition-all duration-300 rounded-full"
                          style={{ width: `${task.progress.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Live Pacing Timer */}
                    {task.details.nextScheduledAt && (
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 shrink-0 animate-spin" />
                        <span>
                          Safety pacing active: next invite scheduled at{" "}
                          <strong className="font-mono">
                            {task.details.nextScheduledAt}
                          </strong>{" "}
                          to preserve account health.
                        </span>
                      </div>
                    )}

                    {/* Expandable Live SSE Activity Logs */}
                    {expandedTaskId === task.id &&
                      task.logs &&
                      task.logs.length > 0 && (
                        <div className="mt-2 p-3 rounded-lg bg-black/90 text-white font-mono text-[11px] max-h-48 overflow-y-auto space-y-1.5 border border-white/10">
                          {task.logs.map((log) => (
                            <div
                              key={log.id}
                              className="flex items-start gap-2 leading-relaxed"
                            >
                              <span className="text-white/40 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  },
                                )}
                              </span>
                              <span
                                className={
                                  log.type === "success"
                                    ? "text-emerald-400"
                                    : log.type === "warning"
                                      ? "text-amber-400"
                                      : log.type === "error"
                                        ? "text-rose-400"
                                        : log.type === "pacing"
                                          ? "text-sky-300"
                                          : "text-slate-300"
                                }
                              >
                                {log.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-400 dark:border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-white/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>
                  Multi-Agent Subgraphs Standby: Ready for concurrent outreach,
                  search &amp; auto-reply tasks.
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 dark:text-white/30">
                SSE Ready
              </span>
            </div>
          )}

          {/* Tools Inspector Drawer */}
          {showToolsDrawer && (
            <div className="p-4 rounded-xl bg-white dark:bg-white/3 border border-slate-400 dark:border-white/8 space-y-3 animate-in fade-in duration-200 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between pb-2 border-b border-slate-400 dark:border-white/6">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white/90">
                    Separated Tools Suite ({REGISTERED_TOOLS.length} Modular
                    Tools)
                  </h3>
                </div>
                <button
                  onClick={() => setShowToolsDrawer(false)}
                  className="text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {REGISTERED_TOOLS.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-white/2 border border-slate-400 dark:border-white/5 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-blue-700 dark:text-cyan-300">
                        {tool.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 dark:bg-white/5 dark:text-white/50 font-semibold">
                        {tool.category}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-white/60 text-[11px] leading-relaxed">
                      {tool.description}
                    </p>
                    <div className="font-mono text-[10px] text-slate-500 dark:text-white/35 truncate">
                      Schema: {tool.schema}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Main Interactive Chat Terminal */}
          <div className="rounded-xl sm:rounded-2xl bg-white dark:bg-white/2 border border-slate-400 dark:border-white/8 flex flex-col h-130 sm:h-155 overflow-hidden shadow-sm dark:shadow-xl">
            {/* Terminal Top Bar */}
            <div className="px-3 sm:px-4 py-2.5 border-b border-slate-400 dark:border-white/6 flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-black/25 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-slate-900 dark:text-white/90">
                    WORKPILOT Agent Console
                  </span>
                </div>
                <span className="text-slate-300 dark:text-white/30 hidden sm:inline">
                  |
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-white/45 hidden sm:inline">
                  Thread: {`thread_${user.id || "default"}`}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {isLoadingHistory && (
                  <div className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-cyan-400 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="hidden sm:inline">Syncing memory...</span>
                  </div>
                )}
                <button
                  onClick={() => setShowNewChatModal(true)}
                  title="Start a new chat and permanently clear previous messages from database"
                  className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-200 dark:border-red-500/25 flex items-center gap-1.5 text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Start New Chat</span>
                </button>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg) =>
                msg.isSummary ? (
                  <div
                    key={msg.id}
                    className="w-full my-2.5 p-3.5 rounded-xl bg-blue-50/80 dark:bg-cyan-950/20 border border-blue-200 dark:border-cyan-500/25 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-cyan-300">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          LangGraph Conversation Executive Summary (30+ Messages
                          Compressed)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-white/40">
                        {msg.timestamp}
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 dark:text-white/80 leading-relaxed pl-3 border-l-2 border-blue-500 dark:border-cyan-500/30">
                      <MarkdownContent content={msg.content} />
                    </div>
                  </div>
                ) : (
                  (() => {
                    const specialCard =
                      msg.role === "assistant"
                        ? parseMessageSpecialCard(msg)
                        : { type: "none" as const };

                    if (specialCard.type === "connection_request") {
                      return (
                        <div
                          key={msg.id}
                          className="flex flex-col items-start animate-in fade-in duration-200"
                        >
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-[10px] font-medium text-slate-600 dark:text-white/40">
                              WORKPILOT Agent
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-white/25">
                              {msg.timestamp}
                            </span>
                          </div>
                          <ConnectionRequestCard data={specialCard.data} />
                        </div>
                      );
                    }

                    if (specialCard.type === "queue") {
                      return (
                        <div
                          key={msg.id}
                          className="flex flex-col items-start animate-in fade-in duration-200"
                        >
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-[10px] font-medium text-slate-600 dark:text-white/40">
                              WORKPILOT Agent
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-white/25">
                              {msg.timestamp}
                            </span>
                          </div>
                          <OutreachQueueCard data={specialCard.data} />
                        </div>
                      );
                    }

                    if (specialCard.type === "pacing") {
                      return (
                        <div
                          key={msg.id}
                          className="flex flex-col items-start animate-in fade-in duration-200"
                        >
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-[10px] font-medium text-slate-600 dark:text-white/40">
                              WORKPILOT Agent
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-white/25">
                              {msg.timestamp}
                            </span>
                          </div>
                          <PacingDelayCard data={specialCard.data} />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-[10px] font-medium text-slate-600 dark:text-white/40">
                            {msg.role === "user" ? "You" : "WORKPILOT Agent"}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-white/25">
                            {msg.timestamp}
                          </span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                            msg.role === "user"
                              ? "user-bubble text-white-force bg-blue-600 text-white font-medium shadow-sm"
                              : "bg-slate-50 dark:bg-white/4 border border-slate-400 dark:border-white/8 text-slate-900 dark:text-white/85 shadow-xs dark:shadow-none"
                          }`}
                        >
                          {/* Tool Calls Execution — clean human-readable chips */}
                          {msg.toolCalls && msg.toolCalls.length > 0 && (
                            <div className="mb-2.5 pb-2.5 border-b border-slate-400 dark:border-white/8 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                <Check className="w-3 h-3" />
                                <span>
                                  {msg.toolCalls.length === 1
                                    ? "1 action completed"
                                    : `${msg.toolCalls.length} actions completed`}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.toolCalls.map((tc, idx) => {
                                  const meta = REGISTERED_TOOLS.find(
                                    (t) => t.name === tc.tool,
                                  );
                                  const categoryColors: Record<string, string> =
                                    {
                                      Discovery:
                                        "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25",
                                      Outreach:
                                        "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/25",
                                      Campaign:
                                        "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25",
                                      Safety:
                                        "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
                                      Network:
                                        "bg-cyan-100 text-cyan-900 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/25",
                                      Inbox:
                                        "bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/25",
                                      Profile:
                                        "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
                                      Content:
                                        "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25",
                                    };
                                  const colorClass =
                                    categoryColors[meta?.category || ""] ||
                                    "bg-slate-100 text-slate-800 border-slate-400 dark:bg-white/8 dark:text-white/60 dark:border-white/10";
                                  const categoryIcons: Record<string, string> =
                                    {
                                      Discovery: "🔍",
                                      Outreach: "📤",
                                      Campaign: "🚀",
                                      Safety: "🛡️",
                                      Network: "🤝",
                                      Inbox: "💬",
                                      Profile: "👤",
                                      Content: "📝",
                                    };
                                  const icon =
                                    categoryIcons[meta?.category || ""] || "⚡";
                                  return (
                                    <span
                                      key={idx}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${colorClass}`}
                                    >
                                      <span>{icon}</span>
                                      <span>{meta?.label || tc.tool}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {msg.role === "assistant" ? (
                            <MarkdownContent content={msg.content} />
                          ) : (
                            <div className="whitespace-pre-wrap font-sans">
                              {msg.content}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ),
              )}

              {isChatting && (
                <div className="flex flex-col items-start animate-in fade-in duration-150 w-full">
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-medium text-slate-600 dark:text-white/40">
                      WORKPILOT Agent
                    </span>
                  </div>
                  <div className="rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-white/4 border border-slate-400 dark:border-white/8 text-xs text-slate-800 dark:text-white/60 flex items-center justify-between gap-3 w-full sm:w-auto shadow-xs">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-cyan-400" />
                      <span className="font-medium">
                        WORKPILOT Agent reasoning & executing tools...
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopAgent}
                      disabled={isStopping}
                      className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 dark:border-rose-500/30 dark:text-rose-300 text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Interrupt and stop execution"
                    >
                      <Square className="w-2.5 h-2.5 fill-current" />
                      <span>{isStopping ? "Stopping..." : "Stop Agent"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Live Autonomous Outreach & Pacing Status Card */}
              {activeTasks.some(
                (t) => t.type === "outreach" && t.status === "running",
              ) && (
                <div className="rounded-xl border border-sky-300 dark:border-sky-500/30 bg-sky-50/80 dark:bg-[#071324] p-3.5 space-y-2.5 shadow-md animate-in fade-in duration-200">
                  {activeTasks
                    .filter(
                      (t) => t.type === "outreach" && t.status === "running",
                    )
                    .map((task) => (
                      <div key={task.id} className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              Autonomous Outreach Active
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStopTask(task.id)}
                            className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 dark:border-rose-500/30 dark:text-rose-300 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Square className="w-2.5 h-2.5 fill-current" />
                            <span>Stop Campaign</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-white/70">
                          <span>
                            Target:{" "}
                            <strong className="text-slate-900 dark:text-white">
                              {task.details?.targetRole || task.name}
                            </strong>
                          </span>
                          <span className="font-mono">
                            {task.progress.current} of {task.progress.total}{" "}
                            processed ({task.progress.percentage}%)
                          </span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 dark:bg-sky-400 transition-all duration-300 rounded-full"
                            style={{ width: `${task.progress.percentage}%` }}
                          />
                        </div>

                        {task.details?.nextScheduledAt && (
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 shrink-0 animate-spin text-amber-600 dark:text-amber-400" />
                            <span>
                              Safety pacing cooldown: next invitation scheduled
                              at{" "}
                              <strong className="font-mono">
                                {task.details.nextScheduledAt}
                              </strong>{" "}
                              to preserve account health.
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Human-in-the-Loop (HITL) Interrupt Card with 10s Auto-Countdown */}
              {pendingInterrupt && (
                <div className="rounded-xl border border-blue-300 dark:border-blue-500/30 bg-white dark:bg-[#0c1222] shadow-lg dark:shadow-[0_0_25px_-5px_rgba(59,130,246,0.35)] p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-400 dark:border-white/8">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Human-in-the-Loop: Action Decision
                      </span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 font-bold">
                      ⏱ Auto in {pendingInterrupt.secondsLeft}s
                    </span>
                  </div>

                  {pendingInterrupt.action === "batch_connection_requests" || pendingInterrupt.action === "batch_send_messages" ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-700 dark:text-white/70">
                        <span>
                          Batch Target:{" "}
                          <strong className="text-slate-950 dark:text-white font-bold">
                            {pendingInterrupt.candidates?.length || 0} prospects
                          </strong>
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-white/40 font-mono">
                          {pendingInterrupt.action === "batch_send_messages" ? "Mode: Existing Connections (Direct Message)" : "Mode: Mixed (with & without notes)"}
                        </span>
                      </div>

                      {pendingInterrupt.candidates &&
                        pendingInterrupt.candidates.length > 0 && (
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                            {pendingInterrupt.candidates.map(
                              (c: any, i: number) => (
                                <div
                                  key={i}
                                  className="p-2 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-400 dark:border-white/6 flex items-center justify-between gap-2 text-[11px]"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-slate-400 dark:text-white/30 font-mono text-[10px]">
                                      #{i + 1}
                                    </span>
                                    <span className="font-semibold text-slate-900 dark:text-white/90 truncate">
                                      {c.name}
                                    </span>
                                    {c.headline && (
                                      <span className="text-[10px] text-slate-500 dark:text-white/40 truncate hidden sm:inline">
                                        • {c.headline}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                      c.withNote
                                        ? "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-500/20 dark:text-cyan-300 dark:border-blue-500/30"
                                        : "bg-slate-100 text-slate-700 border border-slate-400 dark:bg-white/6 dark:text-white/50 dark:border-white/10"
                                    }`}
                                  >
                                    {c.withNote ? "✍️ With Note" : "✉️ Blank"}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        )}

                      <p className="text-[10px] text-slate-500 dark:text-white/40">
                        💡 Tip: {pendingInterrupt.action === "batch_send_messages" ? "Direct messages require text. Sending blank will use a default greeting." : "Blank invitations consume zero monthly custom note quota."} Auto-proceeds with planned note allocation
                        in {pendingInterrupt.secondsLeft}s.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-700 dark:text-white/70">
                        <span>
                          Target Recipient:{" "}
                          <strong className="text-slate-950 dark:text-white font-bold">
                            {pendingInterrupt.name}
                          </strong>
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-white/40 font-mono">
                          Rule: default personalized note under 10s
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-400 dark:border-white/6 text-slate-800 dark:text-white/80 text-[11px] leading-relaxed">
                        <span className="text-slate-500 dark:text-white/40 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1 font-semibold">
                          <Sparkles className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                          Personalized Note Preview:
                        </span>
                        &ldquo;{pendingInterrupt.note}&rdquo;
                      </div>

                      <p className="text-[10px] text-slate-500 dark:text-white/40">
                        💡 Tip: {pendingInterrupt.action === "send_linkedin_message" ? "Sending without note will use a default greeting." : "Sending without note bypasses LinkedIn's monthly custom note limit (HTTP 422 limit)."} If not decided within 10s, WORKPILOT agent will
                        automatically dispatch with the personalized note.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-400 dark:border-white/6">
                    <button
                      type="button"
                      onClick={() => handleResumeInterrupt({ cancel: true })}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/4 transition-colors cursor-pointer self-start sm:self-auto font-medium"
                    >
                      Cancel{" "}
                      {pendingInterrupt.action === "batch_connection_requests" ||
                      pendingInterrupt.action === "batch_send_messages"
                        ? "Batch"
                        : ""}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleResumeInterrupt(
                            pendingInterrupt.action ===
                              "batch_connection_requests" ||
                            pendingInterrupt.action ===
                              "batch_send_messages"
                              ? { allWithNote: false }
                              : { withNote: false },
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20 bg-white hover:bg-slate-50 dark:bg-white/3 dark:hover:bg-white/6 text-slate-800 dark:text-white/80 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                        title="Sends blank connection invitations without notes"
                      >
                        Send All Blank (No Notes)
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleResumeInterrupt({ withNote: true })
                        }
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-white-force text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/20"
                      >
                        <UserPlus className="w-3 h-3 text-cyan-200" />
                        <span>
                          {pendingInterrupt.action ===
                            "batch_connection_requests" ||
                          pendingInterrupt.action === "batch_send_messages"
                            ? `Proceed Batch (${pendingInterrupt.secondsLeft}s)`
                            : `Send With Note (${pendingInterrupt.secondsLeft}s)`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar with Dedicated Stop Button */}
            <div className="px-3 py-2 border-t border-slate-500 dark:border-white/6 bg-slate-50 dark:bg-black/40 flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-white/50">Campaign Target:</span>
                <select 
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value as "DISCOVERY" | "ENGAGEMENT")}
                  className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-xs text-slate-700 dark:text-white/80 outline-none focus:border-blue-500"
                >
                  <option value="DISCOVERY">New Connections (Discovery)</option>
                  <option value="ENGAGEMENT">Existing Connections (Engagement)</option>
                </select>
              </div>
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-white/6 bg-slate-100 dark:bg-black/20 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                disabled={isChatting}
                placeholder="Instruct the agent (e.g. 'Search 5 AI Engineers in India, send 2 with note, 3 blank')..."
                className="flex-1 bg-white dark:bg-white/3 border border-slate-300 dark:border-white/8 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-blue-500 transition-colors shadow-xs"
              />

              {isChatting ? (
                <button
                  type="button"
                  onClick={handleStopAgent}
                  disabled={isStopping}
                  className="h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-rose-600 hover:bg-rose-500 text-white text-white-force shadow-sm shadow-rose-600/30 shrink-0"
                  title="Stop agent reasoning and cancel all background operations"
                >
                  {isStopping ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Square className="w-3 h-3 fill-current" />
                  )}
                  <span>{isStopping ? "Stopping..." : "Stop Agent"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendChatMessage()}
                  disabled={!chatInput.trim()}
                  className={`h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    chatInput.trim()
                      ? "bg-blue-600 hover:bg-blue-500 text-white text-white-force shadow-sm shadow-blue-600/25"
                      : "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-white/30 cursor-not-allowed"
                  }`}
                >
                  <span>Run</span>
                  <Send className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* TAB 2: AGENT SETTINGS & PERSONALITY CUSTOMIZATION */}
      {activeTab === "settings" && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
          {/* Header & Save Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-400 dark:border-white/6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Agent Customization
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-white/45 mt-0.5">
                Train your AI assistant&apos;s personality by typing your
                instructions and adjust your daily request limit.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`h-9 px-5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
                isSaved
                  ? "bg-emerald-600 text-white text-white-force"
                  : "bg-blue-600 hover:bg-blue-500 text-white text-white-force shadow-blue-600/25"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isSaved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>

          {/* 1. LinkedIn Connection & Emergency Freeze Status Bar */}
          <div className="rounded-2xl bg-white dark:bg-white/2 border border-slate-400 dark:border-white/8 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#0A66C2]/10 border border-[#0A66C2]/20 flex items-center justify-center text-[#0A66C2] shrink-0">
                <LinkedInIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    LinkedIn Connection
                  </h3>
                  {linkedInConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Session
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-400 dark:bg-white/5 dark:text-white/40 dark:border-white/10">
                      Disconnected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5 truncate">
                  {linkedInConnected
                    ? `Connected as ${user.name}`
                    : "Connect your LinkedIn profile to execute intelligent discovery and contextual outreach."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
              {linkedInConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3.5 py-2 rounded-xl border border-slate-400 dark:border-white/10 hover:border-red-500/30 text-slate-600 hover:text-red-600 dark:text-white/60 dark:hover:text-red-400 text-xs font-semibold transition-colors cursor-pointer bg-slate-50 dark:bg-transparent"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectClick}
                  className="px-4 py-2 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-white-force font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <LinkedInIcon className="w-3.5 h-3.5 text-white" />
                  <span>Connect Profile</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleKillswitch}
                disabled={killswitchLoading}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                  isPaused
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white text-white-force"
                    : "bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/25"
                }`}
                title={
                  isPaused
                    ? "Resume automated outreach"
                    : "Freeze all automation immediately"
                }
              >
                {killswitchLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                <span>
                  {isPaused ? "Resume Automation" : "Freeze Automation"}
                </span>
              </button>
            </div>
          </div>

          {/* 2. TRAIN AI PERSONALITY CARD REMOVED (Moved to Training Section) */}

          {/* 3. DAILY OUTREACH LIMIT (1 to 20 requests/day) */}
          <div className="rounded-2xl bg-white dark:bg-white/2 border border-slate-400 dark:border-white/8 p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 dark:bg-cyan-500/10 dark:text-cyan-400 border border-sky-200/60 dark:border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Daily Outreach Limit
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
                    Select how many connection requests your agent can dispatch
                    per day (1 to 20).
                  </p>
                </div>
              </div>

              {/* Metric Stat Pill */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {isOutreachRunning && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
                    🔒 Locked (Outreach Active)
                  </span>
                )}
                <div className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 font-mono font-bold text-sm sm:text-base">
                  {dailyQuota} requests / day
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={dailyQuota}
                disabled={isOutreachRunning}
                onChange={(e) => setDailyQuota(Number(e.target.value))}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 ${
                  isOutreachRunning
                    ? "bg-slate-400 dark:bg-white/20 opacity-60 cursor-not-allowed"
                    : "bg-slate-400 dark:bg-white/10"
                }`}
              />

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/40 font-mono">
                <span>1 / day (Gentle)</span>
                <span>10 / day (Recommended)</span>
                <span>20 / day (Maximum Safe Cap)</span>
              </div>

              {isOutreachRunning ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Daily limit locked:</strong> An autonomous outreach
                    campaign is currently dispatching requests. You cannot
                    modify the daily limit mid-campaign.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-400 dark:border-white/5 text-[11px] text-slate-500 dark:text-white/40 leading-relaxed">
                  Reduces activity spikes by enforcing a hard workspace ceiling of 20
                  requests per day to protect your LinkedIn standing.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Start New Chat Warning Popup Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-[#090d16] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Start New Chat & Reset Agent Memory?
                </h3>
                <span className="inline-block text-[11px] font-mono font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                  ⚠️ Irreversible Action
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Starting a new chat will{" "}
              <strong className="text-slate-900 dark:text-white font-bold">
                permanently delete all previous conversation history, tool
                executions, and LangGraph multi-turn memory
              </strong>{" "}
              from the database table (
              <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-blue-700 dark:text-cyan-300 border border-slate-400 dark:border-white/10 font-mono text-[11px]">
                agent_messages
              </code>
              ).
            </p>

            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-500/25 text-[11px] text-red-700 dark:text-red-300/90 leading-relaxed font-medium">
              The agent will clear its working context and will not remember
              past instructions or previous campaign criteria.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-400 dark:border-white/8">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                disabled={isClearingDb}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmNewChat}
                disabled={isClearingDb}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-white-force text-xs font-semibold shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isClearingDb ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting from DB...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete & Start New Chat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-method LinkedIn Connect Modal */}
      <LinkedInConnectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => onUpdateConnection(true)}
      />
    </div>
  );
};

export default AgentView;
