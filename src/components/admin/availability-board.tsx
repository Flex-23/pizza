"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Search, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { toggleItemAvailabilityAction } from "@/app/actions/admin/items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useActionResult } from "@/lib/actions/use-action-result";
import { localizedName } from "@/lib/localized";
import { formatPrice } from "@/lib/money";
import { pickLocalized } from "@/lib/localized";
import type { CategoryView } from "@/lib/schemas/category";
import type { MenuItemView } from "@/lib/schemas/menu-item";
import { cn } from "@/lib/utils";

/** The filter's "everything" option — not a real category id. */
const ALL = "__all__";

/**
 * The sell-out board.
 *
 * One job: flip a dish on or off the menu, fast, in the middle of service. It
 * shows no prices to edit, no delete button and no link into the item form —
 * those belong to the owner's items screen. What it does have is a category
 * filter and a search box, because at nine in the evening the manager is
 * looking for one dish by name and has no patience for a long list.
 *
 * The switch is optimistic: it moves the instant it is pressed and only rolls
 * back if the server refuses. Waiting on a round-trip to see a switch move
 * makes a busy person press it twice.
 */
export function AvailabilityBoard({
  items,
  categories,
}: {
  items: MenuItemView[];
  categories: CategoryView[];
}) {
  const t = useTranslations("admin.availability");
  const tItem = useTranslations("admin.item");
  const locale = useLocale();
  const { messageFor } = useActionResult();
  const [, startTransition] = useTransition();

  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  /**
   * The server's list with the in-flight toggles laid over it. React reverts
   * this automatically if the action throws, so a refused write cannot leave a
   * switch showing a state the database does not have.
   */
  const [optimistic, setOptimistic] = useOptimistic(
    items,
    (current, change: { id: string; value: boolean }) =>
      current.map((item) =>
        item.id === change.id ? { ...item, isAvailable: change.value } : item,
      ),
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return optimistic.filter((item) => {
      if (categoryId !== ALL && item.categoryId !== categoryId) return false;
      if (!needle) return true;
      return (
        item.nameDe.toLowerCase().includes(needle) ||
        item.nameAr.toLowerCase().includes(needle)
      );
    });
  }, [optimistic, categoryId, search]);

  const soldOut = optimistic.filter((item) => !item.isAvailable).length;

  function toggle(item: MenuItemView, value: boolean) {
    startTransition(async () => {
      setOptimistic({ id: item.id, value });

      const result = await toggleItemAvailabilityAction({
        id: item.id,
        field: "isAvailable",
        value,
      });

      if (!result.ok) {
        toast.error(messageFor(result.code));
        return;
      }

      toast.success(
        value
          ? t("nowAvailable", { name: localizedName(locale, item) })
          : t("nowSoldOut", { name: localizedName(locale, item) }),
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter row: the category pills first, since that is the coarse cut,
          then a search box for finding one dish by name. */}
      <Card className="gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={categoryId === ALL ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setCategoryId(ALL)}
          >
            {t("allCategories")}
            <Badge variant="secondary" className="ms-1.5">
              {optimistic.length}
            </Badge>
          </Button>

          {categories.map((category) => {
            const count = optimistic.filter(
              (item) => item.categoryId === category.id,
            ).length;
            if (count === 0) return null;

            return (
              <Button
                key={category.id}
                type="button"
                size="sm"
                variant={categoryId === category.id ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setCategoryId(category.id)}
              >
                {pickLocalized(locale, category.nameAr, category.nameDe)}
                <Badge variant="secondary" className="ms-1.5">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 ps-9"
            aria-label={t("searchPlaceholder")}
          />
        </div>

        {soldOut > 0 && (
          <p className="text-sm font-medium text-warning-foreground">
            {t("soldOutCount", { count: soldOut })}
          </p>
        )}
      </Card>

      {visible.length === 0 ? (
        <Card className="items-center gap-2 border-dashed py-14 text-center">
          <UtensilsCrossed
            className="size-8 text-muted-foreground"
            aria-hidden
          />
          <p className="font-semibold">{t("noResults")}</p>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {visible.map((item) => {
              const name = localizedName(locale, item);

              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 transition-colors",
                    !item.isAvailable && "bg-muted/40",
                  )}
                >
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={name}
                        fill
                        sizes="48px"
                        className={cn(
                          "object-cover",
                          !item.isAvailable && "grayscale",
                        )}
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

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cn(
                        "truncate font-semibold",
                        !item.isAvailable && "text-muted-foreground",
                      )}
                    >
                      {name}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatPrice(item.finalPrice, locale)}
                    </span>
                  </div>

                  {/* The state in words as well as in the switch: a switch alone
                      is read by its position, which is exactly what someone
                      scanning a long list at speed gets wrong. */}
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold",
                      item.isAvailable ? "text-success" : "text-destructive",
                    )}
                  >
                    {item.isAvailable ? t("available") : t("soldOut")}
                  </span>

                  <Switch
                    checked={item.isAvailable}
                    onCheckedChange={(checked) => toggle(item, checked)}
                    aria-label={`${tItem("available")} — ${name}`}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
