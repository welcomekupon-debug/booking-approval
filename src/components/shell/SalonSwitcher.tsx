"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui";

interface SalonRow {
  id: string;
  name: string;
  logoUrl: string | null;
  role: string;
  current: boolean;
}

/**
 * Business switcher — desktop sidebar / mobile nav drawer only. Each entry
 * is a fully independent salon (own calendar, staff, customers, billing);
 * switching just changes which one the active-salon cookie points at, then
 * refreshes the workspace in place (no separate account needed per business).
 */
export function SalonSwitcher({
  name,
  logoUrl,
}: {
  name?: string;
  logoUrl?: string;
}) {
  const router = useRouter();
  const { switchSalon, refresh } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [salons, setSalons] = useState<SalonRow[] | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function load() {
    try {
      const res = await fetch("/api/salons");
      const body = await res.json();
      if (res.ok) setSalons(body.salons ?? []);
    } catch {
      /* switcher just won't populate — not worth surfacing an error for this */
    }
  }

  function onToggle() {
    setOpen((o) => {
      const next = !o;
      if (next && !salons) load();
      return next;
    });
  }

  async function pick(salonId: string) {
    if (switching) return;
    setSwitching(salonId);
    setError(null);
    try {
      await switchSalon(salonId);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't switch businesses.");
    } finally {
      setSwitching(null);
    }
  }

  async function createBusiness() {
    if (!newName.trim()) return;
    setSavingNew(true);
    setError(null);
    try {
      const res = await fetch("/api/salons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't create that business.");
      setOpen(false);
      setCreating(false);
      setNewName("");
      // The POST already switched the active-salon cookie server-side —
      // refresh() pulls this brand-new (mostly empty) business into the
      // workspace, then send them straight to fill in its profile.
      await refresh();
      router.push("/settings?tab=business");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that business.");
    } finally {
      setSavingNew(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className="flex items-center gap-2.5 min-w-0 group w-full text-left"
      >
        <span className="w-9 h-9 rounded-xl bg-ink-900 dark:bg-gold-500 flex items-center justify-center shrink-0 overflow-hidden transition-transform duration-300 group-hover:scale-105">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon name="sparkle" className="w-5 h-5 text-gold-400 dark:text-white" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink-900 dark:text-ink-50 leading-tight truncate">
            {name || "Bookline"}
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-gold-600">
            Appointments
          </span>
        </span>
        <Icon
          name="chevronDown"
          className={`w-4 h-4 text-ink-300 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 rounded-2xl shadow-pop z-50 animate-scale-in origin-top-left overflow-hidden">
          <div className="px-3 py-2 border-b border-ink-100 dark:border-ink-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 dark:text-ink-600 px-1">
              Your businesses
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1.5">
            {!salons ? (
              <p className="text-sm text-ink-400 px-4 py-3">Loading…</p>
            ) : (
              salons.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pick(s.id)}
                  disabled={switching === s.id || s.current}
                  className="w-full flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-xl text-left hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors disabled:cursor-default"
                  style={{ width: "calc(100% - 12px)" }}
                >
                  <span className="w-7 h-7 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center shrink-0 overflow-hidden">
                    {s.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Icon name="sparkle" className="w-3.5 h-3.5 text-ink-400" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
                      {s.name}
                    </span>
                  </span>
                  {s.current ? (
                    <Icon name="check" className="w-4 h-4 text-gold-500 shrink-0" />
                  ) : switching === s.id ? (
                    <span className="text-[10px] text-ink-400 shrink-0">Switching…</span>
                  ) : null}
                </button>
              ))
            )}
          </div>

          {error && (
            <p className="text-xs text-rose-600 px-4 pb-2">{error}</p>
          )}

          <div className="border-t border-ink-100 dark:border-ink-800 p-2">
            {creating ? (
              <div className="flex flex-col gap-2 p-1.5">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Business name"
                  className="text-sm"
                  onKeyDown={(e) => e.key === "Enter" && createBusiness()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={createBusiness}
                    disabled={!newName.trim() || savingNew}
                    className="flex-1 text-xs font-bold text-white bg-gold-500 hover:bg-gold-600 disabled:opacity-50 rounded-lg py-1.5 transition-colors"
                  >
                    {savingNew ? "Creating…" : "Create"}
                  </button>
                  <button
                    onClick={() => setCreating(false)}
                    className="text-xs font-semibold text-ink-400 hover:text-ink-600 px-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
              >
                <span className="w-7 h-7 rounded-lg border border-dashed border-ink-300 dark:border-ink-600 flex items-center justify-center shrink-0">
                  <Icon name="plus" className="w-3.5 h-3.5 text-ink-400" />
                </span>
                <span className="text-sm font-semibold text-ink-600 dark:text-ink-300">
                  Create another business
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
