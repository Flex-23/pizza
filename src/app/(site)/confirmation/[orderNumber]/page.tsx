import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, UtensilsCrossed } from "lucide-react";

import { OrderSummary } from "@/components/orders/order-summary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrderWithOwner } from "@/lib/data/orders";
import { hasReceiptFor } from "@/lib/orders/receipts";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  const [record, t, tOrders] = await Promise.all([
    getOrderWithOwner(decodeURIComponent(orderNumber)),
    getTranslations("confirmation"),
    getTranslations("orders"),
  ]);

  if (!record) notFound();

  // A receipt carries the customer's name, phone and address, so knowing the
  // order number is not enough: this must be the browser that ordered, or the
  // signed-in customer the order belongs to.
  const { order, userId } = record;
  const user = await getCurrentUser();
  const mayView =
    (userId !== null && user?.id === userId) ||
    (await hasReceiptFor(order.orderNumber));

  if (!mayView) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="gap-5 p-6">
        {/* The customer gets the order's own code and nothing else. The daily
            ticket number (#1, #2 …) is the kitchen's counter for the night —
            it is meaningless outside the counter and repeats every day, so it
            stays on the dashboard and the printed receipt. */}
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 py-4">
          <span className="text-xs text-muted-foreground">
            {t("orderNumber")}
          </span>
          <span className="font-mono text-2xl font-extrabold tracking-wider">
            <bdi dir="ltr">{order.orderNumber}</bdi>
          </span>
        </div>

        <OrderSummary order={order} />

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">
              {tOrders(`type.${order.orderType}`)}
            </strong>
            {order.orderType === "DELIVERY" && order.street && (
              <>
                {" "}
                — {order.street}, {order.postalCode} {order.city}
              </>
            )}
          </span>
          <span>{tOrders(`paymentMethod.${order.paymentMethod}`)}</span>
        </div>

        {/* Printing a receipt is the counter's job, on the counter's printer. */}
        <div className="no-print flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1 rounded-full font-bold"
            render={<Link href="/menu" />}
          >
            <UtensilsCrossed data-icon="inline-start" />
            {t("backToMenu")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
