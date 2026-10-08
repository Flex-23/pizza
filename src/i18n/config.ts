// German is the language of the storefront, the customer account and the
// manager dashboard. Arabic is kept only for the master panel, which renders in
// it exclusively (see `@/i18n/resolve`). English is planned as a second public
// language; add "en" to PUBLIC_LOCALES with a `messages/en.json` when it lands.
export const locales = ["de", "ar"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "de";

/** Languages a customer/manager may actually choose in the UI switcher. */
export const PUBLIC_LOCALES = ["de"] as const;

export const LOCALE_COOKIE = "pdn_locale";

export const localeMeta: Record<
  Locale,
  { label: string; dir: "rtl" | "ltr"; htmlLang: string }
> = {
  ar: { label: "العربية", dir: "rtl", htmlLang: "ar" },
  de: { label: "Deutsch", dir: "ltr", htmlLang: "de" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

/** A locale a non-master visitor is allowed to select. */
export function isPublicLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (PUBLIC_LOCALES as readonly string[]).includes(value)
  );
}
