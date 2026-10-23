"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import AuthShell from "@/components/auth/auth-shell";
import { authApi } from "@/lib/api";

export default function VerifyEmailPage() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    authApi.verifyEmail(token).then((result) => { setState("success"); setMessage(result.message); })
      .catch((error) => { setState("error"); setMessage(error.response?.data?.message || "This verification link is invalid or expired."); });
  }, []);
  return <AuthShell type="login"><div className="w-full rounded-lg border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-white/10 dark:bg-WORKPILOT-navy/60">
    <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${state === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'}`}>{state === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : state === "success" ? <CheckCircle2 className="h-5 w-5" /> : <MailWarning className="h-5 w-5" />}</div>
    <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{state === "loading" ? "Verifying email" : state === "success" ? "Email verified" : "Verification failed"}</h2>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
    {state !== "loading" && <Link href="/login" className="mt-6 inline-flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">Go to login</Link>}
  </div></AuthShell>;
}
