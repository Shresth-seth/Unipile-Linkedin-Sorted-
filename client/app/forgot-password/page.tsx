"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import AuthShell from "@/components/auth/auth-shell";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await authApi.forgotPassword(email);
      setMessage(result.message);
    } catch {
      setMessage("Password recovery is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return <AuthShell type="login"><div className="w-full rounded-lg border border-slate-200 bg-white p-7 shadow-xl dark:border-white/10 dark:bg-WORKPILOT-navy/60">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"><Mail className="h-5 w-5" /></div>
    <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Reset your password</h2>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Enter your account email and we will send a secure reset link.</p>
    {message ? <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</div> : <form onSubmit={submit} className="mt-6 space-y-4">
      <div><label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Work email</label><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black" /></div>
      <button disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}Send reset link</button>
    </form>}
    <Link href="/login" className="mt-5 block text-center text-xs font-semibold text-blue-600 dark:text-cyan-400">Back to login</Link>
  </div></AuthShell>;
}
