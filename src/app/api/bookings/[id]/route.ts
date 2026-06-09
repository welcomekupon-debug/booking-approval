import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getBookingByRow, getClientByEmail, updateBookingStatus } from "@/lib/sheets";
import type { UpdateStatusPayload } from "@/types/booking";

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
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress;

    if (!email) {
      return NextResponse.json(
        { error: "No email address found on this account." },
        { status: 400 }
      );
    }

    // Resolve which spreadsheet belongs to this client
    const client = await getClientByEmail(email);

    if (!client) {
      return NextResponse.json(
        {
          error:
            "No client profile found for this account. Please contact the administrator to be added.",
        },
        { status: 404 }
      );
    }

    // Make sure the row actually exists in THIS client's spreadsheet
    const booking = await getBookingByRow(client.spreadsheetId, client.sheetName, rowIndex);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    // Generate timestamp here so we can return it — the client sets the exact
    // same value in local state for a consistent activity feed without a re-fetch.
    const updatedAt = new Date().toISOString();
    await updateBookingStatus(client.spreadsheetId, client.sheetName, rowIndex, status, updatedAt);
    return NextResponse.json({ success: true, status, updatedAt });
  } catch (error) {
    console.error(`[PATCH /api/bookings/${rowIndex}]`, error);
    return NextResponse.json(
      { error: "Failed to update booking. Check server logs for details." },
      { status: 500 }
    );
  }
}
