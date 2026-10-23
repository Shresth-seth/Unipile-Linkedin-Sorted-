import type { Metadata } from "next";
import PageShell from "@/components/public/page-shell";
import PageHero from "@/components/public/page-hero";
import ContactForm from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact — WORKPILOT",
  description:
    "Get in touch with the WORKPILOT team for product inquiries, custom team workspaces, or partnerships.",
};

export default function ContactPage() {
  return (
    <PageShell>
      {/* Hero */}
      <PageHero
        eyebrow="GET IN TOUCH"
        title="Let's"
        titleAccent="talk."
        description="Questions, partnerships, team inquiries, or product feedback? We'd love to hear from you."
      />

      {/* Form Section */}
      <section className="py-10 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ContactForm />
        </div>
      </section>
    </PageShell>
  );
}
