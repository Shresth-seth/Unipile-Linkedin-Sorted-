"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Menu, Search, Plus, Sun, Moon } from "lucide-react";
import { User } from "@/lib/mock-data";
import { NotificationsPopover } from "./notifications-popover";
import { LinkedInProspectSearchModal } from "./linkedin-prospect-search-modal";
import { useTheme } from "@/components/theme-provider";

interface DashboardHeaderProps {
  user: User;
  activeTabTitle?: string;
  onOpenMobileMenu: () => void;
  onNewCampaign: () => void;
  linkedInConnected?: boolean;
  accountHealth?: any;
  onSelectTab?: (tab: string) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  activeTabTitle = "Overview",
  onOpenMobileMenu,
  onNewCampaign,
  linkedInConnected = false,
  accountHealth,
  onSelectTab,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K keyboard shortcut to open search
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return "U";
    return (
      name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "U"
    );
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-14 w-full bg-white/90 dark:bg-[#050608]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/6 px-4 sm:px-8 flex items-center justify-between">
        {/* Left: Mobile Trigger & Dynamic Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="p-1.5 rounded-md text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden cursor-pointer"
            aria-label="Open sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          <h2 className="text-sm font-bold text-slate-900 dark:text-white/90">{activeTabTitle}</h2>
        </div>

        {/* Right: Actions & Compact CTA */}
        <div className="flex items-center gap-2.5">
          {/* Account Health Status Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/3 border border-slate-200 dark:border-white/6 text-[11px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                accountHealth?.isConnected || linkedInConnected
                  ? "bg-emerald-500"
                  : "bg-amber-500"
              }`}
            />
            <span className="text-slate-600 dark:text-white/60 font-mono text-[10px] font-semibold">
              {accountHealth?.healthStatus === "HEALTHY"
                ? "HEALTHY"
                : accountHealth?.isConnected || linkedInConnected
                  ? "CONNECTED"
                  : "STANDBY"}
            </span>
          </div>

          {/* Quick Search Button — opens LinkedIn search modal */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/3 border border-slate-200 dark:border-white/6 text-xs text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white/70 hover:border-slate-300 dark:hover:border-white/10 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search LinkedIn...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/6 text-[10px] text-slate-600 dark:text-white/40 font-mono font-medium">
              ⌘K
            </kbd>
          </button>

          {/* Interactive LinkedIn Notifications Popover */}
          <NotificationsPopover
            onSelectTab={onSelectTab}
            accountHealth={accountHealth}
            linkedInConnected={linkedInConnected}
          />

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-white/3 border border-slate-200 dark:border-white/6 flex items-center justify-center text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/6 transition-colors cursor-pointer shadow-xs"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle light/dark theme"
          >
            {theme === "dark" ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-blue-600" />
            )}
          </button>

          {/* Primary CTA: + New Campaign */}
          <button
            onClick={onNewCampaign}
            className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-white-force dark:bg-white dark:text-black font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-600/25"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>

          {/* User Mini Avatar */}
          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-transparent flex items-center justify-center text-[10px] font-bold shrink-0 ml-1">
            {getInitials(user.name)}
          </div>
        </div>
      </header>

      {/* LinkedIn Search Modal */}
      <LinkedInProspectSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
};

export default DashboardHeader;
