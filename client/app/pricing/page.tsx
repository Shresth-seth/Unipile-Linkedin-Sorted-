import type { Metadata } from "next";
import PageShell from "@/components/public/page-shell";
import PageHero from "@/components/public/page-hero";
import FinalProductCTA from "@/components/public/final-product-cta";
import PricingSection from "@/components/pricing/pricing-section";

export const metadata: Metadata = {
  title: "Pricing — WORKPILOT",
  description:
    "Simple, predictable plans for founders and professionals using paced LinkedIn outreach and contextual AI.",
};

export default function PricingPage() {
  return (
    <PageShell>
      {/* Hero */}
      <PageHero
        eyebrow="SIMPLE PRICING"
        title="Start small. Scale when your"
        titleAccent="outreach grows."
        description="Choose the workspace that fits your outreach needs. Transparent monthly or discounted annual pricing with zero hidden surcharges."
      />

      {/* Pricing Matrix & FAQ Section */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PricingSection />
        </div>
      </section>

      {/* Final CTA */}
      <FinalProductCTA
        title="Start building better outreach workflows."
        subtitle="Test autonomous prospect discovery and contextual outreach in your own workspace today."
        primaryText="Get Started"
        primaryHref="/register"
        secondaryText="Contact Us"
        secondaryHref="/contact"
      />
    </PageShell>
  );
}
