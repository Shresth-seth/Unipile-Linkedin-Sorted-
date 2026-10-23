import type { Metadata } from "next";
import PageShell from "@/components/public/page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — WORKPILOT",
  description:
    "Read the WORKPILOT privacy policy regarding data collection, connected accounts, and user rights.",
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="pb-8 border-b border-slate-200 dark:border-white/6 mb-8 space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold font-heading text-slate-950 dark:text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 font-mono">
            Effective: September 26, 2026
          </p>
        </div>

        {/* Legal Text Content */}
        <div className="space-y-8 text-xs sm:text-sm text-slate-600 dark:text-white/70 leading-relaxed font-normal">
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              1. Information We Collect
            </h2>
            <p>
              We collect information you provide directly to us when creating an
              account, launching outreach campaigns, or communicating with our
              support team. This includes your name, email address, password
              hash, and campaign targeting preferences.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              2. Connected Third-Party Services (LinkedIn)
            </h2>
            <p>
              When you connect your LinkedIn account to WORKPILOT, our platform
              accesses basic profile data and session cookies necessary to
              execute search queries and dispatch connection requests according
              to your configured campaign parameters.
            </p>
            <p>
              We do not sell, rent, or monetize your LinkedIn session
              credentials or your contacts&apos; personal data to third parties.
              Connected-account credentials are encrypted at rest and are
              removed when you disconnect or delete your workspace.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              3. How Information is Used
            </h2>
            <p>We utilize collected information to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-white/60">
              <li>
                Provide, maintain, and optimize our campaign workspace services
              </li>
              <li>
                Parse natural-language outreach queries and evaluate candidate
                match criteria
              </li>
              <li>
                Route requested actions through connected integration
                infrastructure and apply configured pacing limits
              </li>
              <li>
                Provide customer support and dispatch notifications when
                prospects reply
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              4. Service Providers
            </h2>
            <p>
              We use specialist providers to operate the Service, including
              infrastructure hosting, Unipile for connected-account access,
              Google Gemini for configured AI features, Razorpay for billing,
              and Resend for transactional email. Each provider receives only
              the information reasonably required to deliver its service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              5. Cookies and Local Storage
            </h2>
            <p>
              We use browser local storage and essential session cookies to
              remember your login state, active workspace preferences, and user
              interface selections across page refreshes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              6. Data Retention and Security
            </h2>
            <p>
              We retain personal data only for as long as your workspace account
              remains active or as required for billing, fraud prevention, and
              legal obligations. We implement transport encryption (TLS),
              encrypted credential storage, access controls, and secure session
              cookies. Payment card and bank details are handled by Razorpay and
              are not stored by WORKPILOT.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              7. Your Rights and Choices
            </h2>
            <p>
              You have the right to access, update, export, or request the
              deletion of your account and associated campaign history at any
              time through workspace settings or by contacting our team.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              8. Changes to this Policy
            </h2>
            <p>
              We may update this privacy policy periodically to reflect platform
              improvements or legal requirements. Material updates will be
              communicated through our website or via workspace alerts.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/6">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-heading">
              9. Contact
            </h2>
            <p>
              For any questions regarding this policy or data protection, please
              reach out via our contact page at{" "}
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
