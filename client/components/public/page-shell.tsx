"use client";

import React from "react";
import { motion } from "motion/react";
import Navbar from "@/app/Components/landing/Navbar";
import Footer from "@/app/Components/landing/footer";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export const PageShell: React.FC<PageShellProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050608] text-slate-900 dark:text-white selection:bg-blue-600 selection:text-white antialiased overflow-x-hidden">
      {/* Public Navbar */}
      <Navbar />

      {/* Main Page Entrance Animation */}
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={`pt-24 sm:pt-28 pb-16 ${className}`}
      >
        {children}
      </motion.main>

      {/* Public Footer */}
      <Footer />
    </div>
  );
};

export default PageShell;
