"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FoodCard } from "@/components/menu/food-card";
import { cn } from "@/lib/utils";
import { localizedDescription, localizedName } from "@/lib/localized";
import type { CategoryView } from "@/lib/schemas/category";
import type { MenuItemView } from "@/lib/schemas/menu-item";

type MenuBrowserProps = {
  categories: CategoryView[];
  items: MenuItemView[];
  canOrder: boolean;
  initialCategoryId?: string;
};

const ALL = "__all__";

export function MenuBrowser({
  categories,
  items,
  canOrder,
  initialCategoryId,
}: MenuBrowserProps) {
  const t = useTranslations("menu");
  const locale = useLocale();

  const [activeCategory, setActiveCategory] = useState<string>(
    initialCategoryId ?? ALL,
  );
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();

    return items.filter((item) => {
      if (activeCategory !== ALL && item.categoryId !== activeCategory) {
        return false;
      }
      if (!needle) return true;

      const haystack = [
        localizedName(locale, item),
        localizedDescription(locale, item),
        item.nameAr,
        item.nameDe,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [items, activeCategory, deferredQuery, locale]);

  // Grouped rendering keeps category headings visible when browsing everything.
  const groups = useMemo(() => {
    if (activeCategory !== ALL) {
      const category = categories.find((entry) => entry.id === activeCategory);
      return category ? [{ category, items: filtered }] : [];
    }

    return categories
      .map((category) => ({
        category,
        items: filtered.filter((item) => item.categoryId === category.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeCategory, categories, filtered]);

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-14 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/70 sm:top-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="h-11 rounded-full ps-10 pe-10 text-base"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setQuery("")}
                aria-label={t("clearSearch")}
                className="absolute inset-e-1.5 top-1/2 -translate-y-1/2 rounded-full"
              >
                <X />
              </Button>
            )}
          </div>

          {/* Filters, not tabs: nothing here owns a tab panel, so `aria-pressed`
              describes them honestly where `role="tab"` would mislead. */}
          <div
            className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label={t("allCategories")}
          >
            <CategoryChip
              label={t("allCategories")}
              count={items.length}
              isActive={activeCategory === ALL}
              onSelect={() => setActiveCategory(ALL)}
            />
            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={localizedName(locale, category)}
                count={category.itemCount ?? 0}
                isActive={activeCategory === category.id}
                onSelect={() => setActiveCategory(category.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("resultsCount", { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Search className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-lg font-bold">{t("noResults")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("noResultsBody")}
          </p>
          {query && (
            <Button variant="outline" onClick={() => setQuery("")}>
              {t("clearSearch")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map(({ category, items: groupItems }, groupIndex) => (
            <section key={category.id} aria-labelledby={`cat-${category.id}`}>
              <h2
                id={`cat-${category.id}`}
                className="mb-4 flex items-center gap-3 text-xl font-extrabold"
              >
                {localizedName(locale, category)}
                <span className="h-px flex-1 bg-border" aria-hidden />
                <Badge variant="secondary" className="font-medium">
                  {groupItems.length}
                </Badge>
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupItems.map((item, index) => (
                  <FoodCard
                    key={item.id}
                    item={item}
                    canOrder={canOrder}
                    // Only the first row of the first group is above the fold;
                    // preloading every group's images would fight the LCP one.
                    priority={groupIndex === 0 && index < 4}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  isActive,
  onSelect,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onSelect}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isActive
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-xs tabular-nums",
          isActive
            ? "bg-primary-foreground/20"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
