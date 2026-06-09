export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getClientByEmail, getAllBookings } from "@/lib/sheets";

export async function GET() {
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

    // Look up which spreadsheet belongs to this client
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

    // Return ALL bookings — client-side filters (search / status / date) are
    // applied in the browser so we only need one fetch per page load.
    const bookings = await getAllBookings(client.spreadsheetId, client.sheetName);
    return NextResponse.json({ bookings, client: { clientName: client.clientName } });
  } catch (error) {
    console.error("[GET /api/bookings]", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings. Check server logs for details." },
      { status: 500 }
    );
  }
}
