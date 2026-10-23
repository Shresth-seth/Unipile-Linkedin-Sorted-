import { tool } from "langchain";
import { AsyncLocalStorage } from "node:async_hooks";
import { interrupt } from "@langchain/langgraph";
import * as z from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { linkedinAccounts } from "../db/schema.js";
import { linkedInPeopleService } from "../services/linkedin/people.service.js";

import { linkedInConnectionService } from "../services/linkedin/connection.service.js";
import { linkedInMessageService } from "../services/linkedin/message.service.js";
import { linkedInPostService } from "../services/linkedin/post.service.js";
import { linkedInProfileService } from "../services/linkedin/profile.service.js";
import { prospectService } from "../services/prospects/prospect.service.js";
import { accountSafetyService } from "../services/safety/safety.service.js";
import { actionQueueService } from "../services/queue/queue.service.js";
import { unipileClient } from "../services/unipile/unipile.client.js";
import {
  createResearchSubgraph,
  createBatchOutreachSubgraph,
} from "../agent/WORKPILOT-subgraphs.js";

const toolTenantContext = new AsyncLocalStorage<string>();

export function runWithToolTenant<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  if (!userId.trim()) throw new Error("Authenticated user context is required for agent tools.");
  return toolTenantContext.run(userId.trim(), operation);
}

async function resolveDefaultUserId(preferredId?: string): Promise<string> {
  const userId = toolTenantContext.getStore() || preferredId?.trim();
  if (!userId) throw new Error("Authenticated user context is required for this action.");
  return userId;
}

async function resolveActiveLinkedInAccount(
  preferredAccountId?: string,
  userId?: string,
): Promise<string | undefined> {
  const resolvedUserId = await resolveDefaultUserId(userId);
  const conditions = [
    eq(linkedinAccounts.userId, resolvedUserId),
    eq(linkedinAccounts.isConnected, true),
  ];
  if (preferredAccountId?.trim()) {
    conditions.push(eq(linkedinAccounts.unipileAccountId, preferredAccountId.trim()));
  }
  const [acc] = await db
    .select()
    .from(linkedinAccounts)
    .where(and(...conditions))
    .limit(1);

  if (acc?.unipileAccountId && acc.healthStatus !== "DISCONNECTED") {
    return acc.unipileAccountId;
  }

  if (preferredAccountId?.trim()) {
    throw new Error("The requested LinkedIn account does not belong to this workspace.");
  }

  return undefined;
}

export const systemToolDeclarations = [
  {
    name: "search_linkedin_leads",
    description:
      "Search for real, verified professionals on LinkedIn by job role, title, name, industry, company, and location. Returns candidate profiles including name, headline, company, and LinkedIn provider ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        role: {
          type: "STRING",
          description:
            "Target role, job title, or query (e.g., 'AI Engineer', 'CTO', 'Founder')",
        },
        query: {
          type: "STRING",
          description: "Search keywords or person name to look up",
        },
        name: {
          type: "STRING",
          description: "Specific full name of the person to search on LinkedIn",
        },
        location: {
          type: "STRING",
          description:
            "Geographic location filter (e.g., 'India', 'San Francisco', 'Europe')",
        },
        company: { type: "STRING", description: "Target company name" },
        industry: {
          type: "STRING",
          description: "Target industry (e.g., 'SaaS', 'Fintech')",
        },
        limit: {
          type: "NUMBER",
          description: "Maximum number of profiles to fetch (1-25, default 10)",
        },
        campaignType: {
          type: "STRING",
          description: "'DISCOVERY' or 'ENGAGEMENT'",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
        networkDepth: {
          type: "STRING",
          description: "Filter by connection depth ('F' for 1st degree/existing connections, 'S' for 2nd degree, 'O' for 3rd+)",
        },
      },
      required: [],
    },
  },
  {
    name: "send_connection_request",
    description:
      "Send an outbound LinkedIn connection invitation to a targeted professional, with an optional personalized note (max 300 characters).",
    parameters: {
      type: "OBJECT",
      properties: {
        linkedinId: {
          type: "STRING",
          description:
            "Recipient's LinkedIn provider ID or identifier (e.g. ACo...)",
        },
        name: { type: "STRING", description: "Full name of the recipient" },
        note: {
          type: "STRING",
          description:
            "Personalized connection note (max 300 characters, professional tone)",
        },
        profileUrl: { type: "STRING", description: "LinkedIn profile URL" },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
      },
      required: ["linkedinId"],
    },
  },
  {
    name: "send_linkedin_message",
    description:
      "Send a direct message to an existing LinkedIn connection or active chat thread.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipientId: {
          type: "STRING",
          description:
            "LinkedIn provider ID or chat attendee ID of the recipient",
        },
        message: {
          type: "STRING",
          description: "Message text content to send",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
      },
      required: ["recipientId", "message"],
    },
  },
  {
    name: "schedule_autonomous_campaign",
    description:
      "Launch a fully autonomous outreach campaign. Searches LinkedIn for target leads, ingests them into the CRM, and schedules connection requests with human-paced delays (8–18 minutes between requests with micro-jitter), strictly enforcing daily quotas and active business hours.",
    parameters: {
      type: "OBJECT",
      properties: {
        role: {
          type: "STRING",
          description: "Target role or search query (e.g., 'Founders & CTOs')",
        },
        location: {
          type: "STRING",
          description: "Target geography (e.g., 'India', 'United States')",
        },
        industry: { type: "STRING", description: "Target industry" },
        company: { type: "STRING", description: "Target company" },
        limit: {
          type: "NUMBER",
          description: "Number of candidates to contact (recommended 5-15)",
        },
        personalizedNote: {
          type: "STRING",
          description: "Personalized message template to accompany requests",
        },
        campaignType: {
          type: "STRING",
          description: "'DISCOVERY' to find new people and connect, or 'ENGAGEMENT' to message existing connections.",
        },
        userId: { type: "STRING", description: "User ID scoping this action" },
      },
      required: ["role"],
    },
  },
  {
    name: "get_account_safety_and_limits",
    description:
      "Check the user's LinkedIn connection health, automation status (RUNNING/PAUSED), daily connection quota remaining (out of 25/day), daily message quota remaining (out of 50/day), and autonomous queue statistics.",
    parameters: {
      type: "OBJECT",
      properties: {
        userId: { type: "STRING", description: "User ID to inspect" },
      },
      required: [],
    },
  },
  {
    name: "get_pending_invitations",
    description:
      "Retrieve pending sent connection invitations (to see who has not yet accepted) or received incoming invitations (to accept or decline).",
    parameters: {
      type: "OBJECT",
      properties: {
        type: {
          type: "STRING",
          enum: ["sent", "received"],
          description:
            "Whether to retrieve 'sent' invitations or 'received' incoming requests",
        },
        limit: {
          type: "NUMBER",
          description: "Maximum number of items to retrieve (default 20)",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "manage_invitation",
    description:
      "Accept or decline an incoming connection invitation, or withdraw/cancel a pending outbound sent invitation.",
    parameters: {
      type: "OBJECT",
      properties: {
        action: {
          type: "STRING",
          enum: ["accept", "decline", "withdraw"],
          description: "Action to perform: 'accept', 'decline', or 'withdraw'",
        },
        invitationId: {
          type: "STRING",
          description: "The invitation ID or relation ID",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
      },
      required: ["action", "invitationId"],
    },
  },
  {
    name: "get_inbox_conversations",
    description:
      "Retrieve recent LinkedIn messaging conversation threads, including attendee names, profile pictures, headlines, unread message counts, and last message previews.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "NUMBER",
          description:
            "Number of conversation threads to fetch (1-25, default 10)",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
      },
      required: [],
    },
  },
  {
    name: "emergency_pause_automation",
    description:
      "Emergency safety freeze. Immediately pauses all outbound actions, connection requests, and scheduled follow-ups across the user's account.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: {
          type: "STRING",
          description: "Reason for pausing automation",
        },
        userId: { type: "STRING", description: "User ID to pause" },
      },
      required: [],
    },
  },
  {
    name: "resume_automation",
    description:
      "Resume outbound action execution after a manual or safety pause.",
    parameters: {
      type: "OBJECT",
      properties: {
        userId: { type: "STRING", description: "User ID to resume" },
      },
      required: [],
    },
  },
  {
    name: "get_own_profile_and_rating",
    description:
      "Fetch the user's own connected LinkedIn profile via Unipile and run an intelligent audit rating (0-100 score) with headline evaluation, About section critique, strengths, and actionable suggestions to maximize connection conversion rates.",
    parameters: {
      type: "OBJECT",
      properties: {
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
      },
      required: [],
    },
  },
  {
    name: "update_profile_headline",
    description:
      "Edit and update the user's own LinkedIn profile headline / heading via Unipile and sync with local database.",
    parameters: {
      type: "OBJECT",
      properties: {
        headline: {
          type: "STRING",
          description:
            "The new professional headline text to set on your LinkedIn profile",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
      },
      required: ["headline"],
    },
  },
  {
    name: "create_linkedin_post",
    description:
      "Publish a new post directly to the user's LinkedIn feed via Unipile, with optional media attachments.",
    parameters: {
      type: "OBJECT",
      properties: {
        text: {
          type: "STRING",
          description: "The text content of the LinkedIn post",
        },
        attachments: {
          type: "ARRAY",
          description: "Optional array of media attachments",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "get_own_posts",
    description:
      "Retrieve the user's recent published posts on LinkedIn, including engagement metrics (likes and comments count).",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "NUMBER",
          description: "Number of posts to retrieve (default 10)",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
      },
      required: [],
    },
  },
  {
    name: "batch_send_connection_requests",
    description:
      "Send batch connection requests to multiple candidates with customizable note allocation (e.g. first N candidates with personalized notes, remainder as blank invitations). Orchestrated via the Batch Outreach Subgraph with Human-in-the-Loop review.",
    parameters: {
      type: "OBJECT",
      properties: {
        candidates: {
          type: "ARRAY",
          description: "List of candidates to process",
          items: { type: "OBJECT", properties: {} },
        },
        campaignType: {
          type: "STRING",
          description: "'DISCOVERY' (connection invites) or 'ENGAGEMENT' (direct messages)",
        },
        withNoteCount: {
          type: "NUMBER",
          description:
            "Number of candidates in this batch who should receive a personalized note (e.g. 2)",
        },
        withoutNoteCount: {
          type: "NUMBER",
          description:
            "Number of candidates in this batch who should receive blank invitations without notes (e.g. 3)",
        },
        personalizedNote: {
          type: "STRING",
          description:
            "Optional note template to use (supports {firstName}, {name}, {headline})",
        },
        skipHIL: {
          type: "BOOLEAN",
          description:
            "If true, bypasses the 10-second human review countdown and dispatches immediately",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
        userId: {
          type: "STRING",
          description: "User ID scoping this action",
        },
      },
      required: ["candidates"],
    },
  },
  {
    name: "research_and_batch_connect",
    description:
      "End-to-end multi-step autonomous workflow: searches real verified professionals on LinkedIn via the Research Subgraph, then executes batch outreach via the Batch Outreach Subgraph with mixed note strategies (e.g., 2 with note, 3 without note) and full status reporting.",
    parameters: {
      type: "OBJECT",
      properties: {
        role: {
          type: "STRING",
          description:
            "Target role or search query (e.g., 'AI Engineer', 'CTO', 'Founder')",
        },
        location: {
          type: "STRING",
          description:
            "Geographic location filter (e.g., 'India', 'San Francisco', 'Europe')",
        },
        company: { type: "STRING", description: "Target company name" },
        industry: { type: "STRING", description: "Target industry" },
        campaignType: {
          type: "STRING",
          description: "'DISCOVERY' (connection invites) or 'ENGAGEMENT' (direct messages)",
        },
        totalCount: {
          type: "NUMBER",
          description:
            "Total number of candidates to find and connect with (default 5)",
        },
        withNoteCount: {
          type: "NUMBER",
          description:
            "Number of candidates to send with personalized note (e.g. 2)",
        },
        withoutNoteCount: {
          type: "NUMBER",
          description:
            "Number of candidates to send without note / blank (e.g. 3)",
        },
        personalizedNote: {
          type: "STRING",
          description: "Optional custom note template",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
        userId: {
          type: "STRING",
          description: "User ID scoping this action",
        },
      },
      required: ["role"],
    },
  },
  {
    name: "get_existing_connections",
    description:
      "Fetch the user's actual existing 1st-degree LinkedIn connections. Use this BEFORE messaging to get real connection IDs. Can optionally filter by role, keywords, company, or location. Returns name, headline, and member_urn for each connection.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "NUMBER",
          description: "Number of connections to retrieve (default 20, max 50)",
        },
        role: {
          type: "STRING",
          description: "Optional filter by role/headline keyword (e.g. 'CTO', 'Software Engineer')",
        },
        keywords: {
          type: "STRING",
          description: "Optional filter by keywords in name or headline",
        },
        company: {
          type: "STRING",
          description: "Optional filter by company in headline",
        },
        location: {
          type: "STRING",
          description: "Optional filter by location",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
        userId: {
          type: "STRING",
          description: "User ID scoping this action",
        },
      },
      required: [],
    },
  },
  {
    name: "message_existing_connections",
    description:
      "ENGAGEMENT CAMPAIGN: Fetches your actual existing 1st-degree LinkedIn connections (not new people), then sends them a direct message. This is the ONLY correct way to message existing connections. Use this when user asks to 'message my connections', 'engage existing connections', 'send DMs to connections', or runs an ENGAGEMENT campaign. Specify a message template and optionally filter by role/keywords.",
    parameters: {
      type: "OBJECT",
      properties: {
        message: {
          type: "STRING",
          description: "The message text to send to each connection",
        },
        count: {
          type: "NUMBER",
          description: "How many connections to message (default 5)",
        },
        role: {
          type: "STRING",
          description: "Optional: filter connections by role/headline (e.g. 'CTO', 'AI Engineer')",
        },
        keywords: {
          type: "STRING",
          description: "Optional: filter connections by keyword in name or headline",
        },
        company: {
          type: "STRING",
          description: "Optional: filter connections by company",
        },
        personalize: {
          type: "BOOLEAN",
          description: "If true, personalizes message with each connection's first name",
        },
        accountId: {
          type: "STRING",
          description: "Optional specific Unipile account ID",
        },
        userId: {
          type: "STRING",
          description: "User ID scoping this action",
        },
      },
      required: ["message"],
    },
  },
];

export type ToolName =
  | "search_linkedin_leads"
  | "send_connection_request"
  | "batch_send_connection_requests"
  | "research_and_batch_connect"
  | "send_linkedin_message"
  | "schedule_autonomous_campaign"
  | "get_account_safety_and_limits"
  | "get_pending_invitations"
  | "manage_invitation"
  | "get_inbox_conversations"
  | "emergency_pause_automation"
  | "resume_automation"
  | "get_own_profile_and_rating"
  | "update_profile_headline"
  | "create_linkedin_post"
  | "get_own_posts"
  | "get_existing_connections"
  | "message_existing_connections";

export const toolHandlers: Record<ToolName, (args: any) => Promise<any>> = {
  search_linkedin_leads: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: false,
        message:
          "⚠️ LinkedIn account is disconnected or cookies were purged. Please connect your LinkedIn account in Settings to search leads.",
        count: 0,
        candidates: [],
      };
    }
    const queryTerm =
      args.name || args.query || args.role || "Software Engineers";
    const candidates = await linkedInPeopleService.searchPeople({
      role: queryTerm,
      keywords: queryTerm,
      location: args.location,
      company: args.company,
      industry: args.industry,
      limit: args.limit || 10,
      networkDepth: args.networkDepth,
      accountId,
    });
    return {
      success: true,
      count: candidates.length,
      candidates: candidates.map((p) => ({
        name: p.name,
        linkedinId: p.linkedin_id,
        headline: p.designation,
        company: p.company,
        location: p.location,
        profileUrl: p.profile_url,
      })),
    };
  },

  send_connection_request: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: false,
        message:
          "⚠️ LinkedIn account is disconnected or cookies were purged. Please connect your LinkedIn account first.",
      };
    }

    const target = args.linkedinId || args.name;
    if (!target) {
      return {
        success: false,
        message:
          "A recipient LinkedIn provider ID, profile URL, or person name is required.",
      };
    }

    const candidateName = args.name || target;
    const proposedNote =
      args.note ||
      `Hi ${candidateName.split(" ")[0] || "there"}, I came across your profile and would love to connect!`;

    let humanDecision: any = undefined;
    try {
      humanDecision = interrupt({
        action: "send_connection_request",
        target,
        name: candidateName,
        note: proposedNote,
        message: `Confirm connection request to ${candidateName}. Send with personalized note or without note? (Auto-proceeds with note in 10s)`,
        timeoutSeconds: 10,
        defaultChoice: "with_note",
      });
    } catch (e: any) {
      if (
        e?.name?.includes("GraphInterrupt") ||
        e?.constructor?.name?.includes("GraphInterrupt") ||
        (e?.message && e.message.includes("GraphInterrupt"))
      ) {
        throw e;
      }
    }

    if (humanDecision?.cancel) {
      return {
        success: false,
        message: `Connection request to ${candidateName} was cancelled by user.`,
      };
    }

    const shouldSendWithNote =
      humanDecision?.withNote !== false && args.withNote !== false;
    const finalNote = shouldSendWithNote
      ? humanDecision?.note || proposedNote
      : undefined;

    const result = await linkedInConnectionService.sendConnectionRequest(
      target,
      finalNote,
      accountId,
    );
    return {
      success: result.success,
      message:
        result.message ||
        `Connection request dispatched to ${candidateName}${shouldSendWithNote ? " with personalized note" : " without note"}.`,
      result,
    };
  },

  batch_send_connection_requests: async (args) => {
    const activeUserId = await resolveDefaultUserId(args.userId);
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      activeUserId,
    );
    if (!accountId) {
      return {
        success: false,
        message:
          "⚠️ LinkedIn account is disconnected. Please connect your LinkedIn account first.",
      };
    }

    const rawCandidates = Array.isArray(args.candidates) ? args.candidates : [];
    if (rawCandidates.length === 0) {
      return {
        success: false,
        message: "No candidates provided for batch connection requests.",
      };
    }

    const threadId = args.threadId || `thread_${activeUserId}`;
    const batchSubgraph = createBatchOutreachSubgraph();

    const withNoteCount =
      args.withNoteCount !== undefined && args.withNoteCount !== null
        ? Number(args.withNoteCount)
        : rawCandidates.length;

    const withoutNoteCount =
      args.withoutNoteCount !== undefined && args.withoutNoteCount !== null
        ? Number(args.withoutNoteCount)
        : Math.max(0, rawCandidates.length - withNoteCount);

    const initial = {
      candidates: rawCandidates.map((c: any) => ({
        name: c.name || "LinkedIn Member",
        linkedinId: c.linkedinId || c.provider_id || c.linkedin_id,
        headline: c.headline || c.designation,
        company: c.company,
        location: c.location,
        profileUrl: c.profileUrl || c.profile_url,
      })),
      withNoteCount,
      withoutNoteCount,
      noteTemplate: args.personalizedNote || args.noteTemplate,
      accountId,
      userId: activeUserId,
      threadId,
      campaignType: args.campaignType,
      skipHIL: Boolean(args.skipHIL),
    };

    let result: any;
    try {
      result = await batchSubgraph.invoke(initial, {
        configurable: { thread_id: threadId },
      });
    } catch (e: any) {
      if (
        e?.name?.includes("GraphInterrupt") ||
        e?.constructor?.name?.includes("GraphInterrupt") ||
        (e?.message && e.message.includes("GraphInterrupt"))
      ) {
        throw e;
      }
      throw e;
    }

    return {
      success: true,
      message: result.summary,
      queue: result.queue,
      dispatchedCount: (result.queue || []).filter(
        (q: any) => q.status === "sent",
      ).length,
    };
  },

  research_and_batch_connect: async (args) => {
    const activeUserId = await resolveDefaultUserId(args.userId);
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      activeUserId,
    );
    if (!accountId) {
      return {
        success: false,
        message:
          "⚠️ LinkedIn account is disconnected. Please connect your LinkedIn account first.",
      };
    }

    const totalCount = Number(args.totalCount || args.limit || 5);
    const withNoteCount =
      args.withNoteCount !== undefined && args.withNoteCount !== null
        ? Number(args.withNoteCount)
        : Math.min(2, totalCount);
    const withoutNoteCount =
      args.withoutNoteCount !== undefined && args.withoutNoteCount !== null
        ? Number(args.withoutNoteCount)
        : Math.max(0, totalCount - withNoteCount);

    // Step 1: Execute discovery via Research Subgraph
    const researchSubgraph = createResearchSubgraph();
    const researchThreadId = `research_${activeUserId}_${Date.now()}`;
    const researchRes = await researchSubgraph.invoke(
      {
        query: args.role,
        role: args.role,
        location: args.location,
        company: args.company,
        industry: args.industry,
        limit: totalCount,
        userId: activeUserId,
        accountId,
      },
      { configurable: { thread_id: researchThreadId } },
    );

    const candidates = researchRes.candidates || [];
    if (candidates.length === 0) {
      return {
        success: false,
        message: `No verified LinkedIn leads found matching "${args.role}". Try refining the job title or location.`,
      };
    }

    // Step 2: Multi-step dispatch via Batch Outreach Subgraph
    const threadId = args.threadId || `thread_${activeUserId}`;
    const batchSubgraph = createBatchOutreachSubgraph();

    let batchRes: any;
    try {
      batchRes = await batchSubgraph.invoke(
        {
          candidates,
          withNoteCount,
          withoutNoteCount,
          noteTemplate: args.personalizedNote,
          accountId,
          userId: activeUserId,
          threadId,
          campaignType: args.campaignType,
        },
        { configurable: { thread_id: threadId } },
      );
    } catch (e: any) {
      if (
        e?.name?.includes("GraphInterrupt") ||
        e?.constructor?.name?.includes("GraphInterrupt") ||
        (e?.message && e.message.includes("GraphInterrupt"))
      ) {
        throw e;
      }
      throw e;
    }

    return {
      success: true,
      message: batchRes.summary,
      totalFound: candidates.length,
      dispatchedCount: (batchRes.queue || []).filter(
        (q: any) => q.status === "sent",
      ).length,
      queue: batchRes.queue,
    };
  },

  send_linkedin_message: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: false,
        message:
          "⚠️ LinkedIn account is disconnected or cookies were purged. Please connect your LinkedIn account first.",
      };
    }
    let humanDecision: any = undefined;
    try {
      humanDecision = interrupt({
        action: "send_linkedin_message",
        target: args.recipientId,
        name: args.recipientId,
        note: args.message,
        message: `Confirm direct message to ${args.recipientId}. (Auto-proceeds in 10s)`,
        timeoutSeconds: 10,
        defaultChoice: "proceed",
      });
    } catch (e: any) {
      if (
        e?.name?.includes("GraphInterrupt") ||
        e?.constructor?.name?.includes("GraphInterrupt") ||
        (e?.message && e.message.includes("GraphInterrupt"))
      ) {
        throw e;
      }
    }

    if (humanDecision?.cancel) {
      return {
        success: false,
        message: `Direct message to ${args.recipientId} was cancelled by user.`,
      };
    }

    const finalMessage = humanDecision?.note || args.message;

    const result = await linkedInMessageService.sendMessage(
      args.recipientId,
      finalMessage,
      accountId,
    );
    return {
      success: result.success,
      message: result.success ? "Direct message dispatched successfully." : result.message || "Failed to send message.",
      result,
    };
  },

  schedule_autonomous_campaign: async (args) => {
    const activeUserId = await resolveDefaultUserId(args.userId);
    const result = await prospectService.discoverAndIngest(
      activeUserId,
      {
        role: args.role,
        location: args.location,
        industry: args.industry,
        company: args.company,
        limit: args.limit || 10,
        networkDepth: args.campaignType === "ENGAGEMENT" ? "F" : undefined,
      },
      true,
      args.personalizedNote,
      args.campaignType,
    );
    return {
      success: true,
      message: `Autonomous campaign scheduled successfully: ${result.contacts.length} prospects ingested, ${result.enqueuedCount} connection requests paced with 8–18m human delays.`,
      ingestedCount: result.contacts.length,
      enqueuedCount: result.enqueuedCount,
    };
  },

  get_account_safety_and_limits: async (args) => {
    const activeUserId = await resolveDefaultUserId(args.userId);
    const health = await accountSafetyService.getAccountHealth(activeUserId);
    const queueStats = await actionQueueService.getQueueStats(activeUserId);
    return {
      success: true,
      accountHealth: health,
      queueStats,
    };
  },

  get_pending_invitations: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: true,
        type: args.type || "received",
        count: 0,
        invitations: [],
        message: "LinkedIn account is disconnected.",
      };
    }
    if (args.type === "sent") {
      const sent = await linkedInConnectionService.getSentRequests(accountId);
      return {
        success: true,
        type: "sent",
        count: sent.length,
        invitations: sent,
      };
    } else {
      const received =
        await linkedInConnectionService.getReceivedRequests(accountId);
      return {
        success: true,
        type: "received",
        count: received.length,
        invitations: received,
      };
    }
  },

  manage_invitation: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: false,
        message: "⚠️ LinkedIn account is disconnected.",
      };
    }
    let result;
    if (args.action === "accept") {
      result = await linkedInConnectionService.acceptConnectionRequest(
        args.invitationId,
      );
    } else if (args.action === "decline") {
      result = await linkedInConnectionService.declineConnectionRequest(
        args.invitationId,
      );
    } else if (args.action === "withdraw") {
      result = await linkedInConnectionService.cancelSentRequest(
        args.invitationId,
        accountId,
      );
    }
    return {
      success: true,
      action: args.action,
      invitationId: args.invitationId,
      message: `Successfully executed '${args.action}' on invitation ${args.invitationId}.`,
      result,
    };
  },

  get_inbox_conversations: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: true,
        count: 0,
        conversations: [],
        message: "LinkedIn account is disconnected.",
      };
    }
    const conversations = await linkedInMessageService.getConversations(
      accountId,
      args.limit || 10,
    );
    return {
      success: true,
      count: conversations.length,
      conversations: conversations.map((c) => ({
        id: c.id,
        attendeeName: c.name,
        headline: c.headline,
        avatar: c.avatar,
        unreadCount: c.unread_count,
        lastMessage: c.last_message,
        lastMessageAt: c.last_message_at,
      })),
    };
  },

  emergency_pause_automation: async (args) => {
    const activeUserId = await resolveDefaultUserId(args.userId);
    await accountSafetyService.pauseAutomation(
      activeUserId,
      args.reason || "Paused by AI Agent instruction",
    );
    return {
      success: true,
      message:
        "Outbound automation has been immediately paused across all queues.",
    };
  },

  resume_automation: async (args) => {
    const activeUserId = await resolveDefaultUserId(args.userId);
    await accountSafetyService.resumeAutomation(activeUserId);
    return {
      success: true,
      message: "Outbound automation resumed successfully. Queue is active.",
    };
  },

  get_own_profile_and_rating: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: false,
        message:
          "⚠️ LinkedIn account is disconnected. Please connect your LinkedIn account to view or audit your profile.",
      };
    }
    const audit = await linkedInProfileService.getOwnProfileAndAudit(accountId);
    return {
      success: true,
      audit,
    };
  },

  update_profile_headline: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: false,
        message:
          "⚠️ LinkedIn account is disconnected. Please connect your LinkedIn account to update your headline.",
      };
    }
    const result = await linkedInProfileService.updateHeadline(
      args.headline,
      accountId,
    );
    return result;
  },

  create_linkedin_post: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: false,
        message:
          "⚠️ LinkedIn account is disconnected. Please connect your LinkedIn account to publish posts.",
      };
    }
    const result = await linkedInPostService.createPost(args.text, {
      accountId,
      attachments: args.attachments,
    });
    return result;
  },

  get_own_posts: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(
      args.accountId,
      args.userId,
    );
    if (!accountId) {
      return {
        success: true,
        author: "LinkedIn Member",
        count: 0,
        posts: [],
      };
    }
    const profile = await linkedInProfileService.getOwnProfile(accountId);
    const authorId =
      profile.publicIdentifier || profile.raw?.provider_id || "me";
    const posts = await linkedInPostService.readPosts(authorId);
    return {
      success: true,
      count: posts.length,
      posts: posts.slice(0, args.limit || 10),
    };
  },

  get_existing_connections: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(args.accountId, args.userId);
    if (!accountId) {
      return {
        success: false,
        message: "⚠️ LinkedIn account is disconnected. Please connect your LinkedIn account first.",
        connections: [],
      };
    }
    try {
      const { items } = await unipileClient.getConnections(
        accountId,
        Math.min(args.limit || 20, 50),
        undefined,
        {
          keywords: args.keywords,
          role: args.role,
          company: args.company,
          location: args.location,
        },
      );
      return {
        success: true,
        count: items.length,
        connections: items.map((c: any) => ({
          name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
          firstName: c.first_name || "",
          memberId: c.member_id,
          headline: c.headline || "",
          profileUrl: c.public_profile_url || "",
        })),
      };
    } catch (err: any) {
      return { success: false, message: `Failed to fetch connections: ${err.message}`, connections: [] };
    }
  },

  message_existing_connections: async (args) => {
    const accountId = await resolveActiveLinkedInAccount(args.accountId, args.userId);
    if (!accountId) {
      return {
        success: false,
        message: "⚠️ LinkedIn account is disconnected. Please connect your LinkedIn account first.",
      };
    }
    try {
      const count = Math.min(args.count || 5, 20);
      const { items } = await unipileClient.getConnections(
        accountId,
        Math.max(count * 3, 30), // fetch more to allow for filtering
        undefined,
        { keywords: args.keywords, role: args.role, company: args.company },
      );

      if (items.length === 0) {
        return {
          success: false,
          message: "No existing connections found matching your filters. Try broadening the criteria.",
        };
      }

      const targets = items.slice(0, count);
      const results: { name: string; memberId: string; status: string; chatId?: string; error?: string }[] = [];

      for (const conn of targets) {
        const firstName = conn.first_name || "there";
        const fullName = `${conn.first_name || ""} ${conn.last_name || ""}`.trim();
        const memberId = conn.member_id;
        const msgText = args.personalize !== false
          ? args.message.replace(/\{name\}/gi, firstName).replace(/\{firstName\}/gi, firstName)
          : args.message;

        try {
          // Use linkedInMessageService to properly handle ID resolution
          const res = await linkedInMessageService.sendMessage(memberId, msgText, accountId);
          if (res.success) {
            results.push({ name: fullName, memberId, status: "sent", chatId: "resolved" });
          } else {
            results.push({ name: fullName, memberId, status: "failed", error: res.message || "Failed to send message" });
          }
        } catch (e: any) {
          results.push({ name: fullName, memberId, status: "failed", error: e.message });
        }

        // Small safety delay between messages
        await new Promise((r) => setTimeout(r, 1500));
      }

      const sentCount = results.filter((r) => r.status === "sent").length;
      return {
        success: sentCount > 0,
        sentCount,
        totalTargeted: targets.length,
        message: `✅ Successfully sent ${sentCount}/${targets.length} messages to your existing LinkedIn connections.`,
        results,
      };
    } catch (err: any) {
      return { success: false, message: `Failed to run engagement campaign: ${err.message}` };
    }
  },
};

export async function executeSystemTool(fc: {
  name: string;
  args?: any;
  id?: string;
}) {
  const functionName = fc.name;
  const args = fc.args || {};

  try {
    const handler = (toolHandlers as Record<string, any>)[functionName];
    if (!handler) {
      throw new Error(
        `Tool ${functionName} is not implemented inside the router.`,
      );
    }

    const result = await handler(args);

    return {
      id: fc.id || `call_${Date.now()}`,
      name: functionName,
      response: { result },
    };
  } catch (error: any) {
    return {
      id: fc.id || `call_${Date.now()}`,
      name: functionName,
      response: {
        error: error.message || "Unknown error occurred during tool execution.",
      },
    };
  }
}

export const searchLinkedInLeadsTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.search_linkedin_leads(input)),
  {
    name: "search_linkedin_leads",
    description:
      "Search for real, verified professionals on LinkedIn by job role, title, person name, company, and location.",
    schema: z.object({
      role: z
        .string()
        .optional()
        .describe(
          "Target role or job title (e.g., 'AI Engineer', 'CTO', 'Founder')",
        ),
      query: z
        .string()
        .optional()
        .describe("Search query keywords or person name"),
      name: z
        .string()
        .optional()
        .describe("Specific person name to find on LinkedIn"),
      location: z
        .string()
        .optional()
        .describe(
          "Geographic location filter (e.g., 'India', 'San Francisco', 'Europe')",
        ),
      company: z.string().optional().describe("Target company name"),
      industry: z
        .string()
        .optional()
        .describe("Target industry (e.g., 'SaaS', 'Fintech')"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of profiles to fetch (1-25)"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const sendConnectionRequestTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.send_connection_request(input)),
  {
    name: "send_connection_request",
    description:
      "Send an outbound LinkedIn connection invitation to a targeted professional by provider ID or person name, with an optional personalized note (max 300 characters).",
    schema: z.object({
      linkedinId: z
        .string()
        .optional()
        .describe(
          "The recipient's LinkedIn provider ID (e.g. ACo...), profile URL, or identifier",
        ),
      name: z
        .string()
        .optional()
        .describe(
          "Full name of the recipient (used to resolve profile if ID not available)",
        ),
      note: z
        .string()
        .optional()
        .describe("Personalized connection note (max 300 characters)"),
      withNote: z
        .boolean()
        .optional()
        .describe(
          "Whether to include a personalized note (true) or send blank invitation without note (false) to preserve monthly quota",
        ),
      profileUrl: z.string().optional().describe("LinkedIn profile URL"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const sendLinkedInMessageTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.send_linkedin_message(input)),
  {
    name: "send_linkedin_message",
    description:
      "Send a direct message to an existing LinkedIn connection or active chat thread.",
    schema: z.object({
      recipientId: z
        .string()
        .describe("LinkedIn provider ID or chat attendee ID of the recipient"),
      message: z.string().describe("Message text content to send"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const scheduleAutonomousCampaignTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.schedule_autonomous_campaign(input)),
  {
    name: "schedule_autonomous_campaign",
    description:
      "Launch a fully autonomous outreach campaign with 8–18 minute humanized delays and working hours enforcement.",
    schema: z.object({
      role: z
        .string()
        .describe("Target role or search query (e.g., 'Founders & CTOs')"),
      location: z
        .string()
        .optional()
        .describe("Target geography (e.g., 'India', 'United States')"),
      industry: z.string().optional().describe("Target industry"),
      company: z.string().optional().describe("Target company"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Number of candidates to contact (recommended 5-15)"),
      personalizedNote: z
        .string()
        .optional()
        .describe("Personalized message template to accompany requests"),
      userId: z.string().optional().describe("User ID scoping this action"),
    }),
  },
);

export const getAccountSafetyAndLimitsTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.get_account_safety_and_limits(input)),
  {
    name: "get_account_safety_and_limits",
    description:
      "Check the user's LinkedIn connection health, automation status (RUNNING/PAUSED), daily connection quota remaining (out of 25/day), and daily message quota remaining (out of 50/day).",
    schema: z.object({
      userId: z.string().optional().describe("User ID to inspect"),
    }),
  },
);

export const getPendingInvitationsTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.get_pending_invitations(input)),
  {
    name: "get_pending_invitations",
    description:
      "Retrieve pending sent connection invitations or received incoming connection requests.",
    schema: z.object({
      type: z
        .enum(["sent", "received"])
        .describe(
          "Whether to retrieve 'sent' invitations or 'received' incoming requests",
        ),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of items to retrieve"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const manageInvitationTool = tool(
  async (input) => JSON.stringify(await toolHandlers.manage_invitation(input)),
  {
    name: "manage_invitation",
    description:
      "Accept or decline an incoming connection invitation, or withdraw/cancel a pending outbound sent invitation.",
    schema: z.object({
      action: z
        .enum(["accept", "decline", "withdraw"])
        .describe("Action to perform: 'accept', 'decline', or 'withdraw'"),
      invitationId: z.string().describe("The invitation ID or relation ID"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const getInboxConversationsTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.get_inbox_conversations(input)),
  {
    name: "get_inbox_conversations",
    description:
      "Retrieve recent LinkedIn messaging conversation threads including attendee names, profile pictures, and previews.",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Number of conversation threads to fetch (1-25)"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const emergencyPauseAutomationTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.emergency_pause_automation(input)),
  {
    name: "emergency_pause_automation",
    description:
      "Emergency safety freeze. Immediately pauses all outbound actions, connection requests, and scheduled follow-ups.",
    schema: z.object({
      reason: z.string().optional().describe("Reason for pausing automation"),
      userId: z.string().optional().describe("User ID to pause"),
    }),
  },
);

export const resumeAutomationTool = tool(
  async (input) => JSON.stringify(await toolHandlers.resume_automation(input)),
  {
    name: "resume_automation",
    description:
      "Resume outbound action execution after a manual or safety pause.",
    schema: z.object({
      userId: z.string().optional().describe("User ID to resume"),
    }),
  },
);

export const getOwnProfileAndRatingTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.get_own_profile_and_rating(input)),
  {
    name: "get_own_profile_and_rating",
    description:
      "Fetch own LinkedIn profile, evaluate headline/about sections, and return an audit rating (0-100) with concrete recommendations.",
    schema: z.object({
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const updateProfileHeadlineTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.update_profile_headline(input)),
  {
    name: "update_profile_headline",
    description:
      "Update the user's own LinkedIn profile headline / heading via Unipile and persist to local database.",
    schema: z.object({
      headline: z
        .string()
        .describe("The new headline to set on your LinkedIn profile"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const createLinkedInPostTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.create_linkedin_post(input)),
  {
    name: "create_linkedin_post",
    description:
      "Publish a new text post (with optional attachments) directly to the user's LinkedIn feed via Unipile.",
    schema: z.object({
      text: z.string().describe("Text content of the post to publish"),
      attachments: z
        .array(z.any())
        .optional()
        .describe("Optional media attachments"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const getOwnPostsTool = tool(
  async (input) => JSON.stringify(await toolHandlers.get_own_posts(input)),
  {
    name: "get_own_posts",
    description:
      "Fetch recent posts published by the user on LinkedIn, including engagement likes and comments counts.",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of posts to fetch"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
    }),
  },
);

export const batchSendConnectionRequestsTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.batch_send_connection_requests(input)),
  {
    name: "batch_send_connection_requests",
    description:
      "Send batch connection requests across multiple candidate profiles with custom note allocation (e.g. first N with notes, remainder as blank invitations). Orchestrated via the Batch Outreach Subgraph.",
    schema: z.object({
      candidates: z
        .array(
          z.object({
            name: z.string().describe("Candidate full name"),
            linkedinId: z.string().optional().describe("LinkedIn provider ID"),
            headline: z.string().optional().describe("Professional headline"),
            company: z.string().optional().describe("Company name"),
            location: z.string().optional().describe("Location"),
            profileUrl: z.string().optional().describe("LinkedIn profile URL"),
          }),
        )
        .describe("List of target candidates to connect with"),
      withNoteCount: z
        .number()
        .optional()
        .describe(
          "Number of candidates in this batch who should receive personalized notes (e.g. 2)",
        ),
      withoutNoteCount: z
        .number()
        .optional()
        .describe(
          "Number of candidates in this batch who should receive blank invitations without note (e.g. 3)",
        ),
      personalizedNote: z
        .string()
        .optional()
        .describe("Optional customized note template to send"),
      skipHIL: z
        .boolean()
        .optional()
        .describe(
          "If true, bypasses the 10-second human review countdown and dispatches immediately",
        ),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
      userId: z.string().optional().describe("User ID scoping this action"),
    }),
  },
);

export const researchAndBatchConnectTool = tool(
  async (input) =>
    JSON.stringify(await toolHandlers.research_and_batch_connect(input)),
  {
    name: "research_and_batch_connect",
    description:
      "End-to-end multi-step autonomous workflow: searches real verified professionals on LinkedIn via the Research Subgraph, then executes batch outreach via the Batch Outreach Subgraph with custom note allocation (e.g., 2 with personalized note, 3 without note) and full status reporting.",
    schema: z.object({
      role: z
        .string()
        .describe(
          "Target role or search query (e.g., 'AI Engineer', 'CTO', 'Founder')",
        ),
      location: z
        .string()
        .optional()
        .describe(
          "Geographic location filter (e.g., 'India', 'San Francisco', 'Europe')",
        ),
      company: z.string().optional().describe("Target company name"),
      industry: z.string().optional().describe("Target industry"),
      totalCount: z
        .number()
        .optional()
        .default(5)
        .describe(
          "Total number of candidates to find and connect with (default 5)",
        ),
      withNoteCount: z
        .number()
        .optional()
        .default(2)
        .describe(
          "Number of candidates to send with personalized note (e.g. 2)",
        ),
      withoutNoteCount: z
        .number()
        .optional()
        .default(3)
        .describe("Number of candidates to send without note / blank (e.g. 3)"),
      personalizedNote: z
        .string()
        .optional()
        .describe("Optional custom note template"),
      accountId: z
        .string()
        .optional()
        .describe("Optional specific Unipile account ID"),
      userId: z.string().optional().describe("User ID scoping this action"),
    }),
  },
);

export const WORKPILOTConnectTools = [
  searchLinkedInLeadsTool,
  sendConnectionRequestTool,
  batchSendConnectionRequestsTool,
  researchAndBatchConnectTool,
  sendLinkedInMessageTool,
  scheduleAutonomousCampaignTool,
  getAccountSafetyAndLimitsTool,
  getPendingInvitationsTool,
  manageInvitationTool,
  getInboxConversationsTool,
  emergencyPauseAutomationTool,
  resumeAutomationTool,
  getOwnProfileAndRatingTool,
  updateProfileHeadlineTool,
  createLinkedInPostTool,
  getOwnPostsTool,
  tool(
    async (input: any) =>
      JSON.stringify(await toolHandlers.get_existing_connections(input)),
    {
      name: "get_existing_connections",
      description:
        "Fetch the user's actual existing 1st-degree LinkedIn connections. Returns their names, headlines, and member IDs. Use this before messaging to see who is available. Can filter by role, keywords, company, or location.",
      schema: z.object({
        limit: z.number().optional().default(20).describe("How many connections to fetch (max 50)"),
        role: z.string().optional().describe("Filter by role/headline keyword"),
        keywords: z.string().optional().describe("Filter by keyword in name or headline"),
        company: z.string().optional().describe("Filter by company"),
        location: z.string().optional().describe("Filter by location"),
        accountId: z.string().optional().describe("Optional Unipile account ID"),
        userId: z.string().optional().describe("User ID scoping this action"),
      }),
    },
  ),
  tool(
    async (input: any) =>
      JSON.stringify(await toolHandlers.message_existing_connections(input)),
    {
      name: "message_existing_connections",
      description:
        "ENGAGEMENT CAMPAIGN: Fetches your ACTUAL existing 1st-degree LinkedIn connections (real connections, not newly found people) and sends them a direct message. This is the ONLY correct way to message your existing connections. Use when user says 'message my connections', 'engage my connections', 'send DMs to existing connections', or sets up an ENGAGEMENT campaign. You can use {name} in the message template for personalization.",
      schema: z.object({
        message: z.string().describe("Message text to send. Use {name} for personalization (e.g. 'Hi {name}, ...')"),
        count: z.number().optional().default(5).describe("Number of connections to message (default 5, max 20)"),
        role: z.string().optional().describe("Filter: only message connections with this role/keyword in headline"),
        keywords: z.string().optional().describe("Filter: only message connections matching this keyword"),
        company: z.string().optional().describe("Filter: only message connections from this company"),
        personalize: z.boolean().optional().default(true).describe("Replace {name} with each connection's first name"),
        accountId: z.string().optional().describe("Optional Unipile account ID"),
        userId: z.string().optional().describe("User ID scoping this action"),
      }),
    },
  ),
];
