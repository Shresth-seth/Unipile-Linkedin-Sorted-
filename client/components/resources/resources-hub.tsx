"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

interface ResourceArticle {
  id: string;
  category: "Guides" | "Product" | "Outreach" | "Updates";
  title: string;
  description: string;
  readTime: string;
  date: string;
  accent: string;
}

const ARTICLES: ResourceArticle[] = [
  {
    id: "1",
    category: "Guides",
    title: "Building your first 7-day outreach campaign",
    description:
      "A systematic approach to structuring intent, vetting initial candidates, and scheduling human-paced touches.",
    readTime: "6 min read",
    date: "Sep 2026",
    accent: "from-blue-600/20 to-blue-900/10",
  },
  {
    id: "2",
    category: "Outreach",
    title: "Personalization without sounding automated",
    description:
      "Why generic template merge tags fail on LinkedIn, and how to extract genuine conversational hooks from public signals.",
    readTime: "4 min read",
    date: "Aug 2026",
    accent: "from-sky-600/20 to-blue-900/10",
  },
  {
    id: "3",
    category: "Product",
    title: "Understanding campaign quality and match scores",
    description:
      "An inside look at how our frontier LLM evaluates relevance thresholds and intent signals before connection dispatch.",
    readTime: "5 min read",
    date: "Aug 2026",
    accent: "from-indigo-600/20 to-purple-900/10",
  },
  {
    id: "4",
    category: "Guides",
    title: "Five common mistakes that hurt professional outreach",
    description:
      "Avoiding pitch slaps, aggressive follow-up cadence, and irrelevant targeting to maintain high acceptance rates.",
    readTime: "7 min read",
    date: "Jul 2026",
    accent: "from-blue-600/20 to-cyan-900/10",
  },
  {
    id: "5",
    category: "Guides",
    title: "Reviewing a campaign before launch",
    description:
      "A practical checklist for validating audience fit, message relevance, daily limits, and follow-up intent.",
    readTime: "5 min read",
    date: "Jul 2026",
    accent: "from-emerald-600/20 to-teal-900/10",
  },
  {
    id: "6",
    category: "Updates",
    title: "Introducing WORKPILOT: Intelligent Autonomous Networking",
    description:
      "An overview of natural-language campaign orchestration, review controls, and account pacing settings.",
    readTime: "3 min read",
    date: "Jun 2026",
    accent: "from-blue-600/20 to-indigo-900/10",
  },
];

export const ResourcesHub: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const filteredArticles = ARTICLES.filter((a) => {
    if (selectedCategory === "All") return true;
    return a.category === selectedCategory;
  });

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* 1. FEATURED RESOURCE HERO CARD */}
      <div className="rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/8 p-6 sm:p-10 relative overflow-hidden shadow-sm dark:shadow-none">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
              FEATURED GUIDE
            </span>
            <span className="text-slate-500 dark:text-white/40 text-xs font-mono">
              10 min read
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-slate-950 dark:text-white tracking-tight">
            How to build your first intelligent outreach campaign
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/60 leading-relaxed">
            A comprehensive, practical walkthrough covering audience definition,
            intent extraction, human-pacing safety guardrails, and contextual
            response management.
          </p>

          <div className="pt-2">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer group"
            >
              <span>Read complete guide</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. CATEGORY FILTER BUTTONS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          "All",
          "Guides",
          "Product",
          "Outreach",
          "Updates",
        ].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
              selectedCategory === cat
                ? "bg-blue-600 text-white font-semibold shadow-sm"
                : "bg-white dark:bg-white/3 text-slate-700 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/6 border border-slate-200 dark:border-white/5"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 3. ARTICLES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.map((article) => (
          <article
            key={article.id}
            className="rounded-xl bg-white dark:bg-white/1.5 border border-slate-200 dark:border-white/6 hover:border-slate-300 dark:hover:border-white/[0.14] shadow-xs hover:shadow-sm transition-all p-5 flex flex-col justify-between group space-y-4"
          >
            {/* Abstract Graphic Placeholder */}
            <div
              className={`w-full h-32 rounded-lg bg-linear-to-tr ${article.accent} border border-slate-100 dark:border-white/5 p-3 flex flex-col justify-between relative overflow-hidden`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-white/50">
                <span>{article.category}</span>
                <span>{article.date}</span>
              </div>
              <div className="h-0.5 w-1/3 bg-blue-600/40 dark:bg-blue-400/40 rounded-full" />
            </div>

            <div className="space-y-2 flex-1">
              <span className="text-[10px] font-mono font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                {article.category}
              </span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white/90 group-hover:text-blue-600 dark:group-hover:text-white transition-colors leading-snug">
                {article.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-white/50 leading-relaxed line-clamp-2">
                {article.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/4 flex items-center justify-between text-[11px] text-slate-500 dark:text-white/40">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                {article.readTime}
              </span>
              <span className="text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium">
                Overview
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-10 text-center dark:border-white/7">
        <p className="text-sm text-slate-600 dark:text-white/50">Need help with a specific workflow?</p>
        <Link href="/contact" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
          Contact support <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

export default ResourcesHub;
