import { NextRequest, NextResponse } from "next/server";
import { resolveClient } from "@/lib/resolveClient";
import { saveStaff } from "@/lib/sheets";
import type { StaffMember } from "@/types/app";

/** PUT /api/staff — replace the full staff list. */
export async function PUT(request: NextRequest) {
  try {
    const { client, error } = await resolveClient();
    if (error) return error;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.staff)) {
      return NextResponse.json(
        { error: "Body must contain a staff array." },
        { status: 400 }
      );
    }

    const staff = (body.staff as StaffMember[]).map((s) => ({
      name: String(s.name ?? "").slice(0, 200),
      email: String(s.email ?? ""),
      phone: String(s.phone ?? ""),
      role: String(s.role ?? ""),
      color: String(s.color ?? ""),
      active: s.active !== false,
    }));

    await saveStaff(client.spreadsheetId, staff);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/staff]", error);
    return NextResponse.json({ error: "Failed to save staff." }, { status: 500 });
  }
}
