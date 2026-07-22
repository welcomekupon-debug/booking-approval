/**
 * One-time Google Sheets → Postgres import.
 *
 * Run locally (needs GOOGLE_* legacy env vars AND DATABASE_URL in .env.local):
 *
 *   npx tsx scripts/import-sheets.ts            # import every client
 *   npx tsx scripts/import-sheets.ts you@x.com  # import one client
 *
 * Idempotent: appointments carry externalRef = sheet Bookingid (or a
 * deterministic fallback), salons match on slug, customers on email —
 * re-running updates nothing and duplicates nothing.
 *
 * For each row of the master Clients sheet this creates:
 *   salon (+ default settings + business hours from the Settings tab)
 *   placeholder user  pending:<client email>  + owner membership
 *     (claimed automatically on the client's first sign-in)
 *   services / staff / customers / appointments from the per-client tabs
 *
 * After a verified import, delete this script and `npm uninstall googleapis`.
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { google } from "googleapis";
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  appointments,
  appointmentServices,
  businessHours,
  customers,
  memberships,
  salons,
  services,
  settings,
  staff,
  users,
} from "../src/lib/db/schema";
import { localDateTimeToUtc } from "../src/lib/services/timezone";

const TZ = process.env.IMPORT_TIMEZONE ?? "Europe/Ljubljana";

// ── Sheets client (legacy) ──────────────────────────────────────────────────

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

async function readRange(
  api: ReturnType<typeof sheetsClient>,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  try {
    const res = await api.spreadsheets.values.get({ spreadsheetId, range });
    return ((res.data.values ?? []) as string[][]).slice(1); // skip header
  } catch {
    return [];
  }
}

// ── Parsing helpers ─────────────────────────────────────────────────────────

function parseSheetDate(raw: string): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const euro = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (euro)
    return `${euro[3]}-${euro[2].padStart(2, "0")}-${euro[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso)
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return null;
}

function parseSheetTime(raw: string): string {
  const m = raw?.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return "09:00";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function toCents(raw: string): number {
  const n = parseFloat((raw ?? "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function mapStatus(
  raw: string
): "pending" | "confirmed" | "declined" {
  const s = raw?.trim().toLowerCase();
  if (s === "confirmed") return "confirmed";
  if (s === "declined") return "declined";
  return "pending";
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 48) || "salon"
  );
}

// ── Import one client ───────────────────────────────────────────────────────

interface ClientRow {
  name: string;
  email: string;
  spreadsheetId: string;
  sheetName: string;
}

async function importClient(api: ReturnType<typeof sheetsClient>, c: ClientRow) {
  console.log(`\n▸ Importing "${c.name}" <${c.email}>`);

  // 1. Salon (match on slug for idempotency)
  const slug = slugify(c.name);
  let salon = await db.query.salons.findFirst({ where: eq(salons.slug, slug) });
  if (!salon) {
    [salon] = await db
      .insert(salons)
      .values({ name: c.name, slug, timezone: TZ })
      .returning();
    console.log(`  salon created (${slug})`);
  } else {
    console.log(`  salon exists (${slug})`);
  }
  const salonId = salon.id;

  // 2. Placeholder user + owner membership (claimed at first sign-in)
  const emailLc = c.email.trim().toLowerCase();
  let user = await db.query.users.findFirst({ where: eq(users.email, emailLc) });
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ clerkUserId: `pending:${emailLc}`, email: emailLc, name: c.name })
      .returning();
  }
  const membership = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, user.id), eq(memberships.salonId, salonId)),
  });
  if (!membership) {
    await db
      .insert(memberships)
      .values({ userId: user.id, salonId, role: "owner" });
  }

  // 3. Settings tab (key/value) → settings + salon fields + business hours
  const settingsRows = await readRange(api, c.spreadsheetId, "Settings!A:B");
  const kv = new Map(settingsRows.map(([k, v]) => [k, v ?? ""]));

  await db
    .insert(settings)
    .values({ salonId })
    .onConflictDoNothing({ target: settings.salonId });

  const bool = (k: string, dflt: boolean) =>
    kv.has(k) ? kv.get(k) === "TRUE" || kv.get(k) === "true" : dflt;
  const num = (k: string, dflt: number) => {
    const n = Number(kv.get(k));
    return kv.has(k) && !isNaN(n) ? n : dflt;
  };

  await db
    .update(settings)
    .set({
      defaultDurationMinutes: num("defaultDuration", 30),
      defaultBufferAfterMinutes: num("bufferMinutes", 0),
      maxAdvanceDays: num("maxAdvanceDays", 60),
      autoConfirm: bool("autoConfirm", false),
      allowCancellation: bool("allowCancellation", true),
      revenueEnabled: bool("revenueEnabled", true),
      reminderHoursBefore: num("reminderHoursBefore", 24),
      onboardingComplete: bool("onboardingComplete", false),
    })
    .where(eq(settings.salonId, salonId));

  await db
    .update(salons)
    .set({
      businessType: kv.get("businessType") || null,
      phone: kv.get("phone") || null,
      email: kv.get("email") || emailLc,
      website: kv.get("website") || null,
      address: kv.get("address") || null,
      logoUrl: kv.get("logoUrl") || null,
      brandColor: kv.get("brandColor") || null,
      currency: kv.get("currency") || "EUR",
      name: kv.get("businessName") || c.name,
    })
    .where(eq(salons.id, salonId));

  try {
    const hours = JSON.parse(kv.get("hours") ?? "null") as Record<
      string,
      { open: boolean; from: string; to: string }
    > | null;
    if (hours) {
      const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      await db.delete(businessHours).where(eq(businessHours.salonId, salonId));
      const windows = DAY_KEYS.flatMap((key, weekday) => {
        const d = hours[key];
        return d?.open && d.from < d.to
          ? [{ salonId, weekday, opensAt: d.from, closesAt: d.to }]
          : [];
      });
      if (windows.length) await db.insert(businessHours).values(windows);
      console.log(`  business hours: ${windows.length} windows`);
    }
  } catch {
    /* no hours stored */
  }

  // 4. Services tab
  const serviceRows = await readRange(api, c.spreadsheetId, "Services!A:E");
  const serviceByName = new Map<string, { id: string; durationMinutes: number; priceCents: number }>();
  for (const [name, duration, price, color, active] of serviceRows) {
    if (!name?.trim()) continue;
    const existing = await db.query.services.findFirst({
      where: and(eq(services.salonId, salonId), eq(services.name, name.trim())),
    });
    const fields = {
      durationMinutes: parseInt(duration, 10) || 30,
      priceCents: toCents(price),
      color: color || null,
      isActive: (active ?? "TRUE").toUpperCase() !== "FALSE",
    };
    if (existing) {
      serviceByName.set(name.trim().toLowerCase(), {
        id: existing.id,
        durationMinutes: fields.durationMinutes,
        priceCents: fields.priceCents,
      });
    } else {
      const [row] = await db
        .insert(services)
        .values({ salonId, name: name.trim(), ...fields })
        .returning();
      serviceByName.set(name.trim().toLowerCase(), {
        id: row.id,
        durationMinutes: row.durationMinutes,
        priceCents: row.priceCents,
      });
    }
  }
  console.log(`  services: ${serviceByName.size}`);

  // 5. Staff tab
  const staffRows = await readRange(api, c.spreadsheetId, "Staff!A:F");
  const staffByName = new Map<string, string>();
  for (const [name, email, phone, role, color, active] of staffRows) {
    if (!name?.trim()) continue;
    const existing = await db.query.staff.findFirst({
      where: and(eq(staff.salonId, salonId), eq(staff.name, name.trim())),
    });
    if (existing) {
      staffByName.set(name.trim().toLowerCase(), existing.id);
    } else {
      const [row] = await db
        .insert(staff)
        .values({
          salonId,
          name: name.trim(),
          email: email || null,
          phone: phone || null,
          roleTitle: role || null,
          color: color || null,
          isActive: (active ?? "TRUE").toUpperCase() !== "FALSE",
        })
        .returning();
      staffByName.set(name.trim().toLowerCase(), row.id);
    }
  }
  console.log(`  staff: ${staffByName.size}`);

  // 6. Customers tab (metadata overlay — rows created lazily during bookings)
  const customerMetaRows = await readRange(api, c.spreadsheetId, "Customers!A:E");
  const metaByEmail = new Map(
    customerMetaRows
      .filter((r) => r[0]?.trim())
      .map((r) => [
        r[0].trim().toLowerCase(),
        {
          phone: r[1] ?? "",
          tags: (r[2] ?? "").split(",").map((t) => t.trim()).filter(Boolean),
          vip: (r[3] ?? "").toUpperCase() === "TRUE",
          notes: r[4] ?? "",
        },
      ])
  );

  async function findOrCreateCustomer(name: string, email: string, phone: string) {
    const emailNorm = email.trim().toLowerCase() || null;
    if (emailNorm) {
      const existing = await db.query.customers.findFirst({
        where: and(eq(customers.salonId, salonId), eq(customers.email, emailNorm)),
      });
      if (existing) return existing;
    }
    const meta = emailNorm ? metaByEmail.get(emailNorm) : undefined;
    const [row] = await db
      .insert(customers)
      .values({
        salonId,
        name: name.trim() || emailNorm || "Unknown",
        email: emailNorm,
        phone: phone?.trim() || meta?.phone || null,
        tags: meta?.tags ?? [],
        isVip: meta?.vip ?? false,
        notes: meta?.notes || null,
      })
      .returning();
    return row;
  }

  // 7. Bookings (A:M) → appointments + line items
  const bookingRows = await readRange(
    api,
    c.spreadsheetId,
    `${c.sheetName}!A:M`
  );
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < bookingRows.length; i++) {
    const [
      ime, gmail, datum, ura, statusRaw, bookingId, updatedAt,
      phone, serviceName, duration, notes, price, staffName,
    ] = bookingRows[i];

    const dateIso = parseSheetDate(datum);
    if (!dateIso || !ime?.trim()) {
      skipped++;
      continue;
    }

    const externalRef = bookingId?.trim() || `sheet-import-${i + 2}`;
    const already = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.salonId, salonId),
        eq(appointments.externalRef, externalRef)
      ),
    });
    if (already) {
      skipped++;
      continue;
    }

    const startsAt = localDateTimeToUtc(dateIso, parseSheetTime(ura), TZ);
    const catalogService = serviceName?.trim()
      ? serviceByName.get(serviceName.trim().toLowerCase())
      : undefined;
    const durationMinutes =
      parseInt(duration, 10) || catalogService?.durationMinutes || 30;
    const priceCents = price?.trim()
      ? toCents(price)
      : (catalogService?.priceCents ?? 0);

    const customer = await findOrCreateCustomer(ime, gmail ?? "", phone ?? "");
    const staffId = staffName?.trim()
      ? (staffByName.get(staffName.trim().toLowerCase()) ?? null)
      : null;

    const [appointment] = await db
      .insert(appointments)
      .values({
        salonId,
        customerId: customer.id,
        staffId,
        status: mapStatus(statusRaw),
        source: "import",
        startsAt,
        endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
        priceTotalCents: priceCents,
        internalNote: notes || null,
        externalRef,
        updatedAt: updatedAt ? new Date(updatedAt) : undefined,
      })
      .returning();

    if (serviceName?.trim()) {
      await db.insert(appointmentServices).values({
        salonId,
        appointmentId: appointment.id,
        serviceId: catalogService?.id ?? null,
        serviceName: serviceName.trim(),
        durationMinutes,
        priceCents,
      });
    }
    imported++;
  }

  console.log(`  appointments: ${imported} imported, ${skipped} skipped (dupes/invalid)`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const onlyEmail = process.argv[2]?.trim().toLowerCase();
  const api = sheetsClient();

  const clientRows = await readRange(
    api,
    process.env.GOOGLE_CLIENTS_SHEET_ID!,
    `${process.env.GOOGLE_CLIENTS_SHEET_NAME ?? "Clients"}!A:F`
  );

  const clients: ClientRow[] = clientRows
    .filter((r) => r[1]?.trim() && r[2]?.trim())
    .map((r) => ({
      name: r[0]?.trim() || r[1].trim(),
      email: r[1].trim(),
      spreadsheetId: r[2].trim(),
      sheetName: r[3]?.trim() || "Sheet1",
    }))
    .filter((c) => !onlyEmail || c.email.toLowerCase() === onlyEmail);

  if (clients.length === 0) {
    console.error("No matching clients found in the master sheet.");
    process.exit(1);
  }

  console.log(`Importing ${clients.length} client(s)…`);
  for (const c of clients) {
    await importClient(api, c);
  }

  console.log("\n✔ Import complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
