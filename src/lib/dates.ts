/**
 * Parse a date string from the Datum column into a local-time Date.
 * Handles the two most common formats used in European / Slovenian sheets:
 *   DD.MM.YYYY  (e.g. 20.05.2026)
 *   YYYY-MM-DD  (e.g. 2026-05-20)
 * Falls back to the Date constructor for other formats (e.g. MM/DD/YYYY).
 * Returns null when the string is empty or cannot be parsed.
 */
export function parseBookingDate(raw: string): Date | null {
  const s = raw?.trim();
  if (!s) return null;

  // DD.MM.YYYY or D.M.YYYY (European / Slovenian)
  const euro = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (euro) {
    const d = new Date(+euro[3], +euro[2] - 1, +euro[1]);
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY-MM-DD — parse as local time, not UTC
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    if (!isNaN(d.getTime())) return d;
  }

  // Last resort: native parse
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Returns the Monday of the week containing `d` (local time). */
export function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return start;
}
