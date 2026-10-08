"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { UtensilsCrossed } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { formatPrice, round2 } from "@/lib/money";
import { pickLocalized } from "@/lib/localized";
import type { OrderView } from "@/lib/schemas/order";

/** Shared by the admin order page, the customer's history and the receipt. */
export function OrderSummary({
  order,
  showImages = true,
}: {
  order: OrderView;
  showImages?: boolean;
}) {
  const t = useTranslations("cart");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {order.items.map((line) => {
          const name = pickLocalized(locale, line.nameAr, line.nameDe);
          const lineTotal = round2(line.unitPrice * line.quantity);
          const hasDiscount = line.originalPrice > line.unitPrice;

          return (
            <li
              key={`${line.menuItemId}-${line.note ?? ""}`}
              className="flex items-center gap-3"
            >
              {showImages && (
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt={name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <UtensilsCrossed
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                  )}
                </div>
              )}

              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-bold tabular-nums">
                {line.quantity}
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{name}</span>
                {line.note && (
                  <span className="truncate text-xs text-muted-foreground">
                    {line.note}
                  </span>
                )}
              </span>

              <span className="flex shrink-0 flex-col items-end leading-tight">
                {hasDiscount && (
                  <span className="text-[11px] text-muted-foreground line-through tabular-nums">
                    {formatPrice(
                      round2(line.originalPrice * line.quantity),
                      locale,
                    )}
                  </span>
                )}
                <span className="text-sm font-bold tabular-nums">
                  {formatPrice(lineTotal, locale)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <Separator />

      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("subtotal")}</dt>
          <dd className="tabular-nums">
            {formatPrice(order.subtotal, locale)}
          </dd>
        </div>

        {order.discountTotal > 0 && (
          <div className="flex justify-between gap-4 text-sale">
            <dt>{t("discount")}</dt>
            <dd className="tabular-nums">
              − {formatPrice(order.discountTotal, locale)}
            </dd>
          </div>
        )}

        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("deliveryFee")}</dt>
          <dd className="tabular-nums">
            {formatPrice(order.deliveryFee, locale)}
          </dd>
        </div>

        <Separator className="my-1" />

        <div className="flex justify-between gap-4">
          <dt className="font-bold">{t("total")}</dt>
          <dd className="text-lg font-extrabold tabular-nums">
            {formatPrice(order.total, locale)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
