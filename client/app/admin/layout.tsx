"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Shield,
  KeyRound,
  Activity,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Logo from "@/app/Components/landing/Logo";
import { authApi, AuthUser } from "@/lib/api";
import { setAuthToken, setAuthenticated } from "@/lib/storage";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const adminNavItems: NavItem[] = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
  { name: "Connected Accounts", href: "/admin/accounts", icon: Users },
  { name: "Platform Users", href: "/admin/users", icon: Shield },
  { name: "Unipile Settings", href: "/admin/settings", icon: KeyRound },
  { name: "Queue Telemetry", href: "/admin/queue", icon: Activity },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifyAdmin() {
      try {
        const res = await authApi.getMe();
        if (!isMounted) return;

        if (res.success && res.user) {
          if (res.user.role === "ADMIN") {
            setUser(res.user);
            setIsVerifying(false);
          } else {
            // Not an admin — bounce back to user dashboard
            router.replace("/dashboard");
          }
        } else {
          router.replace("/login");
        }
      } catch (err) {
        if (!isMounted) return;
        router.replace("/login");
      }
    }

    verifyAdmin();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue local cleanup
    }
    setAuthToken(null);
    setAuthenticated(false);
    router.replace("/login");
  };

  if (isVerifying) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#050608] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center text-cyan-400 animate-pulse">
            <Shield className="w-5 h-5" />
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-white/50">
            Verifying Administrator Access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050608] text-white flex">
      {/* Mobile Navigation Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Admin Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#080a0e] border-r border-white/7 flex flex-col justify-between transition-transform duration-200 ease-out lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Top Brand & Badge */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-white/7">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" />
              <span className="text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Admin
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-white/40 hover:text-white lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="px-3 pt-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40">
              Platform Management
            </div>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                      : "text-white/60 hover:text-white hover:bg-white/4"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-cyan-400" : "text-white/40"
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Strip & Switch to App */}
        <div className="p-3 border-t border-white/7 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/4 transition-colors border border-white/5"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>User Dashboard</span>
            </div>
            <span className="text-[10px] text-white/40 font-mono">App</span>
          </Link>

          <div className="p-2.5 rounded-lg bg-white/2 border border-white/5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-medium text-white/90 truncate">
                {user?.name || "Admin"}
              </div>
              <div className="text-[10px] text-white/40 truncate font-mono">
                {user?.email || ""}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 rounded-md text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navbar */}
        <header className="h-16 px-4 sm:px-8 border-b border-white/7 bg-[#07090d]/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-semibold text-white/90 tracking-tight">
                System Administration
              </h1>
              <p className="text-[11px] text-white/40 hidden sm:block">
                Multi-tenant Unipile credentials, LinkedIn accounts, and
                platform telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>API Gateway Online</span>
            </div>
          </div>
        </header>

        {/* Page Children */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
