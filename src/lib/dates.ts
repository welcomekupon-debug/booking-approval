/**
 * Parse a date string from the Datum column into a local-time Date.
 * Handles DD.MM.YYYY (European/Slovenian) and YYYY-MM-DD, with a native
 * Date fallback. Returns null when empty or unparseable.
 */
export function parseBookingDate(raw: string): Date | null {
  const s = raw?.trim();
  if (!s) return null;

  const euro = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (euro) {
    const d = new Date(+euro[3], +euro[2] - 1, +euro[1]);
    if (!isNaN(d.getTime())) return d;
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse "HH:MM" (or "H.MM") into minutes since midnight; null if invalid. */
export function parseTime(raw: string): number | null {
  const m = raw?.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Combine Datum + Ura into a full Date (time defaults to 00:00). */
export function bookingDateTime(datum: string, ura: string): Date | null {
  const d = parseBookingDate(datum);
  if (!d) return null;
  const mins = parseTime(ura);
  if (mins !== null) {
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  }
  return d;
}

/** Returns the Monday of the week containing `d` (local time). */
export function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Format a Date back into the sheet's DD.MM.YYYY format. */
export function toSheetDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** "Wed, 8 Jul" style short label */
export function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "8 July 2026" */
export function longDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Minutes since midnight → "9:30" */
export function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
