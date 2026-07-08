import { NextRequest, NextResponse } from "next/server";
import { resolveClient } from "@/lib/resolveClient";
import { upsertCustomerMeta } from "@/lib/sheets";

/** PUT /api/customers — upsert one customer's metadata (tags / VIP / notes). */
export async function PUT(request: NextRequest) {
  try {
    const { client, error } = await resolveClient();
    if (error) return error;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.email !== "string" || !body.email.trim()) {
      return NextResponse.json(
        { error: "Body must contain a customer email." },
        { status: 400 }
      );
    }

    await upsertCustomerMeta(client.spreadsheetId, {
      email: body.email,
      phone: String(body.phone ?? ""),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      vip: body.vip === true,
      notes: String(body.notes ?? ""),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/customers]", error);
    return NextResponse.json(
      { error: "Failed to save customer." },
      { status: 500 }
    );
  }
}
