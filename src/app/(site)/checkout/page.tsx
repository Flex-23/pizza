import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CheckoutForm } from "@/app/(site)/checkout/checkout-form";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getDeliveryZones, getSettings } from "@/lib/data/settings";
import { isAcceptingOrders } from "@/lib/opening-hours";
import type { AddressView } from "@/lib/schemas/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage() {
  const [settings, zones, user, t] = await Promise.all([
    getSettings(),
    getDeliveryZones(true),
    getCurrentUser(),
    getTranslations("checkout"),
  ]);

  const addresses: AddressView[] = user
    ? await db.address
        .findMany({
          where: { userId: user.id },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            label: row.label,
            street: row.street,
            postalCode: row.postalCode,
            city: row.city,
            district: row.district,
            notes: row.notes,
            isDefault: row.isDefault,
          })),
        )
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <CheckoutForm
        settings={{
          minOrderValue: settings.minOrderValue,
          deliveryFee: settings.deliveryFee,
          freeDeliveryFrom: settings.freeDeliveryFrom,
          city: settings.city,
        }}
        zones={zones}
        addresses={addresses}
        user={
          user
            ? { name: user.name, email: user.email, phone: user.phone ?? "" }
            : null
        }
        canOrder={isAcceptingOrders(settings.isOpen, settings.openingHours)}
        paypalEnabled={settings.isPaypalEnabled}
      />
    </div>
  );
}
