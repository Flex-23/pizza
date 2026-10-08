"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Eye, ListOrdered, Printer, Search, Store, Truck } from "lucide-react";

import { useReceiptPrinter } from "@/components/admin/print-receipt-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MANAGER_ROUTES } from "@/lib/admin-path";
import { formatPrice } from "@/lib/money";
import { type OrderView } from "@/lib/schemas/order";
import { cn } from "@/lib/utils";

/** How often the board re-reads the orders while the tab is in front. */
const REFRESH_MS = 10_000;

/**
 * The incoming-orders board.
 *
 * One row per order in a single table, newest first: the counter reads down a
 * column — ticket numbers, names, totals — instead of hunting the same fact in
 * six different boxes. The order's shift ticket number leads each row, which is
 * what the kitchen calls it by.
 */
export function OrdersBoard({ orders }: { orders: OrderView[] }) {
  const t = useTranslations("admin.order");
  const router = useRouter();

  const [query, setQuery] = useState("");

  /**
   * A new order has to appear on the kitchen screen without anyone pressing
   * reload. Polling is enough for one dashboard in one restaurant, and it
   * pauses while the tab is in the background — then refreshes the moment it
   * comes back, so returning to the tab never shows a stale list.
   */
  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }

    const timer = setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orders;

    return orders.filter((order) =>
      `${order.orderNumber} ${order.customerName} ${order.phone}`
        .toLowerCase()
        .includes(needle),
    );
  }, [orders, query]);

  if (orders.length === 0) {
    return (
      <Card className="items-center gap-3 border-dashed py-16 text-center">
        <ListOrdered className="size-9 text-muted-foreground" aria-hidden />
        <p className="text-lg font-bold">{t("empty")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("emptyBody")}
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="relative mb-5 max-w-md">
        <Search
          className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-10 ps-10"
        />
      </div>

      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-muted/40 px-4 py-3">
          <ListOrdered className="size-5 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-bold">{t("listTitle")}</h2>
          <Badge variant="outline" className="font-semibold tabular-nums">
            {filtered.length}
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-base text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          /* `text-base` is one step up from the table default: this screen is
             read at arm's length across a counter, not leaned into. */
          <Table className="table-fixed text-base">
            {/* `table-fixed` with percentage columns: the row always measures
                exactly the width of the card — never wider, so nothing scrolls
                sideways, and never narrower, so no column is left hoarding the
                leftover space. The two least-asked columns fold away before the
                rest get squeezed. */}
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[11%] ps-4 text-start text-sm text-muted-foreground">
                  {t("number")}
                </TableHead>
                <TableHead className="w-[12%] text-start text-sm text-muted-foreground">
                  {t("customer")}
                </TableHead>
                <TableHead className="w-[20%] text-start text-sm text-muted-foreground">
                  {t("contact")}
                </TableHead>
                <TableHead className="w-[10%] text-start text-sm text-muted-foreground">
                  {t("placedAt")}
                </TableHead>
                <TableHead className="w-[14%] text-start text-sm text-muted-foreground">
                  {t("orderTypeLabel")}
                </TableHead>
                <TableHead className="hidden w-[12%] text-start text-sm text-muted-foreground lg:table-cell">
                  {t("paymentLabel")}
                </TableHead>
                <TableHead className="hidden w-[6%] text-end text-sm text-muted-foreground lg:table-cell">
                  {t("shipping")}
                </TableHead>
                <TableHead className="w-[7%] text-end text-sm text-muted-foreground">
                  {t("total")}
                </TableHead>
                <TableHead className="w-[8%] pe-4 ps-0 text-end text-sm text-muted-foreground">
                  {t("actions")}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

/**
 * One order across the table.
 *
 * Facts run left to right in the order they are asked for on the phone — the
 * ticket number, who and where, then when, then how it is paid — and the two
 * money columns sit together at the end, right-aligned so the figures stack.
 */
function OrderRow({ order }: { order: OrderView }) {
  const tOrders = useTranslations("orders");
  const format = useFormatter();
  const locale = useLocale();

  const isDelivery = order.orderType === "DELIVERY";
  const placedAt = new Date(order.createdAt);

  return (
    <TableRow>
      {/* The shift ticket number leads in bold; the long reference number sits
          under it, muted, for anyone who needs to look an order up. `bdi`
          isolates the ordering and leaves alignment to the page. */}
      <TableCell className="ps-4">
        <Link
          href={MANAGER_ROUTES.order(order.id)}
          className="group/num block rounded hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {order.dailySeq !== null && (
            <span className="block font-extrabold tabular-nums">
              #{order.dailySeq}
            </span>
          )}
          <span className="block truncate font-mono text-sm text-muted-foreground">
            <bdi dir="ltr">{order.orderNumber}</bdi>
          </span>
        </Link>
      </TableCell>

      <TableCell>
        <span className="block truncate font-semibold">
          {order.customerName}
        </span>
      </TableCell>

      {/* Phone above address: the two things needed to reach an order, and the
          only cell allowed to wrap — a street is longer than a column. */}
      <TableCell className="whitespace-normal">
        <div className="flex min-w-0 flex-col gap-0.5">
          <a
            href={`tel:${order.phone.replace(/\s/g, "")}`}
            className="block truncate font-medium text-primary hover:underline"
          >
            <bdi dir="ltr">{order.phone}</bdi>
          </a>

          {isDelivery && order.street ? (
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {order.street}
              <span className="mx-1 opacity-40">·</span>
              <bdi dir="ltr">{order.postalCode}</bdi> {order.city}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium tabular-nums">
            {format.dateTime(placedAt, { dateStyle: "short" })}
          </span>
          <span className="truncate text-sm text-muted-foreground tabular-nums">
            {format.dateTime(placedAt, { timeStyle: "short" })}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <Badge
          variant="outline"
          className={cn(
            // A size up from the badge default, icon included: this chip is
            // read at a glance from across the counter.
            "h-6 max-w-full gap-1.5 text-sm font-semibold [&>svg]:size-4!",
            isDelivery
              ? "border-primary/25 bg-primary/10 text-primary"
              : "border-sale/30 bg-sale/10 text-sale",
          )}
        >
          {isDelivery ? <Truck aria-hidden /> : <Store aria-hidden />}
          <span className="truncate">{tOrders(`type.${order.orderType}`)}</span>
        </Badge>
      </TableCell>

      {/* Below `lg` these two fold away rather than crush the columns the
          kitchen actually reads. */}
      <TableCell className="hidden whitespace-normal text-muted-foreground lg:table-cell">
        {tOrders(`paymentMethod.${order.paymentMethod}`)}
      </TableCell>

      <TableCell className="hidden text-end text-muted-foreground tabular-nums lg:table-cell">
        {formatPrice(order.deliveryFee, locale)}
      </TableCell>

      <TableCell className="text-end font-bold tabular-nums">
        {formatPrice(order.total, locale)}
      </TableCell>

      <TableCell className="pe-4 ps-0">
        <RowActions orderId={order.id} />
      </TableCell>
    </TableRow>
  );
}

/** Print and open — the two things a row is ever asked to do. */
function RowActions({ orderId }: { orderId: string }) {
  const t = useTranslations("admin.order");
  const { print, isPrinting } = useReceiptPrinter(orderId);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("printReceipt")}
        title={t("printReceipt")}
        disabled={isPrinting}
        onClick={print}
      >
        {isPrinting ? (
          <Spinner className="size-4.5" />
        ) : (
          <Printer className="size-4.5" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("details")}
        title={t("details")}
        render={<Link href={MANAGER_ROUTES.order(orderId)} />}
      >
        <Eye className="size-4.5" />
      </Button>
    </div>
  );
}
