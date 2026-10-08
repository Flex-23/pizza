import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChefHat, Clock, MapPin } from "lucide-react";

import { Hero } from "@/components/home/hero";
import { FoodCard } from "@/components/menu/food-card";
import { MapEmbed } from "@/components/layout/map-embed";
import { OpeningHoursList } from "@/components/layout/opening-hours-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMostOrderedItems } from "@/lib/data/menu";
import { getSettings } from "@/lib/data/settings";
import { getOpenState, isAcceptingOrders } from "@/lib/opening-hours";

/** Dishes in the "most ordered" section, straight below the hero. */
const POPULAR_COUNT = 10;

export default async function HomePage() {
  const [settings, popular, t, tContact, tFooter] = await Promise.all([
    getSettings(),
    getMostOrderedItems(POPULAR_COUNT),
    getTranslations("home"),
    getTranslations("contact"),
    getTranslations("footer"),
  ]);

  const openState = getOpenState(settings.openingHours);
  const canOrder = isAcceptingOrders(settings.isOpen, settings.openingHours);

  return (
    <>
      <Hero settings={settings} openState={openState} canOrder={canOrder} />

      {popular.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-14">
          <SectionHeading
            title={t("featuredTitle")}
            subtitle={t("featuredSubtitle")}
            action={
              <Button variant="ghost" render={<Link href="/menu" />}>
                {t("viewAll")}
              </Button>
            }
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {popular.map((item, index) => (
              <FoodCard
                key={item.id}
                item={item}
                canOrder={canOrder}
                priority={index < 5}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14">
            <ChefHat className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-xl font-bold">{t("emptyMenuTitle")}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("emptyMenuBody")}
            </p>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-14">
        <SectionHeading title={t("infoTitle")} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="gap-3 rounded-2xl p-6">
            {/* The section already carries the wider title; repeating it here
                said "التوصيل وأوقات العمل" twice on one screen. */}
            <h3 className="flex items-center gap-2 text-base font-bold">
              <Clock className="size-5 text-primary" aria-hidden />
              {tFooter("openingHours")}
            </h3>
            <OpeningHoursList
              hours={settings.openingHours}
              spread
              className="flex-1"
            />
          </Card>

          <Card className="gap-3 rounded-2xl p-6 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <MapPin className="size-5 text-primary" aria-hidden />
              {tContact("findUs")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {settings.street}, {settings.postalCode} {settings.city}
            </p>

            <MapEmbed
              src={settings.mapEmbedUrl}
              title={tContact("findUs")}
              className="mt-1 aspect-video min-h-52 flex-1"
            />
          </Card>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
