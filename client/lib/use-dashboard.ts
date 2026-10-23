"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { User, Campaign, Prospect, ActivityItem, Metrics } from "./mock-data";
import {
  isAuthenticated,
  setAuthenticated,
  getStoredUser,
  setStoredUser,
  isLinkedInConnected,
  setLinkedInConnected,
  getStoredCampaign,
  setStoredCampaign,
  getStoredMetrics,
  setStoredMetrics,
  getStoredProspects,
  setStoredProspects,
  getStoredActivities,
  addActivity,
  logout as storageLogout,
} from "./storage";
import {
  authApi,
  dashboardApi,
  linkedinApi,
  campaignApi,
  agentApi,
  AccountStatusData,
  FunnelAnalytics,
  ContactRecord,
} from "./api";

export function useDashboardState() {
  const [isMounted, setIsMounted] = useState(false);
  const [auth, setAuth] = useState(false);
  const [user, setUser] = useState<User>(getStoredUser());
  const [linkedInConnected, setLinkedIn] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(getStoredMetrics());
  const [prospects, setProspects] = useState<Prospect[]>(getStoredProspects());
  const [activities, setActivities] = useState<ActivityItem[]>(
    getStoredActivities(),
  );

  // Real Backend State
  const [accountHealth, setAccountHealth] = useState<AccountStatusData | null>(
    null,
  );
  const [funnelData, setFunnelData] = useState<FunnelAnalytics | null>(null);
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);

  const hasFetchedBackendRef = useRef(false);

  const syncState = useCallback(() => {
    setAuth(isAuthenticated());
    setUser(getStoredUser());
    setLinkedIn(isLinkedInConnected());
    setCampaign(getStoredCampaign());
    setMetrics(getStoredMetrics());
    setProspects(getStoredProspects());
    setActivities(getStoredActivities());
  }, []);

  // Fetch real backend metrics and account state without triggering recursive loops
  const refreshBackendData = useCallback(async () => {
    try {
      setIsLoadingBackend(true);
      const currentUser = getStoredUser();

      let hasConnectedInMe = false;
      let hasConnectedInHealth = false;

      // 1. Fetch current profile from backend
      try {
        const meRes = await authApi.getMe();
        if (meRes.success && meRes.user) {
          const updatedUser: User = {
            ...currentUser,
            id: meRes.user.id,
            name: meRes.user.name,
            email: meRes.user.email,
            role: meRes.user.role,
          };
          if (typeof window !== "undefined") {
            localStorage.setItem("WORKPILOT_user", JSON.stringify(updatedUser));
          }
          setUser(updatedUser);

          // Check if user has connected LinkedIn in DB
          if (
            meRes.user.linkedinAccounts &&
            meRes.user.linkedinAccounts.length > 0
          ) {
            hasConnectedInMe = meRes.user.linkedinAccounts.some(
              (a) => a.isConnected,
            );
            if (hasConnectedInMe) {
              if (typeof window !== "undefined") {
                localStorage.setItem("WORKPILOT_linkedin_connected", "true");
              }
              setLinkedIn(true);
            }
          }
        }
      } catch {
        // Not authenticated on backend or network error
      }

      // 2. Fetch Account Health & Safety Status and LinkedIn Status
      try {
        const healthRes = await dashboardApi.getAccountHealth();
        if (healthRes.success && healthRes.data) {
          setAccountHealth(healthRes.data);
          hasConnectedInHealth = Boolean(healthRes.data.isConnected);
          if (hasConnectedInHealth) {
            if (typeof window !== "undefined") {
              localStorage.setItem("WORKPILOT_linkedin_connected", "true");
            }
            setLinkedIn(true);
          }
        }
      } catch {
        // Fallback gracefully
      }

      // 2b. Direct check on /api/linkedin/status
      try {
        const liRes = await linkedinApi.getStatus();
        if (liRes.success && liRes.data) {
          const isConn = Boolean(liRes.data.isConnected);
          if (isConn) {
            setLinkedIn(true);
            if (typeof window !== "undefined") {
              localStorage.setItem("WORKPILOT_linkedin_connected", "true");
            }
          } else if (!hasConnectedInMe && !hasConnectedInHealth) {
            // Only set false if backend profile and health also confirm disconnected
            setLinkedIn(false);
            if (typeof window !== "undefined") {
              localStorage.setItem("WORKPILOT_linkedin_connected", "false");
            }
          }
          if (liRes.data.name) {
            setAccountHealth((prev) => ({
              ...(prev || ({} as any)),
              ...liRes.data,
            }));
          }
        }
      } catch {
        // Ignore fallback
      }

      // 3. Fetch Funnel Metrics
      try {
        const funnelRes = await dashboardApi.getFunnel();
        if (funnelRes.success && funnelRes.data) {
          const f = funnelRes.data;
          setFunnelData(f);

          // Update metrics safely using functional setter
          setMetrics({
            prospects: f.totalLeads,
            prospectsChange: `${f.stageBreakdown?.HOT_LEAD || 0} hot leads`,
            connections: f.connectionsAccepted,
            connectionsRate: `${f.acceptanceRate}% acceptance`,
            messages: f.connectionsSent,
            messagesDetail: `${f.activeConversations} active convos`,
            replies: f.totalReplies,
            repliesRate: `${f.replyRate}% response rate`,
          });
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "WORKPILOT_metrics",
              JSON.stringify({
                prospects: f.totalLeads,
                prospectsChange: `${f.stageBreakdown?.HOT_LEAD || 0} hot leads`,
                connections: f.connectionsAccepted,
                connectionsRate: `${f.acceptanceRate}% acceptance`,
                messages: f.connectionsSent,
                messagesDetail: `${f.activeConversations} active convos`,
                replies: f.totalReplies,
                repliesRate: `${f.replyRate}% response rate`,
              }),
            );
          }
        }
      } catch {
        // Fallback gracefully
      }

      // 4. Fetch Contacts
      try {
        const contactsRes = await dashboardApi.getContacts(undefined, 50);
        if (contactsRes.success && Array.isArray(contactsRes.data)) {
          const mappedProspects: Prospect[] = contactsRes.data
            .filter(
              (c: ContactRecord) =>
                c.name !== "Amit Verma" &&
                c.name !== "Priya Patel" &&
                c.name !== "Rahul Sharma" &&
                !c.company?.includes("Dubai Metro") &&
                !c.company?.includes("Gulf Properties") &&
                !c.company?.includes("XYZ Realty"),
            )
            .map((c: ContactRecord) => ({
              id: c.id,
              name: c.name,
              role: c.designation || "Executive",
              company: c.company || "Enterprise",
              match: c.isHotLead ? "98%" : "89%",
              status:
                c.status === "CONNECTED"
                  ? "Connected"
                  : c.status === "CONTACTED"
                    ? "Pending"
                    : c.status === "CONVERSATION" || c.status === "HOT_LEAD"
                      ? "Replied"
                      : "Qualified",
              nextAction: c.isHotLead ? "Priority Reply" : "Scheduled Check",
            }));
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "WORKPILOT_prospects",
              JSON.stringify(mappedProspects),
            );
          }
          setProspects(mappedProspects);
        }
      } catch {
        // Fallback gracefully
      }
    } catch (e) {
      console.warn("Backend sync notice:", e);
    } finally {
      setIsLoadingBackend(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    syncState();

    if (isAuthenticated() && !hasFetchedBackendRef.current) {
      hasFetchedBackendRef.current = true;
      refreshBackendData();
    }

    const handleUpdate = () => {
      syncState();
    };

    window.addEventListener("WORKPILOT_storage_update", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("WORKPILOT_storage_update", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [syncState, refreshBackendData]);

  const updateLinkedIn = useCallback(async (connected: boolean) => {
    setLinkedInConnected(connected);
    setLinkedIn(connected);

    if (connected) {
      addActivity(
        "LinkedIn account synchronized via WorkPilot gateway",
        "connect",
      );
      try {
        const statusRes = await linkedinApi.getStatus();
        if (statusRes.success && statusRes.data) {
          setAccountHealth((prev) => ({
            ...(prev || ({} as any)),
            ...statusRes.data,
          }));
        }
      } catch (err) {
        console.warn("LinkedIn status update error:", err);
      }
    } else {
      addActivity("LinkedIn account disconnected", "start");
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("WORKPILOT_linkedin_connected", "false");
        }
        await linkedinApi.disconnect();
        setAccountHealth({
          hasAccount: false,
          isConnected: false,
          healthStatus: "DISCONNECTED",
          automationStatus: "PAUSED",
        } as any);
      } catch (err) {
        console.warn("LinkedIn disconnect error:", err);
      }
    }
  }, []);

  const connectLinkedIn = useCallback(async () => {
    try {
      const res = await linkedinApi.getConnectLink();
      if (res.success && res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      console.warn("Connect link error:", err);
    }
  }, []);

  const launchCampaign = useCallback(
    async (name: string, targetQuery: string, durationDays: number = 7, campaignType?: "DISCOVERY" | "ENGAGEMENT", dailyLimit: number = 15) => {
      const newCamp: Campaign = {
        id: `camp-${Date.now()}`,
        name: name || "Autonomous LinkedIn Outreach",
        status: "Running",
        currentDay: 1,
        totalDays: durationDays,
        discovered: 0,
        qualified: 0,
        connected: 0,
        replies: 0,
        nextCheckTime: "Paced (8–18m)",
        targetQuery: targetQuery || "Targeted professional outreach",
        audience: "People",
        personalization: "Contextual",
      };

      try {
        if (campaignType === "ENGAGEMENT") {
          const response = await agentApi.chat({
            messages: [{ role: "user", content: `I've just launched a new Engagement campaign named "${newCamp.name}". Please start messaging my existing connections targeting "${targetQuery}", capped at ${dailyLimit} actions per day for ${durationDays} days.` }]
          });
          if (!response.success) throw new Error("Campaign launch failed.");
        } else {
          const res = await campaignApi.discoverProspects({
            role: targetQuery || "Founder",
            limit: dailyLimit,
            autoEnqueue: true,
          });

          if (!res.success) throw new Error("Campaign launch failed.");
          newCamp.discovered = res.count || (res.data ? res.data.length : 0);
          newCamp.qualified = res.enqueuedCount ?? Math.min(newCamp.discovered, dailyLimit);
        }

        setStoredCampaign({ ...newCamp });
        setCampaign({ ...newCamp });
        addActivity(
          campaignType === "ENGAGEMENT"
            ? `Engagement campaign "${newCamp.name}" accepted for processing`
            : `Discovery completed: ${newCamp.discovered} prospects ingested, ${newCamp.qualified} queued`,
          "connect",
          newCamp.name,
        );
      } catch (e) {
        console.warn("Campaign launch failed:", e);
        throw e;
      }

      refreshBackendData();
    },
    [refreshBackendData],
  );

  const pauseCampaign = useCallback(async () => {
    const current = getStoredCampaign();
    if (!current) return;
    const nextStatus = current.status === "Running" ? "Paused" : "Running";
    const updated = { ...current, status: nextStatus as Campaign["status"] };
    setStoredCampaign(updated);
    setCampaign(updated);

    addActivity(
      `Campaign "${current.name}" ${nextStatus.toLowerCase()}`,
      "start",
    );

    // Connect to backend emergency killswitch or resume
    try {
      if (nextStatus === "Paused") {
        await dashboardApi.emergencyPause(
          "User paused from dashboard campaign card",
        );
      } else {
        await dashboardApi.resume();
      }
    } catch (e) {
      console.warn("Could not sync pause status to backend:", e);
    }
  }, []);

  const emergencyPause = useCallback(
    async (reason?: string) => {
      try {
        await dashboardApi.emergencyPause(
          reason || "User triggered emergency pause",
        );
        addActivity(
          "Emergency safety killswitch triggered - all automation frozen",
          "start",
        );
        if (campaign) {
          const updated = { ...campaign, status: "Paused" as const };
          setStoredCampaign(updated);
          setCampaign(updated);
        }
      } catch (e) {
        console.warn("Emergency pause error:", e);
      }
    },
    [campaign],
  );

  const resumeAutomation = useCallback(async () => {
    try {
      await dashboardApi.resume();
      addActivity("Automation resumed - outbound queue active", "start");
      if (campaign) {
        const updated = { ...campaign, status: "Running" as const };
        setStoredCampaign(updated);
        setCampaign(updated);
      }
    } catch (e) {
      console.warn("Resume automation error:", e);
    }
  }, [campaign]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    }
    storageLogout();
    setAuth(false);
  }, []);

  return {
    isMounted,
    auth,
    user,
    setUser: setStoredUser,
    setAuth: setAuthenticated,
    linkedInConnected,
    updateLinkedIn,
    connectLinkedIn,
    campaign,
    launchCampaign,
    pauseCampaign,
    emergencyPause,
    resumeAutomation,
    metrics,
    prospects,
    setProspects: setStoredProspects,
    activities,
    addActivity,
    logout,
    accountHealth,
    funnelData,
    isLoadingBackend,
    refreshBackendData,
  };
}
