"use client";

import { useState } from "react";
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { localeMeta, type Locale } from "@/i18n/config";
import { formatPrice, round2 } from "@/lib/money";
import { pickLocalized } from "@/lib/localized";
import { lineKey } from "@/lib/store/cart";
import { useCart, useCartActions } from "@/lib/store/use-cart";
import { cn } from "@/lib/utils";

type CartSheetProps = {
  minOrderValue: number;
  deliveryFee: number;
  freeDeliveryFrom: number | null;
  canOrder: boolean;
};

export function CartSheet({
  minOrderValue,
  deliveryFee,
  freeDeliveryFrom,
  canOrder,
}: CartSheetProps) {
  const t = useTranslations("cart");
  // "Quantity" on both buttons tells a screen-reader user nothing about which
  // way it goes; the item namespace already has the right pair.
  const tItem = useTranslations("item");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  // The basket button sits at the end of the header, so its drawer comes from
  // that same edge — which is the left one once the page reads right to left.
  const drawerSide =
    localeMeta[locale as Locale]?.dir === "rtl" ? "left" : "right";

  const { lines, subtotal, discountTotal, itemCount, hydrated } = useCart();
  const { decrement, addLineQuantity, removeItem, clear } = useCartControls();

  const qualifiesForFreeDelivery =
    freeDeliveryFrom !== null && subtotal >= freeDeliveryFrom;
  const effectiveDeliveryFee = qualifiesForFreeDelivery ? 0 : deliveryFee;
  const total = round2(subtotal + effectiveDeliveryFee);
  const missingForMinimum = round2(Math.max(0, minOrderValue - subtotal));
  const meetsMinimum = subtotal >= minOrderValue;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="relative rounded-full"
            aria-label={tNav("cartItemsCount", { count: itemCount })}
          />
        }
      >
        <ShoppingCart className="size-5" />
        <AnimatePresence>
          {hydrated && itemCount > 0 && (
            <motion.span
              key={itemCount}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute -top-0.5 inset-e-0 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground tabular-nums"
            >
              {itemCount > 99 ? "99+" : itemCount}
            </motion.span>
          )}
        </AnimatePresence>
      </SheetTrigger>

      <SheetContent
        side={drawerSide}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="size-5 text-primary" aria-hidden />
            {t("title")}
            {itemCount > 0 && (
              <Badge variant="secondary" className="ms-1">
                {itemCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">{t("title")}</SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ShoppingCart
                className="size-7 text-muted-foreground"
                aria-hidden
              />
            </div>
            <p className="text-lg font-bold">{t("empty")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
            <Button
              render={<Link href="/menu" onClick={() => setOpen(false)} />}
              className="mt-2 rounded-full"
            >
              {t("goToMenu")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {lines.map((line) => {
                    const name = pickLocalized(
                      locale,
                      line.nameAr,
                      line.nameDe,
                    );
                    const lineTotal = round2(line.unitPrice * line.quantity);
                    const hasDiscount = line.originalPrice > line.unitPrice;
                    const key = lineKey(line.menuItemId, line.note);

                    return (
                      <motion.li
                        key={key}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex gap-3 rounded-xl border border-border/70 bg-card p-2.5"
                      >
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {line.imageUrl ? (
                            <Image
                              src={line.imageUrl}
                              alt={name}
                              fill
                              sizes="64px"
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

                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <p className="line-clamp-2 text-sm leading-snug font-semibold">
                                {name}
                              </p>
                              {line.note && (
                                <p className="line-clamp-2 text-xs text-muted-foreground">
                                  {line.note}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              aria-label={t("remove")}
                              onClick={() => {
                                removeItem(key);
                                toast.info(t("removed", { name }));
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="rounded-full"
                                aria-label={tItem("decrease")}
                                onClick={() => decrement(key)}
                              >
                                <Minus />
                              </Button>
                              <span className="min-w-5 text-center text-sm font-bold tabular-nums">
                                {line.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="rounded-full"
                                aria-label={tItem("increase")}
                                onClick={() => addLineQuantity(key)}
                              >
                                <Plus />
                              </Button>
                            </div>

                            <div className="flex flex-col items-end leading-tight">
                              {hasDiscount && (
                                <span className="text-[11px] text-muted-foreground line-through">
                                  {formatPrice(
                                    round2(line.originalPrice * line.quantity),
                                    locale,
                                  )}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "text-sm font-bold tabular-nums",
                                  hasDiscount && "text-primary",
                                )}
                              >
                                {formatPrice(lineTotal, locale)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>

              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-muted-foreground"
                onClick={() => {
                  clear();
                  toast.info(t("cleared"));
                }}
              >
                <Trash2 data-icon="inline-start" />
                {t("clear")}
              </Button>
            </div>

            <SheetFooter className="gap-3 border-t border-border bg-muted/30 p-5">
              {freeDeliveryFrom !== null && (
                <p
                  className={cn(
                    "rounded-lg px-3 py-2 text-center text-xs font-semibold",
                    qualifiesForFreeDelivery
                      ? "bg-success/15 text-success"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  {qualifiesForFreeDelivery
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
                <Row
                  label={t("subtotal")}
                  value={formatPrice(subtotal, locale)}
                />
                {discountTotal > 0 && (
                  <Row
                    label={t("discount")}
                    value={`− ${formatPrice(discountTotal, locale)}`}
                    accent="sale"
                  />
                )}
                <Row
                  label={t("deliveryFee")}
                  value={formatPrice(effectiveDeliveryFee, locale)}
                />
                <Separator className="my-1" />
                <Row
                  label={t("total")}
                  value={formatPrice(total, locale)}
                  emphasis
                />
              </dl>

              {!meetsMinimum && (
                /* Same amber notice the hero shows when the restaurant is closed,
                   so the "add a little more" nudge reads as a warning, not a tint. */
                <p className="rounded-lg bg-linear-to-r from-amber-300 via-amber-200 to-yellow-300 px-3 py-2 text-center text-xs font-semibold text-black shadow-md ring-1 ring-amber-500/40">
                  {t("minOrderWarning", {
                    amount: formatPrice(minOrderValue, locale),
                    missing: formatPrice(missingForMinimum, locale),
                  })}
                </p>
              )}

              <Button
                size="lg"
                className="h-12 w-full rounded-full text-base font-bold"
                disabled={!meetsMinimum || !canOrder}
                render={
                  meetsMinimum && canOrder ? (
                    <Link href="/checkout" onClick={() => setOpen(false)} />
                  ) : undefined
                }
              >
                {t("checkout")}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  emphasis,
  accent,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: "sale";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt
        className={cn(
          emphasis ? "font-bold" : "text-muted-foreground",
          accent === "sale" && "text-sale",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          emphasis ? "text-lg font-extrabold" : "font-semibold",
          accent === "sale" && "text-sale",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Wraps the store so the sheet can bump a line without needing the full item. */
function useCartControls() {
  const { decrement, setQuantity, removeItem, clear } = useCartActions();
  const lines = useCart().lines;

  return {
    decrement,
    removeItem,
    clear,
    addLineQuantity: (key: string) => {
      const current =
        lines.find((line) => lineKey(line.menuItemId, line.note) === key)
          ?.quantity ?? 0;
      setQuantity(key, current + 1);
    },
  };
}
