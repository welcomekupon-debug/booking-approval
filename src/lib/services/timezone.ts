/**
 * Timezone math without dependencies, built on Intl (available in Node and
 * every modern runtime). The rule everywhere in this codebase:
 *   • Instants (appointments, blocked times) are UTC `Date`s.
 *   • Wall-clock times (business hours, "book me at 14:00") are salon-local
 *     and must be converted at the edges using these helpers.
 */

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getDtf(timeZone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    dtfCache.set(timeZone, dtf);
  }
  return dtf;
}

/** What does a UTC instant read as on the wall clock in `timeZone`? */
export function utcToWall(date: Date, timeZone: string): WallClock & {
  second: number;
  weekday: number; // 0 = Monday … 6 = Sunday
} {
  const parts = getDtf(timeZone).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const wall = {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24, // Intl can emit "24" for midnight
    minute: get("minute"),
    second: get("second"),
  };

  // Weekday of the local date (0 = Monday), computed from the local Y/M/D
  const jsDay = new Date(
    Date.UTC(wall.year, wall.month - 1, wall.day)
  ).getUTCDay(); // 0 = Sunday
  const weekday = (jsDay + 6) % 7;

  return { ...wall, weekday };
}

/**
 * Convert a salon-local wall-clock time to the UTC instant it represents.
 * Two-pass fixed-point: guess UTC, see what it reads locally, correct.
 * Handles DST transitions correctly (ambiguous times resolve to the earlier
 * offset; nonexistent times shift forward — both acceptable for scheduling).
 */
export function wallToUtc(wall: WallClock, timeZone: string): Date {
  const asUtcMs = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute
  );

  let guess = asUtcMs;
  for (let i = 0; i < 3; i++) {
    const seen = utcToWall(new Date(guess), timeZone);
    const seenMs = Date.UTC(
      seen.year,
      seen.month - 1,
      seen.day,
      seen.hour,
      seen.minute,
      seen.second
    );
    const diff = asUtcMs - seenMs;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

/** Parse "YYYY-MM-DD" + "HH:MM[:SS]" (salon-local) into a UTC Date. */
export function localDateTimeToUtc(
  dateIso: string,
  time: string,
  timeZone: string
): Date {
  const [year, month, day] = dateIso.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return wallToUtc({ year, month, day, hour, minute }, timeZone);
}

/** Weekday (0 = Monday) of a local "YYYY-MM-DD". */
export function weekdayOfLocalDate(dateIso: string): number {
  const [year, month, day] = dateIso.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (jsDay + 6) % 7;
}

/** Today's date in `timeZone`, as "YYYY-MM-DD". */
export function todayLocalIso(timeZone: string): string {
  const w = utcToWall(new Date(), timeZone);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** Add days to a "YYYY-MM-DD" string (pure calendar arithmetic). */
export function addDaysIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}
