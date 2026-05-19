export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPendingBookings } from "@/lib/sheets";

export async function GET() {
  try {
    const bookings = await getPendingBookings();
    return NextResponse.json({ bookings });
  } catch (error) {
    console.error("[GET /api/bookings]", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings. Check server logs for details." },
      { status: 500 }
    );
  }
}
