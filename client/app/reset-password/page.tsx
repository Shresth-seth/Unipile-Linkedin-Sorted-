"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LockKeyhole } from "lucide-react";
import AuthShell from "@/components/auth/auth-shell";
import { authApi } from "@/lib/api";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get("token") || ""), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 10 || password !== confirm) {
      setError(password !== confirm ? "Passwords do not match." : "Use at least 10 characters.");
      return;
    }
    setLoading(true); setError(null);
    try { setMessage((await authApi.resetPassword(token, password)).message); }
    catch (err: any) { setError(err.response?.data?.message || "The reset link is invalid or expired."); }
    finally { setLoading(false); }
  };

  return <AuthShell type="login"><div className="w-full rounded-lg border border-slate-200 bg-white p-7 shadow-xl dark:border-white/10 dark:bg-WORKPILOT-navy/60">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"><LockKeyhole className="h-5 w-5" /></div>
    <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Choose a new password</h2>
    {message ? <><div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</div><Link href="/login" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">Sign in</Link></> : <form onSubmit={submit} className="mt-6 space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
      <div><label className="mb-1.5 block text-xs font-semibold">New password</label><input required type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black" /></div>
      <div><label className="mb-1.5 block text-xs font-semibold">Confirm password</label><input required type="password" minLength={10} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black" /></div>
      <button disabled={loading || !token} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}Update password</button>
    </form>}
  </div></AuthShell>;
}
