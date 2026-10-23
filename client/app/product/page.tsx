import type { Metadata } from "next";
import PageShell from "@/components/public/page-shell";
import PageHero from "@/components/public/page-hero";
import SectionHeading from "@/components/public/section-heading";
import FinalProductCTA from "@/components/public/final-product-cta";

// Product Section Components
import ProductHeroPreview from "@/components/product/product-hero-preview";
import DiscoveryTransform from "@/components/product/discovery-transform";
import PersonalizationSplit from "@/components/product/personalization-split";
import CampaignLifecycle from "@/components/product/campaign-lifecycle";

export const metadata: Metadata = {
  title: "Product — WORKPILOT",
  description:
    "One intelligent workspace for modern LinkedIn outreach: natural language discovery, candidate qualification, contextual personalization, and automated campaigns.",
};

export default function ProductPage() {
  return (
    <PageShell>
      {/* Product Hero */}
      <PageHero
        eyebrow="THE WORKPILOT WORKSPACE"
        title="One workspace for"
        titleAccent="modern outreach."
        description="Find relevant professionals, organize outreach, personalize interactions and keep every campaign moving from one intelligent workspace."
        primaryAction={{
          label: "Start Connecting",
          href: "/register",
        }}
        secondaryAction={{
          label: "View How It Works",
          href: "/how-it-works",
        }}
      >
        <ProductHeroPreview />
      </PageHero>

      {/* SECTION 1: DISCOVERY */}
      <section className="py-16 sm:py-24 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="DISCOVERY"
            title="Start with intent, not filters."
            subtitle="Describe who you want to reach in natural language. WORKPILOT translates your goals into structured criteria and uncovers candidates with verified relevance."
          />
          <DiscoveryTransform />
        </div>
      </section>

      {/* SECTION 2: UNDERSTAND */}
      <section className="py-16 sm:py-24 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="UNDERSTAND"
            title="Know who matters before you reach out."
            subtitle="Every prospect is evaluated with clear match scoring and background signals so you never waste connection requests on cold or inactive profiles."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                name: "Arjun Mehta",
                role: "Founder & CEO · Nexa AI",
                match: "94%",
                signals: [
                  "Building LLM agent orchestration",
                  "Recent benchmark post",
                  "Bengaluru, India",
                ],
                status: "High Intent",
              },
              {
                name: "Sara Verma",
                role: "Lead AI Engineer · Neural Labs",
                match: "91%",
                signals: [
                  "Active open-source contributor",
                  "Mentions vLLM in profile",
                  "Verified Active",
                ],
                status: "Relevant Peer",
              },
              {
                name: "Rohan Jain",
                role: "Co-Founder · Stackly",
                match: "87%",
                signals: [
                  "Developer tooling founder",
                  "Past interaction in network",
                  "High Acceptance Rate",
                ],
                status: "Qualified",
              },
            ].map((card) => (
              <div
                key={card.name}
                className="p-5 rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 hover:border-blue-500/30 transition-all space-y-4 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white/90">
                      {card.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-white/45 mt-0.5">
                      {card.role}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-transparent px-2 py-0.5 rounded">
                    {card.match}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/4">
                  {card.signals.map((sig) => (
                    <div
                      key={sig}
                      className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-white/60 font-medium"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <span>{sig}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-white/40">
                  <span>
                    Status:{" "}
                    <strong className="text-slate-900 dark:text-white/70 font-semibold">
                      {card.status}
                    </strong>
                  </span>
                  <span className="text-blue-700 dark:text-blue-400 font-semibold">
                    View Context →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: PERSONALIZATION */}
      <section className="py-16 sm:py-24 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="PERSONALIZATION"
            title="Every conversation starts with context."
            subtitle="Avoid templated spam. WORKPILOT crafts distinct, character-limited connection notes referencing recent work, technical challenges, or shared industry focus."
          />
          <PersonalizationSplit />
        </div>
      </section>

      {/* SECTION 4: CAMPAIGNS */}
      <section className="py-16 sm:py-24 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="CAMPAIGNS"
            title="Keep every workflow moving."
            subtitle="Coordinate discovery, connection dispatching, inbox response alerts, and follow-ups across an automated lifecycle."
          />
          <CampaignLifecycle />
        </div>
      </section>

      {/* SECTION 5: INTEGRATIONS */}
      <section className="py-16 sm:py-24 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="INTEGRATIONS"
            title="Connect the tools that power your outreach."
            subtitle="Built on hosted provider APIs, configurable pacing controls, and contextual AI reasoning models."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: "LinkedIn Integration",
                role: "Channel & Outreach Execution",
                desc: "Seamless profile linking with verified humanized pacing to protect account standing.",
                badge: "Active Channel",
              },
              {
                title: "Gemini Reasoning",
                role: "Context & Intent Model",
                desc: "Frontier LLM analysis for deep candidate scoring, topic extraction, and message crafting.",
                badge: "AI Engine",
              },
              {
                title: "Tavily Deep Search",
                role: "Web & Signal Discovery",
                desc: "Real-time web research into candidate announcements, articles, and product releases.",
                badge: "Realtime Signals",
              },
              {
                title: "Cloud Proxy Network",
                role: "Hosted Connection Layer",
                desc: "Dedicated IP gateways prevent velocity spikes and keep account actions secure.",
                badge: "Safety Protocol",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-5 rounded-xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/6 flex flex-col justify-between space-y-3 shadow-xs"
              >
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-transparent px-2 py-0.5 rounded uppercase">
                    {item.badge}
                  </span>
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white/90 mt-2.5">
                    {item.title}
                  </h3>
                  <div className="text-[11px] text-slate-500 dark:text-white/40 mb-2 font-medium">
                    {item.role}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <FinalProductCTA
        title="Everything you need to turn outreach into a workflow."
        subtitle="Start building smarter candidate and networking pipelines today with WORKPILOT."
        primaryText="Get Started Free"
        primaryHref="/register"
        secondaryText="See Pricing"
        secondaryHref="/pricing"
      />
    </PageShell>
  );
}
