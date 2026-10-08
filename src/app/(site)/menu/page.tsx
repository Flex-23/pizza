import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CartReconciler } from "@/components/menu/cart-reconciler";
import { MenuBrowser } from "@/components/menu/menu-browser";
import { getPublicCategories, getPublicMenuItems } from "@/lib/data/menu";
import { getSettings } from "@/lib/data/settings";
import { isAcceptingOrders } from "@/lib/opening-hours";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("menu");

  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ category: categorySlug }, categories, items, settings, t] =
    await Promise.all([
      searchParams,
      getPublicCategories(),
      getPublicMenuItems(),
      getSettings(),
      getTranslations("menu"),
    ]);

  const canOrder = isAcceptingOrders(settings.isOpen, settings.openingHours);
  const initialCategoryId = categorySlug
    ? categories.find((entry) => entry.slug === categorySlug)?.id
    : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <div className="flex flex-col gap-2 py-8 text-center sm:py-10">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {t("subtitle")}
        </p>
      </div>

      <CartReconciler items={items} />

      {categories.length === 0 ? (
        <EmptyMenu />
      ) : (
        <MenuBrowser
          categories={categories}
          items={items}
          canOrder={canOrder}
          initialCategoryId={initialCategoryId}
        />
      )}
    </div>
  );
}

async function EmptyMenu() {
  const t = await getTranslations("home");

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
      <h2 className="text-xl font-bold">{t("emptyMenuTitle")}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("emptyMenuBody")}
      </p>
    </div>
  );
}
