import { NextRequest, NextResponse } from "next/server";
import { updateBookingStatus } from "@/lib/sheets";
import type { UpdateStatusPayload } from "@/types/booking";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rowIndex = parseInt(params.id, 10);

  if (isNaN(rowIndex) || rowIndex < 2) {
    return NextResponse.json(
      { error: "Invalid booking row index." },
      { status: 400 }
    );
  }

  let body: UpdateStatusPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { status } = body;

  if (status !== "Confirmed" && status !== "Declined") {
    return NextResponse.json(
      { error: 'Status must be "Confirmed" or "Declined".' },
      { status: 400 }
    );
  }

  try {
    await updateBookingStatus(rowIndex, status);
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error(`[PATCH /api/bookings/${rowIndex}]`, error);
    return NextResponse.json(
      { error: "Failed to update booking. Check server logs for details." },
      { status: 500 }
    );
  }
}
