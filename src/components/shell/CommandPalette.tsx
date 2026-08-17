"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Icon, type IconName } from "@/components/ui/icons";
import { statusLabel } from "@/components/ui";

interface Result {
  id: string;
  icon: IconName;
  title: string;
  subtitle: string;
  group: string;
  href: string;
}

const NAV_RESULTS: Result[] = [
  { id: "nav-dash", icon: "dashboard", title: "Dashboard", subtitle: "Overview & stats", group: "Navigate", href: "/" },
  { id: "nav-cal", icon: "calendar", title: "Calendar", subtitle: "Day, week and month views", group: "Navigate", href: "/calendar" },
  { id: "nav-appts", icon: "clipboard", title: "Appointments", subtitle: "Manage booking requests", group: "Navigate", href: "/appointments" },
  { id: "nav-cust", icon: "users", title: "Customers", subtitle: "Profiles, history and tags", group: "Navigate", href: "/customers" },
  { id: "nav-ana", icon: "chart", title: "Analytics", subtitle: "Trends and reports", group: "Navigate", href: "/analytics" },
  { id: "nav-set", icon: "settings", title: "Settings", subtitle: "Business, staff and preferences", group: "Navigate", href: "/settings" },
];

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { bookings, customers, services, staff, settings } = useWorkspace();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const navResults = useMemo(
    () =>
      settings.entitlements.analytics
        ? NAV_RESULTS
        : NAV_RESULTS.filter((n) => n.href !== "/analytics"),
    [settings.entitlements.analytics]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();

    if (!q) return navResults;

    const out: Result[] = [];

    for (const nav of navResults) {
      if (nav.title.toLowerCase().includes(q)) out.push(nav);
    }

    for (const c of customers) {
      if (
        c.name.toLowerCase().includes(q) ||
        c.email.includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        out.push({
          id: `cust-${c.email}`,
          icon: "users",
          title: c.name,
          subtitle: `${c.email} · ${c.totalBookings} booking${c.totalBookings === 1 ? "" : "s"}`,
          group: "Customers",
          href: `/customers?q=${encodeURIComponent(c.email)}`,
        });
      }
      if (out.length > 24) return out;
    }

    for (const b of bookings) {
      const haystack =
        `${b.Ime} ${b.Gmail} ${b.Service} ${b.Staff} ${b.Notes} ${b.Bookingid} ${b.Datum}`.toLowerCase();
      if (haystack.includes(q)) {
        out.push({
          id: `bk-${b.id}`,
          icon: "clipboard",
          title: `${b.Ime} — ${b.Datum} ${b.Ura}`,
          subtitle: `${statusLabel(b.Status)}${b.Service ? ` · ${b.Service}` : ""}`,
          group: "Appointments",
          href: `/appointments?q=${encodeURIComponent(b.Bookingid || b.Ime)}`,
        });
      }
      if (out.length > 24) return out;
    }

    for (const s of services) {
      if (s.name.toLowerCase().includes(q)) {
        out.push({
          id: `svc-${s.name}`,
          icon: "tag",
          title: s.name,
          subtitle: `Service${s.duration ? ` · ${s.duration} min` : ""}${s.price ? ` · ${s.price}` : ""}`,
          group: "Services",
          href: "/settings?tab=services",
        });
      }
    }

    for (const s of staff) {
      if (s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q)) {
        out.push({
          id: `staff-${s.name}`,
          icon: "users",
          title: s.name,
          subtitle: `Staff${s.role ? ` · ${s.role}` : ""}`,
          group: "Staff",
          href: "/settings?tab=staff",
        });
      }
    }

    return out.slice(0, 25);
  }, [query, bookings, customers, services, staff]);

  useEffect(() => setActive(0), [results.length, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter" && results[active]) {
        e.preventDefault();
        router.push(results[active].href);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, router, onClose]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4 bg-ink-950/40 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 rounded-2xl shadow-pop overflow-hidden animate-scale-in">
        <div className="flex items-center gap-3 px-4 border-b border-ink-100 dark:border-ink-800">
          <Icon name="search" className="w-4.5 h-4.5 w-5 h-5 text-ink-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, appointments, services, staff…"
            className="w-full py-4 bg-transparent text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="hidden sm:block text-[10px] font-semibold text-ink-400 border border-ink-200 dark:border-ink-700 rounded-md px-1.5 py-0.5 shrink-0">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-10">
              No results for “{query}”
            </p>
          ) : (
            results.map((r, i) => {
              const showGroup = r.group !== lastGroup;
              lastGroup = r.group;
              return (
                <div key={r.id}>
                  {showGroup && (
                    <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                      {r.group}
                    </p>
                  )}
                  <button
                    data-index={i}
                    onClick={() => {
                      router.push(r.href);
                      onClose();
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === active ? "bg-gold-50 dark:bg-gold-900/20" : ""
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        i === active
                          ? "bg-gold-100 dark:bg-gold-900/40 text-gold-700 dark:text-gold-300"
                          : "bg-ink-50 dark:bg-ink-800 text-ink-400"
                      }`}
                    >
                      <Icon name={r.icon} className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
                        {r.title}
                      </span>
                      <span className="block text-xs text-ink-400 truncate">
                        {r.subtitle}
                      </span>
                    </span>
                    {i === active && (
                      <kbd className="ml-auto text-[10px] font-semibold text-ink-400 shrink-0">
                        ↵
                      </kbd>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-ink-100 dark:border-ink-800 text-[10px] text-ink-400">
          <span><kbd className="font-semibold">↑↓</kbd> navigate</span>
          <span><kbd className="font-semibold">↵</kbd> open</span>
          <span className="ml-auto hidden sm:inline">Tip: press <kbd className="font-semibold">CTRL K</kbd> anywhere</span>
        </div>
      </div>
    </div>
  );
}
