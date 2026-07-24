import type { Booking } from "./booking";

// ---------------------------------------------------------------------------
// Frontend view-models. Sheet-era shapes kept stable through the Postgres
// migration; ids are now UUIDs. Phase 5 replaces these with the DB types.
// ---------------------------------------------------------------------------

export interface Service {
  /** UUID; absent on freshly added, not-yet-saved rows */
  id?: string;
  name: string;
  duration: string; // minutes
  price: string; // decimal string in salon currency
  color: string;
  active: boolean;
}

export interface StaffMember {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  color: string;
  active: boolean;
}

export interface CustomerMeta {
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
  /** IANA timezone, e.g. "Europe/Ljubljana" */
  timezone: string;
  hours: Record<string, DayHours>; // keys: mon..sun
  holidays: string[]; // ISO dates
  defaultDuration: number; // minutes
  bufferMinutes: number;
  /** Grid the public booking page offers times on, e.g. every 15 or 30 min */
  slotGranularityMinutes: number;
  maxAdvanceDays: number;
  autoConfirm: boolean;
  allowCancellation: boolean;
  revenueEnabled: boolean;
  notifyEmailNewRequest: boolean;
  notifyEmailConfirmation: boolean;
  notifyEmailCancellation: boolean;
  notifyEmailDailySummary: boolean;
  /** Reminder email to the customer, sent by the cron job ahead of their appointment */
  notifyEmailReminder: boolean;
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
  timezone: "Europe/Ljubljana",
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
  slotGranularityMinutes: 15,
  maxAdvanceDays: 60,
  autoConfirm: false,
  allowCancellation: true,
  revenueEnabled: true,
  notifyEmailNewRequest: true,
  notifyEmailConfirmation: true,
  notifyEmailCancellation: true,
  notifyEmailDailySummary: false,
  notifyEmailReminder: true,
  notifySmsReminder: false,
  notifySmsConfirmation: false,
  reminderHoursBefore: 24,
  onboardingComplete: false,
};

/** Notification row as serialized by /api/workspace */
export interface ServerNotification {
  id: string;
  type:
    | "new_request"
    | "confirmation"
    | "cancellation"
    | "reminder"
    | "missed"
    | "system"
    | "change_requested";
  title: string;
  body: string;
  appointmentId: string | null;
  readAt: string | null;
  createdAt: string;
}

/** A customer-submitted cancel/reschedule request awaiting staff review. */
export interface ChangeRequestItem {
  id: string;
  appointmentId: string;
  type: "cancel" | "reschedule";
  requestedStartsAt: string | null;
  customerNote: string | null;
  createdAt: string;
}

/** Everything the app needs, fetched once from /api/workspace */
export interface WorkspaceData {
  clientName: string;
  salonSlug: string;
  bookings: Booking[];
  services: Service[];
  staff: StaffMember[];
  customerMeta: CustomerMeta[];
  notifications: ServerNotification[];
  changeRequests: ChangeRequestItem[];
  settings: BusinessSettings;
}

// ── Notification view model (server rows + client-derived reminders) ───────
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
