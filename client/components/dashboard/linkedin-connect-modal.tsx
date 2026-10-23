"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Mail,
  KeyRound,
  Cookie,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Globe,
  HelpCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { linkedinApi } from "@/lib/api";

interface LinkedInConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type AuthMethod = "credentials" | "cookie" | "hosted";

const COUNTRY_OPTIONS = [
  { code: "", label: "Auto-detect / Default" },
  { code: "US", label: "United States (US)" },
  { code: "GB", label: "United Kingdom (GB)" },
  { code: "IN", label: "India (IN)" },
  { code: "CA", label: "Canada (CA)" },
  { code: "DE", label: "Germany (DE)" },
  { code: "FR", label: "France (FR)" },
  { code: "AU", label: "Australia (AU)" },
  { code: "NL", label: "Netherlands (NL)" },
  { code: "SG", label: "Singapore (SG)" },
  { code: "AE", label: "United Arab Emirates (AE)" },
];

export const LinkedInConnectModal: React.FC<LinkedInConnectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Navigation & Form Tabs
  const [method, setMethod] = useState<AuthMethod>("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [showCookieInstructions, setShowCookieInstructions] = useState(false);

  // Credentials State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");

  // Cookie State
  const [liAt, setLiAt] = useState("");
  const [liA, setLiA] = useState("");
  const [userAgent, setUserAgent] = useState("");

  // Execution & Status States
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Checkpoint State
  const [isCheckpoint, setIsCheckpoint] = useState(false);
  const [checkpointType, setCheckpointType] = useState<string>("2FA");
  const [checkpointAccountId, setCheckpointAccountId] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isPollingInApp, setIsPollingInApp] = useState(false);

  // Initialize user agent from browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserAgent(navigator.userAgent);
    }
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Automatic polling for IN_APP_VALIDATION
  useEffect(() => {
    if (
      !isCheckpoint ||
      checkpointType !== "IN_APP_VALIDATION" ||
      !checkpointAccountId
    ) {
      setIsPollingInApp(false);
      return;
    }

    setIsPollingInApp(true);
    let isCancelled = false;

    const interval = setInterval(async () => {
      try {
        const res = await linkedinApi.getCheckpointStatus(checkpointAccountId);
        if (res.success && res.isConnected) {
          if (!isCancelled) {
            clearInterval(interval);
            setIsPollingInApp(false);
            setSuccessMessage("LinkedIn account connected successfully!");
            setTimeout(() => {
              onSuccess();
              handleClose();
            }, 1200);
          }
        }
      } catch {
        // Continue polling
      }
    }, 3000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isCheckpoint, checkpointType, checkpointAccountId]);

  const handleClose = () => {
    if (isLoading) return;
    setIsCheckpoint(false);
    setErrorMessage("");
    setStatusMessage("");
    setSuccessMessage("");
    setVerificationCode("");
    onClose();
  };

  // -------------------------------------------------------------
  // 1. Submit Credentials (ID & Password)
  // -------------------------------------------------------------
  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage(
        "Please enter both your LinkedIn username/email and password.",
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage(
      "Authenticating with LinkedIn via secure Unipile gateway...",
    );

    try {
      const res = await linkedinApi.connectWithCredentials({
        username: username.trim(),
        password,
        country: country || undefined,
        userAgent: userAgent || undefined,
      });

      if (res.checkpoint) {
        setIsCheckpoint(true);
        setCheckpointAccountId(res.accountId);
        setCheckpointType(res.checkpointType || "2FA");
        setStatusMessage(res.message);
        setResendCooldown(30);
      } else if (res.success) {
        setSuccessMessage(
          res.message || "LinkedIn account connected successfully!",
        );
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1200);
      } else {
        setErrorMessage(
          res.message || "Failed to authenticate LinkedIn account.",
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Failed to connect. Please verify your credentials or use the session cookie method.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 2. Submit Session Cookie (li_at)
  // -------------------------------------------------------------
  const handleSubmitCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liAt.trim()) {
      setErrorMessage("Please provide your LinkedIn 'li_at' session cookie.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("Validating LinkedIn session cookie with Unipile...");

    try {
      const res = await linkedinApi.connectWithCookie({
        li_at: liAt.trim(),
        li_a: liA.trim() || undefined,
        country: country || undefined,
        userAgent: userAgent || undefined,
      });

      if (res.checkpoint) {
        setIsCheckpoint(true);
        setCheckpointAccountId(res.accountId);
        setCheckpointType(res.checkpointType || "2FA");
        setStatusMessage(res.message);
        setResendCooldown(30);
      } else if (res.success) {
        setSuccessMessage(
          res.message || "LinkedIn session connected successfully!",
        );
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1200);
      } else {
        setErrorMessage(
          res.message || "Failed to validate LinkedIn session cookie.",
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Failed to validate cookie. Please ensure you copied the full li_at cookie string.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 3. Submit Hosted Link Flow
  // -------------------------------------------------------------
  const handleHostedConnect = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("Generating hosted Unipile authentication URL...");

    try {
      const res = await linkedinApi.getConnectLink();
      if (res.success && res.url) {
        setStatusMessage("Redirecting to secure authorization page...");
        window.location.href = res.url;
        return;
      }
      setErrorMessage(res.message || "Failed to generate authorization URL.");
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Network error generating auth URL.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 4. Solve Checkpoint (OTP / 2FA / TRY_ANOTHER_WAY)
  // -------------------------------------------------------------
  const handleSolveCheckpoint = async (codeToSubmit?: string) => {
    const code = (codeToSubmit || verificationCode).trim();
    if (!code) {
      setErrorMessage(
        "Please enter the verification code received from LinkedIn.",
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("Verifying security checkpoint with LinkedIn...");

    try {
      const res = await linkedinApi.solveCheckpoint({
        accountId: checkpointAccountId,
        code,
      });

      if (res.checkpoint) {
        // Additional challenge step triggered
        setCheckpointType(res.checkpointType || "2FA");
        setVerificationCode("");
        setStatusMessage(res.message);
        setResendCooldown(30);
      } else if (res.success) {
        setSuccessMessage("Security checkpoint verified! LinkedIn connected.");
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1200);
      } else {
        setErrorMessage(res.message || "Verification code invalid or expired.");
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Failed to verify security code.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 5. Resend Verification Code
  // -------------------------------------------------------------
  const handleResendCode = async () => {
    if (resendCooldown > 0 || !checkpointAccountId) return;

    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("Requesting new verification code from LinkedIn...");

    try {
      await linkedinApi.resendCheckpoint({ accountId: checkpointAccountId });
      setResendCooldown(60);
      setStatusMessage("A new verification code has been dispatched.");
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || "Failed to resend code.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 6. Check In-App Validation Status Manually
  // -------------------------------------------------------------
  const handleCheckInAppStatus = async () => {
    if (!checkpointAccountId) return;
    setIsLoading(true);
    setStatusMessage("Checking authorization status...");

    try {
      const res = await linkedinApi.getCheckpointStatus(checkpointAccountId);
      if (res.success && res.isConnected) {
        setSuccessMessage("In-app approval confirmed! Account connected.");
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1200);
      } else {
        setErrorMessage(
          `Authorization pending. Current status: ${res.status || "WAITING_APPROVAL"}`,
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || "Status check failed.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border border-white/1 bg-[#0c0d12] shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#0A66C2]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/8 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0A66C2]/15 border border-[#0A66C2]/30 flex items-center justify-center">
              <LinkedInIcon className="w-4 h-4 text-[#0A66C2]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white/95">
                {isCheckpoint
                  ? "Security Verification"
                  : "Connect LinkedIn Account"}
              </h2>
              <p className="text-xs text-white/50">
                {isCheckpoint
                  ? `LinkedIn Security Checkpoint: ${checkpointType}`
                  : "Choose your preferred connection method"}
              </p>
            </div>
          </div>

          {!isLoading && (
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/6 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body Container */}
        <div className="py-4 space-y-4 overflow-y-auto pr-1 flex-1 relative z-10">
          {/* Notifications / Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {statusMessage && !errorMessage && !successMessage && (
            <div className="p-3 rounded-xl bg-[#0A66C2]/10 border border-[#0A66C2]/20 text-blue-300 text-xs flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-400" />
              <div className="flex-1">{statusMessage}</div>
            </div>
          )}

          {/* -------------------------------------------------------------
              VIEW A: CHECKPOINT RESOLVER
          ------------------------------------------------------------- */}
          {isCheckpoint ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>LinkedIn Checkpoint Triggered</span>
                </div>
                <p className="text-white/70 leading-relaxed">
                  LinkedIn requires verification to ensure this sign-in attempt
                  was initiated by you.
                </p>
              </div>

              {/* Checkpoint Type: In-App Validation */}
              {checkpointType === "IN_APP_VALIDATION" ? (
                <div className="space-y-4 p-4 rounded-xl bg-white/2 border border-white/6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <Smartphone className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white/90">
                        Check your LinkedIn mobile app
                      </h4>
                      <p className="text-[11px] text-white/50 mt-0.5">
                        Open the LinkedIn app on your smartphone and tap
                        &ldquo;Yes, that&rsquo;s me&rdquo; on the push prompt.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-white/40">
                    <RefreshCw
                      className={`w-3 h-3 ${isPollingInApp ? "animate-spin text-blue-400" : ""}`}
                    />
                    <span>Auto-checking status every 3 seconds...</span>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleCheckInAppStatus}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>I have approved on phone</span>
                    </button>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleSolveCheckpoint("TRY_ANOTHER_WAY")}
                      className="py-2 px-3 rounded-lg bg-white/4 hover:bg-white/8 text-white/70 text-xs font-medium transition-colors cursor-pointer border border-white/6 disabled:opacity-50"
                    >
                      Use SMS/Email Code Instead
                    </button>
                  </div>
                </div>
              ) : (
                /* Checkpoint Type: 2FA or OTP Code Entry */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSolveCheckpoint();
                  }}
                  className="space-y-4 p-4 rounded-xl bg-white/2 border border-white/6"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/80 flex items-center justify-between">
                      <span>Verification Code ({checkpointType})</span>
                      <span className="text-[11px] text-white/40">
                        Check SMS / Authenticator
                      </span>
                    </label>
                    <input
                      type="text"
                      autoFocus
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="e.g. 123456"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/1 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[#0A66C2] tracking-wider"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      disabled={isLoading || resendCooldown > 0}
                      onClick={handleResendCode}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:text-white/30 transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend code"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleSolveCheckpoint("TRY_ANOTHER_WAY")}
                      className="text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
                    >
                      Try another way
                    </button>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCheckpoint(false)}
                      disabled={isLoading}
                      className="px-3 py-2 rounded-lg bg-white/4 hover:bg-white/8 text-white/60 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !verificationCode.trim()}
                      className="flex-1 py-2 px-4 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#0A66C2]/20"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Verification</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* -------------------------------------------------------------
                VIEW B: METHOD SELECTOR + CONNECTION FORMS
            ------------------------------------------------------------- */
            <>
              {/* Method Navigation Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/3 border border-white/6">
                <button
                  type="button"
                  onClick={() => {
                    setMethod("credentials");
                    setErrorMessage("");
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all duration-150 flex flex-col items-center gap-1 cursor-pointer ${
                    method === "credentials"
                      ? "bg-[#0A66C2] text-white shadow-sm"
                      : "text-white/50 hover:text-white hover:bg-white/4"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Password</span>
                  </div>
                  <span className="text-[10px] opacity-75 hidden sm:inline">
                    Direct Sign-in
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMethod("cookie");
                    setErrorMessage("");
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all duration-150 flex flex-col items-center gap-1 cursor-pointer ${
                    method === "cookie"
                      ? "bg-[#0A66C2] text-white shadow-sm"
                      : "text-white/50 hover:text-white hover:bg-white/4"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Cookie className="w-3.5 h-3.5" />
                    <span>Cookie</span>
                  </div>
                  <span className="text-[10px] opacity-75 hidden sm:inline">
                    li_at Session
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMethod("hosted");
                    setErrorMessage("");
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all duration-150 flex flex-col items-center gap-1 cursor-pointer ${
                    method === "hosted"
                      ? "bg-[#0A66C2] text-white shadow-sm"
                      : "text-white/50 hover:text-white hover:bg-white/4"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Hosted</span>
                  </div>
                  <span className="text-[10px] opacity-75 hidden sm:inline">
                    Web Portal
                  </span>
                </button>
              </div>

              {/* METHOD 1: ID & PASSWORD */}
              {method === "credentials" && (
                <form
                  onSubmit={handleSubmitCredentials}
                  className="space-y-3.5"
                >
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-white/40" />
                      <span>LinkedIn Email / Phone</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. alex@company.com or +1234567890"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white/3 border border-white/8 text-white placeholder:text-white/30 text-xs focus:outline-none focus:border-[#0A66C2] transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-white/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-white/40" />
                        <span>LinkedIn Password</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
                      >
                        {showPassword ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Show</span>
                          </>
                        )}
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-white/3 border border-white/8 text-white placeholder:text-white/30 text-xs focus:outline-none focus:border-[#0A66C2] transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-white/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-white/40" />
                        <span>Proxy Geo-Location (Optional)</span>
                      </div>
                      <span className="text-[10px] text-white/40">
                        Matches your sign-in IP
                      </span>
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#14151c] border border-white/8 text-white text-xs focus:outline-none focus:border-[#0A66C2] transition-colors"
                    >
                      {COUNTRY_OPTIONS.map((opt) => (
                        <option
                          key={opt.code}
                          value={opt.code}
                          className="bg-[#14151c] text-white"
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 rounded-xl bg-white/2 border border-white/5 text-[11px] text-white/50 leading-relaxed">
                    <span className="text-white/70 font-medium">
                      Native Unipile Session:
                    </span>{" "}
                    If 2FA or a security challenge is requested by LinkedIn, a
                    verification modal will appear immediately to enter your OTP
                    or approve on mobile.
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isLoading}
                      className="px-3.5 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/4 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !username || !password}
                      className="px-4 py-2 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#0A66C2]/20"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <span>Connect with Password</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* METHOD 2: SESSION COOKIE (li_at) */}
              {method === "cookie" && (
                <form onSubmit={handleSubmitCookie} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-white/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Cookie className="w-3.5 h-3.5 text-amber-400" />
                        <span>li_at Cookie (Required)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setShowCookieInstructions(!showCookieInstructions)
                        }
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                      >
                        <HelpCircle className="w-3 h-3" />
                        <span>
                          {showCookieInstructions
                            ? "Hide Guide"
                            : "How to get li_at"}
                        </span>
                        {showCookieInstructions ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </label>

                    {showCookieInstructions && (
                      <div className="p-3 rounded-xl bg-white/3 border border-white/8 text-[11px] text-white/70 space-y-1.5 leading-relaxed">
                        <p className="font-semibold text-white/90">
                          How to get your LinkedIn session cookie:
                        </p>
                        <ol className="list-decimal pl-4 space-y-1 text-white/60">
                          <li>
                            Open{" "}
                            <a
                              href="https://www.linkedin.com"
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 underline"
                            >
                              linkedin.com
                            </a>{" "}
                            and make sure you are logged in.
                          </li>
                          <li>
                            Press{" "}
                            <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px]">
                              F12
                            </kbd>{" "}
                            (or right click &gt; Inspect) to open DevTools.
                          </li>
                          <li>
                            Go to{" "}
                            <strong className="text-white/80">
                              Application
                            </strong>{" "}
                            (Chrome/Edge) or{" "}
                            <strong className="text-white/80">Storage</strong>{" "}
                            (Firefox).
                          </li>
                          <li>
                            Under{" "}
                            <strong className="text-white/80">Cookies</strong>,
                            select{" "}
                            <code className="text-blue-300">
                              https://www.linkedin.com
                            </code>
                            .
                          </li>
                          <li>
                            Find <code className="text-amber-300">li_at</code>,
                            copy its full Value, and paste it below.
                          </li>
                        </ol>
                      </div>
                    )}

                    <textarea
                      rows={2}
                      required
                      value={liAt}
                      onChange={(e) => setLiAt(e.target.value)}
                      placeholder="AQEDAT... (paste your li_at session cookie)"
                      className="w-full px-3.5 py-2 rounded-lg bg-white/3 border border-white/8 text-white placeholder:text-white/30 text-xs font-mono focus:outline-none focus:border-[#0A66C2] transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-white/80 flex items-center justify-between">
                      <span>li_a Premium Cookie (Optional)</span>
                      <span className="text-[10px] text-white/40">
                        Only for Sales Navigator / Recruiter
                      </span>
                    </label>
                    <input
                      type="text"
                      value={liA}
                      onChange={(e) => setLiA(e.target.value)}
                      placeholder="AQEDAT... (optional premium cookie)"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white/3 border border-white/8 text-white placeholder:text-white/30 text-xs font-mono focus:outline-none focus:border-[#0A66C2] transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-white/40" />
                        <span>Proxy Country</span>
                      </label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#14151c] border border-white/8 text-white text-xs focus:outline-none focus:border-[#0A66C2] transition-colors"
                      >
                        {COUNTRY_OPTIONS.map((opt) => (
                          <option
                            key={opt.code}
                            value={opt.code}
                            className="bg-[#14151c] text-white"
                          >
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-white/80 flex items-center justify-between">
                        <span>User-Agent</span>
                        <span className="text-[10px] text-emerald-400">
                          Auto-detected
                        </span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={userAgent}
                        title={userAgent}
                        className="w-full px-3 py-2 rounded-lg bg-white/2 border border-white/6 text-white/40 text-[11px] truncate cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-[11px] text-emerald-300 leading-relaxed">
                    <span className="font-semibold text-emerald-200">
                      Recommended for Enterprise & SSO:
                    </span>{" "}
                    Cookie login inherits your active session and avoids
                    triggering two-factor authentication in most environments.
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isLoading}
                      className="px-3.5 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/4 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !liAt.trim()}
                      className="px-4 py-2 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#0A66C2]/20"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Validating...</span>
                        </>
                      ) : (
                        <>
                          <span>Connect with Cookie</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* METHOD 3: HOSTED PORTAL */}
              {method === "hosted" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/2 border border-white/6 space-y-2">
                    <h3 className="text-xs font-semibold text-white/90">
                      Hosted Browser Authorization
                    </h3>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Launch an isolated Unipile authentication session in your
                      browser. Complete login inside the official pop-up, after
                      which your account will automatically synchronize with
                      WORKPILOT.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isLoading}
                      className="px-3.5 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/4 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleHostedConnect}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#0A66C2]/20"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating Link...</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Launch Hosted Login</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkedInConnectModal;
