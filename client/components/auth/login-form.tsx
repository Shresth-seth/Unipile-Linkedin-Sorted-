"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import {
  setAuthenticated,
  setStoredUser,
  getStoredUser,
  setLinkedInConnected,
} from "@/lib/storage";
import { authApi } from "@/lib/api";
import { isAxiosError } from "axios";

export const LoginForm: React.FC = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!email.trim()) {
      newErrors.email = "Please enter your email address.";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newErrors.password = "Please enter your password.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setNeedsVerification(false);
    setResendMessage("");

    try {
      const res = await authApi.login({
        email: email.trim(),
        password,
      });

      const existingUser = getStoredUser();
      const userRecord = res.user;

      setStoredUser({
        id: userRecord?.id || existingUser?.id || `user-${Date.now()}`,
        name: userRecord?.name || existingUser?.name || email.split("@")[0],
        email: userRecord?.email || email.trim(),
        role: userRecord?.role || "USER",
        company: existingUser?.company || "Personal Workspace",
        plan: userRecord?.plan || "STARTER",
        createdAt: userRecord?.createdAt || new Date().toISOString(),
      });

      if (
        userRecord?.linkedinAccounts &&
        userRecord.linkedinAccounts.some((a) => a.isConnected)
      ) {
        setLinkedInConnected(true);
      }

      setAuthenticated(true);
      const checkoutIntent = localStorage.getItem("WORKPILOT_checkout_intent");
      if (checkoutIntent) {
        localStorage.removeItem("WORKPILOT_checkout_intent");
        try {
          const intent = JSON.parse(checkoutIntent);
          router.push(`/dashboard?view=settings&plan=pro&cycle=${intent.cycle === "yearly" ? "yearly" : "monthly"}`);
        } catch {
          router.push("/dashboard?view=settings");
        }
        return;
      }
      // Redirect ADMIN users to the admin panel, regular users to dashboard
      if (userRecord?.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const responseData = isAxiosError(error) ? error.response?.data as { message?: string; code?: string } | undefined : undefined;
      const serverMsg = responseData?.message || (error instanceof Error ? error.message : "Invalid email or password.");
      setNeedsVerification(responseData?.code === "EMAIL_NOT_VERIFIED");
      setErrors((prev) => ({
        ...prev,
        general: serverMsg,
      }));
    }
  };

  return (
    <div className="w-full rounded-2xl sm:rounded-3xl border border-slate-900 dark:border-white/10 bg-white dark:bg-WORKPILOT-navy/60 backdrop-blur-2xl p-6 sm:p-8 shadow-xl dark:shadow-2xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Continue building meaningful connections.
        </p>
      </div>

      {errors.general && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400 space-y-2">
          <p>{errors.general}</p>
          {needsVerification && (
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={async () => {
                const response = await authApi.resendVerification(email.trim());
                setResendMessage(response.message);
              }}
            >
              Send a new verification link
            </button>
          )}
          {resendMessage && <p className="text-slate-700 dark:text-slate-300">{resendMessage}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Work Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: "" });
            }}
            placeholder="name@company.com"
            className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-black/60 border text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              errors.email
                ? "border-red-500/80 focus:ring-red-500/20"
                : "border-slate-900 dark:border-white/15 focus:border-blue-600 dark:focus:border-cyan-400 focus:ring-blue-500/25 dark:focus:ring-cyan-400/30"
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <Link href="/forgot-password" className="text-[11px] text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: "" });
              }}
              placeholder="••••••••"
              className={`w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-100 dark:bg-black/60 border text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                errors.password
                  ? "border-red-500/80 focus:ring-red-500/20"
                  : "border-slate-900 dark:border-white/15 focus:border-blue-600 dark:focus:border-cyan-400 focus:ring-blue-500/25 dark:focus:ring-cyan-400/30"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black font-semibold text-sm disabled:opacity-75 transition-all shadow-lg shadow-blue-600/25 dark:shadow-[0_0_20px_-3px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white dark:text-black" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Log In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Register */}
      <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400">
        New to WORKPILOT?{" "}
        <Link
          href="/register"
          className="text-blue-600 dark:text-cyan-400 font-semibold hover:text-blue-700 dark:hover:text-cyan-300 hover:underline ml-1"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;
