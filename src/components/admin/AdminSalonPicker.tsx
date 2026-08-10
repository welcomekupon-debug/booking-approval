"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/roleLabels";
import type { BusinessCategory } from "@/lib/db/types";

interface SalonRow {
  id: string;
  name: string;
  slug: string;
  category: BusinessCategory;
  createdAt: string;
  owners: { name: string | null; email: string }[];
}

export function AdminSalonPicker({ salons }: { salons: SalonRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
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
                <div key={s.id} className="flex items-center gap-3 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
                      {s.name}
                    </p>
                    <p className="text-[11px] text-ink-400 truncate">
                      /book/{s.slug} · {BUSINESS_CATEGORY_LABELS[s.category]}
                      {s.owners.length > 0 && ` · ${s.owners[0].email}`}
                    </p>
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
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
