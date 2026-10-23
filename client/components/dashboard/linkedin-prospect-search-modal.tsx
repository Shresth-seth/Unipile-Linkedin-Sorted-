"use client";

import React, { useState } from "react";
import {
  Search,
  UserPlus,
  Send,
  Loader2,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Building,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { linkedinApi } from "@/lib/api";

interface LinkedInProspectSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSent?: () => void;
}

export const LinkedInProspectSearchModal: React.FC<
  LinkedInProspectSearchModalProps
> = ({ isOpen, onClose, onConnectionSent }) => {
  const [identifierInput, setIdentifierInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSearching || isSending) return;
    setErrorMessage("");
    setStatusMessage("");
    setSuccessMessage("");
    onClose();
  };

  // -------------------------------------------------------------
  // 1. Search or Fetch Profile
  // -------------------------------------------------------------
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = identifierInput.trim();
    if (!query) {
      setErrorMessage(
        "Please enter a LinkedIn username, profile URL, or search query.",
      );
      return;
    }

    setIsSearching(true);
    setErrorMessage("");
    setStatusMessage("Querying LinkedIn via Unipile...");
    setSelectedProfile(null);
    setSearchResults([]);

    try {
      // Check if input looks like a public identifier (e.g. "satyanadella") or URL
      const isIdentifierOrUrl =
        query.includes("linkedin.com/in/") ||
        (!query.includes(" ") && query.length < 50 && !query.includes(","));

      if (isIdentifierOrUrl) {
        // Direct Profile Fetch via GET /api/v1/users/{identifier}
        const res = await linkedinApi.getProfile(query);
        if (res.success && res.data) {
          setSelectedProfile(res.data);
          const firstName =
            res.data.first_name ||
            (res.data.name ? res.data.name.split(" ")[0] : "there");
          setCustomMessage(
            `Hey ${firstName}, came across your profile and would love to connect!`,
          );
          setStatusMessage("");
          return;
        }
      }

      // Keyword / People Search via /api/linkedin/search
      const searchRes = await linkedinApi.searchPeople({ query, limit: 8 });
      if (
        searchRes.success &&
        Array.isArray(searchRes.data) &&
        searchRes.data.length > 0
      ) {
        setSearchResults(searchRes.data);
        setStatusMessage(
          `Found ${searchRes.data.length} profiles matching "${query}".`,
        );
      } else {
        // If keyword search had no results, try fetching as a profile identifier
        try {
          const res = await linkedinApi.getProfile(query);
          if (res.success && res.data) {
            setSelectedProfile(res.data);
            const firstName =
              res.data.first_name ||
              (res.data.name ? res.data.name.split(" ")[0] : "there");
            setCustomMessage(
              `Hey ${firstName}, came across your profile and would love to connect!`,
            );
            setStatusMessage("");
            return;
          }
        } catch {
          // Ignore
        }
        setErrorMessage(
          searchRes.notice || `No LinkedIn profiles found matching "${query}".`,
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Failed to find LinkedIn profile.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  // -------------------------------------------------------------
  // 2. Select a profile from search results
  // -------------------------------------------------------------
  const handleSelectFromList = (person: any) => {
    setSelectedProfile(person);
    const firstName = person.name ? person.name.split(" ")[0] : "there";
    setCustomMessage(
      `Hey ${firstName}, came across your profile and would love to connect!`,
    );
    setErrorMessage("");
    setSuccessMessage("");
  };

  // -------------------------------------------------------------
  // 3. Send Connection Request via POST /api/v1/users/invite
  // -------------------------------------------------------------
  const handleSendInvite = async () => {
    if (!selectedProfile) return;

    setIsSending(true);
    setErrorMessage("");
    setSuccessMessage("");
    setStatusMessage("Sending connection invitation via Unipile...");

    try {
      const targetIdentifier =
        selectedProfile.provider_id ||
        selectedProfile.linkedin_id ||
        selectedProfile.public_identifier ||
        selectedProfile.name;

      const res = await linkedinApi.sendConnection({
        providerId: selectedProfile.provider_id || selectedProfile.linkedin_id,
        identifier: selectedProfile.public_identifier,
        person: selectedProfile,
        message: customMessage.trim() || undefined,
      });

      if (res.success) {
        setSuccessMessage(
          res.message ||
            `Connection invitation sent to ${selectedProfile.name}!`,
        );
        setStatusMessage("");
        if (onConnectionSent) {
          onConnectionSent();
        }
      } else {
        setErrorMessage(res.message || "Failed to send connection request.");
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Failed to dispatch connection request via LinkedIn.",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-white/1 bg-white dark:bg-[#0c0d12] shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#0A66C2]/10 dark:bg-[#0A66C2]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/8 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0A66C2]/10 dark:bg-[#0A66C2]/15 border border-[#0A66C2]/20 dark:border-[#0A66C2]/30 flex items-center justify-center">
              <LinkedInIcon className="w-4 h-4 text-[#0A66C2]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white/95">
                Find on LinkedIn & Send Invite
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/50">
                Direct Unipile profile discovery & invitation dispatch
              </p>
            </div>
          </div>

          {!isSending && (
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/6 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body Container */}
        <div className="py-4 space-y-4 overflow-y-auto pr-1 flex-1 relative z-10">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="text-xs font-medium text-slate-700 dark:text-white/80 flex items-center justify-between">
              <span>Enter LinkedIn Username, Profile URL, or Keyword</span>
              <span className="text-[10px] text-slate-400 dark:text-white/40 font-mono">
                e.g. satyanadella
              </span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                <input
                  type="text"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder="e.g. satyanadella or https://linkedin.com/in/... or 'AI Engineer'"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-300 dark:border-white/8 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 text-xs focus:outline-none focus:border-[#0A66C2] transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !identifierInput.trim()}
                className="h-10 px-4 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md shadow-[#0A66C2]/20"
              >
                {isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>{isSearching ? "Searching..." : "Search"}</span>
              </button>
            </div>
          </form>

          {/* Alerts / Feedback */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {statusMessage && !errorMessage && !successMessage && (
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-[#0A66C2]/10 border border-blue-200 dark:border-[#0A66C2]/20 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-blue-500 dark:text-blue-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Multiple Results List */}
          {searchResults.length > 0 && !selectedProfile && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-700 dark:text-white/70 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Select a profile to invite:</span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {searchResults.map((p, idx) => (
                  <div
                    key={p.linkedin_id || idx}
                    onClick={() => handleSelectFromList(p)}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-white/2 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/6 hover:border-[#0A66C2]/40 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-white/90 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors truncate">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-white/50 truncate">
                        {p.designation}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-white/40 truncate mt-0.5">
                        {p.company} · {p.location}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-[#0A66C2]/20 hover:bg-[#0A66C2] text-blue-700 dark:text-blue-300 hover:text-white text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1"
                    >
                      <span>Select</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Profile Card & Connection Form */}
          {selectedProfile && (
            <div className="space-y-4 pt-1">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8 space-y-3 relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-[#0A66C2]/20 border border-blue-200 dark:border-[#0A66C2]/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm shrink-0">
                      {selectedProfile.name
                        ? selectedProfile.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : "LI"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white/95 truncate">
                          {selectedProfile.name}
                        </h3>
                        {selectedProfile.public_identifier && (
                          <span className="text-[10px] font-mono text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-500/20">
                            @{selectedProfile.public_identifier}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-white/60 line-clamp-2 mt-0.5">
                        {selectedProfile.designation ||
                          selectedProfile.headline ||
                          "LinkedIn Member"}
                      </p>
                    </div>
                  </div>

                  {selectedProfile.profile_url && (
                    <a
                      href={selectedProfile.profile_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/6 transition-colors shrink-0"
                      title="Open LinkedIn profile in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-white/45 pt-1 border-t border-slate-200 dark:border-white/4">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-white/30" />
                    <span className="truncate">
                      {selectedProfile.company || "Company"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-white/30" />
                    <span className="truncate">
                      {selectedProfile.location || "Location not specified"}
                    </span>
                  </div>
                </div>

                {selectedProfile.provider_id && (
                  <div className="text-[10px] font-mono text-slate-400 dark:text-white/30 truncate">
                    Provider ID: {selectedProfile.provider_id}
                  </div>
                )}
              </div>

              {/* Invitation Message Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-white/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Personalized Connection Note (Optional)</span>
                  </div>
                  <span
                    className={`text-[10px] ${customMessage.length > 300 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-white/40"}`}
                  >
                    {customMessage.length}/300
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Hey, came across your profile and would love to connect!"
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-300 dark:border-white/8 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 text-xs focus:outline-none focus:border-[#0A66C2] transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProfile(null);
                    setSuccessMessage("");
                    setErrorMessage("");
                  }}
                  className="px-3 py-2 rounded-lg text-xs text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/4 transition-colors cursor-pointer"
                >
                  Back to Search
                </button>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleSendInvite}
                  className="px-4 py-2 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#0A66C2]/20"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Invite...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Send Connection Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkedInProspectSearchModal;
