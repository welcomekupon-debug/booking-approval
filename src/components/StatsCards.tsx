"use client";

import type { BookingStats } from "@/types/booking";

interface StatCardProps {
  label: string;
  value: number;
  colorClass: string;
  dotClass: string;
}

function StatCard({ label, value, colorClass, dotClass }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-none">
          {label}
        </span>
      </div>
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        <div className="h-3 w-24 rounded bg-gray-200" />
      </div>
      <div className="h-8 w-12 rounded bg-gray-200" />
    </div>
  );
}

interface StatsCardsProps {
  stats: BookingStats | null;
  loading: boolean;
  error: string | null;
}

const STAT_CONFIG = [
  {
    key: "pending" as keyof BookingStats,
    label: "Pending",
    colorClass: "text-amber-500",
    dotClass: "bg-amber-400",
  },
  {
    key: "confirmed" as keyof BookingStats,
    label: "Confirmed",
    colorClass: "text-emerald-600",
    dotClass: "bg-emerald-500",
  },
  {
    key: "declined" as keyof BookingStats,
    label: "Declined",
    colorClass: "text-red-500",
    dotClass: "bg-red-400",
  },
  {
    key: "total" as keyof BookingStats,
    label: "Total",
    colorClass: "text-blue-600",
    dotClass: "bg-blue-500",
  },
  {
    key: "today" as keyof BookingStats,
    label: "Today",
    colorClass: "text-violet-600",
    dotClass: "bg-violet-500",
  },
  {
    key: "thisMonth" as keyof BookingStats,
    label: "This Month",
    colorClass: "text-indigo-600",
    dotClass: "bg-indigo-500",
  },
] as const;

export default function StatsCards({ stats, loading, error }: StatsCardsProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-8">
        <p className="text-sm text-red-600">
          Could not load statistics — {error}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
      {loading || !stats
        ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        : STAT_CONFIG.map(({ key, label, colorClass, dotClass }) => (
            <StatCard
              key={key}
              label={label}
              value={stats[key]}
              colorClass={colorClass}
              dotClass={dotClass}
            />
          ))}
    </div>
  );
}
