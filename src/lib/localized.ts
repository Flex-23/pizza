import type { Locale } from "@/i18n/config";

/**
 * Picks the field for the active locale, falling back to the other language so
 * a half-translated dish still renders a name instead of a blank card.
 */
export function pickLocalized(
  locale: string,
  arabic: string | null | undefined,
  german: string | null | undefined,
): string {
  const preferred = locale === "de" ? german : arabic;
  const fallback = locale === "de" ? arabic : german;
  return (preferred || fallback || "").trim();
}

export function localizedName(
  locale: string,
  entity: { nameAr: string; nameDe: string },
): string {
  return pickLocalized(locale, entity.nameAr, entity.nameDe);
}

export function localizedDescription(
  locale: string,
  entity: { descriptionAr?: string | null; descriptionDe?: string | null },
): string {
  return pickLocalized(locale, entity.descriptionAr, entity.descriptionDe);
}

/** Intl locale tag for date and number formatting. */
export function intlLocale(locale: Locale | string): string {
  return locale === "de" ? "de-DE" : "ar-EG";
}
