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
