"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Icon, type IconName } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui";
import { CommandPalette } from "./CommandPalette";
import { NotificationCenter } from "./NotificationCenter";
import { SalonSwitcher } from "./SalonSwitcher";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  shortcut: string;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", shortcut: "D" },
  { href: "/calendar", label: "Calendar", icon: "calendar", shortcut: "C" },
  { href: "/appointments", label: "Appointments", icon: "clipboard", shortcut: "A" },
  { href: "/customers", label: "Customers", icon: "users", shortcut: "U" },
  { href: "/reviews", label: "Reviews", icon: "star", shortcut: "R" },
  { href: "/analytics", label: "Analytics", icon: "chart", shortcut: "N" },
  { href: "/settings", label: "Settings", icon: "settings", shortcut: "S" },
];

function Logo({ name, logoUrl }: { name?: string; logoUrl?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
      <span className="w-9 h-9 rounded-xl bg-ink-900 dark:bg-gold-500 flex items-center justify-center shrink-0 overflow-hidden transition-transform duration-300 group-hover:scale-105">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Icon name="sparkle" className="w-4.5 h-4.5 w-5 h-5 text-gold-400 dark:text-white" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink-900 dark:text-ink-50 leading-tight truncate">
          {name || "Bookline"}
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-gold-600">
          Appointments
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { theme, toggle } = useTheme();
  const {
    bookings,
    settings,
    loading,
    error,
    clientName,
    isPlatformAdmin,
    impersonating,
    stopImpersonating,
  } = useWorkspace();
  const [exiting, setExiting] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const gPressed = useRef(false);

  const pendingCount = bookings.filter(
    (b) => b.Status?.trim().toLowerCase() === "pending"
  ).length;

  const visibleNav = settings.entitlements.analytics
    ? NAV
    : NAV.filter((item) => item.href !== "/analytics");

  const isOnboarding = pathname === "/onboarding";

  // Send new clients through onboarding once data has loaded
  useEffect(() => {
    if (!loading && !error && !settings.onboardingComplete && !isOnboarding) {
      router.replace("/onboarding");
    }
  }, [loading, error, settings.onboardingComplete, isOnboarding, router]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }

      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (e.key.toLowerCase() === "g") {
        gPressed.current = true;
        setTimeout(() => (gPressed.current = false), 800);
        return;
      }

      if (gPressed.current) {
        const key = e.key.toLowerCase();
        const item = visibleNav.find((n) => n.shortcut.toLowerCase() === key);
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        gPressed.current = false;
        return;
      }

      if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey) {
        toggle();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, toggle, visibleNav]);

  // Onboarding renders full-screen without the shell
  if (isOnboarding) {
    return <>{children}</>;
  }

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-1">
      {visibleNav.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              active
                ? "bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900 shadow-card"
                : "text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-ink-100"
            }`}
          >
            <Icon
              name={item.icon}
              className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                active ? "text-gold-400 dark:text-gold-600" : ""
              }`}
            />
            <span className="flex-1">{item.label}</span>
            {item.href === "/appointments" && pendingCount > 0 && (
              <span
                className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  active
                    ? "bg-gold-500 text-white"
                    : "bg-gold-100 text-gold-700 dark:bg-gold-900/40 dark:text-gold-300"
                }`}
              >
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* ── Impersonation banner ────────────────────────────────────────── */}
      {impersonating && (
        <div className="fixed top-0 inset-x-0 z-50 h-9 bg-gold-500 text-white flex items-center justify-center gap-3 text-xs font-semibold px-4">
          <Icon name="shield" className="w-3.5 h-3.5" />
          <span>Viewing {clientName || "this salon"} as platform admin</span>
          <button
            onClick={async () => {
              setExiting(true);
              await stopImpersonating();
              router.push("/admin");
            }}
            disabled={exiting}
            className="underline underline-offset-2 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {exiting ? "Exiting…" : "Exit"}
          </button>
        </div>
      )}

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex fixed ${impersonating ? "top-9 bottom-0" : "inset-y-0"} left-0 w-64 flex-col bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800 z-30`}
      >
        <div className="px-5 pt-6 pb-5">
          <SalonSwitcher name={settings.businessName || clientName} logoUrl={settings.logoUrl} />
        </div>

        <div className="px-3 flex-1 overflow-y-auto">
          {navLinks()}

          <div className="mt-8 px-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 dark:text-ink-600 mb-3">
              Shortcuts
            </p>
            <div className="flex flex-col gap-2 text-xs text-ink-400">
              <span className="flex justify-between">
                <span>Search</span>
                <kbd className="font-semibold text-ink-500 dark:text-ink-300">CTRL K</kbd>
              </span>
              <span className="flex justify-between">
                <span>Go to page</span>
                <kbd className="font-semibold text-ink-500 dark:text-ink-300">G + key</kbd>
              </span>
              <span className="flex justify-between">
                <span>Toggle theme</span>
                <kbd className="font-semibold text-ink-500 dark:text-ink-300">T</kbd>
              </span>
            </div>
          </div>
        </div>

        {isPlatformAdmin && !impersonating && (
          <div className="px-3 pb-2">
            <Link
              href="/admin"
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-ink-100 transition-colors"
            >
              <Icon name="shield" className="w-[18px] h-[18px] shrink-0" />
              Platform admin
            </Link>
          </div>
        )}

        <div className="px-5 py-4 border-t border-ink-100 dark:border-ink-800 flex items-center gap-3">
          <UserButton />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
              {user?.fullName || user?.firstName || "Account"}
            </p>
            <p className="text-[11px] text-ink-400 truncate">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header
        className={`fixed ${impersonating ? "top-9" : "top-0"} right-0 left-0 lg:left-64 h-16 bg-white/80 dark:bg-ink-900/80 backdrop-blur-xl border-b border-ink-100 dark:border-ink-800 z-20 flex items-center gap-3 px-4 sm:px-6`}
      >
        <button
          onClick={() => setMobileNavOpen(true)}
          className="lg:hidden p-2 -ml-1 rounded-xl text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
          aria-label="Open menu"
        >
          <Icon name="menu" className="w-5 h-5" />
        </button>

        <div className="lg:hidden">
          <Logo name={settings.businessName || clientName} logoUrl={settings.logoUrl} />
        </div>

        {/* Global search trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden sm:flex items-center gap-2.5 flex-1 max-w-md px-3.5 py-2 rounded-xl border border-ink-200 dark:border-ink-700 bg-ink-50/50 dark:bg-ink-800/50 text-sm text-ink-400 hover:border-gold-300 hover:bg-white dark:hover:bg-ink-800 transition-all duration-200"
        >
          <Icon name="search" className="w-4 h-4" />
          <span className="flex-1 text-left">
            Search customers, appointments…
          </span>
          <kbd className="text-[10px] font-semibold border border-ink-200 dark:border-ink-700 rounded-md px-1.5 py-0.5">
            CTRL K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setPaletteOpen(true)}
            className="sm:hidden p-2 rounded-xl text-ink-500 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
            aria-label="Search"
          >
            <Icon name="search" className="w-5 h-5" />
          </button>

          <Tooltip content={theme === "dark" ? "Light mode (T)" : "Dark mode (T)"}>
            <button
              onClick={toggle}
              className="p-2 rounded-xl text-ink-500 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              aria-label="Toggle theme"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} className="w-5 h-5" />
            </button>
          </Tooltip>

          <NotificationCenter />

          <div className="lg:hidden ml-1">
            <UserButton />
          </div>
        </div>
      </header>

      {/* ── Mobile nav drawer ───────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileNavOpen(false);
          }}
        >
          <aside className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800 p-5 animate-fade-in">
            <div className="flex items-center justify-between gap-2 mb-6">
              <div className="min-w-0 flex-1">
                <SalonSwitcher name={settings.businessName || clientName} logoUrl={settings.logoUrl} />
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-2 rounded-xl text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
                aria-label="Close menu"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            {navLinks(() => setMobileNavOpen(false))}
          </aside>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className={`lg:pl-64 ${impersonating ? "pt-[100px]" : "pt-16"} min-h-screen`}>
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
