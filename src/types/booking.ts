// ---------------------------------------------------------------------------
// Frontend view-model for an appointment.
//
// These field names date back to the Google Sheets era (Ime/Datum/Ura…) and
// are kept temporarily so the UI layer stayed stable through the Postgres
// migration. The `id` is now the appointment UUID. Phase 5 renames these to
// the native DB shapes.
// ---------------------------------------------------------------------------
export interface Booking {
  /** Appointment UUID (primary key in Postgres) */
  id: string;
  Ime: string;
  Gmail: string;
  /** Salon-local date, DD.MM.YYYY */
  Datum: string;
  /** Salon-local time, HH:MM */
  Ura: string;
  Status: string;
  Bookingid: string;
  UpdatedAt: string;
  Phone: string;
  Service: string;
  /** Catalog id of the first line item's service — used to color-code the calendar. "" if none/deleted. */
  ServiceId: string;
  Duration: string; // minutes, as string ("30")
  Notes: string;
  Price: string; // decimal string in salon currency ("45")
  Staff: string;
  /** Catalog id of the assigned staff member — used for calendar filtering. "" if unassigned. */
  StaffId: string;
}

export interface BookingActivityItem {
  type: "booking";
  id: string;
  Ime: string;
  Status: string;
  UpdatedAt: string;
}

export interface ReviewActivityItem {
  type: "review";
  id: string;
  /** Customer who left the review */
  Ime: string;
  rating: number;
  UpdatedAt: string;
}

export type ActivityItem = BookingActivityItem | ReviewActivityItem;

export type BookingStatus = "Confirmed" | "Declined" | "Completed" | "No-show";

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

export type StatusFilter = "all" | "pending" | "confirmed" | "declined" | "cancelled";
export type DateFilter = "all" | "today" | "week" | "month" | "upcoming";
