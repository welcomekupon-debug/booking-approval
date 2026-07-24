/**
 * File storage — Supabase Storage, accessed via its plain REST API (no
 * @supabase/supabase-js dependency needed for a single upload endpoint).
 * Reuses the same Supabase project the database already lives in, so no new
 * account/service is required — just two extra env vars.
 */

const LOGO_BUCKET = "logos";

function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      "SUPABASE_URL is not set — required to upload files to Supabase Storage."
    );
  }
  return url.replace(/\/+$/, "");
}

function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required to upload files to Supabase Storage."
    );
  }
  return key;
}

/**
 * Uploads (or overwrites) a salon's logo. No extension in the storage path —
 * Supabase Storage serves the file with the Content-Type it was uploaded
 * with regardless of the object key, so re-uploading a different image
 * format cleanly replaces the old one instead of leaving an orphaned file.
 */
export async function uploadLogo(
  salonId: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const path = `${salonId}/logo`;

  const res = await fetch(
    `${supabaseUrl()}/storage/v1/object/${LOGO_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey()}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: file,
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${res.status}): ${text}`);
  }

  // Cache-bust: browsers/img tags otherwise keep showing the old logo after
  // a re-upload since the URL itself never changes.
  return `${supabaseUrl()}/storage/v1/object/public/${LOGO_BUCKET}/${path}?t=${Date.now()}`;
}
