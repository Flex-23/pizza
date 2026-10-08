import { STREETS, type StreetRecord } from "@/lib/data/streets.generated";

export { STREETS };
export type { StreetRecord };

/** Locale-aware key so casing and stray spaces never change a match. */
function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("de");
}

const byName = new Map<string, StreetRecord>(
  STREETS.map((record) => [normalize(record.street), record]),
);

/**
 * The single source of truth for "is this a real street?". Used by the server
 * action to enforce the strict-list constraint — a hand-typed street that is not
 * in the dataset resolves to `undefined` and the registration is rejected.
 */
export function findStreet(name: string): StreetRecord | undefined {
  return byName.get(normalize(name));
}

/**
 * Ranks prefix matches above substring matches so typing "Ahorn" surfaces
 * "Ahornweg" before a street that merely contains those letters. Returns at most
 * `limit` records to keep the dropdown short and the render cheap.
 */
export function searchStreets(query: string, limit = 8): StreetRecord[] {
  const q = normalize(query);
  if (!q) return [];

  const prefix: StreetRecord[] = [];
  const contains: StreetRecord[] = [];

  for (const record of STREETS) {
    const name = normalize(record.street);
    if (name.startsWith(q)) prefix.push(record);
    else if (name.includes(q)) contains.push(record);
  }

  return [...prefix, ...contains].slice(0, limit);
}

/**
 * Splits a stored "<street name> <house number>" back into its two parts so an
 * existing address can prefill the combobox for editing. Matches the longest
 * dataset street the value starts with; the remainder is the house number.
 * Legacy free-text addresses that match nothing return empty parts, so the
 * customer re-picks a valid street.
 */
export function splitStreetAddress(full: string): {
  streetName: string;
  houseNumber: string;
} {
  const value = full.trim();
  const lower = normalize(value);

  let best: StreetRecord | undefined;
  for (const record of STREETS) {
    const name = normalize(record.street);
    if (
      lower.startsWith(name) &&
      (best === undefined || record.street.length > best.street.length)
    ) {
      best = record;
    }
  }

  if (!best) return { streetName: "", houseNumber: "" };
  return {
    streetName: best.street,
    houseNumber: value.slice(best.street.length).trim(),
  };
}
