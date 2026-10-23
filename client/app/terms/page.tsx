import type { Metadata } from "next";
import PageShell from "@/components/public/page-shell";

export const metadata: Metadata = {
  title: "Terms of Service — WORKPILOT",
  description:
    "Review the terms and conditions governing your use of the WORKPILOT outreach automation platform.",
};

export default function TermsPage() {
  return (
    <PageShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="pb-8 border-b border-slate-200 dark:border-white/6 mb-8 space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold font-heading text-slate-950 dark:text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 font-mono">
            Effective: September 26, 2026
          </p>
        </div>

        {/* Legal Text Content */}
        <div className="space-y-8 text-xs sm:text-sm text-slate-600 dark:text-white/70 leading-relaxed font-normal">
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using WORKPILOT (&quot;the Service&quot;), you
              agree to be bound by these Terms of Service. If you do not agree
              to these terms, please do not use or access the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              2. Eligibility and Accounts
            </h2>
            <p>
              You must be at least 18 years of age and capable of entering into
              legally binding contracts to create an account. You are
              responsible for safeguarding your login credentials and for all
              activities conducted under your workspace account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              3. Connected Third-Party Platforms (LinkedIn)
            </h2>
            <p>
              WORKPILOT enables users to coordinate communication on third-party
              professional networks, primarily LinkedIn. You acknowledge that
              your use of third-party platforms remains subject to those
              platforms&apos; respective User Agreements and Terms of Service.
            </p>
            <p>
              While WORKPILOT incorporates automated pacing, volume limits, and
              pause controls designed to reduce excessive activity, third-party
              platforms may restrict automated activity. You maintain full
              responsibility for your account actions, content, recipients, and
              adherence to applicable network policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              4. Acceptable Use and Prohibitions
            </h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-white/60">
              <li>
                Send abusive, harassing, deceptive, fraudulent, or unlawful
                communications
              </li>
              <li>
                Exceed recommended daily pacing thresholds or bypass safety
                guardrails
              </li>
              <li>
                Scrape, harvest, or distribute private information without
                legitimate consent
              </li>
              <li>
                Attempt to reverse-engineer, disrupt, or compromise the platform
                infrastructure
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              5. Subscriptions, Fees, and Cancellations
            </h2>
            <p>
              Certain workspace plans require paid recurring subscriptions.
              Subscription fees are billed in advance on a monthly or annual
              cycle. You may cancel your subscription at any time; your service
              will remain accessible through the end of the paid billing period.
              Taxes may apply. Except where required by law, completed billing
              periods are non-refundable.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              6. Disclaimers and Limitation of Liability
            </h2>
            <p>
              The Service is provided on an &quot;as is&quot; and &quot;as
              available&quot; basis without warranties of any kind, whether
              express or implied. WORKPILOT does not guarantee specific response
              rates, conversion outcomes, or uninterrupted service.
            </p>
            <p>
              To the maximum extent permitted by applicable law, WORKPILOT and
              its operators shall not be liable for indirect, incidental,
              punitive, or consequential damages resulting from your use of the
              platform.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/6">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              7. Contact Information
            </h2>
            <p>
              For legal questions, inquiries, or notices regarding these terms,
              please contact us at{" "}
              <a
                href="/contact"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                /contact
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
