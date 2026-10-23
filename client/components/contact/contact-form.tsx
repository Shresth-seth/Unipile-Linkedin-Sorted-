"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, Loader2 } from "lucide-react";
import { contactApi } from "@/lib/api";

export const ContactForm: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState("Product question");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [website, setWebsite] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await contactApi.submit({ name, email, company, topic, message, website });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Your message could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/8 p-8 sm:p-12 text-center space-y-3 max-w-lg mx-auto shadow-md dark:shadow-none">
        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Message received</h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-white/60 leading-relaxed">
          Thanks for reaching out, {name.split(" ")[0]}. Our team will review
          your note and get back to you shortly at {email}.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/8 p-6 sm:p-8 space-y-4 max-w-lg mx-auto shadow-sm dark:shadow-none"
    >
      <div className="hidden" aria-hidden="true">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-white/70">Your Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Harsh Pandey"
          required
          className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-300 dark:border-white/8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-white/70">
          Work Email *
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="harsh@company.com"
          required
          className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-300 dark:border-white/8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-white/70">
          Company / Organization
        </label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Labs"
          className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-300 dark:border-white/8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-white/70">Topic</label>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-[#0d0e12] border border-slate-300 dark:border-white/8 text-xs text-slate-900 dark:text-white/80 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="Product question">Product question</option>
          <option value="Partnership">Partnership</option>
          <option value="Team plan">Team plan</option>
          <option value="Feedback">Feedback</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-white/70">Message *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          required
          placeholder="Tell us what you'd like to talk about..."
          className="w-full p-3 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-300 dark:border-white/8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
        />
      </div>

      <div className="pt-2">
        {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-blue-600/20 disabled:opacity-60"
        >
          <span>{submitting ? "Sending..." : "Send message"}</span>
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </form>
  );
};

export default ContactForm;
