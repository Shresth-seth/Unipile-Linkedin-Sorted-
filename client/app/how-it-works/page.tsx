import type { Metadata } from "next";
import PageShell from "@/components/public/page-shell";
import PageHero from "@/components/public/page-hero";
import FinalProductCTA from "@/components/public/final-product-cta";
import InteractiveWalkthrough from "@/components/how-it-works/interactive-walkthrough";

export const metadata: Metadata = {
  title: "How It Works — WORKPILOT",
  description:
    "Explore the 7-step journey from natural language intent to structured LinkedIn candidate discovery, personalized outreach, and live campaign tracking.",
};

export default function HowItWorksPage() {
  return (
    <PageShell>
      {/* Hero */}
      <PageHero
        eyebrow="HOW WORKPILOT WORKS"
        title="From a simple goal to an"
        titleAccent="organized campaign."
        description="Describe who you want to reach. WORKPILOT helps turn that intent into a structured outreach workflow with automated qualification and human-like pacing."
        primaryAction={{
          label: "Create your workspace",
          href: "/register",
        }}
        secondaryAction={{
          label: "Explore Product",
          href: "/product",
        }}
      />

      {/* Main Experience: 7-Step Interactive Walkthrough */}
      <section className="py-16 sm:py-20 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-2">
              STEP-BY-STEP BREAKDOWN
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-slate-950 dark:text-white tracking-tight">
              Anatomy of an autonomous campaign
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-white/50 mt-2 leading-relaxed">
              Follow how intent transforms into candidate profiles, customized
              outreach notes, and active pipeline conversations.
            </p>
          </div>

          <InteractiveWalkthrough />
        </div>
      </section>

      {/* Final CTA */}
      <FinalProductCTA
        title="You set the direction. WORKPILOT keeps the workflow organized."
        subtitle="Start building thoughtful, high-conversion networking campaigns without spreadsheets."
        primaryText="Create your workspace"
        primaryHref="/register"
        secondaryText="View Pricing"
        secondaryHref="/pricing"
      />
    </PageShell>
  );
}
