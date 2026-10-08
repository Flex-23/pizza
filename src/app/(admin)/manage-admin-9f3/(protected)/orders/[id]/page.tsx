import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  MapPin,
  Phone,
  StickyNote,
  Store,
  Truck,
  User,
  UtensilsCrossed,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";
import { PrintReceiptButton } from "@/components/admin/print-receipt-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MANAGER_ROUTES } from "@/lib/admin-path";
import { getOrderById } from "@/lib/data/orders";
import { pickLocalized } from "@/lib/localized";
import { formatPrice, round2 } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The dish table's tracks, shared by its headings and its rows. */
const ITEM_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_9rem] sm:gap-4";

/**
 * One order across the whole screen.
 *
 * A full-width strip carries the facts that get read out on the phone, then
 * the page splits: the customer stays in a narrow rail on the side while the
 * dishes — the part with the most to show — take every remaining pixel as a
 * proper table. On a narrow screen the two stack and it reads top to bottom
 * like the receipt it becomes.
 */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [order, t, tOrders, tCart, format, locale] = await Promise.all([
    getOrderById(id),
    getTranslations("admin.order"),
    getTranslations("orders"),
    getTranslations("cart"),
    getFormatter(),
    getLocale(),
  ]);

  if (!order) notFound();

  const isDelivery = order.orderType === "DELIVERY";

  return (
    <>
      <AdminPageHeader
        title={t("details")}
        /* Without the isolation an Arabic page reorders the two halves and
           shows the number back to front. */
        subtitle={<bdi dir="ltr">{order.orderNumber}</bdi>}
        action={
          <div className="flex flex-wrap gap-2">
            <PrintReceiptButton orderId={order.id} variant="default" />

            <Button
              variant="outline"
              render={<Link href={MANAGER_ROUTES.orders} />}
            >
              <ArrowRight
                data-icon="inline-start"
                className="rtl:rotate-0 ltr:rotate-180"
              />
              {t("listTitle")}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        {/* At a glance, across the full width: number, status, total, then the
            four facts the counter is asked for on the phone. */}
        <Card className="gap-0 p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-5 py-4">
            {order.dailySeq !== null ? (
              <>
                <span className="text-3xl font-extrabold tabular-nums text-primary">
                  #{order.dailySeq}
                </span>
                <span
                  className="font-mono text-sm text-muted-foreground"
                  dir="ltr"
                >
                  {order.orderNumber}
                </span>
              </>
            ) : (
              <span
                className="font-mono text-2xl font-extrabold tracking-tight"
                dir="ltr"
              >
                {order.orderNumber}
              </span>
            )}

            <div className="ms-auto flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">
                {t("total")}
              </span>
              <span className="text-3xl leading-none font-extrabold tabular-nums">
                {formatPrice(order.total, locale)}
              </span>
            </div>
          </div>

          <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Fact
              icon={<CalendarClock className="size-5" />}
              label={t("placedAt")}
            >
              {format.dateTime(new Date(order.createdAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </Fact>

            <Fact
              icon={
                isDelivery ? (
                  <Truck className="size-5" />
                ) : (
                  <Store className="size-5" />
                )
              }
              label={t("orderTypeLabel")}
            >
              <Badge
                variant="outline"
                className={cn(
                  "h-6 text-sm font-semibold",
                  isDelivery
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-sale/30 bg-sale/10 text-sale",
                )}
              >
                {tOrders(`type.${order.orderType}`)}
              </Badge>
            </Fact>

            <Fact
              icon={<Banknote className="size-5" />}
              label={t("paymentLabel")}
            >
              {tOrders(`paymentMethod.${order.paymentMethod}`)}
            </Fact>

            <Fact icon={<Truck className="size-5" />} label={t("shipping")}>
              <span className="tabular-nums">
                {formatPrice(order.deliveryFee, locale)}
              </span>
            </Fact>
          </dl>
        </Card>

        {/* The customer keeps a fixed rail; the dishes take the rest. */}
        <div className="grid items-start gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
          {/* Everything the kitchen needs to reach and reach out to. */}
          <Card className="gap-0 p-0">
            <h2 className="border-b border-border bg-muted/40 px-5 py-4 text-lg font-bold">
              {t("customer")}
            </h2>

            <dl className="flex flex-col p-5 text-base">
              <Row icon={<User className="size-5" />} label={t("customer")}>
                <span className="font-semibold">{order.customerName}</span>
              </Row>

              <Separator className="my-3" />

              <Row icon={<Phone className="size-5" />} label={t("phone")}>
                <a
                  href={`tel:${order.phone.replace(/\s/g, "")}`}
                  className="font-semibold text-primary hover:underline"
                  dir="ltr"
                >
                  {order.phone}
                </a>
              </Row>

              <Separator className="my-3" />

              <Row icon={<MapPin className="size-5" />} label={t("address")}>
                {isDelivery && order.street ? (
                  <span className="font-medium">
                    {order.street}
                    <br />
                    <span dir="ltr">{order.postalCode}</span> {order.city}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {tOrders("type.PICKUP")}
                  </span>
                )}
              </Row>

              {order.notes && (
                <>
                  <Separator className="my-3" />
                  <Row
                    icon={<StickyNote className="size-5" />}
                    label={t("receiptNotes")}
                  >
                    <span className="block rounded-lg bg-warning/15 px-3 py-2 font-medium text-warning-foreground">
                      {order.notes}
                    </span>
                  </Row>
                </>
              )}
            </dl>
          </Card>

          {/* The dishes as a table: quantity and money in their own columns,
              so the kitchen reads down one column instead of across a card. */}
          <Card className="gap-0 p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/40 px-5 py-4">
              <h2 className="text-lg font-bold">{t("items")}</h2>
              <span className="text-sm text-muted-foreground">
                {tOrders("itemsCount", { count: order.items.length })}
              </span>
            </div>

            <div
              className={`${ITEM_COLUMNS} border-b border-border px-5 py-2 text-sm font-semibold text-muted-foreground`}
              aria-hidden
            >
              <span>{t("items")}</span>
              <span className="text-center">{tCart("quantity")}</span>
              <span className="text-end">{tCart("total")}</span>
            </div>

            <ul className="flex flex-col divide-y divide-border">
              {order.items.map((line, index) => {
                const name = pickLocalized(locale, line.nameAr, line.nameDe);
                const lineTotal = round2(line.unitPrice * line.quantity);
                const hasDiscount = line.originalPrice > line.unitPrice;

                return (
                  <li
                    key={`${line.menuItemId}-${index}`}
                    className={`${ITEM_COLUMNS} items-center px-5 py-3`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {line.imageUrl ? (
                          <Image
                            src={line.imageUrl}
                            alt={name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <UtensilsCrossed
                              className="size-5 text-muted-foreground"
                              aria-hidden
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-base font-semibold">
                          {name}
                        </span>
                        {/* The customer's request for this dish. The kitchen
                            works from this screen, so it is spelled out beside
                            the dish rather than tucked away. */}
                        {line.note && (
                          <span className="text-sm font-medium text-primary">
                            {line.note}
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {formatPrice(line.unitPrice, locale)}
                          {hasDiscount && (
                            <span className="ms-1.5 line-through opacity-70">
                              {formatPrice(line.originalPrice, locale)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <span className="flex justify-center">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-base font-extrabold text-primary tabular-nums">
                        {line.quantity}
                      </span>
                    </span>

                    <span className="flex flex-col items-end leading-tight">
                      {hasDiscount && (
                        <span className="text-xs text-muted-foreground line-through tabular-nums">
                          {formatPrice(
                            round2(line.originalPrice * line.quantity),
                            locale,
                          )}
                        </span>
                      )}
                      <span className="text-base font-bold tabular-nums">
                        {formatPrice(lineTotal, locale)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* The sums sit under the money column they add up. */}
            <dl className="flex w-full flex-col gap-2 self-end px-5 py-4 text-base sm:ms-auto sm:max-w-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tCart("subtotal")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.subtotal, locale)}
                </dd>
              </div>

              {order.discountTotal > 0 && (
                <div className="flex justify-between gap-4 text-sale">
                  <dt>{tCart("discount")}</dt>
                  <dd className="tabular-nums">
                    − {formatPrice(order.discountTotal, locale)}
                  </dd>
                </div>
              )}

              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("shipping")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.deliveryFee, locale)}
                </dd>
              </div>

              <Separator className="my-1" />

              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-lg font-bold">{tCart("total")}</dt>
                <dd className="text-2xl font-extrabold tabular-nums">
                  {formatPrice(order.total, locale)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

/** A single labelled cell in the at-a-glance strip. */
function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 bg-card px-5 py-3.5">
      <span className="text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="text-base font-semibold">{children}</dd>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}
