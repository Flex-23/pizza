"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, round2 } from "@/lib/money";
import { pickLocalized } from "@/lib/localized";
import { lineKey } from "@/lib/store/cart";
import { useCart, useCartActions } from "@/lib/store/use-cart";
import { cn } from "@/lib/utils";

export function CartPageContent({
  minOrderValue,
  deliveryFee,
  freeDeliveryFrom,
  canOrder,
}: {
  minOrderValue: number;
  deliveryFee: number;
  freeDeliveryFrom: number | null;
  canOrder: boolean;
}) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { lines, subtotal, discountTotal, hydrated } = useCart();
  const { decrement, setQuantity, removeItem, clear } = useCartActions();

  const freeDelivery =
    freeDeliveryFrom !== null && subtotal >= freeDeliveryFrom;
  const effectiveFee = freeDelivery ? 0 : deliveryFee;
  const total = round2(subtotal + effectiveFee);
  const meetsMinimum = subtotal >= minOrderValue;

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <Card className="items-center gap-3 border-dashed py-16 text-center">
        <ShoppingCart className="size-10 text-muted-foreground" aria-hidden />
        <p className="text-lg font-bold">{t("empty")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("emptyBody")}
        </p>
        <Button className="mt-1 rounded-full" render={<Link href="/menu" />}>
          {t("goToMenu")}
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {lines.map((line) => {
            const name = pickLocalized(locale, line.nameAr, line.nameDe);
            const lineTotal = round2(line.unitPrice * line.quantity);
            const hasDiscount = line.originalPrice > line.unitPrice;
            // The same dish with two different requests is two lines, so the
            // note is part of what identifies one.
            const key = lineKey(line.menuItemId, line.note);

            return (
              <motion.li
                key={key}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="flex-row items-center gap-4 p-3">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {line.imageUrl ? (
                      <Image
                        src={line.imageUrl}
                        alt={name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <UtensilsCrossed
                          className="size-6 text-muted-foreground"
                          aria-hidden
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-bold">{name}</span>
                        {line.note && (
                          <span className="text-xs text-muted-foreground">
                            {line.note}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t("remove")}
                        onClick={() => {
                          removeItem(key);
                          toast.info(t("removed", { name }));
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full"
                          aria-label={t("quantity")}
                          onClick={() => decrement(key)}
                        >
                          <Minus />
                        </Button>
                        <span className="min-w-6 text-center text-sm font-bold tabular-nums">
                          {line.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full"
                          aria-label={t("quantity")}
                          onClick={() => setQuantity(key, line.quantity + 1)}
                        >
                          <Plus />
                        </Button>
                      </div>

                      <div className="flex flex-col items-end leading-tight">
                        {hasDiscount && (
                          <span className="text-xs text-muted-foreground line-through tabular-nums">
                            {formatPrice(
                              round2(line.originalPrice * line.quantity),
                              locale,
                            )}
                          </span>
                        )}
                        <span
                          className={cn(
                            "font-extrabold tabular-nums",
                            hasDiscount && "text-primary",
                          )}
                        >
                          {formatPrice(lineTotal, locale)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <Card className="gap-3 p-5">
        {freeDeliveryFrom !== null && (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-center text-sm font-semibold",
              freeDelivery
                ? "bg-success/15 text-success"
                : "bg-accent text-accent-foreground",
            )}
          >
            {freeDelivery
              ? t("freeDeliveryReached")
              : t("freeDeliveryProgress", {
                  missing: formatPrice(
                    round2(freeDeliveryFrom - subtotal),
                    locale,
                  ),
                })}
          </p>
        )}

        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("subtotal")}</dt>
            <dd className="tabular-nums">{formatPrice(subtotal, locale)}</dd>
          </div>

          {discountTotal > 0 && (
            <div className="flex justify-between gap-4 text-sale">
              <dt>{t("discount")}</dt>
              <dd className="tabular-nums">
                − {formatPrice(discountTotal, locale)}
              </dd>
            </div>
          )}

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("deliveryFee")}</dt>
            <dd className="tabular-nums">
              {formatPrice(effectiveFee, locale)}
            </dd>
          </div>

          <Separator className="my-1" />

          <div className="flex justify-between gap-4">
            <dt className="font-bold">{t("total")}</dt>
            <dd className="text-xl font-extrabold tabular-nums">
              {formatPrice(total, locale)}
            </dd>
          </div>
        </dl>

        {!meetsMinimum && (
          <p className="rounded-lg bg-warning/15 px-3 py-2 text-center text-sm font-semibold text-warning-foreground">
            {t("minOrderWarning", {
              amount: formatPrice(minOrderValue, locale),
              missing: formatPrice(round2(minOrderValue - subtotal), locale),
            })}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="h-12 flex-1 rounded-full text-base font-bold"
            disabled={!meetsMinimum || !canOrder}
            render={
              meetsMinimum && canOrder ? <Link href="/checkout" /> : undefined
            }
          >
            {t("checkout")}
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-12 rounded-full"
            render={<Link href="/menu" />}
          >
            {t("continueShopping")}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            clear();
            toast.info(t("cleared"));
          }}
        >
          <Trash2 data-icon="inline-start" />
          {t("clear")}
        </Button>
      </Card>
    </div>
  );
}
