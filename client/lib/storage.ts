import {
  User,
  Campaign,
  Prospect,
  ActivityItem,
  Metrics,
  INITIAL_USER,
  INITIAL_CAMPAIGN,
  INITIAL_METRICS,
  INITIAL_PROSPECTS,
  INITIAL_ACTIVITIES,
} from "./mock-data";

const isBrowser = typeof window !== "undefined";

const STORAGE_KEYS = {
  AUTH: "WORKPILOT_authenticated",
  USER: "WORKPILOT_user",
  LINKEDIN: "WORKPILOT_linkedin_connected",
  CAMPAIGN: "WORKPILOT_active_campaign",
  METRICS: "WORKPILOT_metrics",
  PROSPECTS: "WORKPILOT_prospects",
  ACTIVITIES: "WORKPILOT_activities",
  TOKEN: "WORKPILOT_token",
  HAS_INITIALIZED: "WORKPILOT_initialized_v1",
};

export function getAuthToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function setAuthToken(token: string | null): void {
  if (!isBrowser) return;
  if (token) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
  }
}

export function isAuthenticated(): boolean {
  if (!isBrowser) return false;
  return (
    localStorage.getItem(STORAGE_KEYS.AUTH) === "true" ||
    !!localStorage.getItem(STORAGE_KEYS.TOKEN)
  );
}

export function setAuthenticated(val: boolean): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEYS.AUTH, val ? "true" : "false");
  window.dispatchEvent(new Event("WORKPILOT_storage_update"));
}

export function getStoredUser(): User {
  if (!isBrowser) return INITIAL_USER;
  const raw = localStorage.getItem(STORAGE_KEYS.USER);
  if (!raw) return INITIAL_USER;
  try {
    return JSON.parse(raw);
  } catch {
    return INITIAL_USER;
  }
}

export function setStoredUser(user: User): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  window.dispatchEvent(new Event("WORKPILOT_storage_update"));
}

export function isLinkedInConnected(): boolean {
  if (!isBrowser) return false;
  return localStorage.getItem(STORAGE_KEYS.LINKEDIN) === "true";
}

export function setLinkedInConnected(val: boolean): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEYS.LINKEDIN, val ? "true" : "false");
  window.dispatchEvent(new Event("WORKPILOT_storage_update"));
}

export function getStoredCampaign(): Campaign | null {
  if (!isBrowser) return null;
  const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGN);
  if (!raw || raw === "null") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredCampaign(campaign: Campaign | null): void {
  if (!isBrowser) return;
  localStorage.setItem(
    STORAGE_KEYS.CAMPAIGN,
    campaign ? JSON.stringify(campaign) : "null",
  );
  window.dispatchEvent(new Event("WORKPILOT_storage_update"));
}

export function getStoredMetrics(): Metrics {
  if (!isBrowser) return INITIAL_METRICS;
  const raw = localStorage.getItem(STORAGE_KEYS.METRICS);
  if (!raw) return INITIAL_METRICS;
  try {
    return JSON.parse(raw);
  } catch {
    return INITIAL_METRICS;
  }
}

export function setStoredMetrics(metrics: Metrics): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(metrics));
  window.dispatchEvent(new Event("WORKPILOT_storage_update"));
}

export function purgeLegacyMockData(): void {
  if (!isBrowser) return;
  try {
    const rawProspects = localStorage.getItem(STORAGE_KEYS.PROSPECTS);
    if (
      rawProspects &&
      (rawProspects.includes("Amit Verma") ||
        rawProspects.includes("Dubai Metro") ||
        rawProspects.includes("Priya Patel") ||
        rawProspects.includes("Rahul Sharma") ||
        rawProspects.includes("XYZ Realty"))
    ) {
      localStorage.removeItem(STORAGE_KEYS.PROSPECTS);
    }
  } catch {
    // Ignore storage errors
  }
}

// Automatically execute purge on client
if (isBrowser) {
  purgeLegacyMockData();
}

export function getStoredProspects(): Prospect[] {
  if (!isBrowser) return INITIAL_PROSPECTS;
  const raw = localStorage.getItem(STORAGE_KEYS.PROSPECTS);
  if (!raw) return INITIAL_PROSPECTS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter(
        (p: any) =>
          p.name !== "Amit Verma" &&
          p.name !== "Priya Patel" &&
          p.name !== "Rahul Sharma" &&
          !p.company?.includes("Dubai Metro") &&
          !p.company?.includes("Gulf Properties") &&
          !p.company?.includes("XYZ Realty"),
      );
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.PROSPECTS, JSON.stringify(cleaned));
      }
      return cleaned;
    }
    return INITIAL_PROSPECTS;
  } catch {
    return INITIAL_PROSPECTS;
  }
}

export function setStoredProspects(prospects: Prospect[]): void {
  if (!isBrowser) return;
  const cleaned = prospects.filter(
    (p) =>
      p.name !== "Amit Verma" &&
      p.name !== "Priya Patel" &&
      p.name !== "Rahul Sharma" &&
      !p.company?.includes("Dubai Metro") &&
      !p.company?.includes("Gulf Properties") &&
      !p.company?.includes("XYZ Realty"),
  );
  localStorage.setItem(STORAGE_KEYS.PROSPECTS, JSON.stringify(cleaned));
  window.dispatchEvent(new Event("WORKPILOT_storage_update"));
}

export function getStoredActivities(): ActivityItem[] {
  if (!isBrowser) return INITIAL_ACTIVITIES;
  const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
  if (!raw) return INITIAL_ACTIVITIES;
  try {
    return JSON.parse(raw);
  } catch {
    return INITIAL_ACTIVITIES;
  }
}

export function addActivity(
  text: string,
  type: ActivityItem["type"] = "connect",
  highlight?: string,
): void {
  if (!isBrowser) return;
  const current = getStoredActivities();
  const newItem: ActivityItem = {
    id: `act-${Date.now()}`,
    time: "Just now",
    type,
    text,
    highlight,
  };
  const updated = [newItem, ...current].slice(0, 20);
  localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(updated));
  window.dispatchEvent(new Event("WORKPILOT_storage_update"));
}

export function logout(): void {
  if (!isBrowser) return;
  localStorage.removeItem(STORAGE_KEYS.AUTH);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.LINKEDIN);
  localStorage.removeItem(STORAGE_KEYS.CAMPAIGN);
  localStorage.removeItem(STORAGE_KEYS.PROSPECTS);
  localStorage.removeItem(STORAGE_KEYS.METRICS);
  localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
  window.dispatchEvent(new Event("WORKPILOT_storage_update"));
}
