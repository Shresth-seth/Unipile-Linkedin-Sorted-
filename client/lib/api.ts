import AxiosInstance from "@/config/AxiosInstance";

// -------------------------------------------------------------
// 1. Auth API
// -------------------------------------------------------------
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: "ADMIN" | "USER" | string;
  plan?: "STARTER" | "PRO" | "TEAM" | string;
  subscriptionStatus?: string;
  createdAt?: string;
  linkedinAccounts?: Array<{
    id: string;
    linkedinName: string | null;
    linkedinEmail: string | null;
    isConnected: boolean;
    healthStatus: string;
    automationStatus: string;
  }>;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  requiresEmailVerification?: boolean;
  user?: AuthUser;
}

export const authApi = {
  signup: async (payload: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const res = await AxiosInstance.post<AuthResponse>(
      "/api/auth/signup",
      payload,
    );
    return res.data;
  },

  login: async (payload: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const res = await AxiosInstance.post<AuthResponse>(
      "/api/auth/login",
      payload,
    );
    return res.data;
  },

  getMe: async (): Promise<{ success: boolean; user: AuthUser }> => {
    const res = await AxiosInstance.get<{ success: boolean; user: AuthUser }>("/api/auth/me", {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
    return res.data;
  },

  logout: async (): Promise<{ success: boolean; message: string }> => {
    const res = await AxiosInstance.post<{ success: boolean; message: string }>(
      "/api/auth/logout",
    );
    return res.data;
  },

  deleteAccount: async (): Promise<{ success: boolean; message: string }> => {
    const res = await AxiosInstance.delete<{
      success: boolean;
      message: string;
    }>("/api/auth/account");
    return res.data;
  },
  verifyEmail: async (token: string) => {
    const res = await AxiosInstance.post("/api/auth/verify-email", { token });
    return res.data as { success: boolean; message: string };
  },
  forgotPassword: async (email: string) => {
    const res = await AxiosInstance.post("/api/auth/forgot-password", { email });
    return res.data as { success: boolean; message: string };
  },
  resendVerification: async (email: string) => {
    const res = await AxiosInstance.post("/api/auth/resend-verification", { email });
    return res.data as { success: boolean; message: string };
  },
  resetPassword: async (token: string, password: string) => {
    const res = await AxiosInstance.post("/api/auth/reset-password", { token, password });
    return res.data as { success: boolean; message: string };
  },
};

export interface SubscriptionSummary {
  plan: string;
  status: string;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export const billingApi = {
  getSubscription: async (): Promise<{ success: boolean; subscription: SubscriptionSummary }> => {
    const res = await AxiosInstance.get("/api/billing/subscription");
    return res.data;
  },
  createCheckout: async (plan: "PRO", cycle: "monthly" | "yearly") => {
    const res = await AxiosInstance.post("/api/billing/checkout", { plan, cycle });
    return res.data as { success: boolean; checkoutUrl?: string; message?: string };
  },
  cancel: async () => {
    const res = await AxiosInstance.post("/api/billing/cancel");
    return res.data as { success: boolean; message: string };
  },
};

export const contactApi = {
  submit: async (payload: { name: string; email: string; company: string; topic: string; message: string; website?: string }) => {
    const res = await AxiosInstance.post("/api/contact", payload);
    return res.data as { success: boolean; message: string };
  },
};

// -------------------------------------------------------------
// 2. LinkedIn API
// -------------------------------------------------------------
export interface ConnectLinkResponse {
  success: boolean;
  url?: string;
  message?: string;
}

export interface AccountStatusData {
  id?: string;
  name?: string;
  email?: string;
  hasAccount?: boolean;
  isConnected: boolean;
  healthStatus: "HEALTHY" | "RECONNECT_REQUIRED" | "DISCONNECTED" | string;
  automationStatus: "RUNNING" | "PAUSED" | string;
  reconnectionRequired?: boolean;
  dailyLimits?: {
    connections: { limit: number; usedToday: number; remaining: number };
    messages: { limit: number; usedToday: number; remaining: number };
  };
}

export interface ConnectResult {
  success: boolean;
  checkpoint: boolean;
  accountId: string;
  checkpointType?: "2FA" | "OTP" | "IN_APP_VALIDATION" | string;
  message: string;
  account?: any;
}

export interface CheckpointStatusResult {
  success: boolean;
  isConnected: boolean;
  status: string;
  account?: any;
}

export const linkedinApi = {
  getConnectLink: async (
    redirectUrl?: string,
  ): Promise<ConnectLinkResponse> => {
    const res = await AxiosInstance.get<ConnectLinkResponse>(
      "/api/linkedin/connect",
      {
        params: redirectUrl ? { redirect: redirectUrl } : undefined,
      },
    );
    return res.data;
  },

  connectWithCredentials: async (payload: {
    username: string;
    password: string;
    country?: string;
    userAgent?: string;
  }): Promise<ConnectResult> => {
    const res = await AxiosInstance.post<ConnectResult>(
      "/api/linkedin/connect/credentials",
      payload,
    );
    return res.data;
  },

  connectWithCookie: async (payload: {
    li_at: string;
    li_a?: string;
    userAgent?: string;
    country?: string;
  }): Promise<ConnectResult> => {
    const res = await AxiosInstance.post<ConnectResult>(
      "/api/linkedin/connect/cookie",
      payload,
    );
    return res.data;
  },

  solveCheckpoint: async (payload: {
    accountId: string;
    code: string;
  }): Promise<ConnectResult> => {
    const res = await AxiosInstance.post<ConnectResult>(
      "/api/linkedin/checkpoint/solve",
      payload,
    );
    return res.data;
  },

  resendCheckpoint: async (payload: {
    accountId: string;
  }): Promise<{ success: boolean; message: string; data?: any }> => {
    const res = await AxiosInstance.post<{
      success: boolean;
      message: string;
      data?: any;
    }>("/api/linkedin/checkpoint/resend", payload);
    return res.data;
  },

  getCheckpointStatus: async (
    accountId: string,
  ): Promise<CheckpointStatusResult> => {
    const res = await AxiosInstance.get<CheckpointStatusResult>(
      `/api/linkedin/checkpoint/status/${accountId}`,
    );
    return res.data;
  },

  getStatus: async (): Promise<{
    success: boolean;
    data: AccountStatusData;
  }> => {
    const res = await AxiosInstance.get<{
      success: boolean;
      data: AccountStatusData;
    }>("/api/linkedin/status");
    return res.data;
  },

  getConnectedAccount: async (
    accountId?: string,
  ): Promise<{ success: boolean; data: any }> => {
    const res = await AxiosInstance.get<{ success: boolean; data: any }>(
      "/api/linkedin/account",
      {
        params: accountId ? { accountId } : undefined,
      },
    );
    return res.data;
  },

  getProfile: async (
    identifier: string,
    accountId?: string,
  ): Promise<{ success: boolean; data: any }> => {
    const res = await AxiosInstance.get<{ success: boolean; data: any }>(
      `/api/linkedin/profile/${encodeURIComponent(identifier)}`,
      {
        params: accountId ? { accountId } : undefined,
      },
    );
    return res.data;
  },

  getOwnProfile: async (): Promise<{
    success: boolean;
    connected?: boolean;
    data?: {
      name: string;
      headline: string;
      about: string;
      location: string;
      industry: string;
      avatar?: string;
      publicIdentifier?: string;
      connectionsCount: number;
      skillsCount: number;
      experienceCount: number;
      educationCount?: number;
      raw?: any;
      accountId?: string;
    };
    message?: string;
  }> => {
    const res = await AxiosInstance.get("/api/linkedin/me");
    return res.data;
  },

  syncAccount: async (payload?: {
    accountId?: string;
    name?: string;
    email?: string;
  }): Promise<{ success: boolean; data: any }> => {
    const res = await AxiosInstance.post<{ success: boolean; data: any }>(
      "/api/linkedin/sync",
      payload || {},
    );
    return res.data;
  },

  disconnect: async (): Promise<{ success: boolean; message: string }> => {
    const res = await AxiosInstance.post<{ success: boolean; message: string }>(
      "/api/linkedin/disconnect",
    );
    return res.data;
  },

  deleteSavedCookiesAndLogin: async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    const res = await AxiosInstance.delete<{
      success: boolean;
      message: string;
    }>("/api/linkedin/login");
    return res.data;
  },

  purgeCookies: async (): Promise<{ success: boolean; message: string }> => {
    const res = await AxiosInstance.post<{ success: boolean; message: string }>(
      "/api/linkedin/purge-cookies",
    );
    return res.data;
  },

  searchPeople: async (params: {
    query?: string;
    keywords?: string;
    role?: string;
    location?: string;
    company?: string;
    industry?: string;
    url?: string;
    limit?: number;
    accountId?: string;
    cursor?: string;
  }) => {
    const res = await AxiosInstance.get("/api/linkedin/search", { params });
    return res.data;
  },

  sendConnection: async (payload: {
    providerId?: string;
    provider_id?: string;
    identifier?: string;
    publicIdentifier?: string;
    url?: string;
    person?: any;
    message?: string;
    note?: string;
    accountId?: string;
  }) => {
    const res = await AxiosInstance.post("/api/linkedin/connection", payload);
    return res.data;
  },

  sendMessage: async (payload: {
    recipientId?: string;
    chatId?: string;
    message: string;
    accountId?: string;
  }) => {
    const res = await AxiosInstance.post("/api/linkedin/message", payload);
    return res.data;
  },

  sendRichMessage: async (payload: {
    recipientId: string;
    messageText?: string;
    voiceNoteUrl?: string;
    attachments?: Array<{
      url?: string;
      name?: string;
      type?: string;
      data?: string;
    }>;
  }) => {
    const res = await AxiosInstance.post(
      "/api/linkedin/messages/rich",
      payload,
    );
    return res.data;
  },

  getSentInvitations: async () => {
    const res = await AxiosInstance.get("/api/linkedin/invitations/sent");
    return res.data;
  },

  cancelSentInvitation: async (invitationId: string) => {
    const res = await AxiosInstance.delete(
      `/api/linkedin/invitations/sent/${invitationId}`,
    );
    return res.data;
  },

  getReceivedInvitations: async () => {
    const res = await AxiosInstance.get("/api/linkedin/invitations/received");
    return res.data;
  },

  acceptInvitation: async (invitationId: string) => {
    const res = await AxiosInstance.post(
      `/api/linkedin/invitations/${invitationId}/accept`,
    );
    return res.data;
  },

  declineInvitation: async (invitationId: string) => {
    const res = await AxiosInstance.post(
      `/api/linkedin/invitations/${invitationId}/decline`,
    );
    return res.data;
  },

  listConversations: async (limit = 20) => {
    const res = await AxiosInstance.get("/api/linkedin/conversations", {
      params: { limit },
    });
    return res.data;
  },

  syncInbox: async (
    limit = 30,
  ): Promise<{
    success: boolean;
    syncedChatsCount?: number;
    syncedMessagesCount?: number;
    message?: string;
  }> => {
    const res = await AxiosInstance.post("/api/linkedin/conversations/sync", {
      limit,
    });
    return res.data;
  },

  getConversationMessages: async (conversationId: string) => {
    const res = await AxiosInstance.get(
      `/api/linkedin/conversations/${conversationId}/messages`,
    );
    return res.data;
  },

  markConversationRead: async (
    conversationId: string,
    unread: boolean = false,
  ) => {
    const res = await AxiosInstance.patch(
      `/api/linkedin/conversations/${conversationId}/read`,
      { unread },
    );
    return res.data;
  },

  getPosts: async (
    limit = 20,
  ): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      socialId: string;
      text: string;
      shareUrl?: string | null;
      impressions: number;
      reactions: number;
      comments: number;
      reposts: number;
      date?: string | null;
      createdAt: string;
    }>;
  }> => {
    const res = await AxiosInstance.get("/api/linkedin/posts", {
      params: { limit },
    });
    return res.data;
  },

  createPost: async (payload: { content: string; attachments?: any[] }) => {
    const res = await AxiosInstance.post("/api/linkedin/posts", payload);
    return res.data;
  },

  deletePost: async (postId: string) => {
    const res = await AxiosInstance.delete(`/api/linkedin/posts/${postId}`);
    return res.data;
  },

  searchCompanies: async (keywords: string, limit = 10) => {
    const res = await AxiosInstance.get("/api/linkedin/companies/search", {
      params: { keywords, limit },
    });
    return res.data;
  },

  getCompany: async (identifier: string) => {
    const res = await AxiosInstance.get(
      `/api/linkedin/companies/${encodeURIComponent(identifier)}`,
    );
    return res.data;
  },

  searchJobs: async (params: {
    keywords?: string;
    location?: string;
    limit?: number;
  }) => {
    const res = await AxiosInstance.get("/api/linkedin/jobs/search", {
      params,
    });
    return res.data;
  },

  getJob: async (jobId: string) => {
    const res = await AxiosInstance.get(
      `/api/linkedin/jobs/${encodeURIComponent(jobId)}`,
    );
    return res.data;
  },
};

// -------------------------------------------------------------
// 3. Dashboard, Analytics & Health API
// -------------------------------------------------------------
export interface FunnelAnalytics {
  totalLeads: number;
  connectionsSent: number;
  connectionsAccepted: number;
  acceptanceRate: number;
  totalReplies: number;
  replyRate: number;
  activeConversations: number;
  hotLeads: number;
  hotLeadConversionRate: number;
  meetingsBooked: number;
  dealsWon: number;
  stageBreakdown: Record<string, number>;
}

export interface ContactRecord {
  id: string;
  userId: string;
  name: string;
  linkedinId: string;
  profileUrl?: string | null;
  company?: string | null;
  designation?: string | null;
  location?: string | null;
  industry?: string | null;
  status: string;
  conversationMode: string;
  isHotLead: boolean;
  hotLeadReason?: string | null;
  draftReply?: string | null;
  draftReplyReason?: string | null;
  createdAt: string;
}

export const dashboardApi = {
  getFunnel: async (): Promise<{ success: boolean; data: FunnelAnalytics }> => {
    const res = await AxiosInstance.get<{
      success: boolean;
      data: FunnelAnalytics;
    }>("/api/dashboard/funnel");
    return res.data;
  },

  getAccountHealth: async (): Promise<{
    success: boolean;
    data: AccountStatusData;
  }> => {
    const res = await AxiosInstance.get<{
      success: boolean;
      data: AccountStatusData;
    }>("/api/dashboard/account-health");
    return res.data;
  },

  emergencyPause: async (
    reason?: string,
  ): Promise<{ success: boolean; message: string }> => {
    const res = await AxiosInstance.post<{ success: boolean; message: string }>(
      "/api/dashboard/emergency-pause",
      {
        reason: reason || "User triggered manual emergency freeze",
      },
    );
    return res.data;
  },

  resume: async (): Promise<{ success: boolean; message: string }> => {
    const res = await AxiosInstance.post<{ success: boolean; message: string }>(
      "/api/dashboard/resume",
    );
    return res.data;
  },

  getContacts: async (
    stage?: string,
    limit: number = 50,
  ): Promise<{ success: boolean; data: ContactRecord[] }> => {
    const res = await AxiosInstance.get<{
      success: boolean;
      data: ContactRecord[];
    }>("/api/dashboard/contacts", {
      params: {
        stage: stage && stage !== "All" ? stage : undefined,
        limit,
      },
    });
    return res.data;
  },

  updateContactStage: async (
    contactId: string,
    stage: string,
  ): Promise<{ success: boolean; data: any }> => {
    const res = await AxiosInstance.patch(
      `/api/dashboard/contacts/${contactId}/stage`,
      {
        stage,
      },
    );
    return res.data;
  },
};

// -------------------------------------------------------------
// 4. Conversation & Inbox API
// -------------------------------------------------------------
export interface MessageItem {
  id: string;
  userId: string;
  contactId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  sentAt: string;
}

export const conversationApi = {
  getMessages: async (
    contactId: string,
  ): Promise<{ success: boolean; contact: any; messages: MessageItem[] }> => {
    const res = await AxiosInstance.get(
      `/api/conversations/${contactId}/messages`,
    );
    return res.data;
  },

  takeover: async (
    contactId: string,
  ): Promise<{ success: boolean; message: string; data: any }> => {
    const res = await AxiosInstance.post(
      `/api/conversations/${contactId}/takeover`,
    );
    return res.data;
  },

  setPilotMode: async (
    contactId: string,
    mode: "AUTOMATIC" | "MANUAL" | "SUGGESTED",
  ): Promise<{ success: boolean; message: string; data?: any }> => {
    const res = await AxiosInstance.post<{
      success: boolean;
      message: string;
      data?: any;
    }>(`/api/conversations/${contactId}/pilot-mode`, { mode });
    return res.data;
  },

  generateAiReply: async (payload: {
    contactId?: string;
    chatId?: string;
    contactName?: string;
    contactRole?: string;
    contactCompany?: string;
    history?: Array<{ sender: string; text: string }>;
    lastMessage?: string;
    instruction?: string;
  }): Promise<{
    success: boolean;
    suggestedReply: string;
    intent?: string;
    rationale?: string;
    thinkingSteps?: string[];
    confidenceScore?: number;
    domainIntelligence?: {
      hasCollision: boolean;
      collisionType: string;
      normalizedDomain: string;
      details: string;
      suggestedAction: string;
      differentiatedAngleSuggestion?: string;
    };
  }> => {
    const res = await AxiosInstance.post("/api/conversations/generate-reply", payload);
    return res.data;
  },

  chatWithCopilot: async (payload: {
    message: string;
    contactName?: string;
    contactRole?: string;
    contactCompany?: string;
    history?: Array<{ sender: string; text: string }>;
    currentDraft?: string;
  }): Promise<{
    success: boolean;
    reply: string;
    thinkingSteps: string[];
    suggestedActions: string[];
    rationale?: string;
    domainIntelligence?: {
      hasCollision: boolean;
      collisionType: string;
      normalizedDomain: string;
      details: string;
    };
  }> => {
    const res = await AxiosInstance.post("/api/conversations/copilot-chat", payload);
    return res.data;
  },

  checkOutreachCollision: async (payload: {
    targetName: string;
    targetCompany?: string;
    targetEmail?: string;
    targetWebsite?: string;
    linkedinId?: string;
    proposedMessage?: string;
  }): Promise<{
    success: boolean;
    data: {
      hasCollision: boolean;
      collisionType: string;
      normalizedDomain: string;
      details: string;
      previousOutreach?: any;
      suggestedAction: string;
      differentiatedAngleSuggestion?: string;
    };
  }> => {
    const res = await AxiosInstance.post("/api/conversations/outreach-brain/check", payload);
    return res.data;
  },

  differentiateOutreach: async (payload: {
    recipientName: string;
    recipientRole?: string;
    company: string;
    domain: string;
    colleagueName?: string;
    originalPitch?: string;
  }): Promise<{
    success: boolean;
    data: {
      differentiatedMessage: string;
      thinkingTrace: string[];
    };
  }> => {
    const res = await AxiosInstance.post("/api/conversations/outreach-brain/differentiate", payload);
    return res.data;
  },

  reply: async (
    contactId: string,
    text: string,
  ): Promise<{ success: boolean; message: string; data: any }> => {
    const res = await AxiosInstance.post(
      `/api/conversations/${contactId}/reply`,
      {
        text,
        message: text,
      },
    );
    return res.data;
  },

  getChatbotStatus: async (): Promise<{
    success: boolean;
    data: {
      isEnabled: boolean;
      replyMode: string;
      autoMessageReplies: boolean;
      personality: string;
      companyKnowledge: string;
      faq: string;
      networkingGoal: string;
    };
  }> => {
    const res = await AxiosInstance.get("/api/conversations/chatbot/status");
    return res.data;
  },

  toggleChatbot: async (payload: {
    enabled?: boolean;
    replyMode?: "AUTO" | "DRAFT" | "OFF";
    personality?: string;
    companyKnowledge?: string;
    faq?: string;
    networkingGoal?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      isEnabled: boolean;
      replyMode: string;
      settings: any;
    };
  }> => {
    const res = await AxiosInstance.post("/api/conversations/chatbot/toggle", payload);
    return res.data;
  },
};

// -------------------------------------------------------------
// 5. Campaigns & Queue Automation API
// -------------------------------------------------------------
export const campaignApi = {
  discoverProspects: async (params: {
    role?: string;
    location?: string;
    industry?: string;
    limit?: number;
    autoEnqueue?: boolean;
    note?: string;
  }): Promise<{
    success: boolean;
    count: number;
    enqueuedCount?: number;
    data: any[];
  }> => {
    const res = await AxiosInstance.post("/api/prospects/discover", params);
    return res.data;
  },

  warmup: async (
    contactId: string,
    options?: {
      postDelayMinutes?: number;
      commentDelayMinutes?: number;
      connectDelayMinutes?: number;
    },
  ): Promise<{ success: boolean; message: string; data: any }> => {
    const res = await AxiosInstance.post("/api/engagement/warmup", {
      contactId,
      ...options,
    });
    return res.data;
  },

  processDueActions: async (): Promise<{
    success: boolean;
    processed?: number;
    message?: string;
  }> => {
    const res = await AxiosInstance.post("/api/process");
    return res.data;
  },

  getStats: async (): Promise<{ success: boolean; data: any }> => {
    const res = await AxiosInstance.get("/api/stats");
    return res.data;
  },
};

// -------------------------------------------------------------
// 5. Admin API (Authenticated + ADMIN Role Only)
// -------------------------------------------------------------
export interface AdminOverviewData {
  metrics: {
    totalUsers: number;
    totalConnectedAccounts: number;
    totalDisconnectedAccounts: number;
    estimatedMonthlyBillUSD: number;
    costPerAccountUSD: number;
  };
  healthBreakdown: {
    healthy: number;
    reconnectRequired: number;
    challenged: number;
    disconnected: number;
  };
  automationBreakdown: {
    running: number;
    paused: number;
  };
  recentActivity: Array<{
    userName: string;
    userEmail: string;
    linkedinName: string;
    isConnected: boolean;
    healthStatus: string;
    timestamp: string;
  }>;
}

export interface AdminLinkedinAccount {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  unipileAccountId: string | null;
  linkedinName: string | null;
  linkedinEmail: string | null;
  isConnected: boolean;
  healthStatus:
    | "HEALTHY"
    | "RECONNECT_REQUIRED"
    | "CHALLENGED"
    | "DISCONNECTED"
    | string;
  automationStatus: "RUNNING" | "PAUSED" | string;
  dailyConnectionsLimit: number;
  dailyMessagesLimit: number;
  createdAt: string;
  updatedAt: string;
  billableThisMonth: boolean;
}

export interface AdminAccountsResponse {
  success: boolean;
  data: {
    accounts: AdminLinkedinAccount[];
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER" | string;
  connectedAccountsCount: number;
  createdAt: string;
}

export interface AdminUsersResponse {
  success: boolean;
  data: {
    users: AdminUser[];
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

export interface UnipileSettingsData {
  dsn: string;
  apiKeyMasked: string;
  isConfigured: boolean;
  source: "DATABASE" | "ENV_VARIABLE" | string;
  estimatedCostPerAccount: number;
}

export interface GeminiSettingsData {
  apiKeyMasked: string;
  model: string;
  isConfigured: boolean;
  source: "DATABASE" | "ENV_VARIABLE" | string;
}

export interface AdminQueueStatsData {
  totalActions: number;
  statusBreakdown: {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    paused: number;
    skipped: number;
  };
  today: {
    completed: number;
    failed: number;
  };
  recentFailed: Array<{
    id: string;
    userId: string;
    actionType: string;
    status: string;
    errorMessage: string | null;
    attempts: number;
    createdAt: string;
  }>;
}

export const adminApi = {
  getOverview: async (): Promise<{
    success: boolean;
    data: AdminOverviewData;
  }> => {
    const res = await AxiosInstance.get<{
      success: boolean;
      data: AdminOverviewData;
    }>("/api/admin/overview");
    return res.data;
  },

  getLinkedinAccounts: async (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminAccountsResponse> => {
    const res = await AxiosInstance.get<AdminAccountsResponse>(
      "/api/admin/linkedin-accounts",
      { params },
    );
    return res.data;
  },

  disconnectAccount: async (
    id: string,
  ): Promise<{ success: boolean; message: string }> => {
    const res = await AxiosInstance.post<{ success: boolean; message: string }>(
      `/api/admin/linkedin-accounts/${id}/disconnect`,
    );
    return res.data;
  },

  checkAccountHealth: async (
    id: string,
  ): Promise<{ success: boolean; data: any; message?: string }> => {
    const res = await AxiosInstance.post<{
      success: boolean;
      data: any;
      message?: string;
    }>(`/api/admin/linkedin-accounts/${id}/check-health`);
    return res.data;
  },

  getUsers: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminUsersResponse> => {
    const res = await AxiosInstance.get<AdminUsersResponse>(
      "/api/admin/users",
      { params },
    );
    return res.data;
  },

  getUnipileSettings: async (): Promise<{
    success: boolean;
    data: UnipileSettingsData;
  }> => {
    const res = await AxiosInstance.get<{
      success: boolean;
      data: UnipileSettingsData;
    }>("/api/admin/settings/unipile");
    return res.data;
  },

  updateUnipileSettings: async (payload: {
    dsn?: string;
    apiKey?: string;
    estimatedCostPerAccount?: number;
  }): Promise<{ success: boolean; message: string }> => {
    const res = await AxiosInstance.post<{ success: boolean; message: string }>(
      "/api/admin/settings/unipile",
      payload,
    );
    return res.data;
  },

  testUnipileConnection: async (payload?: {
    dsn?: string;
    apiKey?: string;
  }): Promise<{
    success: boolean;
    message: string;
    unipileStatus?: number;
    remoteAccountCount?: number;
    error?: string;
  }> => {
    const res = await AxiosInstance.post<{
      success: boolean;
      message: string;
      unipileStatus?: number;
      remoteAccountCount?: number;
      error?: string;
    }>("/api/admin/settings/unipile/test", payload || {});
    return res.data;
  },

  getGeminiSettings: async (): Promise<{
    success: boolean;
    data: GeminiSettingsData;
  }> => {
    const res = await AxiosInstance.get<{
      success: boolean;
      data: GeminiSettingsData;
    }>("/api/admin/settings/gemini");
    return res.data;
  },

  updateGeminiSettings: async (payload: {
    apiKey?: string;
    model?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const res = await AxiosInstance.post<{ success: boolean; message: string }>(
      "/api/admin/settings/gemini",
      payload,
    );
    return res.data;
  },

  testGeminiConnection: async (payload?: {
    apiKey?: string;
    model?: string;
  }): Promise<{
    success: boolean;
    message: string;
    model?: string;
    error?: string;
  }> => {
    const res = await AxiosInstance.post<{
      success: boolean;
      message: string;
      model?: string;
      error?: string;
    }>("/api/admin/settings/gemini/test", payload || {});
    return res.data;
  },

  runDailyAgent: async (
    userId: string,
  ): Promise<{ success: boolean; data: any; message?: string }> => {
    const res = await AxiosInstance.post(`/api/admin/daily-agent/run/${userId}`);
    return res.data;
  },

  getAutomationHealth: async (): Promise<{
    success: boolean;
    data: any;
  }> => {
    const res = await AxiosInstance.get("/api/admin/automation/health");
    return res.data;
  },

  getQueueStats: async (): Promise<{
    success: boolean;
    data: AdminQueueStatsData;
  }> => {
    const res = await AxiosInstance.get<{
      success: boolean;
      data: AdminQueueStatsData;
    }>("/api/admin/queue/stats");
    return res.data;
  },
};

// -------------------------------------------------------------
// 6. WORKPILOT Autonomous AI Agent API (LangChain & LangGraph)
// -------------------------------------------------------------
export interface AgentChatResult {
  reply: string;
  toolCallsExecuted: Array<{ tool: string; input: any; output?: any }>;
  interrupted?: boolean;
  interrupt?: any;
  threadId?: string;
}

export interface AutonomousCampaignResult {
  success: boolean;
  summary: string;
  discovered: number;
  enqueued: number;
  candidates: Array<{
    name: string;
    headline?: string;
    company?: string;
    location?: string;
  }>;
}

export const agentApi = {
  chat: async (params: {
    messages?: Array<{ role: string; content: string }>;
    threadId?: string;
    modelName?: string;
    apiKey?: string;
    resume?: any;
    agentSettings?: any;
  }): Promise<{ success: boolean; data: AgentChatResult }> => {
    const res = await AxiosInstance.post<{
      success: boolean;
      data: AgentChatResult;
    }>("/api/agent/chat", params);
    return res.data;
  },

  stop: async (
    threadId?: string,
  ): Promise<{
    success: boolean;
    stopped: boolean;
    message: string;
  }> => {
    const res = await AxiosInstance.post<{
      success: boolean;
      stopped: boolean;
      message: string;
    }>("/api/agent/stop", { threadId });
    return res.data;
  },

  launchAutonomousWorkflow: async (params: {
    goal: string;
    targetRole?: string;
    location?: string;
    industry?: string;
    limit?: number;
    personalizedNote?: string;
    campaignType?: "DISCOVERY" | "ENGAGEMENT";
  }): Promise<{ success: boolean; data: AutonomousCampaignResult }> => {
    const res = await AxiosInstance.post<{
      success: boolean;
      data: AutonomousCampaignResult;
    }>("/api/agent/campaign", params);
    return res.data;
  },

  getTools: async (): Promise<{
    success: boolean;
    count: number;
    tools: Array<{ name: string; description: string; schema?: any }>;
  }> => {
    const res = await AxiosInstance.get("/api/agent/tools");
    return res.data;
  },

  getMessages: async (): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      userId: string;
      role: "user" | "assistant" | "system";
      content: string;
      toolCalls?: Array<{ tool: string; input: any; output?: any }>;
      isSummary: boolean;
      createdAt: string;
    }>;
  }> => {
    const res = await AxiosInstance.get("/api/agent/messages");
    return res.data;
  },

  clearMessages: async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    const res = await AxiosInstance.delete("/api/agent/messages");
    return res.data;
  },

  getSettings: async (): Promise<{
    success: boolean;
    data: any;
  }> => {
    const res = await AxiosInstance.get("/api/agent/settings");
    return res.data;
  },

  saveSettings: async (
    settings: any,
  ): Promise<{
    success: boolean;
    data: any;
    message?: string;
  }> => {
    const res = await AxiosInstance.post("/api/agent/settings", settings);
    return res.data;
  },

  getTasks: async (): Promise<{
    success: boolean;
    data: Array<AgentTask>;
  }> => {
    const res = await AxiosInstance.get("/api/agent/tasks");
    return res.data;
  },

  stopTask: async (
    taskId: string,
  ): Promise<{
    success: boolean;
    stopped: boolean;
    message: string;
  }> => {
    const res = await AxiosInstance.post(`/api/agent/tasks/${taskId}/stop`);
    return res.data;
  },
};

export interface TaskLogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "pacing";
  message: string;
}

export interface AgentTask {
  id: string;
  userId: string;
  type: "outreach" | "auto_reply" | "general";
  name: string;
  status: "running" | "paused" | "completed" | "stopped" | "failed";
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  details: {
    targetRole?: string;
    dailyQuota?: number;
    currentCandidate?: string;
    nextScheduledAt?: string;
    sentCount?: number;
    repliedCount?: number;
    message?: string;
    error?: string;
  };
  logs: TaskLogEntry[];
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// 10. User Settings & AI BYOK API
// -------------------------------------------------------------
export const settingsApi = {
  getGeminiConfig: async (): Promise<{
    success: boolean;
    data: {
      isCustom: boolean;
      maskedKey: string | null;
      model: string;
      source: "USER_CUSTOM" | "SYSTEM_DEFAULT";
      defaultModel: string;
    };
  }> => {
    const res = await AxiosInstance.get("/api/settings/gemini");
    return res.data;
  },

  updateGeminiConfig: async (payload: {
    apiKey?: string;
    model?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      isCustom: boolean;
      maskedKey: string | null;
      model: string;
      source: string;
    };
  }> => {
    const res = await AxiosInstance.post("/api/settings/gemini", payload);
    return res.data;
  },

  testGeminiConfig: async (payload: {
    apiKey?: string;
    model?: string;
  }): Promise<{
    success: boolean;
    message: string;
    model: string;
  }> => {
    const res = await AxiosInstance.post("/api/settings/gemini/test", payload);
    return res.data;
  },

  deleteGeminiConfig: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      isCustom: boolean;
      maskedKey: null;
      model: string;
      source: string;
    };
  }> => {
    const res = await AxiosInstance.delete("/api/settings/gemini");
    return res.data;
  },
};
