import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CartPageContent } from "@/app/(site)/cart/cart-content";
import { getSettings } from "@/lib/data/settings";
import { isAcceptingOrders } from "@/lib/opening-hours";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CartPage() {
  const [settings, t] = await Promise.all([
    getSettings(),
    getTranslations("cart"),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <h1 className="mb-6 text-3xl font-extrabold">{t("title")}</h1>

      <CartPageContent
        minOrderValue={settings.minOrderValue}
        deliveryFee={settings.deliveryFee}
        freeDeliveryFrom={settings.freeDeliveryFrom}
        canOrder={isAcceptingOrders(settings.isOpen, settings.openingHours)}
      />
    </div>
  );
}
