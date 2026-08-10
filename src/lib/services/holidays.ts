/**
 * Public holiday suggestions — sourced from the free, keyless Nager.Date API
 * (https://date.nager.at). Purely advisory: nothing here ever touches a
 * salon's `blockedTimes`/`holidays` on its own. It only feeds a checklist in
 * Settings that the owner explicitly accepts, one date or all of them at
 * once — never applied automatically.
 *
 * The external API is a nice-to-have, not a dependency the app can break on:
 * every function here fails soft (returns []) and logs, rather than
 * throwing, so a Nager.Date outage never breaks the Settings page.
 */

const API_BASE = "https://date.nager.at/api/v3";

export interface CountryOption {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}

export interface HolidaySuggestion {
  /** "YYYY-MM-DD" */
  date: string;
  name: string;
}

/** Every country Nager.Date has holiday data for. Cached a day — this list barely changes. */
export async function fetchAvailableCountries(): Promise<CountryOption[]> {
  try {
    const res = await fetch(`${API_BASE}/AvailableCountries`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`Nager.Date responded ${res.status}`);
    const rows = (await res.json()) as { countryCode: string; name: string }[];
    return rows
      .map((r) => ({ code: r.countryCode, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.warn("[holidays] Couldn't load available countries:", err);
    return [];
  }
}

/** Public holidays for one country + calendar year. Cached a day. */
export async function fetchPublicHolidays(
  countryCode: string,
  year: number
): Promise<HolidaySuggestion[]> {
  try {
    const res = await fetch(
      `${API_BASE}/PublicHolidays/${year}/${encodeURIComponent(countryCode)}`,
      { next: { revalidate: 86400 } }
    );
    if (res.status === 404) return []; // unknown country code
    if (!res.ok) throw new Error(`Nager.Date responded ${res.status}`);
    const rows = (await res.json()) as {
      date: string;
      name: string;
      localName: string;
    }[];
    return rows
      .map((r) => ({ date: r.date, name: r.localName || r.name }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn(
      `[holidays] Couldn't load public holidays for ${countryCode}/${year}:`,
      err
    );
    return [];
  }
}
