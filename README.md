# Bookline — Premium Appointment Management

Multi-tenant SaaS for salons and service businesses: booking requests, a
drag-and-drop calendar, customer CRM, analytics, and a public online-booking
page — built on **Next.js 15**, **TypeScript**, **Clerk**, **Drizzle ORM**,
and **PostgreSQL** (Supabase, Neon, or any Postgres — swap via `DATABASE_URL`).

## Architecture

```
src/
  app/
    (app)/               Admin app: dashboard, calendar, appointments,
                         customers, analytics, settings, onboarding
    book/[slug]/         Public booking page (no auth)
    api/                 Thin route handlers: auth → validate → service
    api/public/          Unauthenticated/API-key endpoints
  components/            UI kit + feature components (gold/ink design system)
  lib/
    db/                  Drizzle client + schema (17 tables, UUID keys, UTC)
    repositories/        Tenant-scoped data access (every query filters salon_id)
    services/            Business logic: availability engine, booking service,
                         timezone math (dependency-free, DST-safe)
    validators/          Zod schemas for every input
    auth/context.ts      Clerk → users → memberships → active salon
    legacy/mapper.ts     Sheet-era view-model seam (removed when UI moves to DB shapes)
drizzle/                 Generated SQL migrations
```

**Tenancy.** Users authenticate with Clerk and link to `users.clerk_user_id`.
Salon access flows exclusively through `memberships` (owner / manager /
stylist / receptionist). A user can belong to many salons; every repository
query is scoped by the membership-verified `salon_id` — never client input.

**Booking flow.** Requests arrive from three sources: the public page
(`/book/{slug}`, availability-validated), machine callers like n8n/Tally
(`POST /api/public/bookings`, API-key auth, idempotent on `externalRef`), and
staff (`POST /api/appointments`). All go through one transactional booking
service: conflict detection (buffer-aware), price/duration snapshots, audit
log, notifications.

**Availability** = business hours ∩ staff working hours − blocked times
(incl. holidays) − existing appointments (inflated by buffers), on the salon's
slot-granularity grid, computed in the salon's IANA timezone.

## Setup

1. `npm install`
2. `.env.local` — see `.env.example` (Clerk keys + `DATABASE_URL`; use the
   transaction-pooler URI on serverless hosts)
3. `npm run db:generate && npm run db:migrate`
4. `npm run dev` — sign in, complete onboarding (creates your salon)

## Connecting n8n / Tally

Settings → Online booking & API → create an API key, then point your n8n HTTP
node at:

```
POST /api/public/bookings
Authorization: Bearer bk_live_…
{
  "customer": { "name": "…", "email": "…", "phone": "…" },
  "serviceName": "Haircut",
  "date": "2026-08-01", "time": "14:00",
  "externalRef": "<tally submission id>"
}
```

Retries are safe — `externalRef` deduplicates.

## Scripts

| Command            | Purpose                          |
| ------------------ | -------------------------------- |
| `npm run dev`      | Dev server                       |
| `npm run build`    | Production build                 |
| `npm run db:generate` | Generate SQL migration from schema |
| `npm run db:migrate`  | Apply migrations               |
| `npm run db:studio`   | Browse the DB (Drizzle Studio) |
