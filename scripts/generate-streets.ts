/**
 * Turns the flat `streets.txt` delivery lookup into a typed TS module the app
 * can import on both the client (street autocomplete) and the server (strict
 * validation). Re-run whenever `streets.txt` changes:
 *
 *   npm run gen:streets
 *
 * Source format is one record per line, tilde-separated, with a trailing tilde:
 *   Street Name~PostalCode~City~District~
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "streets.txt");
const OUTPUT = resolve(ROOT, "src/lib/data/streets.generated.ts");

type StreetRecord = {
  street: string;
  postalCode: string;
  city: string;
  district: string;
};

function parse(raw: string): StreetRecord[] {
  const seen = new Set<string>();
  const records: StreetRecord[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [street, postalCode, city, district] = trimmed
      .split("~")
      .map((part) => part.trim());

    if (!street || !postalCode || !city || !district) {
      throw new Error(`Malformed line in streets.txt: "${line}"`);
    }

    // The dataset must not carry two records for one street name, or the
    // autocomplete could not resolve a single address from a selection.
    const key = street.toLocaleLowerCase("de");
    if (seen.has(key)) {
      throw new Error(`Duplicate street name in streets.txt: "${street}"`);
    }
    seen.add(key);

    records.push({ street, postalCode, city, district });
  }

  records.sort((a, b) => a.street.localeCompare(b.street, "de"));
  return records;
}

const records = parse(readFileSync(SOURCE, "utf8"));

const body = records
  .map(
    (r) =>
      `  { street: ${JSON.stringify(r.street)}, postalCode: ${JSON.stringify(
        r.postalCode,
      )}, city: ${JSON.stringify(r.city)}, district: ${JSON.stringify(
        r.district,
      )} },`,
  )
  .join("\n");

const file = `// AUTO-GENERATED from streets.txt by \`npm run gen:streets\`. Do not edit by hand.

export type StreetRecord = {
  street: string;
  postalCode: string;
  city: string;
  district: string;
};

export const STREETS: readonly StreetRecord[] = [
${body}
];
`;

writeFileSync(OUTPUT, file, "utf8");
console.log(`Wrote ${records.length} streets to ${OUTPUT}`);
