export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getClientByEmail, getAllBookings } from "@/lib/sheets";
import { computeStats } from "@/lib/stats";

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

    const client = await getClientByEmail(email);

    if (!client) {
      return NextResponse.json(
        { error: "No client profile found for this account." },
        { status: 404 }
      );
    }

    const allBookings = await getAllBookings(client.spreadsheetId, client.sheetName);
    const stats = computeStats(allBookings);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[GET /api/stats]", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics. Check server logs for details." },
      { status: 500 }
    );
  }
}
