import { Response } from "express";
import { randomUUID } from "crypto";

export type TaskType = "outreach" | "auto_reply" | "general";
export type TaskStatus = "running" | "paused" | "completed" | "stopped" | "failed";

export interface TaskLogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "pacing";
  message: string;
}

export interface AgentTask {
  id: string;
  userId: string;
  type: TaskType;
  name: string;
  status: TaskStatus;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  details: {
    targetRole?: string | undefined;
    dailyQuota?: number | undefined;
    currentCandidate?: string | undefined;
    nextScheduledAt?: string | undefined;
    sentCount?: number | undefined;
    repliedCount?: number | undefined;
    message?: string | undefined;
    error?: string | undefined;
  };
  logs: TaskLogEntry[];
  createdAt: string;
  updatedAt: string;
}

interface InternalTask extends AgentTask {
  abortController: AbortController;
  isCancelled: boolean;
}

class WORKPILOTTaskManager {
  // Map of userId -> Map of taskId -> InternalTask
  private userTasks = new Map<string, Map<string, InternalTask>>();

  // Map of userId -> Set of active Express SSE Response streams
  private sseClients = new Map<string, Set<Response>>();

  // Global heartbeat timer to keep SSE streams alive through reverse proxies (AWS EC2, Nginx, ALB)
  public heartbeatInterval: NodeJS.Timeout;

  constructor() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15000); // 15s heartbeat
  }

  /**
   * Register a new SSE client for real-time streaming
   */
  public registerSseClient(userId: string, res: Response): void {
    const key = userId || "default";
    let clients = this.sseClients.get(key);
    if (!clients) {
      clients = new Set<Response>();
      this.sseClients.set(key, clients);
    }
    clients.add(res);

    // Immediately send current active tasks snapshot on connect
    const tasks = this.getUserTasks(key);
    this.sendSseEvent(res, "initial_state", {
      tasks,
      connectedAt: new Date().toISOString(),
    });

    res.on("close", () => {
      this.removeSseClient(key, res);
    });
  }

  /**
   * Remove an SSE client on disconnect
   */
  public removeSseClient(userId: string, res: Response): void {
    const key = userId || "default";
    const clients = this.sseClients.get(key);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        this.sseClients.delete(key);
      }
    }
  }

  /**
   * Send heartbeat to all connected SSE clients
   */
  private sendHeartbeat(): void {
    for (const [, clients] of this.sseClients.entries()) {
      for (const client of clients) {
        try {
          client.write(": keep-alive\n\n");
        } catch {
          // Client might be closed
        }
      }
    }
  }

  /**
   * Send formatted SSE event to a single client
   */
  private sendSseEvent(res: Response, event: string, data: any): void {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Stream error handled on client disconnect
    }
  }

  /**
   * Broadcast SSE event to all connected clients for a user
   */
  public broadcastToUser(userId: string, event: string, data: any): void {
    const key = userId || "default";
    const clients = this.sseClients.get(key);
    if (!clients || clients.size === 0) return;

    for (const res of clients) {
      this.sendSseEvent(res, event, data);
    }
  }

  /**
   * Check if an outreach campaign is actively running for this user.
   * Used to lock the dailyQuota in settings while active!
   */
  public isOutreachActive(userId: string): boolean {
    const key = userId || "default";
    const tasksMap = this.userTasks.get(key);
    if (!tasksMap) return false;

    for (const task of tasksMap.values()) {
      if (task.type === "outreach" && task.status === "running") {
        return true;
      }
    }
    return false;
  }

  /**
   * Create and register a new background task
   */
  public createTask(params: {
    userId: string;
    type: TaskType;
    name: string;
    total: number;
    details?: Partial<AgentTask["details"]>;
  }): { task: AgentTask; abortController: AbortController } {
    const key = params.userId || "default";
    let tasksMap = this.userTasks.get(key);
    if (!tasksMap) {
      tasksMap = new Map<string, InternalTask>();
      this.userTasks.set(key, tasksMap);
    }

    const abortController = new AbortController();
    const taskId = `task_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const internalTask: InternalTask = {
      id: taskId,
      userId: key,
      type: params.type,
      name: params.name,
      status: "running",
      progress: {
        current: 0,
        total: Math.max(params.total, 1),
        percentage: 0,
      },
      details: {
        sentCount: 0,
        repliedCount: 0,
        ...params.details,
      },
      logs: [
        {
          id: randomUUID(),
          timestamp: now,
          type: "info",
          message: `🚀 ${params.name} initiated.`,
        },
      ],
      createdAt: now,
      updatedAt: now,
      abortController,
      isCancelled: false,
    };

    tasksMap.set(taskId, internalTask);

    // Broadcast creation
    this.broadcastToUser(key, "task_created", this.sanitizeTask(internalTask));

    return { task: this.sanitizeTask(internalTask), abortController };
  }

  /**
   * Update task state and progress
   */
  public updateTask(
    taskId: string,
    updates: {
      status?: TaskStatus;
      current?: number;
      total?: number;
      details?: Partial<AgentTask["details"]>;
    },
    userId?: string,
  ): AgentTask | null {
    const target = this.findInternalTask(taskId, userId);
    if (!target) return null;

    if (updates.status) target.status = updates.status;
    if (updates.total !== undefined) {
      target.progress.total = Math.max(updates.total, 1);
    }
    if (updates.current !== undefined) {
      target.progress.current = updates.current;
      target.progress.percentage = Math.min(
        100,
        Math.round((target.progress.current / target.progress.total) * 100),
      );
    }
    if (updates.details) {
      target.details = { ...target.details, ...updates.details };
    }
    target.updatedAt = new Date().toISOString();

    const sanitized = this.sanitizeTask(target);
    this.broadcastToUser(target.userId, "task_updated", sanitized);
    return sanitized;
  }

  /**
   * Append a log entry to a task and broadcast
   */
  public addTaskLog(
    taskId: string,
    type: TaskLogEntry["type"],
    message: string,
    userId?: string,
  ): void {
    const target = this.findInternalTask(taskId, userId);
    if (!target) return;

    const entry: TaskLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      message,
    };

    target.logs.push(entry);
    // Keep bounded to last 100 logs per task
    if (target.logs.length > 100) {
      target.logs.shift();
    }
    target.updatedAt = entry.timestamp;

    this.broadcastToUser(target.userId, "task_log", {
      taskId,
      log: entry,
    });
  }

  /**
   * Stop / Cancel a specific task
   */
  public stopTask(taskId: string, userId?: string): boolean {
    const target = this.findInternalTask(taskId, userId);
    if (!target) return false;

    if (target.status === "completed" || target.status === "stopped") {
      return true;
    }

    target.isCancelled = true;
    target.status = "stopped";
    target.updatedAt = new Date().toISOString();

    try {
      target.abortController.abort("Task stopped by user request.");
    } catch {
      // ignore
    }

    this.addTaskLog(taskId, "warning", "⏸️ Subagent was stopped by user.");
    this.broadcastToUser(target.userId, "task_updated", this.sanitizeTask(target));
    return true;
  }

  /**
   * Stop all running tasks for a user
   */
  public stopAllUserTasks(userId: string): number {
    const key = userId || "default";
    const tasksMap = this.userTasks.get(key);
    if (!tasksMap) return 0;

    let stoppedCount = 0;
    for (const task of tasksMap.values()) {
      if (task.status === "running") {
        this.stopTask(task.id, key);
        stoppedCount++;
      }
    }
    return stoppedCount;
  }

  /**
   * Get all tasks for a specific user
   */
  public getUserTasks(userId: string): AgentTask[] {
    const key = userId || "default";
    const tasksMap = this.userTasks.get(key);
    if (!tasksMap) return [];

    return Array.from(tasksMap.values())
      .map((t) => this.sanitizeTask(t))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  /**
   * Check if a task has been cancelled
   */
  public isTaskCancelled(taskId: string, userId?: string): boolean {
    const target = this.findInternalTask(taskId, userId);
    if (!target) return false;
    return target.isCancelled || target.abortController.signal.aborted;
  }

  private findInternalTask(
    taskId: string,
    userId?: string,
  ): InternalTask | undefined {
    if (userId) {
      return this.userTasks.get(userId)?.get(taskId);
    }
    for (const tasksMap of this.userTasks.values()) {
      const task = tasksMap.get(taskId);
      if (task) return task;
    }
    return undefined;
  }

  private sanitizeTask(task: InternalTask): AgentTask {
    return {
      id: task.id,
      userId: task.userId,
      type: task.type,
      name: task.name,
      status: task.status,
      progress: { ...task.progress },
      details: { ...task.details },
      logs: [...task.logs],
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}

export const taskManager = new WORKPILOTTaskManager();
