import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, Clock, Phone, Truck } from "lucide-react";

import { HeroGallery } from "@/components/home/hero-gallery";
import { Button } from "@/components/ui/button";
import { localeMeta, type Locale } from "@/i18n/config";
import { formatPrice } from "@/lib/money";
import { pickLocalized } from "@/lib/localized";
import type { SettingsView } from "@/lib/schemas/settings";
import type { OpenState } from "@/lib/opening-hours";

export async function Hero({
  settings,
  openState,
  canOrder,
}: {
  settings: SettingsView;
  openState: OpenState;
  canOrder: boolean;
}) {
  const [t, tStatus, tHome, locale] = await Promise.all([
    getTranslations("common"),
    getTranslations("status"),
    getTranslations("home"),
    getLocale(),
  ]);

  const brand = pickLocalized(
    locale,
    settings.restaurantNameAr,
    settings.restaurantNameDe,
  );
  const isRtl = localeMeta[locale as Locale]?.dir === "rtl";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="hero-glow absolute inset-0" aria-hidden />

      {/* Two columns from `lg` up, and the gallery deliberately gets the wider
          share — a wider frame than the rest of the page, so the photography
          leads. Below that the text leads and the gallery follows. */}
      <div className="relative mx-auto grid max-w-352 items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)] lg:gap-14 2xl:max-w-416">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-1.5 text-xs font-semibold backdrop-blur-sm sm:text-sm">
            <Truck className="size-4 text-primary" aria-hidden />
            {t("tagline")}
          </span>

          <h1 className="max-w-3xl text-4xl leading-[1.15] font-extrabold sm:text-5xl lg:text-6xl">
            {tHome("heroTitle")}
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {tHome("heroSubtitle")}
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            {/* No `data-icon` on either pill: that attribute trims the padding
                on the icon's side, which is right for a small button but leaves
                the label of a wide pill sitting off-centre. */}
            <Button
              size="lg"
              className="h-12 rounded-full px-7 text-base font-bold"
              render={<Link href="/menu" />}
            >
              {canOrder ? tHome("orderNow") : tHome("browseMenu")}
              <Arrow />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-full px-7 text-base font-semibold"
              render={<a href={`tel:${settings.phone.replace(/\s/g, "")}`} />}
            >
              <Phone />
              <span dir="ltr">{settings.phone}</span>
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-primary" aria-hidden />
              {openState.isOpen && openState.closesAt
                ? tStatus("closesAt", { time: openState.closesAt })
                : openState.opensAt
                  ? tStatus("opensAt", { time: openState.opensAt })
                  : tStatus("closed")}
            </span>
            <span className="flex items-center gap-1.5">
              <Truck className="size-4 text-primary" aria-hidden />
              {tHome("minOrder")}: {formatPrice(settings.minOrderValue, locale)}
            </span>
            {settings.freeDeliveryFrom !== null && (
              <span className="font-semibold text-success">
                {tHome("freeDeliveryFrom", {
                  amount: formatPrice(settings.freeDeliveryFrom, locale),
                })}
              </span>
            )}
          </div>

          {!canOrder && (
            /* Opaque amber with black text: the notice has to stay readable on
               the dark hero, where a translucent warning tint washed out. */
            <p className="mt-2 flex max-w-xl items-start gap-2 rounded-xl bg-linear-to-r from-amber-300 via-amber-200 to-yellow-300 px-4 py-3 text-start text-sm font-semibold text-black shadow-md ring-1 ring-amber-500/40">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              {tStatus("closedNotice")}
            </p>
          )}

          <p className="sr-only">{brand}</p>
        </div>

        <div className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
          <HeroGallery images={settings.heroImages ?? []} />
        </div>
      </div>
    </section>
  );
}
