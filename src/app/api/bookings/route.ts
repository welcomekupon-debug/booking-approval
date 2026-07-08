export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveClient } from "@/lib/resolveClient";
import { getAllBookings } from "@/lib/sheets";

export async function GET() {
  try {
    const { client, error } = await resolveClient();
    if (error) return error;

    const bookings = await getAllBookings(
      client.spreadsheetId,
      client.sheetName
    );
    return NextResponse.json({
      bookings,
      client: { clientName: client.clientName },
    });
  } catch (error) {
    console.error("[GET /api/bookings]", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings. Check server logs for details." },
      { status: 500 }
    );
  }
}
