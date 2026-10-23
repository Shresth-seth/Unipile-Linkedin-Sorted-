export interface Prospect {
  id: string;
  name: string;
  role: string;
  company: string;
  match: string;
  status: "Connected" | "Pending" | "Replied" | "Qualified" | "Interested";
  nextAction: string;
  avatarUrl?: string;
  notes?: string;
}

export interface ActivityItem {
  id: string;
  time: string;
  type: "start" | "qualify" | "connect" | "message" | "reply";
  text: string;
  highlight?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: "Running" | "Paused" | "Draft" | "Completed";
  currentDay: number;
  totalDays: number;
  discovered: number;
  qualified: number;
  connected: number;
  replies: number;
  nextCheckTime: string;
  targetQuery: string;
  audience: string;
  personalization: string;
}

export interface Metrics {
  prospects: number;
  prospectsChange: string;
  connections: number;
  connectionsRate: string;
  messages: number;
  messagesDetail: string;
  replies: number;
  repliesRate: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: "ADMIN" | "USER" | string;
  plan: string;
  company?: string;
  createdAt: string;
}

export const INITIAL_USER: User = {
  id: "",
  name: "",
  email: "",
  role: "USER",
  plan: "Starter",
  company: "",
  createdAt: new Date().toISOString(),
};

export const INITIAL_METRICS: Metrics = {
  prospects: 0,
  prospectsChange: "0 total",
  connections: 0,
  connectionsRate: "0% acceptance",
  messages: 0,
  messagesDetail: "0 sent",
  replies: 0,
  repliesRate: "0% response rate",
};

export const INITIAL_CAMPAIGN: Campaign | null = null;

export const INITIAL_PROSPECTS: Prospect[] = [];

export const INITIAL_ACTIVITIES: ActivityItem[] = [];
