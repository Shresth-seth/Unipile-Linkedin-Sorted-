"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Compass,
  Users,
  MessageSquare,
  Activity,
  Bot,
  Layers,
  Settings,
  LogOut,
  X,
  ChevronDown,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Logo from "@/app/Components/landing/Logo";
import { User, Campaign } from "@/lib/mock-data";

interface DashboardSidebarProps {
  user: User;
  campaign: Campaign | null;
  onLogout: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onNewCampaign?: () => void;
}

const mainNav = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "campaigns", name: "Campaigns", icon: Compass },
  { id: "prospects", name: "Prospects", icon: Users },
  { id: "messages", name: "Messages", icon: MessageSquare },
  { id: "activity", name: "Activity", icon: Activity },
  { id: "automation", name: "Automation", icon: Zap, isNew: true },
  { id: "agent", name: "AI Agent", icon: Bot },
  { id: "training", name: "Agent Training", icon: Bot },
];

const secondaryNav = [
  { id: "integrations", name: "Integrations", icon: Layers },
  { id: "settings", name: "Settings", icon: Settings },
];

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  user,
  onLogout,
  activeTab,
  onSelectTab,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return "IC";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const handleLogoutClick = () => {
    onLogout();
    router.push("/login");
  };

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container: 220px width */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-56 bg-white dark:bg-[#040506] border-r border-slate-200 dark:border-white/6 flex flex-col justify-between transition-transform duration-200 ease-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header & Logo */}
        <div>
          <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 dark:border-white/6">
            <button
              onClick={() => handleItemClick("overview")}
              className="inline-block cursor-pointer text-left"
              aria-label="WORKPILOT Dashboard"
            >
              <Logo size="sm" />
            </button>
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="px-2.5 py-4 space-y-0.5">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isCurrent = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isCurrent
                      ? "bg-blue-50 text-blue-700 font-semibold dark:bg-white/6 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white/90 dark:hover:bg-white/3"
                  }`}
                >
                  {/* Blue 2px left indicator for active item */}
                  {isCurrent && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-blue-500" />
                  )}
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isCurrent
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-400 group-hover:text-slate-600 dark:text-white/40 dark:group-hover:text-white/70"
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>

                  {item.isNew && !isCurrent && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-200 dark:border-transparent font-medium">
                      Config
                    </span>
                  )}
                </button>
              );
            })}

            <div className="my-3 border-t border-slate-200 dark:border-white/5" />

            {secondaryNav.map((item) => {
              const Icon = item.icon;
              const isCurrent = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isCurrent
                      ? "bg-blue-50 text-blue-700 font-semibold dark:bg-white/6 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white/90 dark:hover:bg-white/3"
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-blue-500" />
                  )}
                  <Icon
                    className={`w-4 h-4 ${
                      isCurrent
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 group-hover:text-slate-600 dark:text-white/40 dark:group-hover:text-white/70"
                    }`}
                  />
                  <span>{item.name}</span>
                </button>
              );
            })}

            {/* Admin Console Entry (Strictly visible only to ADMIN) */}
            {user?.role === "ADMIN" && (
              <div className="pt-2">
                <Link
                  href="/admin"
                  className="w-full group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-amber-500 hover:text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <span>Admin Console</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 uppercase">
                    Staff
                  </span>
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* User Footer Profile & Trigger */}
        <div className="p-3 border-t border-slate-200 dark:border-white/6">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/4 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-transparent flex items-center justify-center text-[10px] font-bold shrink-0">
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0 overflow-hidden">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white/90 truncate">
                    {user.name || "My Account"}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-white/40 truncate">
                    {user.email || "User"}
                  </div>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-white/30 group-hover:text-slate-600 dark:group-hover:text-white/60 shrink-0 ml-1" />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1.5 p-1 rounded-lg bg-white dark:bg-[#0c0d10] border border-slate-200 dark:border-white/8 shadow-xl z-50 text-xs">
                {user?.role === "ADMIN" && (
                  <>
                    <Link
                      href="/admin"
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-500/10 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Admin Console</span>
                    </Link>
                    <div className="my-1 border-t border-slate-200 dark:border-white/5" />
                  </>
                )}
                <button
                  onClick={() => {
                    handleItemClick("settings");
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Workspace Settings</span>
                </button>
                <div className="my-1 border-t border-slate-200 dark:border-white/5" />
                <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
