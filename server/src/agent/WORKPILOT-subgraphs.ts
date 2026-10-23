import {
  Annotation,
  StateGraph,
  InMemoryStore,
  MemorySaver,
  interrupt,
} from "@langchain/langgraph";
import { linkedInPeopleService } from "../services/linkedin/people.service.js";
import { linkedInConnectionService } from "../services/linkedin/connection.service.js";
import { linkedInMessageService } from "../services/linkedin/message.service.js";
import { taskManager } from "./WORKPILOT-task-manager.js";
import { agentMemoryService } from "../services/agent/agent-memory.service.js";
import { outreachBrainService } from "../services/intelligence/outreach-brain.service.js";
import { randomUUID } from "node:crypto";

export const WORKPILOTStore = new InMemoryStore();

export const activeExecutionSignals = new Map<
  string,
  {
    abortController: AbortController;
    isCancelled: boolean;
    cancelledAt?: number;
  }
>();

export function isThreadCancelled(threadId?: string): boolean {
  if (!threadId) return false;
  const signal = activeExecutionSignals.get(threadId);
  return Boolean(signal?.isCancelled || signal?.abortController.signal.aborted);
}

export function registerThreadExecution(threadId: string): {
  abortController: AbortController;
  cancelToken: { isCancelled: boolean };
} {
  const abortController = new AbortController();
  const token = { abortController, isCancelled: false };
  activeExecutionSignals.set(threadId, token);
  return { abortController, cancelToken: token };
}

export function cancelThreadExecution(threadId: string): boolean {
  const signal = activeExecutionSignals.get(threadId);
  if (signal) {
    signal.isCancelled = true;
    signal.cancelledAt = Date.now();
    try {
      signal.abortController.abort("Agent execution stopped by user.");
    } catch {
      // ignore
    }
  }

  // Also halt any running background tasks for this user/thread
  const userId = threadId.replace(/^thread_/, "");
  taskManager.stopAllUserTasks(userId);

  return Boolean(signal);
}

export interface OutreachCandidate {
  name: string;
  linkedinId?: string | undefined;
  headline?: string | undefined;
  company?: string | undefined;
  location?: string | undefined;
  profileUrl?: string | undefined;
}

export interface QueueItem {
  candidate: OutreachCandidate;
  withNote: boolean;
  note?: string | undefined;
  status: "pending" | "sent" | "failed" | "cancelled";
  resultMessage?: string | undefined;
}

export const ResearchState = Annotation.Root({
  query: Annotation<string>(),
  role: Annotation<string>(),
  location: Annotation<string | undefined>(),
  company: Annotation<string | undefined>(),
  industry: Annotation<string | undefined>(),
  limit: Annotation<number>(),
  userId: Annotation<string>(),
  accountId: Annotation<string | undefined>(),
  candidates: Annotation<OutreachCandidate[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  error: Annotation<string | undefined>(),
});

/**
 * Research Subgraph: Discovers verified professionals on LinkedIn
 */
export const createResearchSubgraph = (checkpointer?: MemorySaver) => {
  const workflow = new StateGraph(ResearchState)
    .addNode(
      "executeSearch",
      async (state) => {
        try {
          const rawQuery = state.role || state.query || "Software Engineers";
          const cleanQuery =
            rawQuery
              .replace(/find\s+(?:some\s+)?/gi, "")
              .replace(/around\s+me/gi, "")
              .replace(/around\s+\d+/gi, "")
              .replace(/send\s+them\s+.*$/gi, "")
              .replace(/send\s+connection.*$/gi, "")
              .replace(/without\s+.*$/gi, "")
              .trim() || "Students";

          let rawResults = await linkedInPeopleService.searchPeople(
            {
              role: cleanQuery,
              keywords: cleanQuery,
              location: state.location,
              company: state.company,
              industry: state.industry,
              limit: state.limit || 10,
              accountId: state.accountId,
            },
            state.accountId,
            state.userId,
          );

          if (rawResults.length === 0 && cleanQuery.includes(" ")) {
            const firstWord = cleanQuery.split(" ")[0];
            if (firstWord && firstWord.length > 2) {
              rawResults = await linkedInPeopleService.searchPeople(
                {
                  role: firstWord,
                  keywords: firstWord,
                  limit: state.limit || 10,
                  accountId: state.accountId,
                },
                state.accountId,
                state.userId,
              );
            }
          }

          const formatted: OutreachCandidate[] = rawResults.map((p) => ({
            name: p.name,
            linkedinId: p.linkedin_id,
            headline: p.designation,
            company: p.company,
            location: p.location,
            profileUrl: p.profile_url,
          }));

          if (state.userId && formatted.length > 0) {
            for (const cand of formatted) {
              const key =
                cand.linkedinId || cand.name.replace(/\s+/g, "_").toLowerCase();
              await WORKPILOTStore.put(["prospects", state.userId], key, cand);
            }
          }

          return { candidates: formatted };
        } catch (err: any) {
          return { error: err.message || "Failed to search candidates." };
        }
      },
      {
        retryPolicy: {
          maxAttempts: 3,
          backoffFactor: 2,
          jitter: true,
        },
      },
    )
    .addEdge("__start__", "executeSearch")
    .addEdge("executeSearch", "__end__");

  return workflow.compile({
    ...(checkpointer ? { checkpointer } : {}),
    store: WORKPILOTStore,
  });
};

export const BatchOutreachState = Annotation.Root({
  candidates: Annotation<OutreachCandidate[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  withNoteCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  withoutNoteCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  noteTemplate: Annotation<string | undefined>(),
  accountId: Annotation<string | undefined>(),
  userId: Annotation<string>(),
  threadId: Annotation<string>(),
  campaignType: Annotation<"DISCOVERY" | "ENGAGEMENT">(),
  skipHIL: Annotation<boolean | undefined>(),
  queue: Annotation<QueueItem[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  currentIndex: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  summary: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  isCancelled: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  interruptedDecision: Annotation<any>(),
});

/**
 * Batch Outreach Subgraph: Orchestrates queue planning and dispatches
 */
export const createBatchOutreachSubgraph = (checkpointer?: MemorySaver) => {
  const workflow = new StateGraph(BatchOutreachState)
    .addNode("planQueue", async (state) => {
      const candidates = state.candidates || [];
      const withNoteTarget =
        state.withNoteCount !== undefined && state.withNoteCount !== null
          ? state.withNoteCount
          : candidates.length;

      const encounteredDomains = new Set<string>();
      const queue: QueueItem[] = [];

      for (let idx = 0; idx < candidates.length; idx++) {
        const cand = candidates[idx]!;
        const shouldHaveNote = idx < withNoteTarget;
        let note: string | undefined = undefined;

        const candDomain = outreachBrainService.extractDomain(undefined, undefined, cand.company);

        if (shouldHaveNote) {
          const firstName = cand.name ? cand.name.split(" ")[0] : "there";
          const isDomainCollidedInBatch =
            candDomain !== "unknown-domain.com" && encounteredDomains.has(candDomain);

          if (isDomainCollidedInBatch) {
            // Outreach Brain: Domain Collision detected in batch — synthesize differentiated pitch angle
            note = `Hi ${firstName}, following your work at ${cand.company || "your team"}! Reaching out to key builders in your org to connect and discuss technical collaboration.`;
          } else if (state.noteTemplate) {
            note = state.noteTemplate
              .replace(/\{name\}/gi, cand.name || "")
              .replace(/\{firstName\}/gi, firstName || "")
              .replace(/\{company\}/gi, cand.company || "your company")
              .replace(/\{headline\}/gi, cand.headline || "your work");
          } else {
            note = `Hi ${firstName}, I came across your profile and would love to connect!`;
          }

          if (note.length > 295) {
            note = note.slice(0, 292) + "...";
          }
        }

        if (candDomain !== "unknown-domain.com") {
          encounteredDomains.add(candDomain);
        }

        queue.push({
          candidate: cand,
          withNote: shouldHaveNote,
          note,
          status: "pending",
        });
      }

      return { queue, currentIndex: 0 };
    })

    .addNode("hilReview", async (state) => {
      if (state.skipHIL) {
        return { isCancelled: false };
      }

      if (isThreadCancelled(state.threadId)) {
        return { isCancelled: true };
      }

      const queue = state.queue || [];
      let humanDecision: any = undefined;

      try {
        humanDecision = interrupt({
          action: state.campaignType === "ENGAGEMENT" ? "batch_send_messages" : "batch_connection_requests",
          total: queue.length,
          withNoteCount: queue.filter((q) => q.withNote).length,
          withoutNoteCount: queue.filter((q) => !q.withNote).length,
          candidates: queue.map((q) => ({
            name: q.candidate.name,
            headline: q.candidate.headline,
            withNote: q.withNote,
            note: q.note,
          })),
          message: state.campaignType === "ENGAGEMENT"
            ? `Confirm batch direct messages to ${queue.length} connections. Auto-proceeds in 10s.`
            : `Confirm batch connection requests to ${queue.length} professionals (${queue.filter((q) => q.withNote).length} with personalized notes, ${queue.filter((q) => !q.withNote).length} without notes). Auto-proceeds in 10s.`,
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
        return { isCancelled: true, interruptedDecision: humanDecision };
      }

      if (humanDecision?.allWithNote === false) {
        const updatedQueue = queue.map((q) => ({
          ...q,
          withNote: false,
          note: undefined,
        }));
        return {
          queue: updatedQueue,
          isCancelled: false,
          interruptedDecision: humanDecision,
        };
      }

      return { isCancelled: false, interruptedDecision: humanDecision };
    })

    .addNode(
      "dispatchCandidate",
      async (state) => {
        if (state.isCancelled || isThreadCancelled(state.threadId)) {
          const currentQueue = [...state.queue];
          for (let i = state.currentIndex; i < currentQueue.length; i++) {
            const item = currentQueue[i];
            if (item && item.status === "pending") {
              item.status = "cancelled";
              item.resultMessage = "Cancelled by user stop request.";
            }
          }
          return {
            queue: currentQueue,
            isCancelled: true,
            currentIndex: currentQueue.length,
          };
        }

        const currentQueue = [...state.queue];
        const item = currentQueue[state.currentIndex];

        if (!item) {
          return { currentIndex: state.currentIndex + 1 };
        }

        const target =
          item.candidate.linkedinId ||
          item.candidate.profileUrl ||
          item.candidate.name;

        try {
          let result;
          if (state.campaignType === "ENGAGEMENT") {
            result = await linkedInMessageService.sendMessage(
              target,
              item.withNote ? item.note || "" : "Hello!",
              state.accountId,
              state.userId,
            );
          } else {
            result = await linkedInConnectionService.sendConnectionRequest(
              target,
              item.withNote ? item.note : undefined,
              state.accountId,
              state.userId,
            );
          }

          item.status = result.success ? "sent" : "failed";
          item.resultMessage = result.message;
        } catch (err: any) {
          item.status = "failed";
          item.resultMessage = err.message || "Failed to dispatch invite.";
        }

        return {
          queue: currentQueue,
          currentIndex: state.currentIndex + 1,
        };
      },
      {
        retryPolicy: {
          maxAttempts: 2,
          backoffFactor: 2,
        },
      },
    )

    .addNode("finalize", async (state) => {
      const queue = state.queue || [];
      const sentCount = queue.filter((q) => q.status === "sent").length;
      const failedCount = queue.filter((q) => q.status === "failed").length;
      const cancelledCount = queue.filter(
        (q) => q.status === "cancelled",
      ).length;

      const withNoteSent = queue.filter(
        (q) => q.status === "sent" && q.withNote,
      ).length;
      const blankSent = queue.filter(
        (q) => q.status === "sent" && !q.withNote,
      ).length;

      let summary = `### 🚀 Multi-Step Batch Outreach Report\n\n`;
      const actionStr = state.campaignType === "ENGAGEMENT" ? "direct messages" : "connection requests";
      const blankStr = state.campaignType === "ENGAGEMENT" ? "Default Note" : "Blank Invitations (No Note)";

      summary += `**Summary**: Successfully dispatched **${sentCount}** of **${queue.length}** ${actionStr}.\n`;
      summary += `- ✍️ **With Personalized Note**: ${withNoteSent}\n`;
      summary += `- ✉️ **${blankStr}**: ${blankSent}\n`;

      if (failedCount > 0) {
        summary += `- ⚠️ **Failed / Errors**: ${failedCount}\n`;
      }
      if (cancelledCount > 0) {
        summary += `- ⏸️ **Cancelled / Stopped**: ${cancelledCount}\n`;
      }

      summary += `\n| # | Prospect Name | Headline | Strategy | Status |\n`;
      summary += `|---|---------------|----------|----------|--------|\n`;

      queue.forEach((item, idx) => {
        const statusIcon =
          item.status === "sent"
            ? "✅ Dispatched"
            : item.status === "failed"
              ? "❌ Failed"
              : "⏸️ Stopped";
        const noteBadge = item.withNote
          ? "✍️ Personalized Note"
          : (state.campaignType === "ENGAGEMENT" ? "✉️ Default Note" : "✉️ Blank (No Note)");
        const cleanHeadline = (item.candidate.headline || "Professional")
          .replace(/\|/g, "/")
          .slice(0, 45);

        summary += `| ${idx + 1} | **${item.candidate.name}** | ${cleanHeadline} | ${noteBadge} | ${statusIcon} |\n`;
      });

      if (state.isCancelled) {
        summary += `\n> ⚠️ *Execution was halted early via the Stop Agent control.*`;
      }

      return { summary };
    })

    .addEdge("__start__", "planQueue")
    .addEdge("planQueue", "hilReview")
    .addConditionalEdges("hilReview", (state) => {
      if (state.isCancelled) return "finalize";
      return "dispatchCandidate";
    })
    .addConditionalEdges("dispatchCandidate", (state) => {
      if (
        state.isCancelled ||
        state.currentIndex >= (state.queue?.length || 0)
      ) {
        return "finalize";
      }
      return "dispatchCandidate";
    })
    .addEdge("finalize", "__end__");

  return workflow.compile({
    ...(checkpointer ? { checkpointer } : {}),
    store: WORKPILOTStore,
  });
};

export interface PacedOutreachWorkflowParams {
  userId: string;
  query: string;
  role?: string | undefined;
  location?: string | undefined;
  company?: string | undefined;
  industry?: string | undefined;
  candidates?: OutreachCandidate[] | undefined;
  withNoteCount?: number | undefined;
  withoutNoteCount?: number | undefined;
  personalizedNote?: string | undefined;
  accountId?: string | undefined;
  taskId?: string | undefined;
  pacingDelaySeconds?: number | undefined;
  dailyLimitOverride?: number | undefined;
  campaignType?: "DISCOVERY" | "ENGAGEMENT" | undefined;
}

/**
 * Asynchronous Paced Outreach Campaign Runner
 * Runs autonomously in the background side-by-side with interactive chat.
 * Strictly adheres to user's dailyQuota (1–20), paces requests safely,
 * and streams real-time updates via SSE.
 */
export async function runPacedOutreachWorkflow(
  params: PacedOutreachWorkflowParams,
): Promise<{
  success: boolean;
  taskId: string;
  summary: string;
  sentCount: number;
  totalCount: number;
}> {
  const userId = params.userId || "default";

  // 1. Enforce strict daily limit configured in user settings (1–20/day)
  const userSettings = agentMemoryService.getUserSettings(userId);
  const safeDailyQuota = Math.min(
    Math.max(Number(userSettings.dailyQuota) || 10, 1),
    20,
  );

  let taskId = params.taskId;
  if (!taskId) {
    const created = taskManager.createTask({
      userId,
      type: "outreach",
      name: `Outreach Campaign: ${params.role || params.query || "Leads"}`,
      total: safeDailyQuota,
      details: {
        targetRole: params.role || params.query,
        dailyQuota: safeDailyQuota,
        sentCount: 0,
        message: `Campaign active: safe daily quota capped at ${safeDailyQuota} requests/day.`,
      },
    });
    taskId = created.task.id;
  }

  try {
    taskManager.addTaskLog(
      taskId,
      "info",
      `🔒 Daily quota locked at ${safeDailyQuota} requests/day for account safety.`,
      userId,
    );

    // Helper to stream live messages directly into chat dialogue and persist in user memory
    const broadcastChatMessage = (content: string, toolCalls?: any[]) => {
      const msg = {
        id: `agent_live_${randomUUID()}`,
        role: "assistant" as const,
        content,
        toolCalls: toolCalls || [],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      taskManager.broadcastToUser(userId, "chat_message", msg);
      agentMemoryService.recordMessage(userId, "assistant", content, toolCalls || []);
    };

    let candidates = params.candidates || [];

    // 2. Discover leads if candidates not already provided
    if (candidates.length === 0) {
      taskManager.addTaskLog(
        taskId,
        "info",
        `🔍 Searching for verified LinkedIn prospects matching: "${params.role || params.query}" (up to ${safeDailyQuota})...`,
        userId,
      );

      const researchGraph = createResearchSubgraph();
      try {
        const searchResult = await researchGraph.invoke(
          {
            role: params.role || params.query,
            location: params.location,
            company: params.company,
            industry: params.industry,
            limit: safeDailyQuota,
            userId,
            accountId: params.accountId,
          },
          {
            configurable: {
              thread_id: `task_${taskId}_research`,
            },
          },
        );

        candidates = searchResult.candidates || [];
      } catch (searchErr: any) {
        taskManager.addTaskLog(
          taskId,
          "error",
          `❌ Lead search error: ${searchErr.message}`,
          userId,
        );
      }
    }

    // Strictly limit to safeDailyQuota
    candidates = candidates.slice(0, safeDailyQuota);

    if (candidates.length === 0) {
      const noFoundMsg = `⚠️ **No verified LinkedIn profiles found matching "${params.role || params.query}".**\nPlease check your keywords or ensure your LinkedIn account is connected.`;
      broadcastChatMessage(noFoundMsg);
      taskManager.addTaskLog(
        taskId,
        "warning",
        "⚠️ No candidate profiles found matching criteria. Outreach halted.",
        userId,
      );
      taskManager.updateTask(
        taskId,
        {
          status: "completed",
          total: 0,
          current: 0,
          details: { message: "Search returned 0 candidate matches." },
        },
        userId,
      );
      return {
        success: false,
        taskId,
        summary: noFoundMsg,
        sentCount: 0,
        totalCount: 0,
      };
    }

    taskManager.updateTask(
      taskId,
      {
        total: candidates.length,
        current: 0,
      },
      userId,
    );

    taskManager.addTaskLog(
      taskId,
      "success",
      `🎯 Discovered ${candidates.length} verified prospects. Preparing paced outreach queue...`,
      userId,
    );

    // 3. Prepare queue with note policies
    const withNoteTarget =
      params.withNoteCount !== undefined
        ? params.withNoteCount
        : candidates.length;

    const queue: QueueItem[] = candidates.map((cand, idx) => {
      const shouldHaveNote = idx < withNoteTarget;
      let note: string | undefined = undefined;

      if (shouldHaveNote) {
        const firstName = cand.name ? cand.name.split(" ")[0] : "there";
        if (params.personalizedNote) {
          note = params.personalizedNote
            .replace(/\{name\}/gi, cand.name || "")
            .replace(/\{firstName\}/gi, firstName || "")
            .replace(/\{headline\}/gi, cand.headline || "your work");
        } else {
          note = `Hi ${firstName}, I came across your profile and would love to connect!`;
        }
        if (note.length > 295) note = note.slice(0, 292) + "...";
      }

      return {
        candidate: cand,
        withNote: shouldHaveNote,
        note,
        status: "pending",
      };
    });

    // Broadcast Queue Initialized card to user's chat!
    let queueTable = `### 📋 Outreach Queue Initialized (${queue.length} Prospects)\n\n`;
    queueTable += `| # | Prospect Name | Role / Headline | Strategy | Status |\n`;
    queueTable += `|---|---------------|-----------------|----------|--------|\n`;
    queue.forEach((item, idx) => {
      const headline = (item.candidate.headline || item.candidate.company || "LinkedIn Member")
        .replace(/\|/g, "/")
        .slice(0, 42);
      const strat = item.withNote ? "✍️ With Note" : "✉️ Blank (No note)";
      queueTable += `| ${idx + 1} | **${item.candidate.name}** | ${headline} | ${strat} | ⏳ Queued |\n`;
    });
    queueTable += `\n- 🔒 **Daily Quota Lock**: **${safeDailyQuota} requests/day** max.\n`;
    const basePacingSeconds =
      params.pacingDelaySeconds !== undefined
        ? params.pacingDelaySeconds
        : Number(process.env.PACING_SECONDS || 20);
    queueTable += `- **Pacing Interval**: **${basePacingSeconds}s** delay between queued dispatches.\n\n`;
    queueTable += `> ⚡ *Starting automated dispatch sequence now...*`;

    broadcastChatMessage(queueTable, [
      {
        tool: "queue_prospects",
        input: {
          total: queue.length,
          candidates: queue.map((q) => ({
            name: q.candidate.name,
            headline:
              q.candidate.headline ||
              q.candidate.company ||
              "LinkedIn Professional",
            profileUrl: q.candidate.profileUrl,
            withNote: q.withNote,
          })),
          withNoteCount: queue.filter((q) => q.withNote).length,
          withoutNoteCount: queue.filter((q) => !q.withNote).length,
        },
      },
    ]);

    // 4. Execution loop with safety pacing
    let sentCount = 0;

    for (let i = 0; i < queue.length; i++) {
      if (taskManager.isTaskCancelled(taskId, userId)) {
        taskManager.addTaskLog(
          taskId,
          "warning",
          "⏸️ Outreach campaign was halted by user stop request.",
          userId,
        );
        taskManager.updateTask(taskId, { status: "stopped" }, userId);

        const stopMsg = `⏸️ **Outreach Campaign Halted by User**\n- **Dispatched**: ${sentCount} of ${queue.length} invitations.\n- Remaining ${queue.length - sentCount} requests cancelled.`;
        broadcastChatMessage(stopMsg);

        return {
          success: false,
          taskId,
          summary: `Outreach stopped by user. Dispatched ${sentCount} of ${queue.length}.`,
          sentCount,
          totalCount: queue.length,
        };
      }

      const item = queue[i];
      if (!item) continue;

      const target =
        item.candidate.linkedinId ||
        item.candidate.profileUrl ||
        item.candidate.name;

      taskManager.updateTask(
        taskId,
        {
          current: i + 1,
          details: {
            currentCandidate: item.candidate.name,
            sentCount,
          },
        },
        userId,
      );

      taskManager.addTaskLog(
        taskId,
        "info",
        `✉️ [${i + 1}/${queue.length}] Dispatching ${params.campaignType === "ENGAGEMENT" ? "direct message" : "connection request"} to ${item.candidate.name}${item.withNote ? " (with note)" : " (blank)"}...`,
        userId,
      );

      try {
        let result;
        if (params.campaignType === "ENGAGEMENT") {
          result = await linkedInMessageService.sendMessage(
            target,
            item.withNote ? item.note || "" : "Hello!",
            params.accountId,
            userId,
          );
        } else {
          result = await linkedInConnectionService.sendConnectionRequest(
            target,
            item.withNote ? item.note : undefined,
            params.accountId,
            userId,
          );
        }

        if (result.success) {
          item.status = "sent";
          sentCount++;
          taskManager.addTaskLog(
            taskId,
            "success",
            params.campaignType === "ENGAGEMENT" 
              ? `✅ Sent direct message to ${item.candidate.name}.`
              : `✅ Sent connection request to ${item.candidate.name}.`,
            userId,
          );

          const dispatchMsg =
            (params.campaignType === "ENGAGEMENT" ? `✉️ **Direct Message Dispatched` : `✉️ **Connection Request Dispatched`) + ` [${i + 1}/${queue.length}]**\n` +
            `- **Prospect**: **${item.candidate.name}**\n` +
            `- **Headline**: ${item.candidate.headline || "LinkedIn Member"}\n` +
            `- **Strategy**: ${item.withNote ? "✍️ With Personalized Note" : "✉️ Blank Invitation (No note)"}\n` +
            `- **Status**: ✅ **Sent successfully!**\n` +
            `- **Time**: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

          broadcastChatMessage(dispatchMsg, [
            {
              tool: params.campaignType === "ENGAGEMENT" ? "send_linkedin_message" : "send_connection_request",
              input: {
                target: item.candidate.name,
                name: item.candidate.name,
                headline: item.candidate.headline || "LinkedIn Member",
                profileUrl: item.candidate.profileUrl,
                withNote: item.withNote,
                status: "sent",
              },
              output: result,
            },
          ]);
        } else {
          item.status = "failed";
          taskManager.addTaskLog(
            taskId,
            "warning",
            `⚠️ Request to ${item.candidate.name}: ${result.message || "Failed"}`,
            userId,
          );

          const failMsg =
            `⚠️ **${params.campaignType === "ENGAGEMENT" ? "Direct Message" : "Connection Request"} to ${item.candidate.name} could not be sent**\n` +
            `- **Reason**: ${result.message || "Invitation error"}\n` +
            `- **Time**: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

          broadcastChatMessage(failMsg, [
            {
              tool: params.campaignType === "ENGAGEMENT" ? "send_linkedin_message" : "send_connection_request",
              input: {
                target: item.candidate.name,
                name: item.candidate.name,
                headline: item.candidate.headline || "LinkedIn Member",
                profileUrl: item.candidate.profileUrl,
                withNote: item.withNote,
                status: "failed",
              },
              output: result,
            },
          ]);
        }
      } catch (err: any) {
        item.status = "failed";
        taskManager.addTaskLog(
          taskId,
          "error",
          `❌ Failed to connect with ${item.candidate.name}: ${err.message}`,
          userId,
        );

        const errorMsg =
          `❌ **Error dispatching invite to ${item.candidate.name}**\n` +
          `- **Error Details**: ${err.message}\n` +
          `- **Time**: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

        broadcastChatMessage(errorMsg);
      }

      taskManager.updateTask(taskId, { details: { sentCount } }, userId);

      // Pacing delay between requests (if not last item)
      if (i < queue.length - 1) {
        const jitter = Math.floor(Math.random() * 5); // 0-4s jitter
        const delay = basePacingSeconds + jitter;
        const nextCandidate = queue[i + 1]?.candidate;
        const nextDispatchTime = new Date(
          Date.now() + delay * 1000,
        ).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        taskManager.updateTask(
          taskId,
          {
            details: {
              nextScheduledAt: nextDispatchTime,
              currentCandidate: nextCandidate?.name,
            },
          },
          userId,
        );

        taskManager.addTaskLog(
          taskId,
          "pacing",
          `⏳ Safety pacing delay: waiting ${delay}s before next request to ${nextCandidate?.name || "next prospect"} (next at ${nextDispatchTime})...`,
          userId,
        );

        const delayMsg =
          `⏳ **Safety Pacing Delay Active (${delay}s Cooldown)**\n` +
          `- **Activity Pacing**: Pausing for **${delay} seconds** between queued requests.\n` +
          `- **Next in Queue**: **${nextCandidate?.name || "Next Prospect"}**\n` +
          `- **Scheduled Dispatch**: **${nextDispatchTime}**`;

        broadcastChatMessage(delayMsg, [
          {
            tool: "pacing_cooldown",
            input: {
              delaySeconds: delay,
              nextCandidate: nextCandidate?.name,
              nextDispatchTime,
            },
          },
        ]);

        // Sleep in 1-second chunks to immediately respond to cancel/stop requests
        for (let s = 0; s < delay; s++) {
          if (taskManager.isTaskCancelled(taskId, userId)) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    taskManager.updateTask(
      taskId,
      {
        status: "completed",
        current: queue.length,
        details: {
          sentCount,
          nextScheduledAt: "",
          message: `Campaign complete. Sent ${sentCount} of ${queue.length} invites.`,
        },
      },
      userId,
    );

    taskManager.addTaskLog(
      taskId,
      "success",
      `🏁 Campaign completed successfully. Dispatched ${sentCount} connection requests.`,
      userId,
    );

    const completionMsg =
      `### 🏁 Autonomous Outreach Campaign Finished!\n\n` +
      `- **Total Dispatched**: **${sentCount} of ${queue.length}** connection requests sent successfully.\n` +
      `- **Strategy Breakdown**: ${queue.filter((q) => q.status === "sent" && q.withNote).length} with notes, ${queue.filter((q) => q.status === "sent" && !q.withNote).length} blank.\n` +
      `- **Daily Quota Status**: **${sentCount} / ${safeDailyQuota}** requests dispatched today.\n` +
      `- **Pacing Controls**: Requests were queued according to the configured workspace limits.\n\n` +
      `> ⚡ *The supervisor agent is ready for your next command.*`;

    broadcastChatMessage(completionMsg);

    return {
      success: true,
      taskId,
      summary: `Successfully completed outreach campaign: dispatched ${sentCount} of ${queue.length} connection requests.`,
      sentCount,
      totalCount: queue.length,
    };
  } catch (err: any) {
    taskManager.addTaskLog(
      taskId,
      "error",
      `❌ Campaign execution error: ${err.message}`,
      userId,
    );
    taskManager.updateTask(
      taskId,
      {
        status: "failed",
        details: { error: err.message },
      },
      userId,
    );
    return {
      success: false,
      taskId,
      summary: err.message || "Failed to execute outreach campaign.",
      sentCount: 0,
      totalCount: 0,
    };
  }
}
