import { NextRequest, NextResponse } from "next/server";
import { resolveClient } from "@/lib/resolveClient";
import { saveSettings } from "@/lib/sheets";
import { DEFAULT_SETTINGS, type BusinessSettings } from "@/types/app";

/** PUT /api/settings — save a partial settings object (merged server-side). */
export async function PUT(request: NextRequest) {
  try {
    const { client, error } = await resolveClient();
    if (error) return error;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    // Only accept known settings keys
    const partial: Partial<BusinessSettings> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof BusinessSettings)[]) {
      if (key in body) {
        (partial as Record<string, unknown>)[key] = body[key];
      }
    }

    await saveSettings(client.spreadsheetId, partial);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/settings]", error);
    return NextResponse.json(
      { error: "Failed to save settings." },
      { status: 500 }
    );
  }
}
