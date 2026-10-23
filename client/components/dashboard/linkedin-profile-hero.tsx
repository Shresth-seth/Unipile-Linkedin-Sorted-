"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  MapPin,
  Briefcase,
  Users,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
} from "lucide-react";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { linkedinApi } from "@/lib/api";
import { LinkedInConnectModal } from "./linkedin-connect-modal";

interface LinkedInProfileHeroProps {
  connected: boolean;
  onUpdateConnection: (connected: boolean) => void;
  onSelectTab: (tab: string) => void;
  user?: any;
}

interface OwnProfileData {
  name: string;
  headline: string;
  about?: string;
  location: string;
  industry: string;
  avatar?: string;
  publicIdentifier?: string;
  connectionsCount: number;
  skillsCount: number;
  experienceCount: number;
  educationCount?: number;
  accountId?: string;
}

export const LinkedInProfileHero: React.FC<LinkedInProfileHeroProps> = ({
  connected,
  onUpdateConnection,
  onSelectTab,
  user,
}) => {
  const [profile, setProfile] = useState<OwnProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>("");

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await linkedinApi.getOwnProfile();
      if (res.success && res.data) {
        setProfile(res.data);
        if (!connected && res.connected) {
          onUpdateConnection(true);
        }
        setLastSynced(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } else if (res.connected === false && connected) {
      }
    } catch (err) {
      console.warn("Could not fetch own profile from Unipile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [connected]);

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return "LI";
    return name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  if (!connected && (!profile || !profile.name)) {
    return (
      <>
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-8 bottom-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-13 h-13 rounded-2xl bg-blue-100 dark:bg-[#0A66C2]/15 border border-blue-200 dark:border-[#0A66C2]/30 flex items-center justify-center shrink-0 shadow-xs">
                <LinkedInIcon className="w-7 h-7 text-[#0A66C2]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white/95">
                    Connect Your LinkedIn Account
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1 shadow-xs">
                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-300" />
                    Action Required
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-white/60 max-w-2xl leading-relaxed">
                  Connect your LinkedIn profile via Unipile to sync your profile
                  details, audit outreach readiness score, discover verified
                  prospects, and automate messaging with humanized delays.
                </p>
                <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-white/40 font-medium">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Strict 25/day safety limits
                  </span>
                  <span>•</span>
                  <span>Hosted provider connection</span>
                  <span>•</span>
                  <span>Zero passwords stored</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="w-full md:w-auto h-10 px-5 rounded-xl bg-[#0A66C2] hover:bg-[#095196] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/25 cursor-pointer hover:scale-[1.02]"
              >
                <LinkedInIcon className="w-4 h-4 fill-current" />
                <span>Connect LinkedIn</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>
          </div>
        </div>

        <LinkedInConnectModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          onSuccess={() => {
            setIsConnectModalOpen(false);
            onUpdateConnection(true);
            fetchProfile();
          }}
        />
      </>
    );
  }

  const displayName = profile?.name || user?.name || "LinkedIn Member";
  const displayHeadline =
    profile?.headline || "Senior Professional | Scaling Engineering & Systems";
  const displayLocation = profile?.location || "Global";
  const displayIndustry = profile?.industry || "Technology";
  const connectionsCount =
    typeof profile?.connectionsCount === "number"
      ? profile.connectionsCount
      : 0;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-lg font-bold font-heading text-blue-700 dark:text-blue-300">
                    {getInitials(displayName)}
                  </span>
                )}
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#050608] flex items-center justify-center shadow-sm"
                title="LinkedIn account actively synchronized via Unipile"
              >
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
            </div>

            {/* Profile Information */}
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white/95 truncate">
                  {displayName}
                </h2>

                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300 text-[10px] font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>LIVE SYNCED</span>
                </div>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/25 dark:text-blue-300 text-[10px] font-medium">
                  <LinkedInIcon className="w-3 h-3 text-[#0A66C2]" />
                  <span>Unipile</span>
                </div>
              </div>

              {/* Headline */}
              <p className="text-xs sm:text-sm text-slate-700 dark:text-white/75 font-medium line-clamp-2 leading-relaxed">
                {displayHeadline}
              </p>

              {/* Meta Badges: Location, Industry, Connections */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-white/45 font-medium">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {displayLocation}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-slate-400" />
                  {displayIndustry}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-blue-700 dark:text-cyan-300/80 font-mono font-bold">
                  <Users className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                  {connectionsCount > 500
                    ? "500+ Connections"
                    : `${connectionsCount} Connections`}
                </span>
                {lastSynced && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400 dark:text-white/30 text-[10px]">
                      Synced at {lastSynced}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200 dark:border-white/6">
            {/* Audit Profile Rating */}
            <button
              onClick={() => onSelectTab("agent")}
              className="flex-1 sm:flex-none h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-white/4 dark:hover:bg-white/8 dark:border-white/10 text-slate-800 dark:text-white/90 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:border-blue-400 shadow-xs"
              title="Inspect 0-100 profile audit score & headline critiques"
            >
              <Award className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Audit Score</span>
            </button>

            {/* Launch Outreach / AI Agent */}
            <button
              onClick={() => onSelectTab("agent")}
              className="flex-1 sm:flex-none h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>WORKPILOT Agent</span>
              <ArrowRight className="w-3 h-3 text-white" />
            </button>

            {/* Refresh Profile from Unipile */}
            <button
              onClick={fetchProfile}
              disabled={loading}
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-white/3 dark:hover:bg-white/7 dark:border-white/8 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-white/50 dark:hover:text-white transition-colors cursor-pointer shadow-xs"
              title="Refresh LinkedIn profile details from Unipile"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600 dark:text-cyan-400" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      <LinkedInConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={() => {
          setIsConnectModalOpen(false);
          onUpdateConnection(true);
          fetchProfile();
        }}
      />
    </>
  );
};

export default LinkedInProfileHero;
