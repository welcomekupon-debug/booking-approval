"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import BookingCard from "@/components/BookingCard";
import StatsCards from "@/components/StatsCards";
import type { Booking, BookingStats, BookingStatus } from "@/types/booking";

export default function HomePage() {
  const { user } = useUser();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const [stats, setStats] = useState<BookingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setBookingsLoading(true);
    setStatsLoading(true);
    setBookingsError(null);
    setStatsError(null);

    // Fire both requests in parallel — one Google Sheets read each
    const [bookingsRes, statsRes] = await Promise.allSettled([
      fetch("/api/bookings", { cache: "no-store" }),
      fetch("/api/stats", { cache: "no-store" }),
    ]);

    // --- bookings ---
    if (bookingsRes.status === "fulfilled") {
      const res = bookingsRes.value;
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings);
      } else {
        const data = await res.json().catch(() => ({}));
        setBookingsError(data.error ?? `Server responded with ${res.status}`);
      }
    } else {
      setBookingsError("Failed to load bookings.");
    }
    setBookingsLoading(false);

    // --- stats ---
    if (statsRes.status === "fulfilled") {
      const res = statsRes.value;
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      } else {
        setStatsError("Could not load statistics.");
      }
    } else {
      setStatsError("Could not load statistics.");
    }
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

      // Remove from pending list immediately
      setBookings((prev) => prev.filter((b) => b.rowIndex !== rowIndex));

      // Update stats locally — no extra API call needed
      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          confirmed:
            status === "Confirmed" ? prev.confirmed + 1 : prev.confirmed,
          declined: status === "Declined" ? prev.declined + 1 : prev.declined,
        };
      });
    },
    []
  );

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {user?.firstName ? `${user.firstName}'s Bookings` : "Your Bookings"}
        </h1>
        <p className="text-gray-500 mt-1">
          Review and action your pending booking requests.
        </p>
      </header>

      {/* ── Statistics ── */}
      <StatsCards
        stats={stats}
        loading={statsLoading}
        error={statsError}
      />

      {/* ── Pending bookings ── */}
      {bookingsLoading && (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {bookingsError && !bookingsLoading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600 font-medium">{bookingsError}</p>
          <button
            onClick={fetchAll}
            className="mt-4 px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!bookingsLoading && !bookingsError && bookings.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-gray-400 text-lg">No pending bookings.</p>
          <button
            onClick={fetchAll}
            className="mt-4 px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}

      {!bookingsLoading && !bookingsError && bookings.length > 0 && (
        <>
          <p className="text-sm text-gray-400 mb-4">
            {bookings.length} pending{" "}
            {bookings.length === 1 ? "booking" : "bookings"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bookings.map((booking) => (
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
    </main>
  );
}
