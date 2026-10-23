import type { Metadata } from "next";
import PageShell from "@/components/public/page-shell";
import PageHero from "@/components/public/page-hero";
import FinalProductCTA from "@/components/public/final-product-cta";
import ResourcesHub from "@/components/resources/resources-hub";

export const metadata: Metadata = {
  title: "Resources — WORKPILOT",
  description:
    "Explore actionable guides, outreach benchmarks, and product updates on building intelligent networking workflows with WORKPILOT.",
};

export default function ResourcesPage() {
  return (
    <PageShell>
      {/* Hero */}
      <PageHero
        eyebrow="RESOURCES & KNOWLEDGE"
        title="Ideas, guides and updates for"
        titleAccent="better outreach."
        description="Learn how to build thoughtful campaigns, improve professional networking, and get more out of your WORKPILOT workspace."
      />

      {/* Main Hub */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ResourcesHub />
        </div>
      </section>

      {/* Final CTA */}
      <FinalProductCTA
        title="Put these outreach principles into practice."
        subtitle="Create your workspace and start connecting with relevant professionals today."
        primaryText="Create Free Workspace"
        primaryHref="/register"
        secondaryText="View How It Works"
        secondaryHref="/how-it-works"
      />
    </PageShell>
  );
}
