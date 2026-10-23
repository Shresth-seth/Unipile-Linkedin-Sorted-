import { linkedInMessageService } from "../services/linkedin/message.service.js";
import { linkedInProfileService } from "../services/linkedin/profile.service.js";
import { agentMemoryService } from "../services/agent/agent-memory.service.js";
import { getGeminiChatModelForUser } from "./WORKPILOT-connect-agent.js";
import { taskManager } from "./WORKPILOT-task-manager.js";
import { HumanMessage } from "@langchain/core/messages";
import { db } from "../db/index.js";
import { linkedinAccounts } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export interface AutoReplySubagentParams {
  userId: string;
  accountId?: string;
  taskId?: string;
  maxConversations?: number;
}

/**
 * Autonomous Inbox Triage & Auto-Reply Subagent
 * Analyzes inbound LinkedIn messages and automatically replies if the contact
 * is asking about work/collaboration or asking for help.
 */
export async function runAutoReplySubagent(
  params: AutoReplySubagentParams,
): Promise<{ success: boolean; repliedCount: number; message: string }> {
  const userId = params.userId || "default";
  let accountId = params.accountId;

  if (!accountId && userId !== "default") {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (isUuid) {
      const [acc] = await db
        .select({ unipileAccountId: linkedinAccounts.unipileAccountId })
        .from(linkedinAccounts)
        .where(and(eq(linkedinAccounts.userId, userId), eq(linkedinAccounts.isConnected, true)))
        .limit(1);
      accountId = acc?.unipileAccountId || undefined;
    }
  }

  let taskId = params.taskId;

  if (!taskId) {
    const created = taskManager.createTask({
      userId,
      type: "auto_reply",
      name: "Inbox Auto-Reply Subagent",
      total: 10,
      details: {
        repliedCount: 0,
        message: "Triage active: monitoring inbox for work and help requests.",
      },
    });
    taskId = created.task.id;
  }

  try {
    taskManager.addTaskLog(
      taskId,
      "info",
      "📥 Scanning recent LinkedIn messaging threads for inbound work or help inquiries...",
      userId,
    );

    // 1. Fetch conversations from Unipile
    const conversations = await linkedInMessageService.getConversations(
      accountId,
      params.maxConversations || 15,
    );

    if (!conversations || conversations.length === 0) {
      taskManager.addTaskLog(
        taskId,
        "info",
        "📭 No active messaging threads found to triage at this moment.",
        userId,
      );
      taskManager.updateTask(
        taskId,
        {
          status: "completed",
          details: { message: "Scan finished: No active threads." },
        },
        userId,
      );
      return {
        success: true,
        repliedCount: 0,
        message: "Scan complete. No active conversation threads found.",
      };
    }

    taskManager.updateTask(
      taskId,
      {
        total: conversations.length,
        current: 0,
      },
      userId,
    );

    // 2. Load user personality and LinkedIn ground-truth identity
    const userSettings = agentMemoryService.getUserSettings(userId);
    const personality = (userSettings.personality || "").trim();
    const profileContext =
      await linkedInProfileService.getUserProfileGroundTruth(userId);

    const model = await getGeminiChatModelForUser(userId, { temperature: 0.3 });
    let repliedCount = 0;

    for (let i = 0; i < conversations.length; i++) {
      if (taskManager.isTaskCancelled(taskId, userId)) {
        taskManager.addTaskLog(
          taskId,
          "warning",
          "⏸️ Auto-reply subagent execution halted by user stop request.",
          userId,
        );
        taskManager.updateTask(taskId, { status: "stopped" }, userId);
        return {
          success: false,
          repliedCount,
          message: "Auto-reply subagent halted by user.",
        };
      }

      const conv = conversations[i];
      const contactName = conv.name || conv.attendee_name || "Contact";
      const chatId = conv.id;

      taskManager.updateTask(
        taskId,
        {
          current: i + 1,
          details: {
            currentCandidate: contactName,
            repliedCount,
          },
        },
        userId,
      );

      // Fetch recent messages for thread
      const messages = await linkedInMessageService.getMessages(chatId);
      if (!messages || messages.length === 0) continue;

      // Find the latest message
      const latestMsg = messages[messages.length - 1];
      if (!latestMsg || latestMsg.sender === "Me" || !latestMsg.message.trim()) {
        // Already responded to or sender was me
        continue;
      }

      taskManager.addTaskLog(
        taskId,
        "info",
        `🔍 Evaluating message from ${contactName}: "${latestMsg.message.slice(0, 50)}..."`,
        userId,
      );

      // Format thread history for full conversational context
      const historyFormatted = messages
        .slice(-6)
        .map((m) => `${m.isSender ? "User" : contactName}: "${m.message}"`)
        .join("\n");
      const hasPriorMessages = messages.length > 1;

      // LLM Evaluation & Draft
      const triagePrompt = `You are the WORKPILOT Inbox Triage & Auto-Reply Subagent.
YOUR GOAL: Analyze an incoming LinkedIn message and determine if the sender is:
1. Inquiring about work, projects, freelancing, contracts, services, hiring, or collaboration.
2. Asking for help, technical assistance, guidance, or mentorship.

SENDER NAME: ${contactName}
CONVERSATION HISTORY (OLDEST TO NEWEST):
${historyFormatted}

LATEST INBOUND MESSAGE FROM ${contactName}:
"""
${latestMsg.message}
"""

YOUR USER'S VERIFIED IDENTITY (GROUND TRUTH):
${profileContext}

YOUR USER'S CONFIGURED PERSONALITY:
${personality}

EVALUATION INSTRUCTIONS:
- If the message DOES NOT inquire about work, collaboration, or asking for help (e.g. spam, cold pitch selling crypto/SEO, generic greeting without intent, automated outreach), respond with:
{"shouldReply": false, "reason": "Not a work or help request"}

- If the message DOES inquire about work, business collaboration, or asking for help:
  1. ONGOING CONVERSATION CONTINUITY: If there is prior conversation history (${hasPriorMessages ? "YES, active ongoing thread" : "NO, first message"}), NEVER start your message with "Hey [Name]", "Hi [Name]", or any greeting! Jump directly into answering or continuing the thought like a real human texting back and forth.
  2. LISTEN & UNDERSTAND: Directly address what ${contactName} actually asked or said using the chat context. If they asked a specific question, answer it directly.
  3. TALK LIKE A REAL HUMAN: Write in the first person ("I", "my") like a real colleague. NEVER use robotic openers ("Thanks for reaching out!", "Hope all is well") or AI buzzwords ("synergy", "game-changer", "leverage", "delve").
  4. KEEP IT COMPACT: Strictly 1-2 concise, punchy sentences. Zero corporate fluff or boilerplate sign-offs.

Respond in JSON format:
{
  "shouldReply": true,
  "category": "WORK" or "HELP",
  "replyText": "Your drafted 1-2 sentence human reply here"
}

Respond ONLY with valid JSON.`;

      try {
        const response = await model.invoke([new HumanMessage(triagePrompt)]);
        const rawContent =
          typeof response.content === "string"
            ? response.content
            : Array.isArray(response.content)
              ? response.content.map((c: any) => (typeof c === "string" ? c : c.text || "")).join("")
              : JSON.stringify(response.content);

        let parsed: any = null;
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            const cleanJson = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
            parsed = JSON.parse(cleanJson);
          }
        } else {
          const cleanJson = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
          parsed = JSON.parse(cleanJson);
        }

        if (parsed?.shouldReply && parsed?.replyText) {
          let replyText = parsed.replyText.trim();
          if (hasPriorMessages) {
            const regreetPattern = /^(?:Hey|Hi|Hello|Dear)(?:\s+[A-Za-z]+){0,2}[,!:\s-]+\s*/i;
            if (regreetPattern.test(replyText)) {
              const stripped = replyText.replace(regreetPattern, "").trim();
              if (stripped.length > 0) {
                replyText = stripped.charAt(0).toUpperCase() + stripped.slice(1);
              }
            }
          }
          taskManager.addTaskLog(
            taskId,
            "info",
            `💡 Detected ${parsed.category || "WORK"} request from ${contactName}. Sending auto-reply...`,
            userId,
          );

          // Attempt direct chat reply first, fallback to sendMessage
          let sendResult = await linkedInMessageService.sendChatReply(
            chatId,
            replyText,
            accountId,
          );

          if (!sendResult.success) {
            sendResult = await linkedInMessageService.sendMessage(
              chatId,
              replyText,
              accountId,
            );
          }

          if (sendResult.success) {
            repliedCount++;
            taskManager.addTaskLog(
              taskId,
              "success",
              `✅ Sent reply to ${contactName}: "${replyText.slice(0, 60)}..."`,
              userId,
            );
            taskManager.updateTask(
              taskId,
              { details: { repliedCount } },
              userId,
            );
          } else {
            taskManager.addTaskLog(
              taskId,
              "warning",
              `⚠️ Failed to send reply to ${contactName}: ${sendResult.message}`,
              userId,
            );
          }
        }
      } catch (err: any) {
        console.warn(`[INBOX SUBAGENT] Error analyzing message for ${contactName}:`, err.message);
      }
    }

    taskManager.updateTask(
      taskId,
      {
        status: "completed",
        current: conversations.length,
        details: {
          repliedCount,
          message: `Inbox scan complete. Processed ${conversations.length} threads, auto-replied to ${repliedCount} contacts.`,
        },
      },
      userId,
    );

    taskManager.addTaskLog(
      taskId,
      "success",
      `🏁 Inbox triage completed: Auto-replied to ${repliedCount} relevant inquiries.`,
      userId,
    );

    return {
      success: true,
      repliedCount,
      message: `Inbox triage completed: Auto-replied to ${repliedCount} inquiries.`,
    };
  } catch (error: any) {
    taskManager.addTaskLog(
      taskId,
      "error",
      `❌ Error during inbox auto-reply execution: ${error.message}`,
      userId,
    );
    taskManager.updateTask(
      taskId,
      {
        status: "failed",
        details: { error: error.message },
      },
      userId,
    );
    return {
      success: false,
      repliedCount: 0,
      message: error.message || "Failed to execute auto-reply subagent.",
    };
  }
}
