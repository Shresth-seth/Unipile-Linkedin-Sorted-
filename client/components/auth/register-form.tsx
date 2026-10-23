"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { setAuthenticated, setStoredUser } from "@/lib/storage";
import { authApi } from "@/lib/api";

export const RegisterForm: React.FC = () => {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("Preparing your workspace...");
  const [verificationSent, setVerificationSent] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("plan") === "pro") {
      localStorage.setItem("WORKPILOT_checkout_intent", JSON.stringify({
        plan: "PRO",
        cycle: params.get("cycle") === "yearly" ? "yearly" : "monthly",
      }));
    }
  }, []);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = "Please enter your full name.";
    }

    if (!email.trim()) {
      newErrors.email = "Please enter your work email.";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newErrors.password = "Please enter a password.";
    } else if (password.length < 10) {
      newErrors.password = "Password must be at least 10 characters.";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setLoadingStep("Creating your account on backend...");

    try {
      const res = await authApi.signup({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (res.requiresEmailVerification) {
        setVerificationSent(true);
        setIsLoading(false);
        return;
      }

      const userRecord = res.user;
      setStoredUser({
        id: userRecord?.id || `user-${Date.now()}`,
        name: userRecord?.name || name.trim(),
        email: userRecord?.email || email.trim(),
        role: userRecord?.role || "USER",
        company: company.trim() || "Personal Workspace",
        plan: userRecord?.plan || "STARTER",
        createdAt: userRecord?.createdAt || new Date().toISOString(),
      });

      setAuthenticated(true);
      setLoadingStep("Workspace ready! Redirecting...");
      setTimeout(() => {
      if (userRecord?.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
      }, 350);
    } catch (error: any) {
      setIsLoading(false);
      const serverMsg =
        error.response?.data?.message ||
        error.message ||
        "Registration failed. Please check your details and try again.";
      setErrors((prev) => ({
        ...prev,
        general: serverMsg,
      }));
    }
  };

  return (
    verificationSent ? (
      <div className="w-full rounded-lg border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-white/10 dark:bg-WORKPILOT-navy/60">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Check your inbox</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">We sent a verification link to <strong>{email.trim()}</strong>. Verify your email before signing in.</p>
        <Link href="/login" className="mt-6 inline-flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">Go to login</Link>
      </div>
    ) :
    <div className="w-full rounded-2xl sm:rounded-3xl border border-slate-900 dark:border-white/10 bg-white dark:bg-WORKPILOT-navy/60 backdrop-blur-2xl p-6 sm:p-8 shadow-xl dark:shadow-2xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Create your account
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Start building smarter outreach workflows.
        </p>
      </div>

      {errors.general && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Full Name <span className="text-blue-600 dark:text-cyan-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: "" });
            }}
            placeholder="Harsh Pandey"
            className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-black/60 border text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              errors.name
                ? "border-red-500/80 focus:ring-red-500/20"
                : "border-slate-900 dark:border-white/15 focus:border-blue-600 dark:focus:border-cyan-400 focus:ring-blue-500/25 dark:focus:ring-cyan-400/30"
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
          )}
        </div>

        {/* Work Email */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Work Email <span className="text-blue-600 dark:text-cyan-400">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: "" });
            }}
            placeholder="harsh@company.com"
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

        <div>
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Company / Team Name</span>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-normal">Optional</span>
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-black/60 border border-slate-900 dark:border-white/15 text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-cyan-400 focus:ring-2 focus:ring-blue-500/25 dark:focus:ring-cyan-400/30 transition-all"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Password <span className="text-blue-600 dark:text-cyan-400">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: "" });
              }}
              placeholder="At least 10 characters"
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

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Confirm Password <span className="text-blue-600 dark:text-cyan-400">*</span>
          </label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword)
                setErrors({ ...errors, confirmPassword: "" });
            }}
            placeholder="Repeat password"
            className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-black/60 border text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              errors.confirmPassword
                ? "border-red-500/80 focus:ring-red-500/20"
                : "border-slate-900 dark:border-white/15 focus:border-blue-600 dark:focus:border-cyan-400 focus:ring-blue-500/25 dark:focus:ring-cyan-400/30"
            }`}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.confirmPassword}
            </p>
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
              <span>{loadingStep}</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-blue-600 dark:text-cyan-400 font-semibold hover:text-blue-700 dark:hover:text-cyan-300 hover:underline ml-1"
        >
          Log in
        </Link>
      </div>
    </div>
  );
};

export default RegisterForm;
