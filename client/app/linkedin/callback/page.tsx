"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { linkedinApi } from "@/lib/api";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function LinkedInCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusText, setStatusText] = useState(
    "Finalizing secure LinkedIn authorization...",
  );
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const processCallback = async () => {
      try {
        const accountId =
          searchParams.get("account_id") || searchParams.get("accountId");
        const status = searchParams.get("status");

        if (status === "error") {
          setIsSuccess(false);
          setErrorMsg("LinkedIn connection was cancelled or rejected.");
          return;
        }

        setStatusText("Synchronizing account with WorkPilot safety gateway...");

        const syncRes = await linkedinApi.syncAccount({
          accountId: accountId || undefined,
        });

        if (!isCancelled) {
          if (syncRes.success) {
            setIsSuccess(true);
            setStatusText(
              "LinkedIn connected successfully! Redirecting to dashboard...",
            );
            if (typeof window !== "undefined") {
              localStorage.setItem("WORKPILOT_linkedin_connected", "true");
              window.dispatchEvent(new Event("WORKPILOT_storage_update"));
            }
            setTimeout(() => {
              router.replace("/dashboard");
            }, 1200);
          } else {
            setIsSuccess(false);
            setErrorMsg("Failed to synchronize LinkedIn account with backend.");
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("LinkedIn callback error:", err);
          setIsSuccess(false);
          setErrorMsg(
            err?.message || "An unexpected error occurred during account sync.",
          );
        }
      }
    };

    processCallback();

    return () => {
      isCancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050608] flex flex-col items-center justify-center p-4 text-slate-900 dark:text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#090a0d] p-8 shadow-xl dark:shadow-2xl flex flex-col items-center text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-[#0A66C2]/15 flex items-center justify-center text-[#0A66C2] ring-1 ring-[#0A66C2]/30 shadow-[0_0_25px_-5px_rgba(10,102,194,0.4)]">
          <LinkedInIcon className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white/90">
            {isSuccess === true
              ? "LinkedIn Account Connected"
              : isSuccess === false
                ? "Connection Issue"
                : "Connecting LinkedIn"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/50 max-w-xs mx-auto">
            {isSuccess === false ? errorMsg : statusText}
          </p>
        </div>

        {isSuccess === null && (
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Securing handshake...</span>
          </div>
        )}

        {isSuccess === true && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            <span>Connection verified</span>
          </div>
        )}

        {isSuccess === false && (
          <button
            onClick={() => router.replace("/dashboard")}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-xs text-slate-700 dark:text-white transition-colors"
          >
            Return to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}

export default function LinkedInCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#050608] flex items-center justify-center text-slate-500 dark:text-white/50 text-xs">
          Loading authorization status...
        </div>
      }
    >
      <LinkedInCallbackContent />
    </Suspense>
  );
}
