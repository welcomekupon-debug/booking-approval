import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import type { Customer, NewCustomer } from "@/lib/db/types";

const notDeleted = (salonId: string) =>
  and(eq(customers.salonId, salonId), isNull(customers.deletedAt));

export interface CustomerListOptions {
  search?: string;
  vipOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function listCustomers(
  salonId: string,
  opts: CustomerListOptions = {}
): Promise<{ items: Customer[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const conditions = [notDeleted(salonId)];
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    conditions.push(
      or(
        ilike(customers.name, q),
        ilike(customers.email, q),
        ilike(customers.phone, q),
        sql`EXISTS (SELECT 1 FROM unnest(${customers.tags}) tag WHERE tag ILIKE ${q})`
      )!
    );
  }
  if (opts.vipOnly) conditions.push(eq(customers.isVip, true));

  const where = and(...conditions);

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.isVip), asc(customers.name))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(customers).where(where),
  ]);

  return { items, total };
}

export async function getCustomerById(
  salonId: string,
  id: string
): Promise<Customer | null> {
  const row = await db.query.customers.findFirst({
    where: and(eq(customers.id, id), notDeleted(salonId)),
  });
  return row ?? null;
}

/**
 * Find-or-create by email (or phone when no email) — used by the booking
 * pipeline so every appointment always has a customer row.
 */
export async function findOrCreateCustomer(
  tx: DbOrTx,
  salonId: string,
  data: { name: string; email?: string | null; phone?: string | null }
): Promise<Customer> {
  const email = data.email?.trim().toLowerCase() || null;
  const phone = data.phone?.trim() || null;

  if (email) {
    const existing = await tx.query.customers.findFirst({
      where: and(eq(customers.email, email), notDeleted(salonId)),
    });
    if (existing) {
      // Backfill phone/name improvements without overwriting good data
      if ((!existing.phone && phone) || (!existing.name && data.name)) {
        const [updated] = await tx
          .update(customers)
          .set({
            phone: existing.phone ?? phone,
            name: existing.name || data.name,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }
  }

  const [created] = await tx
    .insert(customers)
    .values({ salonId, name: data.name, email, phone })
    .returning();
  return created;
}

export async function updateCustomer(
  salonId: string,
  id: string,
  patch: Partial<
    Pick<NewCustomer, "name" | "email" | "phone" | "tags" | "isVip" | "notes">
  >
): Promise<Customer | null> {
  const [row] = await db
    .update(customers)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(customers.id, id), notDeleted(salonId)))
    .returning();
  return row ?? null;
}

export async function softDeleteCustomer(
  salonId: string,
  id: string
): Promise<boolean> {
  const [row] = await db
    .update(customers)
    .set({ deletedAt: new Date() })
    .where(and(eq(customers.id, id), notDeleted(salonId)))
    .returning({ id: customers.id });
  return !!row;
}
