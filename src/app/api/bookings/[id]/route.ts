import { NextRequest, NextResponse } from "next/server";
import { resolveClient } from "@/lib/resolveClient";
import { getBookingByRow, updateBooking } from "@/lib/sheets";
import type { BookingUpdatePayload } from "@/types/booking";

const EDITABLE_FIELDS: (keyof BookingUpdatePayload)[] = [
  "status",
  "datum",
  "ura",
  "notes",
  "service",
  "staff",
  "phone",
  "duration",
  "price",
];

/**
 * PATCH /api/bookings/[id] — update any subset of editable booking fields.
 * Supports: approve/decline (status), reschedule (datum/ura), and editing
 * phone / service / duration / notes / price / staff.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rowIndex = parseInt(id, 10);

  if (isNaN(rowIndex) || rowIndex < 2) {
    return NextResponse.json(
      { error: "Invalid booking row index." },
      { status: 400 }
    );
  }

  let body: BookingUpdatePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Whitelist fields
  const fields: BookingUpdatePayload = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) {
      (fields as Record<string, unknown>)[key] = body[key];
    }
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { error: "No editable fields provided." },
      { status: 400 }
    );
  }

  if (
    fields.status !== undefined &&
    fields.status !== "Confirmed" &&
    fields.status !== "Declined"
  ) {
    return NextResponse.json(
      { error: 'Status must be "Confirmed" or "Declined".' },
      { status: 400 }
    );
  }

  try {
    const { client, error } = await resolveClient();
    if (error) return error;

    // Make sure the row actually exists in THIS client's spreadsheet
    const booking = await getBookingByRow(
      client.spreadsheetId,
      client.sheetName,
      rowIndex
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const updatedAt = new Date().toISOString();
    await updateBooking(
      client.spreadsheetId,
      client.sheetName,
      rowIndex,
      fields,
      updatedAt
    );

    return NextResponse.json({ success: true, fields, updatedAt });
  } catch (error) {
    console.error(`[PATCH /api/bookings/${rowIndex}]`, error);
    return NextResponse.json(
      { error: "Failed to update booking. Check server logs for details." },
      { status: 500 }
    );
  }
}
