import type { Booking } from "./booking";

// ── Services tab: A: Name | B: Duration | C: Price | D: Color | E: Active ──
export interface Service {
  rowIndex: number;
  name: string;
  duration: string; // minutes
  price: string;
  color: string;
  active: boolean;
}

// ── Staff tab: A: Name | B: Email | C: Phone | D: Role | E: Color | F: Active
export interface StaffMember {
  rowIndex: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  color: string;
  active: boolean;
}

// ── Customers tab: A: Email | B: Phone | C: Tags | D: VIP | E: Notes ───────
export interface CustomerMeta {
  rowIndex: number;
  email: string;
  phone: string;
  tags: string[];
  vip: boolean;
  notes: string;
}

/** Customer profile derived from bookings + CustomerMeta overlay */
export interface Customer {
  email: string;
  name: string;
  phone: string;
  tags: string[];
  vip: boolean;
  notes: string;
  totalBookings: number;
  confirmed: number;
  declined: number;
  pending: number;
  firstBooking: Date | null;
  lastBooking: Date | null;
  nextBooking: Booking | null;
  lifetimeValue: number;
  bookings: Booking[];
}

// ── Settings tab: key/value store (complex values stored as JSON) ──────────
export interface DayHours {
  open: boolean;
  from: string; // "09:00"
  to: string; // "17:00"
}

export interface BusinessSettings {
  businessName: string;
  businessType: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  brandColor: string;
  currency: string;
  hours: Record<string, DayHours>; // keys: mon..sun
  holidays: string[]; // ISO dates
  defaultDuration: number; // minutes
  bufferMinutes: number;
  maxAdvanceDays: number;
  autoConfirm: boolean;
  allowCancellation: boolean;
  revenueEnabled: boolean;
  notifyEmailNewRequest: boolean;
  notifyEmailConfirmation: boolean;
  notifyEmailCancellation: boolean;
  notifyEmailDailySummary: boolean;
  notifySmsReminder: boolean;
  notifySmsConfirmation: boolean;
  reminderHoursBefore: number;
  onboardingComplete: boolean;
}

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "",
  businessType: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  logoUrl: "",
  brandColor: "#B99A55",
  currency: "EUR",
  hours: {
    mon: { open: true, from: "09:00", to: "17:00" },
    tue: { open: true, from: "09:00", to: "17:00" },
    wed: { open: true, from: "09:00", to: "17:00" },
    thu: { open: true, from: "09:00", to: "17:00" },
    fri: { open: true, from: "09:00", to: "17:00" },
    sat: { open: false, from: "09:00", to: "13:00" },
    sun: { open: false, from: "09:00", to: "13:00" },
  },
  holidays: [],
  defaultDuration: 30,
  bufferMinutes: 0,
  maxAdvanceDays: 60,
  autoConfirm: false,
  allowCancellation: true,
  revenueEnabled: true,
  notifyEmailNewRequest: true,
  notifyEmailConfirmation: true,
  notifyEmailCancellation: true,
  notifyEmailDailySummary: false,
  notifySmsReminder: false,
  notifySmsConfirmation: false,
  reminderHoursBefore: 24,
  onboardingComplete: false,
};

/** Everything the app needs, fetched once from /api/workspace */
export interface WorkspaceData {
  clientName: string;
  bookings: Booking[];
  services: Service[];
  staff: StaffMember[];
  customerMeta: CustomerMeta[];
  settings: BusinessSettings;
}

// ── Notifications (derived client-side) ────────────────────────────────────
export type NotificationKind =
  | "request"
  | "confirmation"
  | "cancellation"
  | "reminder"
  | "missed"
  | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: Date | null;
  href: string;
}
