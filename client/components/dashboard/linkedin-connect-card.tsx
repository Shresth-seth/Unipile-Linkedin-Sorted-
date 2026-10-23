"use client";

import React, { useState } from "react";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { User } from "@/lib/mock-data";
import { linkedinApi, AccountStatusData } from "@/lib/api";
import { LinkedInConnectModal } from "./linkedin-connect-modal";

interface LinkedInConnectCardProps {
  connected: boolean;
  onUpdateConnection: (connected: boolean) => void;
  user: User;
  accountHealth?: AccountStatusData | null;
}

export const LinkedInConnectCard: React.FC<LinkedInConnectCardProps> = ({
  connected,
  onUpdateConnection,
  user,
  accountHealth,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleDisconnect = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("WORKPILOT_linkedin_connected", "false");
      }
      await linkedinApi.disconnect();
      onUpdateConnection(false);
    } catch (e: any) {
      console.warn("Disconnect notice:", e);
      if (typeof window !== "undefined") {
        localStorage.setItem("WORKPILOT_linkedin_connected", "false");
      }
      onUpdateConnection(false);
      alert(
        e.response?.data?.message ||
          e.message ||
          "Failed to disconnect account.",
      );
    }
  };

  return (
    <>
      <div className="rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 p-5 h-full flex flex-col justify-between gap-4 shadow-sm dark:shadow-none">
        {/* Top: Header with Icon & State */}
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider mb-2">
            LinkedIn
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white/90">
                {connected
                  ? accountHealth?.name || user.name || "LinkedIn User"
                  : "Not connected"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5 leading-relaxed">
                {connected
                  ? accountHealth?.healthStatus === "HEALTHY"
                    ? "Active · Verified WorkPilot Gateway"
                    : "Account linked for outreach workflows"
                  : "Connect LinkedIn with ID/Password or Session Cookie."}
              </p>
            </div>

            {connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-transparent shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium text-slate-500 bg-slate-100 dark:text-white/40 dark:bg-white/4 shrink-0">
                Inactive
              </span>
            )}
          </div>
        </div>

        {/* Footer: Action button */}
        <div className="pt-3 border-t border-slate-200 dark:border-white/4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-white/40 text-xs font-medium">
            <LinkedInIcon className="w-3.5 h-3.5 text-[#0A66C2]" />
            <span>LinkedIn Account</span>
          </div>

          {connected ? (
            <button
              onClick={handleDisconnect}
              className="text-xs text-slate-500 dark:text-white/40 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer font-medium"
            >
              Disconnect
            </button>
          ) : (
            /* BLUE LINKEDIN CONNECT BUTTON */
            <button
              onClick={() => setModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-white-force font-semibold text-xs shadow-sm shadow-blue-600/20 transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
            >
              <LinkedInIcon className="w-3.5 h-3.5 text-white" />
              <span>Connect LinkedIn</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-method LinkedIn Authentication Modal */}
      <LinkedInConnectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => onUpdateConnection(true)}
      />
    </>
  );
};

export default LinkedInConnectCard;
