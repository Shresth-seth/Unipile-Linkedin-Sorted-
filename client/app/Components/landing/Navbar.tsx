"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X, Sun, Moon, LayoutDashboard } from "lucide-react";
import Logo from "./Logo";
import { useTheme } from "@/components/theme-provider";
import { isAuthenticated } from "@/lib/storage";

const navLinks = [
  { name: "Product", href: "/product" },
  { name: "How It Works", href: "/how-it-works" },
  { name: "Pricing", href: "/pricing" },
  { name: "Resources", href: "/resources" },
  { name: "About", href: "/about" },
];

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Only use dark foreground (white logo/nav) when at top of landing AND in dark mode
  const isLandingTop = pathname === "/" && !isScrolled;
  const isLightMode = theme === "light";
  const heroUsesDarkForeground = isLandingTop && !isLightMode;

  // Use dark (white text/logo) appearance when hero is dark OR scrolled and dark mode
  const useDarkAppearance =
    heroUsesDarkForeground || (!isLandingTop && !isLightMode);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isLandingTop
          ? "bg-transparent border-b border-transparent py-4 sm:py-5"
          : isLightMode
            ? "bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm py-3.5"
            : "bg-black/85 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/40 py-3.5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link
            href="/"
            className="group transition-opacity duration-200 hover:opacity-95"
            aria-label="WORKPILOT"
          >
            <Logo size="md" forceWhite={useDarkAppearance} />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;

              // Color determination
              let linkColorClass = "";
              if (useDarkAppearance) {
                linkColorClass = isActive
                  ? "text-white font-bold"
                  : "text-white/80 hover:text-white";
              } else {
                linkColorClass = isActive
                  ? "text-blue-600 font-bold"
                  : "text-slate-700 hover:text-blue-600";
              }

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative py-1 transition-colors duration-150 ${linkColorClass}`}
                >
                  <span>{link.name}</span>
                  {isActive && (
                    <span
                      className={`absolute -bottom-1 left-0 right-0 h-0.5 rounded-full ${
                        useDarkAppearance ? "bg-cyan-400" : "bg-blue-600"
                      }`}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                useDarkAppearance
                  ? "text-slate-200 hover:text-white hover:bg-white/10"
                  : "text-slate-700 hover:text-black hover:bg-slate-100 shadow-xs"
              }`}
              title={
                theme === "dark"
                  ? "Switch to Light Mode"
                  : "Switch to Dark Mode"
              }
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-blue-600" />
              )}
            </button>

            {/* Primary Action Button */}
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className={`group inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                  useDarkAppearance
                    ? "bg-white text-black hover:bg-slate-100 shadow-md shadow-white/15"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25"
                }`}
              >
                <LayoutDashboard
                  className={`w-3.5 h-3.5 ${
                    useDarkAppearance ? "text-blue-600" : "text-white"
                  }`}
                />
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`text-sm font-semibold px-2 py-1.5 transition-colors duration-150 ${
                    useDarkAppearance
                      ? "text-white/80 hover:text-white"
                      : "text-slate-700 hover:text-black"
                  }`}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className={`group inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    useDarkAppearance
                      ? "bg-white text-black hover:bg-slate-100 shadow-md shadow-white/15"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25"
                  }`}
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors focus:outline-none cursor-pointer ${
                useDarkAppearance
                  ? "text-slate-200 hover:text-white hover:bg-white/10"
                  : "text-slate-700 hover:text-black hover:bg-slate-100"
              }`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-blue-600" />
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-lg transition-colors focus:outline-none cursor-pointer ${
                useDarkAppearance
                  ? "text-slate-200 hover:text-white hover:bg-white/10"
                  : "text-slate-700 hover:text-black hover:bg-slate-100"
              }`}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            className={`lg:hidden mt-3 pt-2 pb-5 px-4 backdrop-blur-2xl rounded-2xl shadow-xl transition-all duration-200 ${
              !isLightMode
                ? "bg-[#050608]/98 border border-white/15 text-white shadow-2xl shadow-black/80"
                : "bg-white/98 border border-slate-200 text-slate-900 shadow-xl shadow-slate-900/10"
            }`}
          >
            <nav className="flex flex-col space-y-2 pt-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-base font-semibold px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? !isLightMode
                          ? "text-white bg-white/10 font-bold"
                          : "text-blue-600 bg-blue-50 font-bold"
                        : !isLightMode
                          ? "text-white/80 hover:text-white hover:bg-white/5"
                          : "text-slate-700 hover:text-blue-600 hover:bg-slate-50"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            <div
              className={`mt-4 pt-4 border-t flex flex-col gap-2.5 ${
                !isLightMode ? "border-white/10" : "border-slate-200"
              }`}
            >
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-center gap-2 text-sm font-semibold py-3 px-4 rounded-full shadow-md transition-all ${
                    !isLightMode
                      ? "bg-white text-black hover:bg-slate-100"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Open Dashboard</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-center text-sm font-semibold py-2 ${
                      !isLightMode
                        ? "text-white/80 hover:text-white"
                        : "text-slate-700 hover:text-black"
                    }`}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-center gap-2 text-sm font-semibold py-3 px-4 rounded-full shadow-md transition-all ${
                      !isLightMode
                        ? "bg-white text-black hover:bg-slate-100"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;