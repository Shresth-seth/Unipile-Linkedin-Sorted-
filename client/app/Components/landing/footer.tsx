"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useInView } from "motion/react";
import Logo from "./Logo";

const footerLinks = {
  product: [
    { name: "Product", href: "/product" },
    { name: "How It Works", href: "/how-it-works" },
    { name: "Pricing", href: "/pricing" },
  ],
  resources: [{ name: "Resources", href: "/resources" }],
  company: [
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ],
  legal: [
    { name: "Privacy", href: "/privacy" },
    { name: "Terms", href: "/terms" },
  ],
};

export const Footer: React.FC = () => {
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"],
  });

  const wordmarkY = useTransform(scrollYProgress, [0, 1], ["20%", "-5%"]);

  return (
    <footer
      ref={containerRef}
      className="relative w-full bg-white dark:bg-WORKPILOT-dark border-t border-slate-200 dark:border-white/10 pt-20 pb-12 overflow-hidden"
    >
      {/* Top Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-45 bg-blue-500/10 dark:bg-blue-950/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16"
        >
          {/* Brand Column (Left - 5 cols) */}
          <div className="md:col-span-4 space-y-4">
            <Link href="/" className="inline-block" aria-label="WORKPILOT Home">
              <Logo size="md" />
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
              Professional outreach, made more intelligent. Discover high-intent
              contacts, personalize every connection, and automate campaign
              workflows safely.
            </p>
          </div>

          {/* Navigation Links Columns (Right - 8 cols) */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {/* Product Column */}
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300 mb-4">
                Product
              </h4>
              <ul className="space-y-3 text-sm">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="group relative inline-block text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors duration-150 font-medium"
                    >
                      <span>{link.name}</span>
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-blue-600 dark:bg-blue-400 transition-all duration-200 group-hover:w-full" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources Column */}
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300 mb-4">
                Resources
              </h4>
              <ul className="space-y-3 text-sm">
                {footerLinks.resources.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="group relative inline-block text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors duration-150 font-medium"
                    >
                      <span>{link.name}</span>
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-blue-600 dark:bg-blue-400 transition-all duration-200 group-hover:w-full" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300 mb-4">
                Company
              </h4>
              <ul className="space-y-3 text-sm">
                {footerLinks.company.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="group relative inline-block text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors duration-150 font-medium"
                    >
                      <span>{link.name}</span>
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-blue-600 dark:bg-blue-400 transition-all duration-200 group-hover:w-full" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Column */}
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300 mb-4">
                Legal
              </h4>
              <ul className="space-y-3 text-sm">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="group relative inline-block text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors duration-150 font-medium"
                    >
                      <span>{link.name}</span>
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-blue-600 dark:bg-blue-400 transition-all duration-200 group-hover:w-full" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Oversized Parallax Background Wordmark (WORKPILOT) */}
        <div className="relative w-full overflow-hidden flex justify-center py-6 sm:py-10 select-none pointer-events-none">
          <motion.div
            style={{ y: wordmarkY }}
            className="font-heading font-black text-[9.5vw] leading-none tracking-tighter uppercase text-slate-900/20 dark:text-white/5 whitespace-nowrap"
          >
            WORKPILOT
          </motion.div>
        </div>

        {/* Bottom Bar Divider & Copyright */}
        <div className="pt-8 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>© 2026 WORKPILOT. All rights reserved.</div>
          <div className="flex items-center gap-1.5">
            <span>Built by</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-bold tracking-wide">
              WORKPILOTX AI
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
