import { z } from "zod";

/** Reusable primitives shared by several entity schemas. */

export const idSchema = z.string().min(1, "Kennung erforderlich");

export const slugSchema = z
  .string()
  .min(2, "الرابط قصير جداً")
  .max(140)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط",
  );

export const priceSchema = z.coerce
  .number({ message: "أدخل سعراً صحيحاً" })
  .min(0, "السعر لا يمكن أن يكون سالباً")
  .max(9999.99, "السعر أكبر من الحد المسموح")
  .refine((value) => Number.isFinite(value), "أدخل سعراً صحيحاً");

export const sortOrderSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(9999)
  .default(0);

export const postalCodeSchema = z
  .string()
  .trim()
  // The empty case gets its own message: "must be 5 digits" reads like a
  // correction, not like a field the customer simply has not filled in yet.
  .min(1, "PLZ erforderlich")
  .regex(/^\d{5}$/, "Die PLZ muss aus 5 Ziffern bestehen");

/** German landline/mobile numbers, entered with or without spaces or +49. */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Telefonnummer erforderlich")
  .min(6, "Telefonnummer ist zu kurz")
  .max(40)
  .regex(/^[+()\d\s/-]+$/, "Telefonnummer enthält ungültige Zeichen");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "E-Mail-Adresse erforderlich")
  .email("Ungültige E-Mail-Adresse");

/** Trims, then converts "" to undefined so optional text fields stay clean. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Maximal ${max} Zeichen`)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

/**
 * Google Maps' "share" box hands out a whole `<iframe …>` snippet, and pasting
 * it whole is the natural mistake. Keep the src rather than rejecting it.
 */
function unwrapEmbedUrl(value: string): string {
  const match = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(value);
  return match ? match[1].trim() : value;
}

/** "www.facebook.com/pizza" is what a manager types; assume https for it. */
function withScheme(value: string): string {
  if (value === "" || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return `https://${value}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    return (
      (protocol === "http:" || protocol === "https:") && hostname.includes(".")
    );
  } catch {
    return false;
  }
}

/**
 * Optional link field. Only http(s) survives, so a `javascript:` URL can never
 * reach an `href` or an iframe `src`.
 */
export const optionalUrl = (max = 500) =>
  z
    .string()
    .trim()
    .transform(unwrapEmbedUrl)
    .transform(withScheme)
    .refine((value) => value.length <= max, `الحد الأقصى ${max} حرفاً`)
    .refine(
      (value) => value === "" || isHttpUrl(value),
      "أدخل رابطاً صالحاً يبدأ بـ https://",
    )
    .transform((value) => (value === "" ? undefined : value))
    .optional();

export const stringArraySchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .default([]);

/** Turns "a, b , c" from a text input into a clean string array. */
export const csvToArraySchema = z
  .union([z.string(), z.array(z.string())])
  .default([])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20),
  );

const TRANSLITERATIONS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  é: "e",
  è: "e",
  ê: "e",
  á: "a",
  à: "a",
  í: "i",
  ó: "o",
  ú: "u",
  ñ: "n",
  ç: "c",
};

/**
 * Builds a URL-safe slug. Latin input (the German name) transliterates cleanly;
 * scripts without a Latin form — Arabic, for instance — yield an empty string,
 * so callers must supply their own fallback.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => TRANSLITERATIONS[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

/** Slug that is always valid, even for Arabic-only names. */
export function slugifyWithFallback(
  input: string,
  fallbackSeed: string,
): string {
  const slug = slugify(input);
  if (slug.length >= 2) return slug;
  return `c-${
    fallbackSeed
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10) || Date.now().toString(36)
  }`;
}
