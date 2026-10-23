"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboardState } from "@/lib/use-dashboard";
import { authApi } from "@/lib/api";

// Subcomponents
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { LinkedInProfileHero } from "@/components/dashboard/linkedin-profile-hero";
import { AgentFloatingButton } from "@/components/dashboard/agent-floating-button";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { LinkedInPostsAnalytics } from "@/components/dashboard/linkedin-posts-analytics";
import { LinkedInConnectCard } from "@/components/dashboard/linkedin-connect-card";
import { CampaignCard } from "@/components/dashboard/campaign-card";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { CampaignBuilder } from "@/components/dashboard/campaign-builder";

// Dedicated Views for Sidebar Options
import { AgentView } from "@/components/dashboard/views/agent-view";
import { TrainingView } from "@/components/dashboard/views/training-view";
import { CampaignsView } from "@/components/dashboard/views/campaigns-view";
import { ProspectsView } from "@/components/dashboard/views/prospects-view";
import { MessagesView } from "@/components/dashboard/views/messages-view";
import { ActivityView } from "@/components/dashboard/views/activity-view";
import { IntegrationsView } from "@/components/dashboard/views/integrations-view";
import { SettingsView } from "@/components/dashboard/views/settings-view";
import { AutomationView } from "@/components/dashboard/views/automation-view";

import { Loader2 } from "lucide-react";

const TAB_TITLES: Record<string, string> = {
  overview: "Overview",
  campaigns: "Campaigns",
  prospects: "Prospects & Pipeline",
  messages: "Messages",
  activity: "Activity Log",
  automation: "Automation Control Center",
  agent: "AI Agent Behavior & Safety",
  training: "Agent Knowledge Base",
  integrations: "Integrations",
  settings: "Workspace Settings",
};

export default function DashboardPage() {
  const router = useRouter();
  const {
    isMounted,
    user,
    linkedInConnected,
    updateLinkedIn,
    campaign,
    launchCampaign,
    pauseCampaign,
    metrics,
    prospects,
    activities,
    logout,
    accountHealth,
  } = useDashboardState();

  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Authentication Guard
  useEffect(() => {
    if (!isMounted) return;
    let active = true;
    authApi.getMe()
      .then(() => {
        if (active) setAuthChecked(true);
      })
      .catch(async () => {
        if (!active) return;
        await logout();
        router.replace("/login");
      });
    return () => { active = false; };
  }, [isMounted, logout, router]);

  useEffect(() => {
    Promise.resolve().then(() => {
      const requestedView = new URLSearchParams(window.location.search).get("view");
      if (requestedView && TAB_TITLES[requestedView]) setActiveTab(requestedView);
    });
  }, []);

  // Dynamic greeting based on current local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const userFirstName = user?.name ? user.name.split(" ")[0] : (user?.email ? user.email.split("@")[0] : "User");

  const handleFocusChat = () => {
    setActiveTab("agent");
  };

  // Prevent flash while checking authentication session
  if (!isMounted || !authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#050608] flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-white/40">
        <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
        <span className="text-xs font-mono text-slate-500 dark:text-white/40">
          Loading workspace...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050608] text-slate-900 dark:text-white/90 flex flex-col lg:flex-row antialiased selection:bg-blue-600 selection:text-white">
      {/* 1. Sidebar (220px / w-56) */}
      <DashboardSidebar
        user={user}
        campaign={campaign}
        onLogout={logout}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onNewCampaign={() => setIsBuilderOpen(true)}
      />

      {/* 2. Main Shell */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-56 overflow-x-hidden">
        {/* Header (56px) with dynamic active title */}
        <DashboardHeader
          user={user}
          activeTabTitle={TAB_TITLES[activeTab] || "Overview"}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNewCampaign={() => setIsBuilderOpen(true)}
          linkedInConnected={linkedInConnected}
          accountHealth={accountHealth}
          onSelectTab={(tab) => setActiveTab(tab)}
        />

        {/* Content Area: Max 1280px / 7xl centered */}
        <main className="flex-1 px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 max-w-7xl mx-auto w-full space-y-6 sm:space-y-7 min-w-0">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-7">
              {/* Real-time LinkedIn Profile Hero / Connect Prompt */}
              <LinkedInProfileHero
                connected={linkedInConnected}
                onUpdateConnection={updateLinkedIn}
                onSelectTab={(tab) => setActiveTab(tab)}
                user={user}
              />

              {/* Greeting */}
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white/90 tracking-tight">
                  {getGreeting()}, <span className="text-blue-600 dark:text-blue-400">{userFirstName}</span> 👋
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-white/45">
                  What would you like to accomplish today?
                </p>
              </div>

              {/* Compact Overview Metrics */}
              <OverviewCards metrics={metrics} />

              {/* Real-time LinkedIn Post Performance & Engagement */}
              <LinkedInPostsAnalytics connected={linkedInConnected} />

              {/* Workspace Grid: Current Campaign (65%) + LinkedIn (35%) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Active Campaign Card */}
                <div className="lg:col-span-8">
                  <CampaignCard
                    campaign={campaign}
                    onPauseToggle={pauseCampaign}
                    onFocusChat={handleFocusChat}
                  />
                </div>

                {/* LinkedIn Connection Card (with Blue Connect Button) */}
                <div className="lg:col-span-4">
                  <LinkedInConnectCard
                    connected={linkedInConnected}
                    onUpdateConnection={updateLinkedIn}
                    user={user}
                    accountHealth={accountHealth}
                  />
                </div>
              </div>

              {/* Prospects Table (Largest Section) */}
              <div>
                <LeadsTable prospects={prospects} />
              </div>

              {/* Recent Activity */}
              <div>
                <ActivityFeed activities={activities} />
              </div>
            </div>
          )}

          {/* TAB 2: CAMPAIGNS */}
          {activeTab === "campaigns" && (
            <CampaignsView
              campaign={campaign}
              onPauseToggle={pauseCampaign}
              onNewCampaign={() => setIsBuilderOpen(true)}
            />
          )}

          {/* TAB 3: PROSPECTS */}
          {activeTab === "prospects" && (
            <ProspectsView prospects={prospects} />
          )}

          {/* TAB 4: MESSAGES */}
          {activeTab === "messages" && (
            <MessagesView />
          )}

          {/* TAB 5: ACTIVITY */}
          {activeTab === "activity" && (
            <ActivityView activities={activities} />
          )}

          {/* TAB 6: AUTOMATION */}
          {activeTab === "automation" && (
            <AutomationView />
          )}

          {/* TAB 7: AI AGENT BEHAVIORS & LINKEDIN CONNECTION */}
          {activeTab === "agent" && (
            <AgentView
              user={user}
              campaign={campaign}
              linkedInConnected={linkedInConnected}
              onUpdateConnection={updateLinkedIn}
            />
          )}

          {/* TAB 7: AGENT TRAINING */}
          {activeTab === "training" && (
            <TrainingView />
          )}

          {/* TAB 8: INTEGRATIONS */}
          {activeTab === "integrations" && (
            <IntegrationsView
              user={user}
              linkedInConnected={linkedInConnected}
              onUpdateConnection={updateLinkedIn}
            />
          )}

          {/* TAB 8: SETTINGS */}
          {activeTab === "settings" && (
            <SettingsView user={user} onLogout={logout} />
          )}
        </main>
      </div>

      {/* New Campaign Modal */}
      <CampaignBuilder
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onLaunchCampaign={launchCampaign}
      />

      {/* Floating Action Button for AI Agent (hidden when Agent view is active) */}
      {activeTab !== "agent" && (
        <AgentFloatingButton
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
        />
      )}
    </div>
  );
}
