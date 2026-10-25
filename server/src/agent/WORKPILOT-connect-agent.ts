import "../config/dotenv.config.js";
import { createAgent } from "langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver, Command } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import {
  WORKPILOTConnectTools,
  toolHandlers,
  executeSystemTool,
  systemToolDeclarations,
  runWithToolTenant,
} from "../tools/tools.js";
import { accountSafetyService } from "../services/safety/safety.service.js";
import { agentMemoryService } from "../services/agent/agent-memory.service.js";
import { linkedInProfileService } from "../services/linkedin/profile.service.js";
import { linkedInPeopleService } from "../services/linkedin/people.service.js";
import {
  WORKPILOTStore,
  registerThreadExecution,
  cancelThreadExecution,
  isThreadCancelled,
  activeExecutionSignals,
  runPacedOutreachWorkflow,
  OutreachCandidate,
} from "./WORKPILOT-subgraphs.js";
import { db } from "../db/index.js";
import { linkedinAccounts } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { taskManager } from "./WORKPILOT-task-manager.js";
import { runAutoReplySubagent } from "./WORKPILOT-inbox-subagent.js";
import { geminiConfigService } from "../services/ai/gemini-config.service.js";

export {
  toolHandlers,
  executeSystemTool,
  systemToolDeclarations,
  cancelThreadExecution as stopAgentExecution,
  isThreadCancelled,
  WORKPILOTStore,
};

export const WORKPILOT_AGENT_SYSTEM_PROMPT = `You are the WORKPILOT Autonomous AI Agent — an intelligent relationship director and LinkedIn outreach automation engine.

YOUR CORE IDENTITY & CAPABILITIES:
1. You interact directly with LinkedIn via the Unipile API to discover verified professionals, send connection requests, and manage direct message conversations.
2. You execute campaigns autonomously with realistic human-like delays (8–18 minutes between requests with micro-jitter) and strict business hours rollover (8:30 AM to 7:30 PM).
3. You have access to a suite of specialized tools:
   - search_linkedin_leads: Find targeted prospects by role, location, company, and industry.
   - send_connection_request: Send a single connection request to an individual person.
   - batch_send_connection_requests: Send batch connection requests to a list of candidates with custom note allocation through the Batch Outreach Subgraph.
   - research_and_batch_connect: End-to-end multi-step autonomous workflow: researches real verified leads and connects with them according to user note rules.
   - send_linkedin_message: Send direct messages to existing connections or active chat threads.
   - schedule_autonomous_campaign: Ingest leads and pace outbound connection invites safely.
   - get_account_safety_and_limits: Verify daily connection and messaging quotas (out of 20 invites, 50 messages/day).
   - get_pending_invitations: Check sent and incoming connection requests.
   - manage_invitation: Accept, decline, or withdraw invitations.
   - get_inbox_conversations: Read recent conversation threads and unread counts.
   - get_own_profile_and_rating: Fetch own LinkedIn profile, evaluate headline/about quality, and score out of 100 with recommendations.
   - update_profile_headline: Edit and update own LinkedIn profile headline / heading directly.
   - create_linkedin_post: Publish posts and updates directly to user's LinkedIn feed.
   - get_own_posts: Inspect user's recent posts and engagement performance (likes, comments).
   - emergency_pause_automation: Freeze all outbound automation instantly.
   - resume_automation: Resume outbound queue processing.

CRITICAL FORMATTING & SYNTHESIS RULE:
- NEVER return empty content or a generic "I have processed your request." statement.
- When calling any tool, synthesize the tool's findings into rich Markdown: list candidate names, headlines, profile links, action statuses, and concrete recommendations.
- Keep the user informed with clear, structured bullet points.`;

export interface AgentOptions {
  userId?: string | undefined;
  modelName?: string | undefined;
  apiKey?: string | undefined;
  temperature?: number | undefined;
  checkpointer?: MemorySaver | undefined;
  systemPrompt?: string | undefined;
  llm?: any;
}

export const getGeminiChatModel = (options?: AgentOptions) => {
  let model = options?.modelName;
  let apiKey = options?.apiKey;

  if (!apiKey && options?.userId) {
    const userCached = geminiConfigService.getCachedUserApiKey(options.userId);
    apiKey = userCached.apiKey;
    if (!model) model = userCached.model;
  }

  model = model || geminiConfigService.getModelName();
  apiKey = apiKey || geminiConfigService.getApiKey();

  return new ChatGoogleGenerativeAI({
    model,
    apiKey: apiKey || "dummy_key_for_offline_validation",
    temperature: options?.temperature ?? 0.2,
  });
};

export const getGeminiChatModelForUser = async (
  userId?: string,
  options?: AgentOptions,
): Promise<ChatGoogleGenerativeAI> => {
  const userConfig = await geminiConfigService.getUserConfig(userId);
  return getGeminiChatModel({
    ...options,
    apiKey: options?.apiKey || userConfig.apiKey,
    modelName: options?.modelName || userConfig.model,
  });
};


export const createWORKPILOTLangGraphAgent = (
  options?: AgentOptions & { threadId?: string; userId?: string },
) => {
  const userId = options?.userId || "default";
  const memory =
    options?.checkpointer || agentMemoryService.getUserCheckpointer(userId);
  const llm = options?.llm || getGeminiChatModel(options);

  return createReactAgent({
    llm,
    tools: WORKPILOTConnectTools,
    messageModifier: options?.systemPrompt || WORKPILOT_AGENT_SYSTEM_PROMPT,
    checkpointSaver: memory,
  });
};

export const createWORKPILOTLangChainAgent = (options?: {
  modelName?: string;
  apiKey?: string;
}) => {
  const modelName =
    options?.modelName || process.env.GEMINI_MODEL || "gemini-3.8-flash";

  return createAgent({
    model: `google-genai:${modelName}`,
    tools: WORKPILOTConnectTools,
  });
};

export const WORKPILOTAgent = createWORKPILOTLangGraphAgent();

export interface ChatAgentParams {
  messages: Array<{ role: string; content: string }>;
  userId?: string | undefined;
  threadId?: string | undefined;
  modelName?: string | undefined;
  apiKey?: string | undefined;
  toolCall?: { name: string; args?: any; id?: string } | undefined;
  resume?: any; // For resuming from LangGraph interrupt
  agentSettings?: any;
}

export interface AutonomousWorkflowParams {
  goal: string;
  targetRole?: string | undefined;
  location?: string | undefined;
  industry?: string | undefined;
  limit?: number | undefined;
  userId?: string | undefined;
  personalizedNote?: string | undefined;
  campaignType?: "DISCOVERY" | "ENGAGEMENT" | undefined;
}

export async function chatWithWORKPILOTAgent(params: ChatAgentParams): Promise<{
  reply: string;
  toolCallsExecuted: Array<{ tool: string; input: any; output?: any }>;
  interrupted?: boolean;
  interrupt?: any;
  threadId?: string;
}> {
  if (params.toolCall) {
    if (!params.userId) throw new Error("Authenticated user context is required for tool execution.");
    const execution = await runWithToolTenant(params.userId, () => executeSystemTool({
      ...params.toolCall!,
      args: { ...(params.toolCall!.args || {}), userId: params.userId },
    }));
    return {
      reply:
        typeof execution.response?.result === "string"
          ? execution.response.result
          : JSON.stringify(
              execution.response?.result ?? execution.response?.error ?? {},
            ),
      toolCallsExecuted: [
        {
          tool: params.toolCall.name,
          input: params.toolCall.args,
          output: execution.response?.result,
        },
      ],
    };
  }

  const hasKey = Boolean(
    params.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  );

  if (!hasKey) {
    return {
      reply:
        "❌ No Gemini API key connected. Please set your `GEMINI_API_KEY` in `server/.env` or configure an API key in the Agent Settings to enable reasoning and responses.",
      toolCallsExecuted: [],
    };
  }

  if (!params.userId) {
    return {
      reply: "❌ Authentication required. User ID context must be provided to interact with the WorkPilot agent.",
      toolCallsExecuted: [],
    };
  }

  const activeUserId = params.userId;
  const threadId = agentMemoryService.getUserThreadId(
    activeUserId,
    params.threadId,
  );

  const accountHealth =
    await accountSafetyService.getAccountHealth(activeUserId);
  const isLinkedInConnected = Boolean(accountHealth?.isConnected);

  const lastUserMsg =
    params.messages.filter((m) => m.role === "user").pop()?.content || "";

  const isAutomationIntent =
    /(?:search|find|lead|prospect|connect|campaign|outreach|message|send|post|publish|headline|profile|invite)/i.test(
      lastUserMsg,
    );

  if (!isLinkedInConnected && isAutomationIntent) {
    return {
      reply:
        "⚠️ Your LinkedIn account is disconnected or your session cookies were deleted. Please connect your LinkedIn account in Settings/Integrations before performing automations, finding leads, or dispatching outreach.",
      toolCallsExecuted: [],
    };
  }

  // Record user message in short-term session memory (in-memory only)
  if (lastUserMsg && params.resume === undefined) {
    agentMemoryService.recordMessage(activeUserId, "user", lastUserMsg);
  }

  // 1. Check for Stop / Halt Intent
  const isStopIntent =
    /^(?:stop|halt|cancel|pause|stop\s+agent|stop\s+all|stop\s+outreach|stop\s+campaign)$/i.test(
      lastUserMsg.trim(),
    );
  if (isStopIntent) {
    cancelThreadExecution(threadId);
    taskManager.stopAllUserTasks(activeUserId);
    const stopMsg =
      "⏸️ **Agent execution and all active background subagents have been stopped safely.**";
    agentMemoryService.recordMessage(activeUserId, "assistant", stopMsg, []);
    return {
      reply: stopMsg,
      toolCallsExecuted: [],
      threadId,
    };
  }

  const userSettings = agentMemoryService.getUserSettings(activeUserId);
  const activeSettings = {
    ...userSettings,
    ...(params.agentSettings || {}),
  };

  const safeDailyQuota = Math.min(
    Math.max(Number(activeSettings.dailyQuota) || 10, 1),
    20,
  );

  // 2. Check for Auto-Reply Subagent Intent
  const isAutoReplyIntent =
    /(?:auto[-\s]?reply|auto\s+reply\s+to\s+any\s+message|reply\s+to\s+(?:any\s+)?message)/i.test(
      lastUserMsg,
    );
  if (isAutoReplyIntent && params.resume === undefined) {
    const created = taskManager.createTask({
      userId: activeUserId,
      type: "auto_reply",
      name: "Inbox Auto-Reply Subagent",
      total: 10,
      details: {
        message: "Triage active: monitoring conversations for work or help inquiries.",
      },
    });

    // Run asynchronously in background!
    runAutoReplySubagent({
      userId: activeUserId,
      taskId: created.task.id,
    }).catch((err) => {
      console.error("[AUTO-REPLY SUBAGENT BACKGROUND ERROR]", err);
    });

    const replyMsg = `### 📬 Auto-Reply Subagent Activated (Background)
- **Status**: Running autonomously in the background side-by-side.
- **Monitoring Scope**: Inbound LinkedIn message threads for work inquiries, hiring/freelance opportunities, or requests for help.
- **Response Strategy**: Crafts personalized replies based on your custom personality and verified profile.
- **Live Stream**: Real-time triage events and dispatched replies stream directly to your Console via SSE.

> ⚡ *The supervisor agent is free! You can give your next command right now.*`;

    agentMemoryService.recordMessage(activeUserId, "assistant", replyMsg, [
      { tool: "launch_auto_reply_subagent", input: { taskId: created.task.id } },
    ]);

    return {
      reply: replyMsg,
      toolCallsExecuted: [
        { tool: "launch_auto_reply_subagent", input: { taskId: created.task.id } },
      ],
      threadId,
    };
  }

  // 3. Check for Autonomous Outreach & Connection Dispatch Intent
  const isOutreachIntent =
    /(?:connection\s*requests?|send\s*.*(?:connection|invite|invitation)|connect\s*(?:with|to)|batch\s*connect|reach\s*out|outreach|campaign|find\s+.*(?:connect|send|invite)|search\s+.*(?:connect|send|invite))/i.test(
      lastUserMsg,
    ) ||
    Boolean(
      /(?:connect|invite|connection)/i.test(lastUserMsg) &&
      /(?:send|find|search|student|engineer|developer|lead|people|person|profile|around|blank|note)/i.test(lastUserMsg)
    );

  if (isOutreachIntent && params.resume === undefined) {
    if (taskManager.isOutreachActive(activeUserId)) {
      const busyMsg = `⚠️ **An outreach campaign is already active in the background.**\nYour daily quota is locked at **${safeDailyQuota} requests/day** for account safety. You can inspect live progress in the console or stop the active campaign first before launching another.`;
      agentMemoryService.recordMessage(activeUserId, "assistant", busyMsg, []);
      return {
        reply: busyMsg,
        toolCallsExecuted: [],
        threadId,
      };
    }

    // Resolve active Unipile account ID from DB for activeUserId
    let activeAccountId = params.agentSettings?.accountId;
    if (!activeAccountId) {
      try {
        const [acc] = await db
          .select()
          .from(linkedinAccounts)
          .where(
            and(
              eq(linkedinAccounts.userId, activeUserId),
              eq(linkedinAccounts.isConnected, true),
            ),
          )
          .limit(1);
        if (acc?.unipileAccountId && acc.healthStatus !== "DISCONNECTED") {
          activeAccountId = acc.unipileAccountId;
        }
      } catch {}
    }
    if (!activeAccountId) {
      try {
        const [anyAcc] = await db
          .select()
          .from(linkedinAccounts)
          .where(eq(linkedinAccounts.isConnected, true))
          .limit(1);
        if (anyAcc?.unipileAccountId && anyAcc.healthStatus !== "DISCONNECTED") {
          activeAccountId = anyAcc.unipileAccountId;
        }
      } catch {}
    }

    // Intelligent Extraction: Parse target names, count, and note strategy
    let extractedNames: string[] = [];
    let extractedRole = "";
    let targetCount = safeDailyQuota;
    let withNoteCount = 0;
    let withoutNoteCount = 0;
    let personalizedNoteText: string | undefined = undefined;

    try {
      const llm = getGeminiChatModel({
        apiKey: params.apiKey,
        modelName: params.modelName,
        temperature: 0,
      });

      const parsePrompt = `You are an intent parser for an autonomous LinkedIn outreach agent.
Analyze the user's outreach command and extract target parameters strictly into JSON.
User Message: "${lastUserMsg}"

Required JSON format:
{
  "names": string[],
  "role": string,
  "count": number,
  "withNoteCount": number,
  "withoutNoteCount": number,
  "personalizedNote": string | null
}
Rules:
- "names": specific candidate or person names mentioned (e.g. ["Code With Harry", "Neeraj Walia (ezsnippet)"]). Empty array [] if general role search.
- "role": role/title or search query if looking for generic leads. Empty "" if specific names provided.
- "count": total number of requests requested.
- "withNoteCount": number of requests with personalized notes. If user specified "without note", "no note", or "blank", MUST BE 0.
- "withoutNoteCount": number of requests without notes.
- "personalizedNote": note text if provided, else null.

Respond ONLY with valid JSON. Do not include markdown codeblocks or explanation.`;

      const res = await llm.invoke([new HumanMessage(parsePrompt)]);
      const raw =
        typeof res.content === "string"
          ? res.content
          : Array.isArray(res.content)
            ? res.content
                .map((c: any) => (typeof c === "string" ? c : c.text || ""))
                .join("")
            : "";

      const cleanJson = raw.replace(/```json/gi, "").replace(/```/gi, "").trim();
      const parsed = JSON.parse(cleanJson);

      if (Array.isArray(parsed.names)) {
        extractedNames = parsed.names.filter(
          (n: any) => typeof n === "string" && n.trim().length > 0,
        );
      }
      if (typeof parsed.role === "string") {
        extractedRole = parsed.role.trim();
      }
      if (typeof parsed.count === "number" && parsed.count > 0) {
        targetCount = Math.min(parsed.count, safeDailyQuota);
      }
      if (typeof parsed.withNoteCount === "number") {
        withNoteCount = Math.max(0, parsed.withNoteCount);
      }
      if (typeof parsed.withoutNoteCount === "number") {
        withoutNoteCount = Math.max(0, parsed.withoutNoteCount);
      }
      if (
        typeof parsed.personalizedNote === "string" &&
        parsed.personalizedNote.trim()
      ) {
        personalizedNoteText = parsed.personalizedNote.trim();
      }
    } catch {
      // Fallback to heuristic regex parsing if LLM is offline
    }

    // Heuristic fallback / overrides
    const isExplicitWithoutNote =
      /(?:without\s+.*notes?|no\s+notes?|blank\s+invit|blank)/i.test(lastUserMsg);
    if (isExplicitWithoutNote) {
      withNoteCount = 0;
      withoutNoteCount = targetCount;
    }

    // Heuristic fallback for target count (e.g. "around 5", "5 students")
    const countMatch = lastUserMsg.match(/\b(?:around\s+|send\s+|to\s+)?(\d+)\b/i);
    if (countMatch && countMatch[1]) {
      const num = parseInt(countMatch[1], 10);
      if (!isNaN(num) && num > 0) {
        targetCount = Math.min(num, safeDailyQuota);
      }
    }

    // Clean conversational noise from extractedRole
    if (extractedRole) {
      extractedRole = extractedRole
        .replace(/find\s+(?:some\s+)?/gi, "")
        .replace(/around\s+me/gi, "")
        .replace(/around\s+\d+/gi, "")
        .replace(/send\s+them\s+.*$/gi, "")
        .replace(/send\s+connection.*$/gi, "")
        .replace(/without\s+.*$/gi, "")
        .trim();
    }
    if (!extractedRole && extractedNames.length === 0) {
      const matchRole = lastUserMsg.match(/\b(students?|engineers?|developers?|founders?|recruiters?|designers?|managers?)\b/i);
      if (matchRole && matchRole[1]) {
        extractedRole = matchRole[1];
      }
    }

    if (extractedNames.length === 0) {
      const splitNamesMatch = lastUserMsg.match(
        /one\s+(?:to|ot)\s+([^,]+?)\s+and\s+(?:the\s+)?(?:other|another)\s+(?:to|ot)\s+(.+?)(?:\.|$)/i,
      );
      if (splitNamesMatch && splitNamesMatch[1] && splitNamesMatch[2]) {
        extractedNames = [splitNamesMatch[1].trim(), splitNamesMatch[2].trim()];
      } else {
        const toNamesMatch = lastUserMsg.match(
          /(?:connect\s+with|requests?\s+to)\s+([^,]+?)\s+and\s+(.+?)(?:\.|$)/i,
        );
        if (toNamesMatch && toNamesMatch[1] && toNamesMatch[2]) {
          extractedNames = [toNamesMatch[1].trim(), toNamesMatch[2].trim()];
        }
      }
    }

    if (extractedNames.length > 0) {
      targetCount = Math.min(extractedNames.length, safeDailyQuota);
    }

    if (withNoteCount === 0 && withoutNoteCount === 0) {
      if (isExplicitWithoutNote) {
        withNoteCount = 0;
        withoutNoteCount = targetCount;
      } else {
        withNoteCount = targetCount;
        withoutNoteCount = 0;
      }
    }

    // Resolve candidates if specific names were given
    const resolvedCandidates: OutreachCandidate[] = [];
    if (extractedNames.length > 0) {
      for (const rawName of extractedNames) {
        const cleanName = rawName.trim();
        if (!cleanName) continue;
        try {
          const searchRes = await linkedInPeopleService.searchPeople(
            {
              role: cleanName,
              keywords: cleanName,
              limit: 3,
            },
            activeAccountId,
            activeUserId,
          );
          const best = searchRes?.[0];
          if (best) {
            resolvedCandidates.push({
              name: best.name,
              linkedinId: best.linkedin_id,
              headline: best.designation,
              company: best.company,
              location: best.location,
              profileUrl: best.profile_url,
            });
          } else {
            resolvedCandidates.push({
              name: cleanName,
              headline: "LinkedIn Professional",
            });
          }
        } catch {
          resolvedCandidates.push({
            name: cleanName,
            headline: "LinkedIn Professional",
          });
        }
      }
    }

    const campaignTargetDescription =
      extractedNames.length > 0
        ? extractedNames.join(", ")
        : extractedRole || "Targeted Professionals";

    // Provision asynchronous outreach task in Task Manager
    const created = taskManager.createTask({
      userId: activeUserId,
      type: "outreach",
      name: `Outreach: ${campaignTargetDescription.slice(0, 30)}`,
      total: targetCount,
      details: {
        targetRole: campaignTargetDescription,
        dailyQuota: safeDailyQuota,
        sentCount: 0,
        message: `Campaign active: capped at ${safeDailyQuota}/day with safety pacing.`,
      },
    });

    // Launch background paced runner asynchronously!
    runPacedOutreachWorkflow({
      userId: activeUserId,
      query: campaignTargetDescription,
      role: extractedRole || campaignTargetDescription,
      candidates:
        resolvedCandidates.length > 0 ? resolvedCandidates : undefined,
      withNoteCount,
      withoutNoteCount,
      personalizedNote: personalizedNoteText,
      dailyLimitOverride: targetCount,
      taskId: created.task.id,
      accountId: activeAccountId,
      campaignType: activeSettings.campaignType,
    }).catch((err) => {
      console.error("[OUTREACH SUBGRAPH BACKGROUND ERROR]", err);
    });

    const isEngagement = activeSettings.campaignType === "ENGAGEMENT";
    const blankStr = isEngagement ? "Default Templates (No note requested)" : "Blank Invitations (No note requested)";
    
    const strategyBadge =
      withoutNoteCount > 0 && withNoteCount === 0
        ? `✉️ ${blankStr}`
        : withNoteCount > 0 && withoutNoteCount === 0
          ? "✍️ With Personalized Notes"
          : `Split: ${withNoteCount} with note, ${withoutNoteCount} ${isEngagement ? "default" : "blank"}`;

    const actionTitle = isEngagement ? "Engagement Campaign (Direct Messages)" : "Outreach Campaign (Invitations)";

    const replyMsg = `### 🚀 Autonomous ${actionTitle} Launched (Background)
- **Target**: **${campaignTargetDescription}**
- **Planned Connections**: Up to **${targetCount}** (Strictly capped by your configured daily limit: **${safeDailyQuota}/day**)
- **Strategy**: ${strategyBadge}
- **Activity Pacing**: Requests use configured quotas and randomized delay intervals (20s cooldown). This reduces activity spikes but does not guarantee platform approval.
- **Settings Lock**: 🔒 Daily quota is locked while this campaign executes.
- **Execution**: Managed asynchronously by the **Outreach Subgraph**.

Real-time candidate discovery, dispatch status, and pacing countdowns are streaming live to your **Console & Chat** via SSE.

> ⚡ **Supervisor Ready**: The agent is now completely free! You can enter your next command side-by-side.`;

    agentMemoryService.recordMessage(activeUserId, "assistant", replyMsg, [
      {
        tool: "launch_autonomous_outreach",
        input: {
          target: campaignTargetDescription,
          count: targetCount,
          taskId: created.task.id,
        },
      },
    ]);

    return {
      reply: replyMsg,
      toolCallsExecuted: [
        {
          tool: "launch_autonomous_outreach",
          input: {
            target: campaignTargetDescription,
            count: targetCount,
            taskId: created.task.id,
          },
        },
      ],
      threadId,
    };
  }

  // 4. Interactive Reasoning & General Tool Execution via LangGraph
  const { abortController } = registerThreadExecution(threadId);

  try {
    const userPersonality = (activeSettings.personality || "").trim();
    const personalityInstruction = userPersonality
      ? `\n\nYOUR CORE PERSONALITY & SYSTEM INSTRUCTIONS (DEFINED BY USER — HIGHEST PRIORITY):\n${userPersonality}\nYou MUST adopt this exact personality, style, tone, and directives across all your reasoning, dialogue, and outbound message writing.\n`
      : `\n\nYOUR CORE PERSONALITY & SYSTEM INSTRUCTIONS:\nAct as an authentic, articulate human peer. Actively listen to contacts, answer their specific points directly, and keep messages compact (1-2 sentences). Never sound robotic, use AI clichés, or push aggressive sales pitches.\n`;

    const limitsInstruction = `\nDAILY OUTREACH LIMIT (USER CONFIGURED):\n- Maximum allowed connection requests per day: ${safeDailyQuota} (Strict user cap: 1–20 requests/day). Always respect this quota and warn or stop if approaching or exceeding it.\n`;

    const userLinkedInProfileContext =
      await linkedInProfileService.getUserProfileGroundTruth(activeUserId);

    const campaignTypeInstruction = activeSettings.campaignType === "ENGAGEMENT" 
      ? `\nCAMPAIGN MODE: "ENGAGEMENT" — MESSAGE EXISTING CONNECTIONS\nYou are targeting EXISTING 1st-degree LinkedIn connections (NOT searching for new people).\n\nCRITICAL RULES FOR ENGAGEMENT MODE:\n1. ALWAYS use the \"message_existing_connections\" tool to send messages. This is the ONLY correct tool for this mode.\n2. NEVER use schedule_autonomous_campaign, research_and_batch_connect, or batch_send_connection_requests for this mode — those tools search for new people and cannot DM them.\n3. NEVER use send_connection_request for an ENGAGEMENT campaign.\n4. You can optionally use \"get_existing_connections\" to preview who will be messaged before sending.\n5. Personalize messages using {name} placeholder — it will be replaced with each person's first name automatically.\n\nExample: If user says \"send a message to my AI Engineer connections\", call message_existing_connections with role: \"AI Engineer\" and the appropriate message template.\n`
      : `\nCAMPAIGN MODE: "DISCOVERY"\nYou are searching for NEW LinkedIn connections to invite. When launching a campaign, use schedule_autonomous_campaign, research_and_batch_connect, or batch_send_connection_requests with campaignType: "DISCOVERY".\n`;

    const contextModifier =
      WORKPILOT_AGENT_SYSTEM_PROMPT +
      `\n\n` +
      userLinkedInProfileContext +
      `\n\n` +
      personalityInstruction +
      limitsInstruction +
      campaignTypeInstruction +
      `\nREAL-TIME ACCOUNT STATUS:\n` +
      `- LinkedIn Connected: ${isLinkedInConnected ? "YES (Active)" : "NO (Disconnected)"}\n` +
      `- Authenticated User ID: ${activeUserId}\n` +
      (!isLinkedInConnected
        ? `CRITICAL NOTICE: The user's LinkedIn is disconnected. Inform them they must connect their LinkedIn account first.\n`
        : "");

    const agent = createWORKPILOTLangGraphAgent({
      modelName: params.modelName,
      apiKey: params.apiKey,
      systemPrompt: contextModifier,
      userId: activeUserId,
      threadId,
    });

    let result: any;

    if (params.resume !== undefined) {
      try {
        result = await runWithToolTenant(activeUserId, () => agent.invoke(new Command({ resume: params.resume }), {
          configurable: { thread_id: threadId },
          signal: abortController.signal,
        }));
      } catch (resumeErr: any) {
        console.warn(
          "⚠️ [WORKPILOT AGENT] Error resuming graph with Command:",
          resumeErr.message,
        );
        throw resumeErr;
      }
    } else {
      const messagesToInvoke: BaseMessage[] = [
        new HumanMessage(lastUserMsg || "Hello"),
      ];

      try {
        result = await runWithToolTenant(activeUserId, () => agent.invoke(
          { messages: messagesToInvoke },
          {
            configurable: { thread_id: threadId },
            signal: abortController.signal,
          },
        ));
      } catch (modelErr: any) {
        if (
          isThreadCancelled(threadId) ||
          abortController.signal.aborted ||
          modelErr?.name === "AbortError"
        ) {
          throw modelErr;
        }
        const errMsg = modelErr?.message || "";
        if (
          errMsg.includes("429") ||
          errMsg.includes("quota") ||
          errMsg.includes("ResourceExhausted") ||
          errMsg.includes("Too Many Requests")
        ) {
          console.warn(
            "⚠️ [WORKPILOT AGENT] Primary model rate-limited. Retrying with gemini-3.1-flash-lite fallback...",
          );
          const fallbackAgent = createWORKPILOTLangGraphAgent({
            modelName: "gemini-3.1-flash-lite",
            apiKey: params.apiKey,
            systemPrompt: contextModifier,
            userId: activeUserId,
            threadId,
          });
          result = await runWithToolTenant(activeUserId, () => fallbackAgent.invoke(
            { messages: messagesToInvoke },
            {
              configurable: { thread_id: threadId },
              signal: abortController.signal,
            },
          ));
        } else {
          throw modelErr;
        }
      }
    }

    const rawInterrupts = (result as any)?.__interrupt__;
    if (Array.isArray(rawInterrupts) && rawInterrupts.length > 0) {
      const interruptPayload = rawInterrupts[0]?.value || rawInterrupts[0];
      return {
        reply:
          typeof interruptPayload === "string"
            ? interruptPayload
            : interruptPayload?.message ||
              "Human confirmation required to proceed.",
        toolCallsExecuted: [],
        interrupted: true,
        interrupt: interruptPayload,
        threadId,
      };
    }

    const latestMessage = result.messages[result.messages.length - 1];
    let replyContent = "";
    if (latestMessage) {
      if (typeof latestMessage.content === "string") {
        replyContent = latestMessage.content.trim();
      } else if (Array.isArray(latestMessage.content)) {
        replyContent = latestMessage.content
          .map((part: any) =>
            typeof part === "string" ? part : part?.text || "",
          )
          .join("")
          .trim();
      } else if (latestMessage.content) {
        replyContent = JSON.stringify(latestMessage.content);
      }
    }

    const toolCallsExecuted: Array<{ tool: string; input: any; output?: any }> =
      [];
    for (const msg of result.messages) {
      if ((msg as any).tool_calls && Array.isArray((msg as any).tool_calls)) {
        for (const tc of (msg as any).tool_calls) {
          toolCallsExecuted.push({
            tool: tc.name,
            input: tc.args,
          });
        }
      }
    }

    // Synthesize response if latestMessage was empty or generic tool execution
    if (!replyContent || replyContent === "I have processed your request.") {
      const toolMessages = result.messages.filter(
        (m: any) =>
          m._getType?.() === "tool" || m.name || (m as any).tool_call_id,
      );

      if (toolMessages.length > 0) {
        const summaries: string[] = [];
        for (const tm of toolMessages) {
          try {
            const parsed =
              typeof tm.content === "string"
                ? JSON.parse(tm.content)
                : tm.content;
            if (parsed.candidates && Array.isArray(parsed.candidates)) {
              summaries.push(
                `### 🎯 Discovered Candidates (${parsed.candidates.length})\n` +
                  parsed.candidates
                    .slice(0, 5)
                    .map(
                      (c: any, idx: number) =>
                        `${idx + 1}. **${c.name}** — ${c.headline || c.company || "Professional"}${c.location ? ` (${c.location})` : ""}`,
                    )
                    .join("\n"),
              );
            } else if (parsed.message) {
              summaries.push(`- ${parsed.message}`);
            }
          } catch {
            if (typeof tm.content === "string" && tm.content.length > 5) {
              summaries.push(tm.content);
            }
          }
        }

        replyContent =
          summaries.length > 0
            ? summaries.join("\n\n")
            : "Action executed successfully. Live updates are available in your agent console.";
      } else {
        replyContent =
          "I have reviewed your request and verified your account state. Ready for your next instruction.";
      }
    }

    // Record assistant reply in short-term session memory
    agentMemoryService.recordMessage(
      activeUserId,
      "assistant",
      replyContent,
      toolCallsExecuted,
    );

    return {
      reply: replyContent,
      toolCallsExecuted,
      threadId,
    };
  } catch (err: any) {
    if (
      isThreadCancelled(threadId) ||
      abortController.signal.aborted ||
      err?.name === "AbortError" ||
      err?.message?.toLowerCase().includes("abort") ||
      err?.message?.toLowerCase().includes("cancelled")
    ) {
      console.log(
        `🛑 [WORKPILOT AGENT] Thread ${threadId} execution halted by user.`,
      );
      const stopNotice =
        "⏸️ **Agent execution was stopped by user.** All queued dispatches and graph steps have been halted safely.";
      agentMemoryService.recordMessage(
        activeUserId,
        "assistant",
        stopNotice,
        [],
      );
      return {
        reply: stopNotice,
        toolCallsExecuted: [],
        threadId,
      };
    }

    console.error("❌ [WORKPILOT AGENT] LangGraph execution error:", err);
    return {
      reply: `I encountered an issue processing your request: ${err.message}. Please try again or refine your query.`,
      toolCallsExecuted: [],
      threadId,
    };
  } finally {
    activeExecutionSignals.delete(threadId);
  }
}

export async function executeAutonomousCampaignWorkflow(
  params: AutonomousWorkflowParams,
): Promise<{
  success: boolean;
  summary: string;
  discovered: number;
  enqueued: number;
  candidates: Array<{
    name: string;
    headline?: string | undefined;
    company?: string | undefined;
    location?: string | undefined;
  }>;
}> {
  if (!params.userId) {
    return {
      success: false,
      summary: "Authentication required. User ID context must be provided to run an outreach workflow.",
      discovered: 0,
      enqueued: 0,
      candidates: [],
    };
  }

  const userId = params.userId;
  const userSettings = agentMemoryService.getUserSettings(userId);
  const userDailyLimit = Math.min(
    Math.max(Number(userSettings?.dailyQuota) || 10, 1),
    20,
  );
  const limit = Math.min(params.limit || userDailyLimit, userDailyLimit);

  const health = await accountSafetyService.getAccountHealth(userId);

  if (!health?.isConnected) {
    return {
      success: false,
      summary:
        "LinkedIn account is disconnected. Please connect your account in Integrations before starting an outreach campaign.",
      discovered: 0,
      enqueued: 0,
      candidates: [],
    };
  }

  const result = await runPacedOutreachWorkflow({
    userId,
    query: params.goal || params.targetRole || "Leads",
    role: params.targetRole,
    location: params.location,
    industry: params.industry,
    dailyLimitOverride: limit,
    personalizedNote: params.personalizedNote,
    campaignType: params.campaignType,
  });

  return {
    success: result.success,
    summary: result.summary,
    discovered: result.totalCount,
    enqueued: result.sentCount,
    candidates: [],
  };
}
