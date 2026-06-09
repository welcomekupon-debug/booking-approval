export interface Booking {
  rowIndex: number;
  Ime: string;
  Gmail: string;
  Datum: string;
  Ura: string;
  Status: string;
  Bookingid: string;
}

export type BookingStatus = "Confirmed" | "Declined";

export interface UpdateStatusPayload {
  status: BookingStatus;
}

export interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  declined: number;
  today: number;
  thisMonth: number;
}

export type StatusFilter = "all" | "pending" | "confirmed" | "declined";
export type DateFilter = "all" | "today" | "week" | "month";
