export type DailyAgentMode = "DISCOVERY_ONLY" | "ASSISTED" | "AUTONOMOUS";
export type DailyReplyMode = "OFF" | "DRAFT" | "AUTO";
export type DailyRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "SKIPPED"
  | "FAILED"
  | "DAILY_LIMIT_REACHED";

export interface DailyAgentConfig {
  userId: string;
  dailyAgentEnabled: boolean;
  dailyAgentMode: DailyAgentMode;
  targetRoles: string[];
  targetIndustries: string[];
  targetLocations: string[];
  networkingGoal?: string | undefined;
  autoConnectionRequests: boolean;
  autoFollowUps: boolean;
  autoMessageReplies: boolean;
  replyMode: DailyReplyMode;
  preferredDailyStartTime: string; // "04:00"
  timezone: string; // "UTC", "Asia/Kolkata", "America/New_York", etc.
  dailyQuota: number; // 1 to 20, default 10
  personality?: string | undefined;
  companyKnowledge?: string | undefined;
  faq?: string | undefined;
  autoNewConnectionMessage?: boolean;
  newConnectionMessageTemplate?: string | undefined;
  nextDailyRunAt?: Date | null | undefined;
  lastDailyRunAt?: Date | null | undefined;
}

export interface ProspectCandidate {
  name: string;
  linkedinId: string;
  profileUrl?: string | undefined;
  company?: string | undefined;
  designation?: string | undefined;
  location?: string | undefined;
  industry?: string | undefined;
}

export interface ProspectMatchEvaluation {
  candidate: ProspectCandidate;
  matchScore: number; // 0 - 100
  reason: string;
  isStrongMatch: boolean;
  suggestedNote?: string | undefined;
}

export interface DailyRunSummary {
  runId: string;
  userId: string;
  runKey?: string | undefined;
  scheduledFor?: Date | null | undefined;
  status: DailyRunStatus;
  startedAt: Date;
  completedAt: Date;
  remainingCapacityAtStart?: number | undefined;
  prospectsDiscovered?: number | undefined;
  prospectsQualified?: number | undefined;
  prospectsReviewed: number;
  strongMatchesFound: number;
  connectionRequestsSent: number;
  connectionRequestsFailed?: number | undefined;
  followUpsSent: number;
  repliesHandled: number;
  skippedCount: number;
  errorsCount: number;
  summary: string;
  logDetails: Array<{ timestamp: string; level: "info" | "warn" | "error"; message: string }>;
  nextDailyRunAt?: Date | null | undefined;
  error?: string | undefined;
}
