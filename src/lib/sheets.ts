import { google } from "googleapis";
import type { Booking } from "@/types/booking";
import type { ClientProfile } from "@/types/client";

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

// ---------------------------------------------------------------------------
// Master "Clients" spreadsheet
//
// This is YOUR spreadsheet — one row per client (business) that logs into
// this app. It maps each client's login email to the Google Sheet that
// contains THEIR bookings (a separate spreadsheet per client).
//
// Columns (1-indexed, A=1):
// A: ClientName | B: ClientEmail | C: SpreadsheetID | D: SheetName | E: Phone | F: Notes
// ---------------------------------------------------------------------------

const CLIENTS_SHEET_ID = process.env.GOOGLE_CLIENTS_SHEET_ID!;
const CLIENTS_SHEET_NAME = process.env.GOOGLE_CLIENTS_SHEET_NAME ?? "Clients";
const CLIENTS_RANGE = `${CLIENTS_SHEET_NAME}!A:F`;

function rowToClientProfile(row: string[], index: number): ClientProfile {
  return {
    rowIndex: index + 2,
    clientName: row[0] ?? "",
    clientEmail: row[1] ?? "",
    spreadsheetId: row[2] ?? "",
    sheetName: row[3] || "Sheet1",
    phone: row[4] ?? "",
    notes: row[5] ?? "",
  };
}

/**
 * Look up a client's profile (and the spreadsheet that holds their bookings)
 * by their login email. Returns null if no matching client record exists.
 */
export async function getClientByEmail(
  email: string
): Promise<ClientProfile | null> {
  if (!CLIENTS_SHEET_ID) {
    throw new Error("Missing GOOGLE_CLIENTS_SHEET_ID environment variable.");
  }

  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CLIENTS_SHEET_ID,
    range: CLIENTS_RANGE,
  });

  const rows = response.data.values ?? [];
  const normalizedEmail = email.trim().toLowerCase();

  // Row 0 is the header row — skip it
  const match = rows
    .slice(1)
    .map(rowToClientProfile)
    .find(
      (client) => client.clientEmail.trim().toLowerCase() === normalizedEmail
    );

  return match ?? null;
}

// ---------------------------------------------------------------------------
// Per-client bookings spreadsheet
//
// Each client has their own spreadsheet (its ID/tab name comes from their
// row in the Clients sheet above). Columns (1-indexed, A=1):
// A: Ime | B: Gmail | C: Datum | D: Ura | E: Status | F: Bookingid
// ---------------------------------------------------------------------------

function bookingDataRange(sheetName: string) {
  return `${sheetName}!A:F`;
}

function rowToBooking(row: string[], index: number): Booking {
  return {
    rowIndex: index + 2,
    Ime: row[0] ?? "",
    Gmail: row[1] ?? "",
    Datum: row[2] ?? "",
    Ura: row[3] ?? "",
    Status: row[4] ?? "",
    Bookingid: row[5] ?? "",
  };
}

/**
 * Fetch bookings with Status = "Pending" from a specific client's spreadsheet.
 */
export async function getPendingBookings(
  spreadsheetId: string,
  sheetName: string
): Promise<Booking[]> {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: bookingDataRange(sheetName),
  });

  const rows = response.data.values ?? [];

  // Row 0 is the header row — skip it
  return rows
    .slice(1)
    .map(rowToBooking)
    .filter(
      (booking) =>
        booking.Status?.toString().trim().toLowerCase() === "pending"
    );
}

/**
 * Fetch a single booking row by its 1-based sheet row index from a
 * specific client's spreadsheet. Used to verify the row exists before
 * allowing a status update.
 */
export async function getBookingByRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number
): Promise<Booking | null> {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex}:F${rowIndex}`,
  });

  const row = response.data.values?.[0];
  if (!row) return null;

  return rowToBooking(row, rowIndex - 2);
}

export async function updateBookingStatus(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  status: "Confirmed" | "Declined"
): Promise<void> {
  const sheets = getSheetsClient();

  // Only column E holds Status; there is no DecisionTimestamp column in this sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!E${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[status]],
    },
  });
}
