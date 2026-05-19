import { google } from "googleapis";
import type { Booking } from "@/types/booking";

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variables."
    );
  }

  // Vercel stores newlines as literal \n — convert them back
  const privateKey = rawKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuthClient() });
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME ?? "Sheet1";

// Column order in the sheet (1-indexed, A=1)
// A: Ime | B: Gmail | C: Datum | D: Ura | E: Status | F: Bookingid
const DATA_RANGE = `${SHEET_NAME}!A:F`;

export async function getPendingBookings(): Promise<Booking[]> {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: DATA_RANGE,
  });

  const rows = response.data.values ?? [];
console.log("RAW ROWS:", rows);
  // Row 0 is the header row — skip it
  return rows
  .slice(1)
  .map((row, index) => ({
    rowIndex: index + 2,
    Ime: row[0] ?? "",
    Gmail: row[1] ?? "",
    Datum: row[2] ?? "",
    Ura: row[3] ?? "",
    Status: row[4] ?? "",
    Bookingid: row[5] ?? "",
  }))
  .filter(
  (booking) =>
    booking.Status?.toString().trim().toLowerCase() === "pending"
);
}

export async function updateBookingStatus(
  rowIndex: number,
  status: "Confirmed" | "Declined"
): Promise<void> {
  const sheets = getSheetsClient();

  // Only column E holds Status; there is no DecisionTimestamp column in this sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!E${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[status]],
    },
  });
}
