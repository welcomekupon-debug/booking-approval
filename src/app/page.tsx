"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import BookingCard from "@/components/BookingCard";
import BookingFilters from "@/components/BookingFilters";
import RecentActivity from "@/components/RecentActivity";
import StatsCards from "@/components/StatsCards";
import { getRecentActivity } from "@/lib/activity";
import { filterBookings } from "@/lib/filterBookings";
import { computeStats } from "@/lib/stats";
import type {
  Booking,
  BookingStatus,
  DateFilter,
  StatusFilter,
} from "@/types/booking";

export default function HomePage() {
  const { user } = useUser();

  // ── Raw data (single fetch) ─────────────────────────────────────────────
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filter state ────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // ── Derived data (no extra fetches) ────────────────────────────────────
  const stats = useMemo(() => computeStats(bookings), [bookings]);
  const activityItems = useMemo(() => getRecentActivity(bookings), [bookings]);

  const filteredBookings = useMemo(
    () => filterBookings(bookings, query, statusFilter, dateFilter),
    [bookings, query, statusFilter, dateFilter]
  );

  const isFiltered = query !== "" || statusFilter !== "all" || dateFilter !== "all";

  // ── Data fetching ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // One fetch returns ALL bookings; filters are applied client-side
      const res = await fetch("/api/bookings", { cache: "no-store" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setBookings(data.bookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Decision handler ────────────────────────────────────────────────────
  // Updates the booking status in local state rather than removing it —
  // the active status filter handles visibility automatically.
  const handleDecision = useCallback(
    async (rowIndex: number, status: BookingStatus) => {
      const res = await fetch(`/api/bookings/${rowIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update booking.");
      }

      // The route returns the exact timestamp it wrote to the sheet —
      // use it here so local state matches the sheet value precisely.
      const { updatedAt } = await res.json();

      // Update status + UpdatedAt in-place; all useMemos (stats, activity,
      // filteredBookings) recompute automatically from the updated array.
      setBookings((prev) =>
        prev.map((b) =>
          b.rowIndex === rowIndex
            ? { ...b, Status: status, UpdatedAt: updatedAt ?? new Date().toISOString() }
            : b
        )
      );
    },
    []
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {user?.firstName ? `${user.firstName}'s Bookings` : "Your Bookings"}
        </h1>
        <p className="text-gray-500 mt-1">
          Review and action your booking requests.
        </p>
      </header>

      {/* ── Statistics ────────────────────────────────────────────────── */}
      <StatsCards
        stats={loading ? null : stats}
        loading={loading}
        error={error}
      />

      {/* ── Recent Activity ───────────────────────────────────────────── */}
      {!error && (
        <RecentActivity items={activityItems} loading={loading} />
      )}

      {/* ── Loading spinner ───────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={fetchAll}
            className="mt-4 px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Filters + booking list ────────────────────────────────────── */}
      {!loading && !error && (
        <>
          <BookingFilters
            query={query}
            onQueryChange={setQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            dateFilter={dateFilter}
            onDateChange={setDateFilter}
          />

          {/* Result count */}
          <p className="text-sm text-gray-400 mb-4">
            {filteredBookings.length}{" "}
            {filteredBookings.length === 1 ? "booking" : "bookings"}
            {isFiltered && " matching current filters"}
          </p>

          {/* Empty state */}
          {filteredBookings.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
              {isFiltered ? (
                <>
                  <p className="text-gray-400 text-lg">
                    No bookings match your current search and filters.
                  </p>
                  <button
                    onClick={() => {
                      setQuery("");
                      setStatusFilter("all");
                      setDateFilter("all");
                    }}
                    className="mt-4 px-5 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-lg">No bookings yet.</p>
                  <button
                    onClick={fetchAll}
                    className="mt-4 px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
                  >
                    Refresh
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredBookings.map((booking) => (
                  <BookingCard
                    key={booking.rowIndex}
                    booking={booking}
                    onDecision={handleDecision}
                  />
                ))}
              </div>
              <div className="mt-8 text-center">
                <button
                  onClick={fetchAll}
                  className="px-5 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
