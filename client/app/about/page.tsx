import type { Metadata } from "next";
import PageShell from "@/components/public/page-shell";
import PageHero from "@/components/public/page-hero";
import SectionHeading from "@/components/public/section-heading";
import FinalProductCTA from "@/components/public/final-product-cta";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "About — WORKPILOT",
  description:
    "Learn why we are building WORKPILOT: to replace repetitive spreadsheets with thoughtful, contextual, and safe professional networking workflows.",
};

export default function AboutPage() {
  return (
    <PageShell>
      {/* Hero */}
      <PageHero
        eyebrow="ABOUT WORKPILOT"
        title="Professional networking"
        titleAccent="deserves better tools."
        description="WORKPILOT is being built to make outreach easier to understand, organize, and manage — without turning human relationships into cold, mechanical spreadsheets."
        primaryAction={{
          label: "Start Connecting Free",
          href: "/register",
        }}
        secondaryAction={{
          label: "Explore Product",
          href: "/product",
        }}
      />

      {/* Story: Why we're building it */}
      <section className="py-16 sm:py-24 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-3">
            <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              OUR MISSION
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold font-heading text-slate-950 dark:text-white tracking-tight">
              Why we&apos;re building WORKPILOT
            </h2>
          </div>

          <div className="space-y-5 text-sm sm:text-base text-slate-600 dark:text-white/70 leading-relaxed font-normal">
            <p>
              Professional outreach today is trapped between two flawed
              extremes: either spending hours manually copy-pasting notes into
              generic LinkedIn search filters, or resorting to aggressive,
              spammy automated bots that risk your account standing and destroy
              goodwill.
            </p>
            <p>
              We believe networking should feel thoughtful, natural, and
              respectful of both parties&apos; time. Modern machine learning
              enables software to understand the true semantic context of what
              you want to achieve — who you are looking for, what challenges you
              solve, and why a specific person is genuinely relevant.
            </p>
            <p>
              WORKPILOT automates the busywork — candidate filtering, pacing
              rate limits, proxy rotation, and status tracking — while keeping
              you in full control of your message and relationship context.
            </p>
          </div>
        </div>
      </section>

      {/* Principles Section */}
      <section className="py-16 sm:py-24 border-t border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-white/1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="OUR PHILOSOPHY"
            title="The principles guiding our product."
            subtitle="How we make design decisions, prioritize features, and safeguard your professional reputation."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {[
              {
                title: "Context over volume",
                desc: "Sending 15 deeply relevant, context-aware messages yields vastly higher response rates than blasting 200 impersonal connection requests.",
              },
              {
                title: "Simple over complicated",
                desc: "You should not need a 40-page tutorial to launch a campaign. State your intent naturally and let the workspace handle the underlying parameters.",
              },
              {
                title: "Workflow over busywork",
                desc: "Discovery, evaluation, dispatching, and reply tracking belong in one calm interface, eliminating scattered browser tabs and CSV sheets.",
              },
              {
                title: "People over metrics",
                desc: "Behind every LinkedIn profile is a real human being. Every interaction should respect their time, offer value, and preserve long-term trust.",
              },
            ].map((p) => (
              <div
                key={p.title}
                className="p-6 rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 space-y-2.5 shadow-xs"
              >
                <div className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {p.title}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-white/60 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKPILOTX AI Ecosystem Section */}
      <section className="py-16 sm:py-20 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-mono select-none">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI PLATFORM ECOSYSTEM</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-950 dark:text-white">
            Built with WORKPILOTX AI
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/60 leading-relaxed max-w-xl mx-auto">
            WORKPILOT is part of the broader WORKPILOTX AI software ecosystem,
            dedicated to creating practical, high-leverage artificial
            intelligence tools for founders, developers, and enterprise teams.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <FinalProductCTA
        title="Experience more thoughtful professional outreach."
        subtitle="Create your account and launch your first AI-guided campaign in minutes."
        primaryText="Get Started Free"
        primaryHref="/register"
        secondaryText="View Pricing"
        secondaryHref="/pricing"
      />
    </PageShell>
  );
}
