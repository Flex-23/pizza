/**
 * Money helpers.
 *
 * Prices live in MySQL as DECIMAL(10,2). Depending on the driver they arrive as
 * a number, a string, or a decimal object, so every value crossing the
 * server/client boundary goes through `toNumber` first — React Server
 * Components can only serialise plain values.
 */

type DecimalObject = { toNumber: () => number };

function hasToNumber(value: object): value is DecimalObject {
  return typeof (value as DecimalObject).toNumber === "function";
}

/** Accepts whatever the driver hands back for a DECIMAL column. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && hasToNumber(value)) {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Rounds to cents, avoiding the classic 0.1 + 0.2 drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sum(values: number[]): number {
  return round2(values.reduce((total, value) => total + value, 0));
}

/**
 * Resolves the price a customer actually pays.
 * An explicit `discountPrice` always wins over `discountPercent`.
 */
export function effectivePrice(input: {
  price: number;
  discountPercent?: number | null;
  discountPrice?: number | null;
}): number {
  const { price } = input;
  const discountPrice = input.discountPrice ?? null;

  if (discountPrice !== null && discountPrice > 0 && discountPrice < price) {
    return round2(discountPrice);
  }

  const percent = input.discountPercent ?? 0;
  if (percent > 0 && percent < 100) {
    return round2(price * (1 - percent / 100));
  }

  return round2(price);
}

/** Whole-percent saving, for the badge on a menu card. Returns 0 when there is no discount. */
export function discountPercentage(input: {
  price: number;
  discountPercent?: number | null;
  discountPrice?: number | null;
}): number {
  const final = effectivePrice(input);
  if (input.price <= 0 || final >= input.price) return 0;
  return Math.round(((input.price - final) / input.price) * 100);
}

/** German-style currency formatting, e.g. "12,50 €" — correct for both locales. */
export function formatPrice(value: number, locale: string = "de-DE"): string {
  return new Intl.NumberFormat(locale === "ar" ? "de-DE" : locale, {
    style: "currency",
    currency: "EUR",
  }).format(round2(value));
}
