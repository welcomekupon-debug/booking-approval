/**
 * Bookline — PostgreSQL schema (Drizzle ORM)
 *
 * Conventions
 * ───────────
 * • UUID primary keys (gen_random_uuid()).
 * • All timestamps are `timestamptz` stored in UTC. Salon-local rendering uses
 *   `salons.timezone` (IANA name) at the edges — never in the database.
 * • Money is integer cents; currency lives on the salon.
 * • Every tenant-owned table carries `salon_id` directly (even join-reachable
 *   ones) so every query can be tenant-scoped without joins, every index can
 *   lead with it, and Postgres RLS can be layered on later without migration.
 * • Soft deletes (`deleted_at`) only on entities where restore/history matters:
 *   salons, staff, services, customers. Appointments use `status` instead.
 * • Cascades only where the child is meaningless without the parent
 *   (appointment_services, memberships, calendar_event_links). Everything else
 *   is RESTRICT so data can never vanish by accident.
 */

import { relations, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const membershipRole = pgEnum("membership_role", [
  "owner",
  "manager",
  "stylist",
  "receptionist",
]);

export const appointmentStatus = pgEnum("appointment_status", [
  "pending", // requested, awaiting salon decision
  "confirmed",
  "declined", // salon rejected the request
  "cancelled", // was confirmed, then called off
  "completed",
  "no_show",
]);

export const appointmentSource = pgEnum("appointment_source", [
  "staff", // created in the admin app
  "public", // public booking page
  "tally", // Tally form via n8n webhook
  "import", // one-time Google Sheets migration
]);

export const notificationType = pgEnum("notification_type", [
  "new_request",
  "confirmation",
  "cancellation",
  "reminder",
  "missed",
  "system",
  "change_requested",
]);

export const changeRequestType = pgEnum("change_request_type", [
  "cancel",
  "reschedule",
]);

export const changeRequestStatus = pgEnum("change_request_status", [
  "pending",
  "approved",
  "declined",
]);

export const calendarProvider = pgEnum("calendar_provider", [
  "google",
  "outlook",
]);

export const integrationStatus = pgEnum("integration_status", [
  "active",
  "paused",
  "error",
  "revoked",
]);

export const auditActorType = pgEnum("audit_actor_type", [
  "user",
  "api_key",
  "system",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Shared column helpers
// ─────────────────────────────────────────────────────────────────────────────

const id = () => uuid("id").primaryKey().defaultRandom();

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

const deletedAt = () => timestamp("deleted_at", { withTimezone: true });

// ─────────────────────────────────────────────────────────────────────────────
// Identity & tenancy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row per Clerk account. Deliberately contains NO salon reference —
 * salon access is granted exclusively through `memberships`.
 */
export const users = pgTable(
  "users",
  {
    id: id(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    imageUrl: text("image_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_clerk_user_id_idx").on(t.clerkUserId),
    index("users_email_idx").on(t.email),
  ]
);

/** Tenant root. Everything hangs off `salon_id`. */
export const salons = pgTable(
  "salons",
  {
    id: id(),
    name: text("name").notNull(),
    /** Public booking URL: /book/{slug} */
    slug: text("slug").notNull(),
    businessType: text("business_type"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    address: text("address"),
    logoUrl: text("logo_url"),
    brandColor: text("brand_color"),
    /** ISO 4217, e.g. "EUR" */
    currency: text("currency").notNull().default("EUR"),
    /** IANA timezone, e.g. "Europe/Ljubljana" — all local-time math uses this */
    timezone: text("timezone").notNull().default("Europe/Ljubljana"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [uniqueIndex("salons_slug_idx").on(t.slug)]
);

/**
 * User ↔ salon with a role. A user may belong to many salons.
 * `staff_id` optionally links this login to a staff profile in the same salon
 * (stylists usually exist as staff rows before they ever log in).
 */
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("stylist"),
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("memberships_user_salon_idx").on(t.userId, t.salonId),
    index("memberships_salon_idx").on(t.salonId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// Catalog & people
// ─────────────────────────────────────────────────────────────────────────────

export const staff = pgTable(
  "staff",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    /** Display title, e.g. "Senior stylist" (access role lives on memberships) */
    roleTitle: text("role_title"),
    /** Calendar color, hex */
    color: text("color"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("staff_salon_idx").on(t.salonId, t.isActive)]
);

export const services = pgTable(
  "services",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    /** Cleanup / prep time around this service, consumed by availability */
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    color: text("color"),
    /** Visible & bookable on the public booking page */
    isPublic: boolean("is_public").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("services_salon_idx").on(t.salonId, t.isActive, t.sortOrder),
    check("services_duration_positive", sql`${t.durationMinutes} > 0`),
    check("services_price_nonnegative", sql`${t.priceCents} >= 0`),
  ]
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    isVip: boolean("is_vip").notNull().default(false),
    /** Private notes, visible to salon staff only */
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    // One customer per email per salon — but email is optional (walk-ins),
    // and soft-deleted rows must not block re-creation.
    uniqueIndex("customers_salon_email_idx")
      .on(t.salonId, t.email)
      .where(sql`${t.email} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    index("customers_salon_name_idx").on(t.salonId, t.name),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// Scheduling core
// ─────────────────────────────────────────────────────────────────────────────

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    status: appointmentStatus("status").notNull().default("pending"),
    source: appointmentSource("source").notNull().default("staff"),
    /** UTC. Local rendering via salons.timezone. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /** UTC. Service time only — buffers are stored separately below. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** Snapshot of applicable buffers at booking time (availability blocks
     *  starts_at − before … ends_at + after). */
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    /** Snapshot total across appointment_services */
    priceTotalCents: integer("price_total_cents").notNull().default(0),
    /** What the customer wrote on the booking form */
    customerNote: text("customer_note"),
    /** Internal note, staff-only */
    internalNote: text("internal_note"),
    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Reschedule chain: the appointment this one replaced */
    rescheduledFromId: uuid("rescheduled_from_id").references(
      (): AnyPgColumn => appointments.id,
      { onDelete: "set null" }
    ),
    /** External idempotency key (e.g. Tally submission id via n8n) */
    externalRef: text("external_ref"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appointments_salon_starts_idx").on(t.salonId, t.startsAt),
    index("appointments_salon_status_idx").on(t.salonId, t.status, t.startsAt),
    index("appointments_staff_starts_idx").on(t.staffId, t.startsAt),
    index("appointments_customer_idx").on(t.customerId, t.startsAt),
    uniqueIndex("appointments_external_ref_idx")
      .on(t.salonId, t.externalRef)
      .where(sql`${t.externalRef} IS NOT NULL`),
    check("appointments_time_order", sql`${t.endsAt} > ${t.startsAt}`),
  ]
);

/**
 * Line items: one appointment can bundle multiple services.
 * name/duration/price are SNAPSHOTS taken at booking time so later catalog
 * edits never rewrite history or reports.
 */
export const appointmentServices = pgTable(
  "appointment_services",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "restrict" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    serviceName: text("service_name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("appointment_services_appointment_idx").on(t.appointmentId),
    index("appointment_services_salon_service_idx").on(t.salonId, t.serviceId),
  ]
);

/**
 * Customer-initiated cancel/reschedule requests, submitted from the public
 * "manage your booking" page (linked from confirmation/reminder emails).
 * These never mutate the appointment directly — a salon staff member must
 * approve before anything actually changes, mirroring the same
 * pending-request pattern new bookings already use.
 */
export const appointmentChangeRequests = pgTable(
  "appointment_change_requests",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    type: changeRequestType("type").notNull(),
    status: changeRequestStatus("status").notNull().default("pending"),
    /** Reschedule only — the time the customer proposed. */
    requestedStartsAt: timestamp("requested_starts_at", { withTimezone: true }),
    /** Customer's own note, either reason for cancelling or context. */
    customerNote: text("customer_note"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("change_requests_salon_status_idx").on(t.salonId, t.status),
    index("change_requests_appointment_idx").on(t.appointmentId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// Availability inputs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Salon opening windows per weekday (0 = Monday … 6 = Sunday).
 * Multiple rows per weekday allow split shifts (e.g. 9–12 and 14–18).
 * Times are salon-local wall clock; the availability engine converts.
 */
export const businessHours = pgTable(
  "business_hours",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("business_hours_salon_idx").on(t.salonId, t.weekday),
    check("business_hours_weekday_range", sql`${t.weekday} BETWEEN 0 AND 6`),
    check("business_hours_time_order", sql`${t.closesAt} > ${t.opensAt}`),
  ]
);

/** Same shape per staff member; intersected with business hours. */
export const staffWorkingHours = pgTable(
  "staff_working_hours",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("staff_working_hours_staff_idx").on(t.staffId, t.weekday),
    index("staff_working_hours_salon_idx").on(t.salonId),
    check("staff_hours_weekday_range", sql`${t.weekday} BETWEEN 0 AND 6`),
    check("staff_hours_time_order", sql`${t.endsAt} > ${t.startsAt}`),
  ]
);

/**
 * Concrete UTC ranges when booking is impossible.
 * staff_id NULL ⇒ the whole salon is blocked — this is also how holidays and
 * closures are modeled (one mechanism, not three).
 */
export const blockedTimes = pgTable(
  "blocked_times",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "cascade",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("blocked_times_salon_idx").on(t.salonId, t.startsAt),
    index("blocked_times_staff_idx").on(t.staffId, t.startsAt),
    check("blocked_times_time_order", sql`${t.endsAt} > ${t.startsAt}`),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// Platform
// ─────────────────────────────────────────────────────────────────────────────

/** 1:1 with salon. Strongly typed — replaces the old key-value Settings tab. */
export const settings = pgTable(
  "settings",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    defaultDurationMinutes: integer("default_duration_minutes")
      .notNull()
      .default(30),
    defaultBufferBeforeMinutes: integer("default_buffer_before_minutes")
      .notNull()
      .default(0),
    defaultBufferAfterMinutes: integer("default_buffer_after_minutes")
      .notNull()
      .default(0),
    /** Public page offers slots on this grid (e.g. every 15 min) */
    slotGranularityMinutes: integer("slot_granularity_minutes")
      .notNull()
      .default(15),
    maxAdvanceDays: integer("max_advance_days").notNull().default(60),
    /** Customers can't book closer to now than this */
    minNoticeMinutes: integer("min_notice_minutes").notNull().default(60),
    autoConfirm: boolean("auto_confirm").notNull().default(false),
    allowCancellation: boolean("allow_cancellation").notNull().default(true),
    cancellationWindowHours: integer("cancellation_window_hours")
      .notNull()
      .default(24),
    revenueEnabled: boolean("revenue_enabled").notNull().default(true),
    notifyEmailNewRequest: boolean("notify_email_new_request")
      .notNull()
      .default(true),
    notifyEmailConfirmation: boolean("notify_email_confirmation")
      .notNull()
      .default(true),
    notifyEmailCancellation: boolean("notify_email_cancellation")
      .notNull()
      .default(true),
    notifyEmailDailySummary: boolean("notify_email_daily_summary")
      .notNull()
      .default(false),
    notifySmsConfirmation: boolean("notify_sms_confirmation")
      .notNull()
      .default(false),
    notifySmsReminder: boolean("notify_sms_reminder").notNull().default(false),
    notifyEmailReminder: boolean("notify_email_reminder")
      .notNull()
      .default(true),
    reminderHoursBefore: integer("reminder_hours_before").notNull().default(24),
    onboardingComplete: boolean("onboarding_complete").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("settings_salon_idx").on(t.salonId)]
);

/** Persisted per-recipient notifications (replaces localStorage read state). */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    /** Recipient. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt),
    index("notifications_salon_idx").on(t.salonId, t.createdAt),
  ]
);

/**
 * Hashed API keys for machine access (n8n → POST /api/public/bookings).
 * Only the hash is stored; `prefix` (first 8 chars) is kept for display.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    prefix: text("prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("api_keys_hash_idx").on(t.keyHash),
    index("api_keys_salon_idx").on(t.salonId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting (fixed-window counters for unauthenticated endpoints)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row per (bucket key, current window). `key` encodes route + identity,
 * e.g. "public-book:203.0.113.4" or "public-bookings-key:<apiKeyId>".
 * Rows are cheap and self-cleaning in practice (old windows just stop being
 * matched) — a periodic delete of stale rows is a nice-to-have, not required.
 */
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    key: text("key").primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
    count: integer("count").notNull().default(1),
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Calendar sync (DB is always the source of truth; sync flows outward)
// ─────────────────────────────────────────────────────────────────────────────

export const calendarIntegrations = pgTable(
  "calendar_integrations",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    /** NULL ⇒ salon-level calendar; otherwise a specific staff member's */
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "cascade",
    }),
    provider: calendarProvider("provider").notNull(),
    externalCalendarId: text("external_calendar_id").notNull(),
    /** OAuth tokens, encrypted at the application layer before storage */
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    status: integrationStatus("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("calendar_integrations_salon_idx").on(t.salonId)]
);

/** appointment ↔ external event mapping; makes outward sync idempotent. */
export const calendarEventLinks = pgTable(
  "calendar_event_links",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => calendarIntegrations.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    externalEventId: text("external_event_id").notNull(),
    lastPushedAt: timestamp("last_pushed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("calendar_event_links_unique_idx").on(
      t.integrationId,
      t.appointmentId
    ),
    index("calendar_event_links_appointment_idx").on(t.appointmentId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// Audit
// ─────────────────────────────────────────────────────────────────────────────

/** Append-only. Never updated, never deleted. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    actorType: auditActorType("actor_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorApiKeyId: uuid("actor_api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    /** e.g. "appointment.confirmed", "service.updated" */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    /** JSON diff or payload snapshot */
    changes: jsonb("changes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_salon_idx").on(t.salonId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// Relations (Drizzle query API)
// ─────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const salonsRelations = relations(salons, ({ many, one }) => ({
  memberships: many(memberships),
  staff: many(staff),
  services: many(services),
  customers: many(customers),
  appointments: many(appointments),
  businessHours: many(businessHours),
  blockedTimes: many(blockedTimes),
  settings: one(settings),
  apiKeys: many(apiKeys),
  calendarIntegrations: many(calendarIntegrations),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  salon: one(salons, { fields: [memberships.salonId], references: [salons.id] }),
  staff: one(staff, { fields: [memberships.staffId], references: [staff.id] }),
}));

export const staffRelations = relations(staff, ({ one, many }) => ({
  salon: one(salons, { fields: [staff.salonId], references: [salons.id] }),
  workingHours: many(staffWorkingHours),
  appointments: many(appointments),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  salon: one(salons, { fields: [services.salonId], references: [salons.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  salon: one(salons, { fields: [customers.salonId], references: [salons.id] }),
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  salon: one(salons, {
    fields: [appointments.salonId],
    references: [salons.id],
  }),
  customer: one(customers, {
    fields: [appointments.customerId],
    references: [customers.id],
  }),
  staff: one(staff, {
    fields: [appointments.staffId],
    references: [staff.id],
  }),
  services: many(appointmentServices),
  changeRequests: many(appointmentChangeRequests),
  rescheduledFrom: one(appointments, {
    fields: [appointments.rescheduledFromId],
    references: [appointments.id],
  }),
}));

export const appointmentChangeRequestsRelations = relations(
  appointmentChangeRequests,
  ({ one }) => ({
    salon: one(salons, {
      fields: [appointmentChangeRequests.salonId],
      references: [salons.id],
    }),
    appointment: one(appointments, {
      fields: [appointmentChangeRequests.appointmentId],
      references: [appointments.id],
    }),
    resolvedByUser: one(users, {
      fields: [appointmentChangeRequests.resolvedByUserId],
      references: [users.id],
    }),
  })
);

export const appointmentServicesRelations = relations(
  appointmentServices,
  ({ one }) => ({
    appointment: one(appointments, {
      fields: [appointmentServices.appointmentId],
      references: [appointments.id],
    }),
    service: one(services, {
      fields: [appointmentServices.serviceId],
      references: [services.id],
    }),
  })
);

export const businessHoursRelations = relations(businessHours, ({ one }) => ({
  salon: one(salons, {
    fields: [businessHours.salonId],
    references: [salons.id],
  }),
}));

export const staffWorkingHoursRelations = relations(
  staffWorkingHours,
  ({ one }) => ({
    staff: one(staff, {
      fields: [staffWorkingHours.staffId],
      references: [staff.id],
    }),
  })
);

export const blockedTimesRelations = relations(blockedTimes, ({ one }) => ({
  salon: one(salons, {
    fields: [blockedTimes.salonId],
    references: [salons.id],
  }),
  staff: one(staff, {
    fields: [blockedTimes.staffId],
    references: [staff.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  salon: one(salons, { fields: [settings.salonId], references: [salons.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  salon: one(salons, {
    fields: [notifications.salonId],
    references: [salons.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [notifications.appointmentId],
    references: [appointments.id],
  }),
}));

export const calendarIntegrationsRelations = relations(
  calendarIntegrations,
  ({ one, many }) => ({
    salon: one(salons, {
      fields: [calendarIntegrations.salonId],
      references: [salons.id],
    }),
    staff: one(staff, {
      fields: [calendarIntegrations.staffId],
      references: [staff.id],
    }),
    eventLinks: many(calendarEventLinks),
  })
);

export const calendarEventLinksRelations = relations(
  calendarEventLinks,
  ({ one }) => ({
    integration: one(calendarIntegrations, {
      fields: [calendarEventLinks.integrationId],
      references: [calendarIntegrations.id],
    }),
    appointment: one(appointments, {
      fields: [calendarEventLinks.appointmentId],
      references: [appointments.id],
    }),
  })
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  salon: one(salons, { fields: [auditLogs.salonId], references: [salons.id] }),
  actorUser: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));
