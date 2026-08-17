"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Toggle } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/roleLabels";
import { PLAN_DETAILS, PLAN_ORDER } from "@/lib/plans";
import { CUSTOM_PLAN_DEFAULTS, type Entitlements } from "@/lib/entitlements";
import type { BusinessCategory, SalonPlan } from "@/lib/db/types";

interface SalonRow {
  id: string;
  name: string;
  slug: string;
  category: BusinessCategory;
  plan: SalonPlan;
  customEntitlements: Entitlements;
  createdAt: string;
  owners: { name: string | null; email: string }[];
}

export function AdminSalonPicker({ salons: initialSalons }: { salons: SalonRow[] }) {
  const router = useRouter();
  const [salons, setSalons] = useState(initialSalons);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [planBusyId, setPlanBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return salons;
    return salons.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.owners.some((o) => o.email.toLowerCase().includes(q))
    );
  }, [salons, query]);

  async function changePlan(salonId: string, plan: SalonPlan) {
    const previous = salons.find((s) => s.id === salonId)?.plan;
    setPlanBusyId(salonId);
    setError(null);
    // Optimistic update
    setSalons((list) => list.map((s) => (s.id === salonId ? { ...s, plan } : s)));
    try {
      const res = await fetch(`/api/admin/salons/${salonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Switching to Custom seeds sensible starting values so the salon
        // never sits on an unconfigured/empty entitlement set.
        body: JSON.stringify(
          plan === "custom"
            ? { plan, customEntitlements: CUSTOM_PLAN_DEFAULTS }
            : { plan }
        ),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't change that plan.");
      if (plan === "custom") {
        setSalons((list) =>
          list.map((s) =>
            s.id === salonId ? { ...s, customEntitlements: CUSTOM_PLAN_DEFAULTS } : s
          )
        );
      }
    } catch (err) {
      // Roll back on failure
      setSalons((list) =>
        list.map((s) => (s.id === salonId ? { ...s, plan: previous ?? s.plan } : s))
      );
      setError(err instanceof Error ? err.message : "Couldn't change that plan.");
    } finally {
      setPlanBusyId(null);
    }
  }

  async function changeCustomEntitlements(salonId: string, next: Entitlements) {
    const previous = salons.find((s) => s.id === salonId)?.customEntitlements;
    setPlanBusyId(salonId);
    setError(null);
    setSalons((list) =>
      list.map((s) => (s.id === salonId ? { ...s, customEntitlements: next } : s))
    );
    try {
      const res = await fetch(`/api/admin/salons/${salonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customEntitlements: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't update those features.");
    } catch (err) {
      setSalons((list) =>
        list.map((s) =>
          s.id === salonId
            ? { ...s, customEntitlements: previous ?? s.customEntitlements }
            : s
        )
      );
      setError(err instanceof Error ? err.message : "Couldn't update those features.");
    } finally {
      setPlanBusyId(null);
    }
  }

  async function viewAs(salonId: string) {
    setBusyId(salonId);
    setError(null);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salonId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't open that salon.");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that salon.");
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-ink-900 dark:bg-gold-500 flex items-center justify-center shrink-0">
            <Icon name="shield" className="w-5 h-5 text-gold-400 dark:text-white" />
          </div>
          <h1 className="text-lg font-bold text-ink-900 dark:text-ink-50">
            Platform admin
          </h1>
        </div>
        <p className="text-sm text-ink-400 mb-6">
          View any salon as its owner to help with setup. Every session is logged.
        </p>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by salon name, link, or owner email…"
          className="mb-4 max-w-md"
        />

        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5 mb-4">
            {error}
          </p>
        )}

        <Card className="animate-fade-up">
          <div className="flex flex-col divide-y divide-ink-50 dark:divide-ink-800">
            {filtered.length === 0 ? (
              <p className="text-sm text-ink-400 px-6 py-8 text-center">
                No salons match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              filtered.map((s) => (
                <div key={s.id} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
                        {s.name}
                      </p>
                      <p className="text-[11px] text-ink-400 truncate">
                        /book/{s.slug} · {BUSINESS_CATEGORY_LABELS[s.category]}
                        {s.owners.length > 0 && ` · ${s.owners[0].email}`}
                      </p>
                    </div>
                    <div className="w-36 shrink-0">
                      <Select
                        value={s.plan}
                        disabled={planBusyId === s.id}
                        onChange={(e) => changePlan(s.id, e.target.value as SalonPlan)}
                        aria-label={`Plan for ${s.name}`}
                      >
                        {PLAN_ORDER.map((p) => (
                          <option key={p} value={p}>
                            {PLAN_DETAILS[p].label}
                          </option>
                        ))}
                        <option value="custom">Custom</option>
                      </Select>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busyId === s.id}
                      onClick={() => viewAs(s.id)}
                    >
                      View as owner
                    </Button>
                  </div>

                  {s.plan === "custom" && (
                    <div className="mt-3 rounded-xl border border-gold-200 dark:border-gold-800 bg-gold-50/40 dark:bg-gold-900/10 p-4 flex flex-col gap-3 max-w-md">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                            Staff seats
                          </p>
                          <p className="text-xs text-ink-400 mt-0.5">
                            Blank = unlimited
                          </p>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={s.customEntitlements.maxStaff ?? ""}
                          placeholder="Unlimited"
                          disabled={planBusyId === s.id}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const maxStaff = raw === "" ? null : Math.max(1, parseInt(raw, 10) || 1);
                            changeCustomEntitlements(s.id, {
                              ...s.customEntitlements,
                              maxStaff,
                            });
                          }}
                          className="w-24"
                        />
                      </div>
                      <Toggle
                        label="Analytics"
                        description="Analytics page and CSV export"
                        checked={s.customEntitlements.analytics}
                        disabled={planBusyId === s.id}
                        onChange={(v) =>
                          changeCustomEntitlements(s.id, {
                            ...s.customEntitlements,
                            analytics: v,
                          })
                        }
                      />
                      <Toggle
                        label="Self-service booking"
                        description="Customer reschedule/cancel links in emails"
                        checked={s.customEntitlements.selfServiceBooking}
                        disabled={planBusyId === s.id}
                        onChange={(v) =>
                          changeCustomEntitlements(s.id, {
                            ...s.customEntitlements,
                            selfServiceBooking: v,
                          })
                        }
                      />
                      <Toggle
                        label="API access"
                        description="Create and use machine API keys"
                        checked={s.customEntitlements.apiAccess}
                        disabled={planBusyId === s.id}
                        onChange={(v) =>
                          changeCustomEntitlements(s.id, {
                            ...s.customEntitlements,
                            apiAccess: v,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
