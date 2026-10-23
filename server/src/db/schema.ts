import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  boolean,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("USER").notNull(), // 'USER' | 'ADMIN'
  sessionVersion: integer("session_version").default(0).notNull(),
  timezone: text("timezone").default("UTC"),
  geminiApiKey: text("gemini_api_key"),
  geminiModel: text("gemini_model"),
  plan: text("plan").default("STARTER").notNull(),
  subscriptionStatus: text("subscription_status").default("FREE").notNull(),
  billingCycle: text("billing_cycle"),
  razorpaySubscriptionId: text("razorpay_subscription_id").unique(),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  emailVerifiedAt: timestamp("email_verified_at"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const linkedinAccounts = pgTable("linkedin_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  unipileAccountId: text("unipile_account_id").unique(),
  linkedinName: text("linkedin_name"),
  headline: text("headline"),
  linkedinEmail: text("linkedin_email"),
  isConnected: boolean("is_connected").default(false).notNull(),
  healthStatus: text("health_status").default("DISCONNECTED").notNull(), // 'HEALTHY', 'RECONNECT_REQUIRED', 'DISCONNECTED'
  automationStatus: text("automation_status").default("PAUSED").notNull(), // 'RUNNING', 'PAUSED'
  dailyConnectionsLimit: integer("daily_connections_limit")
    .default(25)
    .notNull(),
  dailyMessagesLimit: integer("daily_messages_limit").default(50).notNull(),
  authMethod: text("auth_method"), // 'CREDENTIALS' | 'COOKIE' | 'HOSTED'
  encryptedCredentials: text("encrypted_credentials"), // AES-encrypted payload for auto-reconnect
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  linkedinId: text("linkedin_id").notNull(),
  profileUrl: text("profile_url"),
  company: text("company"),
  designation: text("designation"),
  location: text("location"),
  industry: text("industry"),
  // Funnel stages: 'NEW', 'CONTACTED', 'CONNECTED', 'CONVERSATION', 'INTERESTED', 'HOT_LEAD', 'WON', 'LOST'
  status: text("status").default("NEW").notNull(),
  conversationMode: text("conversation_mode").default("AUTOMATIC").notNull(), // 'AUTOMATIC', 'SUGGESTED', 'MANUAL'
  isHotLead: boolean("is_hot_lead").default(false).notNull(),
  hotLeadReason: text("hot_lead_reason"),
  matchScore: integer("match_score"),
  matchReason: text("match_reason"),
  optedOut: boolean("opted_out").default(false).notNull(),
  optedOutAt: timestamp("opted_out_at"),
  optOutReason: text("opt_out_reason"),
  draftReply: text("draft_reply"),
  draftReplyReason: text("draft_reply_reason"),
  draftReplyAt: timestamp("draft_reply_at"),
  automatedReplyCount: integer("automated_reply_count").default(0).notNull(),
  lastInboundMessageId: text("last_inbound_message_id"),
  lastOutboundMessageId: text("last_outbound_message_id"),
  lastAutomatedReplyAt: timestamp("last_automated_reply_at"),
  connectionSentAt: timestamp("connection_sent_at"),
  connectedAt: timestamp("connected_at"),
  lastMessageSentAt: timestamp("last_message_sent_at"),
  lastMessageReceivedAt: timestamp("last_message_received_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dailyAgentSettings = pgTable("daily_agent_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  dailyAgentEnabled: boolean("daily_agent_enabled").default(false).notNull(),
  dailyAgentMode: text("daily_agent_mode").default("AUTONOMOUS").notNull(), // 'DISCOVERY_ONLY' | 'ASSISTED' | 'AUTONOMOUS'
  targetRoles: jsonb("target_roles").$type<string[]>().default([]).notNull(),
  targetIndustries: jsonb("target_industries").$type<string[]>().default([]).notNull(),
  targetLocations: jsonb("target_locations").$type<string[]>().default([]).notNull(),
  networkingGoal: text("networking_goal"),
  autoConnectionRequests: boolean("auto_connection_requests").default(true).notNull(),
  autoFollowUps: boolean("auto_follow_ups").default(true).notNull(),
  autoMessageReplies: boolean("auto_message_replies").default(true).notNull(),
  replyMode: text("reply_mode").default("AUTO").notNull(), // 'OFF' | 'DRAFT' | 'AUTO'
  preferredDailyStartTime: text("preferred_daily_start_time").default("04:00").notNull(),
  timezone: text("timezone").default("UTC").notNull(),
  dailyQuota: integer("daily_quota").default(10).notNull(),
  personality: text("personality"),
  companyKnowledge: text("company_knowledge"),
  faq: text("faq"),
  autoNewConnectionMessage: boolean("auto_new_connection_message").default(true).notNull(),
  newConnectionMessageTemplate: text("new_connection_message_template"),
  nextDailyRunAt: timestamp("next_daily_run_at"),
  lastDailyRunAt: timestamp("last_daily_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dailyAgentRuns = pgTable("daily_agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  runKey: text("run_key").unique(), // e.g. daily:{userId}:{localDate} for atomic idempotency
  scheduledFor: timestamp("scheduled_for"),
  status: text("status").default("RUNNING").notNull(), // 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'SKIPPED' | 'FAILED' | 'DAILY_LIMIT_REACHED'
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  remainingCapacityAtStart: integer("remaining_capacity_at_start").default(10).notNull(),
  prospectsDiscovered: integer("prospects_discovered").default(0).notNull(),
  prospectsQualified: integer("prospects_qualified").default(0).notNull(),
  prospectsReviewed: integer("prospects_reviewed").default(0).notNull(),
  strongMatchesFound: integer("strong_matches_found").default(0).notNull(),
  connectionRequestsSent: integer("connection_requests_sent").default(0).notNull(),
  connectionRequestsFailed: integer("connection_requests_failed").default(0).notNull(),
  followUpsSent: integer("follow_ups_sent").default(0).notNull(),
  repliesHandled: integer("replies_handled").default(0).notNull(),
  skippedCount: integer("skipped_count").default(0).notNull(),
  errorsCount: integer("errors_count").default(0).notNull(),
  summary: text("summary"),
  logDetails: jsonb("log_details").$type<any[]>().default([]),
  errorMessage: text("error_message"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: text("event_id").notNull().unique(), // e.g. message_id or generated event identifier
  eventType: text("event_type").notNull(), // 'message_received' | 'new_relation' | 'account_status'
  accountId: text("account_id"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  payload: jsonb("payload").notNull(),
  status: text("status").default("PROCESSED").notNull(), // 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED'
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  errorMessage: text("error_message"),
});

export const messageAgentJobs = pgTable("message_agent_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accountId: text("account_id").notNull(),
  chatId: text("chat_id").notNull(),
  messageId: text("message_id").notNull().unique(), // idempotency key
  status: text("status").default("PENDING").notNull(), // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'NEEDS_USER'
  attemptCount: integer("attempt_count").default(0).notNull(),
  payload: jsonb("payload").notNull(),
  suggestedReply: text("suggested_reply"),
  sentReply: text("sent_reply"),
  reasoning: text("reasoning"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "cascade" })
    .notNull(),
  conversationId: text("conversation_id").notNull(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  direction: text("direction").notNull(), // 'INBOUND', 'OUTBOUND'
  content: text("content").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const actionQueue = pgTable("action_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  actionType: text("action_type").notNull(), // 'CONNECT', 'MESSAGE', 'VIEW', 'REACT', 'COMMENT'
  payload: jsonb("payload").notNull(),
  status: text("status").default("QUEUED").notNull(), // 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED', 'SKIPPED'
  scheduledFor: timestamp("scheduled_for").notNull(),
  executedAt: timestamp("executed_at"),
  errorMessage: text("error_message"),
  attempts: integer("attempts").default(0).notNull(),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(), // e.g. 'unipile_api_key', 'unipile_dsn', 'unipile_cost_per_account'
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

export const billingEvents = pgTable("billing_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  type: text("type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentMessages = pgTable("agent_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls"), // Array<{ tool: string; input: any; output?: any }>
  isSummary: boolean("is_summary").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type LinkedinAccount = typeof linkedinAccounts.$inferSelect;
export type NewLinkedinAccount = typeof linkedinAccounts.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type DailyAgentSetting = typeof dailyAgentSettings.$inferSelect;
export type NewDailyAgentSetting = typeof dailyAgentSettings.$inferInsert;
export type DailyAgentRun = typeof dailyAgentRuns.$inferSelect;
export type NewDailyAgentRun = typeof dailyAgentRuns.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type MessageRecord = typeof messages.$inferSelect;
export type NewMessageRecord = typeof messages.$inferInsert;
export type QueuedAction = typeof actionQueue.$inferSelect;
export type NewQueuedAction = typeof actionQueue.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type NewAgentMessage = typeof agentMessages.$inferInsert;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type AuthToken = typeof authTokens.$inferSelect;
