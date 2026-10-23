import { MemorySaver } from "@langchain/langgraph";
import { randomUUID } from "node:crypto";

export interface AgentMessageItem {
  id: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: Array<{ tool: string; input: any; output?: any }> | null;
  isSummary: boolean;
  createdAt: string;
}

export interface UserAgentSettings {
  personality: string;
  dailyQuota: number; // 1 to 20
}


/**
 * AgentMemoryService
 * 
 * Implements user-isolated short-term memory strictly adhering to:
 * https://docs.langchain.com/oss/javascript/langchain/short-term-memory
 * 
 * - Memory is purely short-term (in-memory, thread-level persistence).
 * - NOT saved as long-term memory in the database.
 * - Each user gets their own dedicated MemorySaver instance, ensuring 100% isolation.
 * - State is preserved across multiple conversation turns within the user's session.
 */
export class AgentMemoryService {
  // User-scoped checkpointers: each user gets an isolated MemorySaver instance
  private userCheckpointers = new Map<string, MemorySaver>();

  // In-memory short-term message log for active user session & UI hydration
  private userSessionMessages = new Map<string, AgentMessageItem[]>();

  // User-scoped customizable personality and agent settings
  private userSettings = new Map<string, UserAgentSettings>();

  // Maximum short-term messages to retain in active session window
  private readonly MAX_SESSION_MESSAGES = 50;

  /**
   * Get or create the dedicated LangGraph MemorySaver checkpointer for a specific user.
   * This guarantees user A and user B never share memory state.
   */
  getUserCheckpointer(userId: string): MemorySaver {
    const key = userId || "default";
    let checkpointer = this.userCheckpointers.get(key);
    if (!checkpointer) {
      checkpointer = new MemorySaver();
      this.userCheckpointers.set(key, checkpointer);
    }
    return checkpointer;
  }

  /**
   * Formats a user-namespaced thread identifier.
   */
  getUserThreadId(userId: string, threadId?: string): string {
    const key = userId || "default";
    if (!threadId || threadId === "default" || threadId.startsWith("thread_")) {
      return `user_${key}_thread_main`;
    }
    return `user_${key}_thread_${threadId}`;
  }

  /**
   * Records a message in the active short-term session memory (in-memory only).
   */
  recordMessage(
    userId: string,
    role: "user" | "assistant" | "system",
    content: string,
    toolCalls?: Array<{ tool: string; input: any; output?: any }>,
    isSummary: boolean = false,
  ): AgentMessageItem {
    const key = userId || "default";
    let list = this.userSessionMessages.get(key);
    if (!list) {
      list = [];
      this.userSessionMessages.set(key, list);
    }

    const item: AgentMessageItem = {
      id: randomUUID(),
      userId: key,
      role,
      content,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : null,
      isSummary,
      createdAt: new Date().toISOString(),
    };

    list.push(item);

    // Keep bounded within short-term window
    if (list.length > this.MAX_SESSION_MESSAGES) {
      list.splice(0, list.length - this.MAX_SESSION_MESSAGES);
    }

    return item;
  }

  /**
   * Backward-compatible alias for recordMessage (purely short-term in-memory).
   */
  async saveMessage(
    userId: string,
    role: "user" | "assistant" | "system",
    content: string,
    toolCalls?: Array<{ tool: string; input: any; output?: any }>,
    isSummary: boolean = false,
  ): Promise<AgentMessageItem> {
    return this.recordMessage(userId, role, content, toolCalls, isSummary);
  }

  /**
   * Get short-term message history for a specific user session.
   */
  async getHistory(userId: string): Promise<AgentMessageItem[]> {
    const key = userId || "default";
    return [...(this.userSessionMessages.get(key) || [])];
  }

  /**
   * Clear short-term memory for a specific user.
   * Completely resets the user's MemorySaver checkpointer and active session history,
   * without affecting any other user.
   */
  async clearHistory(userId: string): Promise<void> {
    const key = userId || "default";
    this.userCheckpointers.delete(key);
    this.userSessionMessages.delete(key);
    console.log(`🧹 [AGENT MEMORY] Short-term memory cleared for user ${key}.`);
  }

  /**
   * Retrieves the current agent settings and personality options for a specific user.
   */
  getUserSettings(userId: string): UserAgentSettings {
    const key = userId || "default";
    const existing = this.userSettings.get(key);
    if (existing) return { ...existing };

    return {
      personality:
        "Talk like an authentic human peer texting on LinkedIn. Actively listen and directly address what the other person actually said in 1-2 punchy, compact sentences. Zero AI fluff, no buzzwords, no corporate boilerplate.",
      dailyQuota: 10, // Default 10/day, selectable 1 to 20
    };
  }

  /**
   * Saves and updates the customizable personality and daily request limit for a specific user.
   * Enforces a strict daily connection limit between 1 and 20 per day.
   */
  saveUserSettings(
    userId: string,
    settings: Partial<UserAgentSettings>,
  ): UserAgentSettings {
    const key = userId || "default";
    const current = this.getUserSettings(key);

    let quota =
      settings.dailyQuota !== undefined
        ? Number(settings.dailyQuota)
        : current.dailyQuota;

    if (isNaN(quota) || quota < 1) quota = 1;
    if (quota > 20) quota = 20; // Hard max limit set to 20

    const personality =
      settings.personality !== undefined && typeof settings.personality === "string"
        ? settings.personality.trim()
        : current.personality;

    const updated: UserAgentSettings = {
      personality: personality || current.personality,
      dailyQuota: quota,
    };

    this.userSettings.set(key, updated);
    console.log(`⚙️ [AGENT MEMORY] Updated settings for user ${key}:`, {
      dailyQuota: updated.dailyQuota,
      personalityPreview: updated.personality.slice(0, 60) + "...",
    });

    return updated;
  }
}

export const agentMemoryService = new AgentMemoryService();

/**
 * No-op retained for backwards compatibility with server startup hooks.
 */
export async function initAgentMessagesTable(): Promise<void> {
  // Pure short-term memory mode: PostgreSQL agent_messages table is not used.
}
