"use client";

import { formatRelativeTime } from "@/lib/relativeTime";
import type { ActivityItem } from "@/types/booking";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 py-3 animate-pulse">
      <div className="mt-0.5 w-6 h-6 rounded-full bg-gray-200 shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="h-3.5 w-32 rounded bg-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-200" />
      </div>
    </div>
  );
}

// ── Single activity row ───────────────────────────────────────────────────────

interface ActivityRowProps {
  item: ActivityItem;
}

function ActivityRow({ item }: ActivityRowProps) {
  const isConfirmed = item.Status.trim().toLowerCase() === "confirmed";

  return (
    <div className="flex items-start gap-3 py-3">
      {/* Icon */}
      <div
        className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
          ${isConfirmed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}
      >
        {isConfirmed ? "✓" : "✗"}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {item.Ime}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          <span
            className={`font-medium ${isConfirmed ? "text-emerald-600" : "text-red-500"}`}
          >
            {isConfirmed ? "Confirmed" : "Declined"}
          </span>
          {" · "}
          {formatRelativeTime(item.UpdatedAt)}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface RecentActivityProps {
  items: ActivityItem[];
  loading: boolean;
}

export default function RecentActivity({ items, loading }: RecentActivityProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
      <div className="px-5 pt-5 pb-3 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Recent Activity
        </h2>
      </div>

      <div className="px-5 divide-y divide-gray-50">
        {loading ? (
          // 3 skeleton rows while data loads
          Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-gray-400 text-sm">
            No recent activity yet.
          </p>
        ) : (
          items.map((item) => <ActivityRow key={item.rowIndex} item={item} />)
        )}
      </div>
    </div>
  );
}
