import { NextRequest, NextResponse } from "next/server";
import { resolveClient } from "@/lib/resolveClient";
import { saveServices } from "@/lib/sheets";
import type { Service } from "@/types/app";

/** PUT /api/services — replace the full services list. */
export async function PUT(request: NextRequest) {
  try {
    const { client, error } = await resolveClient();
    if (error) return error;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.services)) {
      return NextResponse.json(
        { error: "Body must contain a services array." },
        { status: 400 }
      );
    }

    const services = (body.services as Service[]).map((s) => ({
      name: String(s.name ?? "").slice(0, 200),
      duration: String(s.duration ?? ""),
      price: String(s.price ?? ""),
      color: String(s.color ?? ""),
      active: s.active !== false,
    }));

    await saveServices(client.spreadsheetId, services);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/services]", error);
    return NextResponse.json(
      { error: "Failed to save services." },
      { status: 500 }
    );
  }
}
