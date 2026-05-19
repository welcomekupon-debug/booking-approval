"use client";

import { useState } from "react";
import type { Booking, BookingStatus } from "@/types/booking";

interface BookingCardProps {
  booking: Booking;
  onDecision: (rowIndex: number, status: BookingStatus) => Promise<void>;
}

export default function BookingCard({ booking, onDecision }: BookingCardProps) {
  const [loading, setLoading] = useState<BookingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(status: BookingStatus) {
    setLoading(status);
    setError(null);
    try {
      await onDecision(booking.rowIndex, status);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  const isDisabled = loading !== null;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-gray-800 truncate">
          {booking.Ime}
        </h2>
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-600">Gmail:</span>{" "}
          {booking.Gmail}
        </p>
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-600">Datum:</span>{" "}
          {booking.Datum}
        </p>
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-600">Ura:</span>{" "}
          {booking.Ura}
        </p>
        <p className="text-xs text-gray-400 mt-1">ID: {booking.Bookingid}</p>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 mt-auto">
        <button
          onClick={() => handleClick("Confirmed")}
          disabled={isDisabled}
          className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "Confirmed" ? "Confirming…" : "Confirm"}
        </button>
        <button
          onClick={() => handleClick("Declined")}
          disabled={isDisabled}
          className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "Declined" ? "Declining…" : "Decline"}
        </button>
      </div>
    </div>
  );
}
