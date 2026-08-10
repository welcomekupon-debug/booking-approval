"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Segmented } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

interface Suggestion {
  date: string; // "YYYY-MM-DD"
  name: string;
}

function formatSuggestionDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function HolidaySuggestions({
  country,
  existingHolidays,
  onAdd,
}: {
  country: string;
  existingHolidays: string[];
  onAdd: (entries: Suggestion[]) => void;
}) {
  const thisYear = new Date().getFullYear();
  const [yearChoice, setYearChoice] = useState<"this" | "next">("this");
  const year = yearChoice === "this" ? thisYear : thisYear + 1;

  const [all, setAll] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!country) {
      setAll([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/holidays/suggestions?year=${year}&country=${country}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setAll(body.holidays ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load holidays right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country, year]);

  const existing = useMemo(() => new Set(existingHolidays), [existingHolidays]);
  const pending = useMemo(
    () => all.filter((h) => !existing.has(h.date)),
    [all, existing]
  );

  if (!country) {
    return (
      <p className="text-xs text-ink-400 bg-ink-50 dark:bg-ink-800/50 rounded-xl px-3.5 py-2.5 mt-4">
        Set your country in Settings → Business profile to see public holiday
        suggestions here.
      </p>
    );
  }

  return (
    <div className="mt-5 pt-5 border-t border-ink-100 dark:border-ink-800">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-ink-800 dark:text-ink-100">
          Suggested public holidays
        </p>
        <Segmented
          options={[
            { value: "this", label: String(thisYear) },
            { value: "next", label: String(thisYear + 1) },
          ]}
          value={yearChoice}
          onChange={setYearChoice}
        />
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : all.length === 0 ? (
        <p className="text-sm text-ink-400">
          No holiday data available for this country.
        </p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-ink-400">
          All {all.length} public holidays for {year} are already on your list.
        </p>
      ) : (
        <>
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            className="mb-3"
            onClick={() => onAdd(pending)}
          >
            Add all {pending.length}
          </Button>
          <div className="flex flex-col divide-y divide-ink-50 dark:divide-ink-800">
            {pending.map((h) => (
              <div key={h.date} className="flex items-center gap-3 py-2">
                <span className="text-xs font-bold text-ink-400 w-14 shrink-0">
                  {formatSuggestionDate(h.date)}
                </span>
                <span className="text-sm text-ink-700 dark:text-ink-200 flex-1 truncate">
                  {h.name}
                </span>
                <button
                  onClick={() => onAdd([h])}
                  className="p-1.5 rounded-lg text-ink-300 hover:text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 transition-colors"
                  aria-label={`Add ${h.name}`}
                >
                  <Icon name="plus" className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
