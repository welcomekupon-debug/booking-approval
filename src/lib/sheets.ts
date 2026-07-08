import { google, sheets_v4 } from "googleapis";
import type { Booking, BookingUpdatePayload } from "@/types/booking";
import type { ClientProfile } from "@/types/client";
import {
  BusinessSettings,
  CustomerMeta,
  DEFAULT_SETTINGS,
  Service,
  StaffMember,
} from "@/types/app";

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
// Master "Clients" spreadsheet — one row per business that logs into the app.
// Columns: A: ClientName | B: ClientEmail | C: SpreadsheetID | D: SheetName |
//          E: Phone | F: Notes
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

  const match = rows
    .slice(1)
    .map(rowToClientProfile)
    .find(
      (client) => client.clientEmail.trim().toLowerCase() === normalizedEmail
    );

  return match ?? null;
}

// ---------------------------------------------------------------------------
// Per-client bookings sheet — columns A:M
// A: Ime | B: Gmail | C: Datum | D: Ura | E: Status | F: Bookingid |
// G: UpdatedAt | H: Phone | I: Service | J: Duration | K: Notes | L: Price | M: Staff
// ---------------------------------------------------------------------------

function rowToBooking(row: string[], index: number): Booking {
  return {
    rowIndex: index + 2,
    Ime: row[0] ?? "",
    Gmail: row[1] ?? "",
    Datum: row[2] ?? "",
    Ura: row[3] ?? "",
    Status: row[4] ?? "",
    Bookingid: row[5] ?? "",
    UpdatedAt: row[6] ?? "",
    Phone: row[7] ?? "",
    Service: row[8] ?? "",
    Duration: row[9] ?? "",
    Notes: row[10] ?? "",
    Price: row[11] ?? "",
    Staff: row[12] ?? "",
  };
}

export async function getAllBookings(
  spreadsheetId: string,
  sheetName: string
): Promise<Booking[]> {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:M`,
  });

  const rows = response.data.values ?? [];
  return rows.slice(1).map(rowToBooking);
}

export async function getBookingByRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number
): Promise<Booking | null> {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex}:M${rowIndex}`,
  });

  const row = response.data.values?.[0];
  if (!row) return null;

  return rowToBooking(row, rowIndex - 2);
}

/** Column letters for each editable booking field. */
const BOOKING_COLUMNS: Record<keyof BookingUpdatePayload, string> = {
  datum: "C",
  ura: "D",
  status: "E",
  phone: "H",
  service: "I",
  duration: "J",
  notes: "K",
  price: "L",
  staff: "M",
};

/**
 * Update any subset of editable booking fields in ONE batchUpdate call.
 * Always stamps UpdatedAt (column G) with the supplied timestamp.
 */
export async function updateBooking(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  fields: BookingUpdatePayload,
  updatedAt: string
): Promise<void> {
  const sheets = getSheetsClient();

  const data: { range: string; values: string[][] }[] = [];

  for (const [key, value] of Object.entries(fields)) {
    const column = BOOKING_COLUMNS[key as keyof BookingUpdatePayload];
    if (column && value !== undefined) {
      data.push({
        range: `${sheetName}!${column}${rowIndex}`,
        values: [[String(value)]],
      });
    }
  }

  data.push({ range: `${sheetName}!G${rowIndex}`, values: [[updatedAt]] });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
}

// ---------------------------------------------------------------------------
// Auxiliary tabs (Services / Staff / Settings / Customers) inside each
// client's spreadsheet. Created automatically the first time they're needed.
// ---------------------------------------------------------------------------

const TAB_HEADERS: Record<string, string[]> = {
  Services: ["Name", "Duration", "Price", "Color", "Active"],
  Staff: ["Name", "Email", "Phone", "Role", "Color", "Active"],
  Settings: ["Key", "Value"],
  Customers: ["Email", "Phone", "Tags", "VIP", "Notes"],
};

/** Ensure the given tabs exist (adds them with a header row if missing). */
export async function ensureTabs(
  spreadsheetId: string,
  tabs: string[]
): Promise<void> {
  const sheets = getSheetsClient();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  const existing = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "")
  );

  const missing = tabs.filter((t) => !existing.has(t));
  if (missing.length === 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
    },
  });

  // Write header rows for the new tabs
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: missing.map((title) => ({
        range: `${title}!A1`,
        values: [TAB_HEADERS[title] ?? ["Key", "Value"]],
      })),
    },
  });
}

async function readTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return (res.data.values ?? []).slice(1) as string[][]; // skip header
  } catch {
    return []; // tab doesn't exist yet
  }
}

// ── Services ────────────────────────────────────────────────────────────────

function rowToService(row: string[], index: number): Service {
  return {
    rowIndex: index + 2,
    name: row[0] ?? "",
    duration: row[1] ?? "",
    price: row[2] ?? "",
    color: row[3] ?? "",
    active: (row[4] ?? "TRUE").toUpperCase() !== "FALSE",
  };
}

export async function getServices(spreadsheetId: string): Promise<Service[]> {
  const sheets = getSheetsClient();
  const rows = await readTab(sheets, spreadsheetId, "Services!A:E");
  return rows.map(rowToService).filter((s) => s.name);
}

export async function saveServices(
  spreadsheetId: string,
  services: Omit<Service, "rowIndex">[]
): Promise<void> {
  const sheets = getSheetsClient();
  await ensureTabs(spreadsheetId, ["Services"]);

  // Rewrite the whole tab (small data set — simplest consistent approach)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: "Services!A2:E1000",
  });

  if (services.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Services!A2",
      valueInputOption: "RAW",
      requestBody: {
        values: services.map((s) => [
          s.name,
          s.duration,
          s.price,
          s.color,
          s.active ? "TRUE" : "FALSE",
        ]),
      },
    });
  }
}

// ── Staff ───────────────────────────────────────────────────────────────────

function rowToStaff(row: string[], index: number): StaffMember {
  return {
    rowIndex: index + 2,
    name: row[0] ?? "",
    email: row[1] ?? "",
    phone: row[2] ?? "",
    role: row[3] ?? "",
    color: row[4] ?? "",
    active: (row[5] ?? "TRUE").toUpperCase() !== "FALSE",
  };
}

export async function getStaff(spreadsheetId: string): Promise<StaffMember[]> {
  const sheets = getSheetsClient();
  const rows = await readTab(sheets, spreadsheetId, "Staff!A:F");
  return rows.map(rowToStaff).filter((s) => s.name);
}

export async function saveStaff(
  spreadsheetId: string,
  staff: Omit<StaffMember, "rowIndex">[]
): Promise<void> {
  const sheets = getSheetsClient();
  await ensureTabs(spreadsheetId, ["Staff"]);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: "Staff!A2:F1000",
  });

  if (staff.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Staff!A2",
      valueInputOption: "RAW",
      requestBody: {
        values: staff.map((s) => [
          s.name,
          s.email,
          s.phone,
          s.role,
          s.color,
          s.active ? "TRUE" : "FALSE",
        ]),
      },
    });
  }
}

// ── Settings (key/value store, complex values JSON-encoded) ────────────────

const JSON_KEYS = new Set(["hours", "holidays"]);
const BOOL_KEYS = new Set([
  "autoConfirm",
  "allowCancellation",
  "revenueEnabled",
  "notifyEmailNewRequest",
  "notifyEmailConfirmation",
  "notifyEmailCancellation",
  "notifyEmailDailySummary",
  "notifySmsReminder",
  "notifySmsConfirmation",
  "onboardingComplete",
]);
const NUM_KEYS = new Set([
  "defaultDuration",
  "bufferMinutes",
  "maxAdvanceDays",
  "reminderHoursBefore",
]);

export async function getSettings(
  spreadsheetId: string
): Promise<BusinessSettings> {
  const sheets = getSheetsClient();
  const rows = await readTab(sheets, spreadsheetId, "Settings!A:B");

  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };

  for (const [key, raw] of rows) {
    if (!key || raw === undefined) continue;
    if (JSON_KEYS.has(key)) {
      try {
        settings[key] = JSON.parse(raw);
      } catch {
        /* keep default */
      }
    } else if (BOOL_KEYS.has(key)) {
      settings[key] = raw === "TRUE" || raw === "true";
    } else if (NUM_KEYS.has(key)) {
      const n = Number(raw);
      if (!isNaN(n)) settings[key] = n;
    } else {
      settings[key] = raw;
    }
  }

  return settings as unknown as BusinessSettings;
}

export async function saveSettings(
  spreadsheetId: string,
  settings: Partial<BusinessSettings>
): Promise<void> {
  const sheets = getSheetsClient();
  await ensureTabs(spreadsheetId, ["Settings"]);

  // Merge with existing so partial saves don't wipe other keys
  const current = await getSettings(spreadsheetId);
  const merged: Record<string, unknown> = { ...current, ...settings };

  const rows = Object.entries(merged).map(([key, value]) => [
    key,
    JSON_KEYS.has(key)
      ? JSON.stringify(value)
      : typeof value === "boolean"
        ? value
          ? "TRUE"
          : "FALSE"
        : String(value ?? ""),
  ]);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: "Settings!A2:B1000",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Settings!A2",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

// ── Customers metadata (tags / VIP / notes keyed by email) ─────────────────

function rowToCustomerMeta(row: string[], index: number): CustomerMeta {
  return {
    rowIndex: index + 2,
    email: (row[0] ?? "").trim().toLowerCase(),
    phone: row[1] ?? "",
    tags: (row[2] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    vip: (row[3] ?? "").toUpperCase() === "TRUE",
    notes: row[4] ?? "",
  };
}

export async function getCustomerMeta(
  spreadsheetId: string
): Promise<CustomerMeta[]> {
  const sheets = getSheetsClient();
  const rows = await readTab(sheets, spreadsheetId, "Customers!A:E");
  return rows.map(rowToCustomerMeta).filter((c) => c.email);
}

export async function upsertCustomerMeta(
  spreadsheetId: string,
  meta: Omit<CustomerMeta, "rowIndex">
): Promise<void> {
  const sheets = getSheetsClient();
  await ensureTabs(spreadsheetId, ["Customers"]);

  const existing = await getCustomerMeta(spreadsheetId);
  const match = existing.find((c) => c.email === meta.email.trim().toLowerCase());

  const values = [
    [
      meta.email.trim().toLowerCase(),
      meta.phone,
      meta.tags.join(", "),
      meta.vip ? "TRUE" : "FALSE",
      meta.notes,
    ],
  ];

  if (match) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Customers!A${match.rowIndex}:E${match.rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Customers!A:E",
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }
}
