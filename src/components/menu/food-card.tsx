"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Minus, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/money";
import { localizedDescription, localizedName } from "@/lib/localized";
import { ITEM_NOTE_MAX } from "@/lib/schemas/order";
import type { MenuItemView } from "@/lib/schemas/menu-item";
import { lineKey } from "@/lib/store/cart";
import { useCartActions, useLineQuantity } from "@/lib/store/use-cart";

type FoodCardProps = {
  item: MenuItemView;
  /** Disables ordering while the restaurant is closed, without hiding the card. */
  canOrder?: boolean;
  priority?: boolean;
};

export function FoodCard({
  item,
  canOrder = true,
  priority = false,
}: FoodCardProps) {
  const t = useTranslations("item");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const quantity = useLineQuantity(item.id);
  const { addItem, decrement } = useCartActions();

  const name = localizedName(locale, item);
  const description = localizedDescription(locale, item);
  const orderable = item.isAvailable && canOrder;

  /**
   * The request typed on this card, if the dish takes one.
   *
   * It belongs to the card rather than the cart until the dish is added: a
   * half-typed "ohne Zwie" is not an order yet. Adding hands it to the cart and
   * clears the box, so the next add starts blank instead of silently repeating
   * the previous request.
   */
  const [note, setNote] = useState("");
  const showNoteField = item.allowCustomNote && orderable;

  function handleAdd() {
    addItem(item, 1, showNoteField ? note : undefined);
    toast.success(t("addedToast", { name }));
    setNote("");
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="h-full"
    >
      <Card
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-2xl border-border/70 p-0 shadow-sm transition-shadow duration-300 hover:shadow-lg",
          !item.isAvailable && "opacity-60 grayscale-35",
        )}
      >
        <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              priority={priority}
              loading={priority ? undefined : "lazy"}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2 bg-accent/50 text-accent-foreground/60"
              aria-label={t("noImage")}
            >
              <UtensilsCrossed className="size-8" aria-hidden />
              <span className="text-xs">{t("noImage")}</span>
            </div>
          )}

          {item.hasDiscount && (
            <Badge
              className="absolute inset-s-3 top-3 border-transparent bg-sale px-2.5 py-1 text-sm font-extrabold text-sale-foreground shadow-md"
              aria-label={t("discountBadge", {
                percent: item.discountPercentage,
              })}
            >
              {t("discountBadge", { percent: item.discountPercentage })}
            </Badge>
          )}

          {item.isFeatured && item.isAvailable && (
            <Badge
              variant="secondary"
              className="absolute inset-e-3 top-3 bg-background/85 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm"
            >
              {t("featured")}
            </Badge>
          )}

          {!item.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]">
              <span className="rounded-full bg-foreground/85 px-4 py-1.5 text-sm font-bold text-background">
                {t("unavailable")}
              </span>
            </div>
          )}
        </div>

        {/* The name sits almost directly on the photo: `pt-1.5` against the
            `p-4` of the other three sides. The image is a solid block of
            colour, so the usual padding read as a gap between the dish and the
            name of the dish — and the space it was wasting is what the note
            field needs. Sides and foot keep their breathing room. */}
        <div className="flex flex-1 flex-col gap-1 p-4 pt-1">
          {/* Arabic sits low in its line box, so even `leading-tight` leaves a
              visible band of air above the name. The negative top margin pulls
              that slack back out, which is what actually seats the name against
              the photo — and the space it frees is what the note field uses. */}
          <h3 className="-mt-0.5 text-base leading-tight font-bold text-foreground">
            {name}
          </h3>

          {description && (
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
              {description}
            </p>
          )}

          {showNoteField && (
            <div className="mt-0.5 flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor={`note-${item.id}`}
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {t("noteLabel")}
                </label>
                {/* The limit is short on purpose, so it has to be visible —
                    a field that simply stops accepting letters reads as
                    broken. Only shown once typing starts, to keep the
                    resting card quiet. */}
                {note.length > 0 && (
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      note.length >= ITEM_NOTE_MAX
                        ? "font-semibold text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {note.length}/{ITEM_NOTE_MAX}
                  </span>
                )}
              </div>
              {/* No placeholder: the label above already names the field, and
                  the worked example that used to sit here read as a suggestion
                  of what to ask for. */}
              <Input
                id={`note-${item.id}`}
                maxLength={ITEM_NOTE_MAX}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder=""
                className="h-9 text-sm"
              />
            </div>
          )}

          <div className="mt-auto flex items-end justify-between gap-3 pt-2.5">
            <div className="flex flex-col leading-tight">
              {item.hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  <span className="sr-only">{t("oldPrice")}: </span>
                  {formatPrice(item.price, locale)}
                </span>
              )}
              <span
                className={cn(
                  "text-lg font-extrabold",
                  item.hasDiscount ? "text-primary" : "text-foreground",
                )}
              >
                {formatPrice(item.finalPrice, locale)}
              </span>
            </div>

            {quantity > 0 && orderable ? (
              <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={t("decrease")}
                  // Mirrors `handleAdd`: whichever line the + would grow is the
                  // one − shrinks, so the pair always acts on the same line
                  // rather than the counter jumping between note variants.
                  onClick={() =>
                    decrement(
                      lineKey(item.id, showNoteField ? note.trim() : undefined),
                    )
                  }
                >
                  <Minus />
                </Button>
                <span
                  className="min-w-6 text-center text-sm font-bold tabular-nums"
                  aria-label={t("quantityInCart", { count: quantity })}
                >
                  {quantity}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={t("increase")}
                  onClick={handleAdd}
                >
                  <Plus />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                className="rounded-full px-3.5 font-semibold"
                onClick={handleAdd}
                disabled={!orderable}
                aria-label={`${t("addToCart")} — ${name}`}
              >
                <ShoppingBag data-icon="inline-start" />
                {t("addToCart")}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function FoodCardSkeleton() {
  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-2xl p-0">
      <div className="aspect-4/3 w-full animate-pulse bg-muted" />
      {/* Mirrors the card's own `p-4 pt-1.5`, so nothing shifts when the real
          card replaces this one. */}
      <div className="flex flex-col gap-2 p-4 pt-1.5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-2 flex items-center justify-between">
          <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </Card>
  );
}
