import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "WORKPILOT — Safe & Complete LinkedIn Automation",
  description:
    "Automate your LinkedIn outreach safely. Scale connection requests, follow-ups, and pipeline generation with human-like pacing and complete account protection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased font-sans"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          href="/vidoes/blue-light-glow.mp4"
          as="video"
          type="video/mp4"
        />
        {/* Pre-hydration theme initialization script — prevents flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var t = localStorage.getItem('WORKPILOT_theme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    var d = document.documentElement;
    d.classList.add(t);
    d.classList.remove(t === 'dark' ? 'light' : 'dark');
    d.style.colorScheme = t;
  } catch(e) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();
`,
          }}
        />
      </head>
      <body
        className="min-h-full bg-app-background text-app-foreground font-sans"
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
