import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { MapPin, ReceiptText } from "lucide-react";

import { OrderSummary } from "@/components/orders/order-summary";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";
import { getOrdersForUser } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import { formatPrice } from "@/lib/money";
import type { OrderView } from "@/lib/schemas/order";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function OrdersPage() {
  const user = await requireUser("/orders");

  const [orders, settings, t, tCart, format, locale] = await Promise.all([
    getOrdersForUser(user.id),
    getSettings(),
    getTranslations("orders"),
    getTranslations("cart"),
    getFormatter(),
    getLocale(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {orders.length === 0 ? (
        <Card className="items-center gap-3 border-dashed py-16 text-center">
          <ReceiptText className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-lg font-bold">{t("empty")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyBody")}
          </p>
          {/* The button goes to the menu, so it must not say "view details". */}
          <Button className="mt-1 rounded-full" render={<Link href="/menu" />}>
            {tCart("goToMenu")}
          </Button>
        </Card>
      ) : (
        <Accordion className="flex flex-col gap-3">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden p-0">
              <AccordionItem value={order.id} className="border-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1 text-start">
                    {/* The order's own code, never the kitchen's nightly
                        ticket number — that one belongs to the counter. */}
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">
                        <bdi dir="ltr">{order.orderNumber}</bdi>
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("placedAt", {
                        date: format.dateTime(new Date(order.createdAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                      })}
                      <span className="mx-1.5 opacity-50">·</span>
                      {t("itemsCount", { count: order.items.length })}
                    </span>
                  </div>
                  <span className="me-2 shrink-0 font-bold tabular-nums">
                    {formatPrice(order.total, locale)}
                  </span>
                </AccordionTrigger>

                <AccordionContent className="border-t border-border px-4 py-4">
                  <OrderSummary order={order} />

                  <OrderAddress
                    order={order}
                    restaurant={{
                      street: settings.street,
                      postalCode: settings.postalCode,
                      city: settings.city,
                    }}
                    deliveryLabel={t("address")}
                    pickupLabel={t("type.PICKUP")}
                  />
                </AccordionContent>
              </AccordionItem>
            </Card>
          ))}
        </Accordion>
      )}
    </div>
  );
}

type PostalAddress = { street: string; postalCode: string; city: string };

/**
 * Where the order went. A delivery shows the address it was sent to — the one
 * stored on the order, never the customer's current address, so an old receipt
 * stays truthful after a move. A pickup shows the restaurant instead.
 */
function OrderAddress({
  order,
  restaurant,
  deliveryLabel,
  pickupLabel,
}: {
  order: OrderView;
  restaurant: PostalAddress;
  deliveryLabel: string;
  pickupLabel: string;
}) {
  const isDelivery = order.orderType === "DELIVERY";

  const address: PostalAddress | null = isDelivery
    ? order.street
      ? {
          street: order.street,
          postalCode: order.postalCode ?? "",
          city: order.city ?? "",
        }
      : null
    : restaurant;

  if (!address) return null;

  return (
    <div className="mt-4 flex gap-3 border-t border-border pt-3 text-sm">
      <MapPin
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">
          {isDelivery ? deliveryLabel : pickupLabel}
        </span>
        <span className="font-medium">
          {address.street}
          <br />
          <span dir="ltr">{address.postalCode}</span> {address.city}
        </span>
      </div>
    </div>
  );
}
