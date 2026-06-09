"use client";

import type { StatusFilter, DateFilter } from "@/types/booking";

// ── Pill button ───────────────────────────────────────────────────────────────

interface PillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}

function Pill({ active, onClick, children, activeClass = "bg-gray-800 text-white" }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap
        ${active ? activeClass : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
    >
      {children}
    </button>
  );
}

// ── Status pills config ───────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: StatusFilter; label: string; activeClass: string }[] = [
  { value: "all",       label: "All",       activeClass: "bg-gray-800 text-white" },
  { value: "pending",   label: "Pending",   activeClass: "bg-amber-500 text-white" },
  { value: "confirmed", label: "Confirmed", activeClass: "bg-emerald-500 text-white" },
  { value: "declined",  label: "Declined",  activeClass: "bg-red-500 text-white" },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all",   label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week",  label: "This Week" },
  { value: "month", label: "This Month" },
];

// ── Main component ────────────────────────────────────────────────────────────

interface BookingFiltersProps {
  query: string;
  onQueryChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  dateFilter: DateFilter;
  onDateChange: (v: DateFilter) => void;
}

export default function BookingFilters({
  query,
  onQueryChange,
  statusFilter,
  onStatusChange,
  dateFilter,
  onDateChange,
}: BookingFiltersProps) {
  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mr-1">
          Status
        </span>
        {STATUS_OPTIONS.map(({ value, label, activeClass }) => (
          <Pill
            key={value}
            active={statusFilter === value}
            activeClass={activeClass}
            onClick={() => onStatusChange(value)}
          >
            {label}
          </Pill>
        ))}
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mr-1">
          Date
        </span>
        {DATE_OPTIONS.map(({ value, label }) => (
          <Pill
            key={value}
            active={dateFilter === value}
            onClick={() => onDateChange(value)}
          >
            {label}
          </Pill>
        ))}
      </div>
    </div>
  );
}
