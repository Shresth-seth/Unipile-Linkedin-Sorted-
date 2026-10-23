export interface PricingPlan {
  id: string;
  name: string;
  badge?: string;
  popular?: boolean;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
}

export interface ComparisonRow {
  feature: string;
  category: string;
  starter: string | boolean;
  pro: string | boolean;
  team: string | boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "For individuals exploring intelligent outreach workflows.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "₹",
    features: [
      "1 workspace",
      "1 active campaign",
      "Basic prospect management",
      "Standard personalization",
      "Safe pacing & daily limits",
      "Manual review workflow",
    ],
    ctaText: "Start Free",
    ctaHref: "/register",
  },
  {
    id: "pro",
    name: "Pro",
    popular: true,
    badge: "MOST POPULAR",
    description: "For professionals running regular outreach campaigns.",
    monthlyPrice: 3499,
    yearlyPrice: 2799, // 20% discount
    currency: "₹",
    features: [
      "Multiple active campaigns",
      "Contextual AI personalization",
      "Up to 500 qualified prospects/mo",
      "Dedicated connection infrastructure",
      "Campaign analytics & pacing rules",
      "Smart follow-up automation",
      "Priority outreach queue",
    ],
    ctaText: "Choose Pro",
    ctaHref: "/register",
  },
  {
    id: "team",
    name: "Team",
    description:
      "For organizations that need a tailored rollout and managed onboarding.",
    monthlyPrice: 8999,
    yearlyPrice: 7199,
    currency: "₹",
    features: [
      "Everything in Pro",
      "Custom prospect capacity",
      "Managed account rollout",
      "Deployment and policy review",
      "Custom reporting exports",
      "Priority email support",
    ],
    ctaText: "Contact Us",
    ctaHref: "/contact",
  },
];

export const COMPARISON_FEATURES: ComparisonRow[] = [
  {
    feature: "Active Campaigns",
    category: "Campaigns",
    starter: "1",
    pro: "Multiple",
    team: "Custom",
  },
  {
    feature: "Prospect Discovery",
    category: "Campaigns",
    starter: "50 / mo",
    pro: "500 / mo",
    team: "Custom",
  },
  {
    feature: "Natural Language Composer",
    category: "Campaigns",
    starter: false,
    pro: true,
    team: true,
  },
  {
    feature: "AI Personalization",
    category: "Personalization",
    starter: "Basic",
    pro: "Contextual (LLM)",
    team: "Configured rollout",
  },
  {
    feature: "Automated Follow-ups",
    category: "Personalization",
    starter: false,
    pro: true,
    team: true,
  },
  {
    feature: "Connection Infrastructure",
    category: "Safety",
    starter: "Shared",
    pro: "Dedicated",
    team: "Custom allocation",
  },
  {
    feature: "Pacing & Safety Controls",
    category: "Safety",
    starter: true,
    pro: true,
    team: true,
  },
  {
    feature: "Workspace Setup",
    category: "Workspace",
    starter: "1",
    pro: "1",
    team: "Managed rollout",
  },
  {
    feature: "Data Export",
    category: "Integrations",
    starter: false,
    pro: "CSV",
    team: "Custom exports",
  },
  {
    feature: "Support",
    category: "Support",
    starter: "Community",
    pro: "Standard Email",
    team: "Priority support",
  },
];

export const PRICING_FAQS: FAQItem[] = [
  {
    question: "Can I change plans later?",
    answer:
      "Yes, you can upgrade or downgrade your workspace plan at any time. When upgrading, changes and additional quotas apply immediately.",
  },
  {
    question: "Does WORKPILOT require a LinkedIn account?",
    answer:
      "Yes. You connect a professional LinkedIn account so WORKPILOT can organize supported discovery, outreach, and connection workflows on your behalf.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. Subscriptions are billed on a month-to-month or annual basis. You can cancel at any time with zero penalties or lock-in.",
  },
  {
    question: "Is there a team plan?",
    answer:
      "Team deployments are scoped with our team before purchase. Contact us to review account volume, rollout needs, and support requirements.",
  },
  {
    question: "Are API and integration limits included?",
    answer:
      "Standard cloud proxy allocations and AI reasoning requests are included within the monthly quotas of each plan. No surprise overage bills.",
  },
];
