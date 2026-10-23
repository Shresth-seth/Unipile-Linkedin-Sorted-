import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — WORKPILOT",
  description: "Manage your intelligent LinkedIn outreach campaigns.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050608] text-slate-900 dark:text-white/90 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {children}
    </div>
  );
}
