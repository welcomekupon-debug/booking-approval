"use client";

export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import BookingCard from "@/components/BookingCard";
import type { Booking, BookingStatus } from "@/types/booking";

export default function HomePage() {
  const { user } = useUser();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const res = await fetch("/api/bookings", {
      cache: "no-store",
    });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setBookings(data.bookings);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load bookings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

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

      // Remove the decided booking from the local list immediately
      setBookings((prev) => prev.filter((b) => b.rowIndex !== rowIndex));
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

      {loading && (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={fetchBookings}
            className="mt-4 px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-gray-400 text-lg">No pending bookings.</p>
          <button
            onClick={fetchBookings}
            className="mt-4 px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}

      {!loading && !error && bookings.length > 0 && (
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
              onClick={fetchBookings}
              className="px-5 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Refresh list
            </button>
          </div>
        </>
      )}
    </main>
  );
}
