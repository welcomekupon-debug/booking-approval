// ---------------------------------------------------------------------------
// Booking row — columns A:M of each client's bookings sheet.
// A: Ime | B: Gmail | C: Datum | D: Ura | E: Status | F: Bookingid |
// G: UpdatedAt | H: Phone | I: Service | J: Duration | K: Notes | L: Price | M: Staff
// Columns H–M are new; older rows simply have blanks there.
// ---------------------------------------------------------------------------
export interface Booking {
  rowIndex: number;
  Ime: string;
  Gmail: string;
  Datum: string;
  Ura: string;
  Status: string;
  Bookingid: string;
  UpdatedAt: string;
  Phone: string;
  Service: string;
  Duration: string; // minutes, as string ("30")
  Notes: string;
  Price: string; // numeric string ("45")
  Staff: string;
}

export interface ActivityItem {
  rowIndex: number;
  Ime: string;
  Status: string;
  UpdatedAt: string;
}

export type BookingStatus = "Confirmed" | "Declined";

/** Fields that can be edited on a booking via PATCH /api/bookings/[id] */
export interface BookingUpdatePayload {
  status?: BookingStatus;
  datum?: string;
  ura?: string;
  notes?: string;
  service?: string;
  staff?: string;
  phone?: string;
  duration?: string;
  price?: string;
}

export type StatusFilter = "all" | "pending" | "confirmed" | "declined";
export type DateFilter = "all" | "today" | "week" | "month" | "upcoming";
