import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { MapPin, Phone, Pizza } from "lucide-react";

import { FacebookIcon } from "@/components/icons/facebook";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { getSettings } from "@/lib/data/settings";
import { pickLocalized } from "@/lib/localized";

export async function SiteFooter() {
  const [settings, t, tNav, tContact, tLegal, locale] = await Promise.all([
    getSettings(),
    getTranslations("footer"),
    getTranslations("nav"),
    getTranslations("contact"),
    getTranslations("legal"),
    getLocale(),
  ]);

  const brand = pickLocalized(
    locale,
    settings.restaurantNameAr,
    settings.restaurantNameDe,
  );

  const legalLinks = [
    { href: "/terms", label: tLegal("terms") },
    { href: "/privacy", label: tLegal("privacy") },
    { href: "/allergens", label: tLegal("allergens") },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      {/* Four columns, one list each. Widths follow how much each column has
          to say — the brand paragraph and the address need room, two short
          link lists do not — so nothing stretches thin or wraps early. */}
      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1.4fr_1fr]">
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Pizza className="size-5" aria-hidden />
            </span>
            <span className="text-base font-extrabold">{brand}</span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t("aboutBody")}
          </p>
          {settings.facebookUrl && (
            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-auto inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <FacebookIcon className="size-4" />
              {tContact("facebook")}
            </a>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide uppercase">
            {t("quickLinks")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition-colors hover:text-primary"
                >
                  {tNav(item.labelKey)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/orders"
                className="transition-colors hover:text-primary"
              >
                {tNav("orders")}
              </Link>
            </li>
            <li>
              <Link
                href="/account"
                className="transition-colors hover:text-primary"
              >
                {tNav("account")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide uppercase">
            {t("contactUs")}
          </h2>
          <address className="flex flex-col gap-2.5 text-sm text-muted-foreground not-italic">
            <span className="flex items-start gap-2">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <span>
                {settings.street}
                <br />
                {settings.postalCode} {settings.city}
              </span>
            </span>
            {/* The contact box carries the primary phone only — secondary
                numbers, fax and email are intentionally kept off it. */}
            <a
              href={`tel:${settings.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 transition-colors hover:text-primary"
            >
              <Phone className="size-4 shrink-0 text-primary" aria-hidden />
              <span dir="ltr">{settings.phone}</span>
            </a>
          </address>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide uppercase">
            {t("legalLinks")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition-colors hover:text-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-5 text-center text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {brand} — {t("rights")}
          </p>
          <span className="opacity-50" aria-hidden>
            ·
          </span>
          <address className="not-italic">
            {settings.street}, {settings.postalCode} {settings.city}
          </address>
        </div>
      </div>
    </footer>
  );
}
