export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveClient } from "@/lib/resolveClient";
import {
  ensureTabs,
  getAllBookings,
  getCustomerMeta,
  getServices,
  getSettings,
  getStaff,
} from "@/lib/sheets";

/**
 * Single bootstrap endpoint — returns everything the app needs in one call.
 * Also makes sure the auxiliary tabs exist in the client's spreadsheet.
 */
export async function GET() {
  try {
    const { client, error } = await resolveClient();
    if (error) return error;

    await ensureTabs(client.spreadsheetId, [
      "Services",
      "Staff",
      "Settings",
      "Customers",
    ]);

    const [bookings, services, staff, settings, customerMeta] =
      await Promise.all([
        getAllBookings(client.spreadsheetId, client.sheetName),
        getServices(client.spreadsheetId),
        getStaff(client.spreadsheetId),
        getSettings(client.spreadsheetId),
        getCustomerMeta(client.spreadsheetId),
      ]);

    return NextResponse.json({
      clientName: client.clientName,
      bookings,
      services,
      staff,
      settings,
      customerMeta,
    });
  } catch (error) {
    console.error("[GET /api/workspace]", error);
    return NextResponse.json(
      { error: "Failed to load workspace data. Check server logs for details." },
      { status: 500 }
    );
  }
}
