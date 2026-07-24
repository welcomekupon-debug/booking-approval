import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireRole, requireTenant } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rateLimit";
import { updateSalon } from "@/lib/repositories/salons";
import { uploadLogo } from "@/lib/services/storage";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 3 * 1024 * 1024; // 3MB

/** POST /api/uploads/logo — multipart/form-data with a single "file" field. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");

    // Authenticated, but still cheap insurance against a runaway client.
    await checkRateLimit(`upload-logo:${ctx.salon.id}`, 10, 60);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      throw ApiError.badRequest("No file provided.");
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      throw ApiError.badRequest("Logo must be a PNG, JPG, or WebP image.");
    }
    if (file.size > MAX_BYTES) {
      throw ApiError.badRequest("Logo must be under 3MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const logoUrl = await uploadLogo(ctx.salon.id, buffer, file.type);
    await updateSalon(ctx.salon.id, { logoUrl });

    return { logoUrl };
  });
}
