import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { parseOrderLines } from "@/lib/data/orders";
import { discountPercentage, effectivePrice, toNumber } from "@/lib/money";
import type { CategoryView } from "@/lib/schemas/category";
import type { MenuItemView } from "@/lib/schemas/menu-item";

type MenuItemRow = {
  id: string;
  categoryId: string;
  nameAr: string;
  nameDe: string;
  descriptionAr: string | null;
  descriptionDe: string | null;
  price: unknown;
  discountPercent: number;
  discountPrice: unknown;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  allowCustomNote: boolean;
  tags: unknown;
  allergens: unknown;
  sortOrder: number;
  category?: { slug: string } | null;
};

/** Loose JSON columns become clean string arrays before crossing to the client. */
function toStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      return toStringArray(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

export function toMenuItemView(row: MenuItemRow): MenuItemView {
  const price = toNumber(row.price);
  const discountPrice =
    row.discountPrice === null || row.discountPrice === undefined
      ? null
      : toNumber(row.discountPrice);

  const pricing = {
    price,
    discountPercent: row.discountPercent,
    discountPrice,
  };

  const finalPrice = effectivePrice(pricing);
  const percentage = discountPercentage(pricing);

  return {
    id: row.id,
    categoryId: row.categoryId,
    categorySlug: row.category?.slug ?? "",
    nameAr: row.nameAr,
    nameDe: row.nameDe,
    descriptionAr: row.descriptionAr,
    descriptionDe: row.descriptionDe,
    price,
    finalPrice,
    discountPercentage: percentage,
    hasDiscount: percentage > 0,
    imageUrl: row.imageUrl,
    isAvailable: row.isAvailable,
    isFeatured: row.isFeatured,
    allowCustomNote: row.allowCustomNote,
    tags: toStringArray(row.tags),
    allergens: toStringArray(row.allergens),
    sortOrder: row.sortOrder,
  };
}

const itemSelect = {
  id: true,
  categoryId: true,
  nameAr: true,
  nameDe: true,
  descriptionAr: true,
  descriptionDe: true,
  price: true,
  discountPercent: true,
  discountPrice: true,
  imageUrl: true,
  isAvailable: true,
  isFeatured: true,
  allowCustomNote: true,
  tags: true,
  allergens: true,
  sortOrder: true,
  category: { select: { slug: true } },
} as const;

/** Categories a customer may see: active, and only those holding visible items. */
export const getPublicCategories = cache(async (): Promise<CategoryView[]> => {
  const categories = await db.category.findMany({
    where: { isActive: true, items: { some: {} } },
    orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }],
    select: {
      id: true,
      nameAr: true,
      nameDe: true,
      slug: true,
      imageUrl: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { items: true } },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    nameAr: category.nameAr,
    nameDe: category.nameDe,
    slug: category.slug,
    imageUrl: category.imageUrl,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    itemCount: category._count.items,
  }));
});

/** Every category, including empty and disabled ones — admin view. */
export const getAllCategories = cache(async (): Promise<CategoryView[]> => {
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }],
    select: {
      id: true,
      nameAr: true,
      nameDe: true,
      slug: true,
      imageUrl: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { items: true } },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    nameAr: category.nameAr,
    nameDe: category.nameDe,
    slug: category.slug,
    imageUrl: category.imageUrl,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    itemCount: category._count.items,
  }));
});

/**
 * Everything shown on the public menu. Unavailable items are included on
 * purpose: the card renders them dimmed rather than hiding them, so regulars
 * can see that a dish exists but is sold out.
 */
export const getPublicMenuItems = cache(async (): Promise<MenuItemView[]> => {
  const items = await db.menuItem.findMany({
    where: { category: { isActive: true } },
    orderBy: [{ isAvailable: "desc" }, { sortOrder: "asc" }, { nameDe: "asc" }],
    select: itemSelect,
  });

  return items.map(toMenuItemView);
});

/** How far back the popularity ranking looks. */
const RANKING_WINDOW = 500;

/**
 * The dishes customers actually order most, counted over the most recent
 * orders.
 *
 * A new restaurant has no order history, and a menu section that renders empty
 * would look broken, so the ranking falls back to the manager's featured picks
 * and then the rest of the menu: the sort is stable, which leaves every dish of
 * equal popularity — zero included — in the order the query returned it.
 */
export const getMostOrderedItems = cache(
  async (limit = 10): Promise<MenuItemView[]> => {
    const [orders, items] = await Promise.all([
      db.order.findMany({
        orderBy: { createdAt: "desc" },
        take: RANKING_WINDOW,
        select: { items: true },
      }),
      db.menuItem.findMany({
        where: { isAvailable: true, category: { isActive: true } },
        orderBy: [
          { isFeatured: "desc" },
          { sortOrder: "asc" },
          { nameDe: "asc" },
        ],
        select: itemSelect,
      }),
    ]);

    const quantities = new Map<string, number>();
    for (const order of orders) {
      for (const line of parseOrderLines(order.items)) {
        quantities.set(
          line.menuItemId,
          (quantities.get(line.menuItemId) ?? 0) + line.quantity,
        );
      }
    }

    return items
      .map(toMenuItemView)
      .sort((a, b) => (quantities.get(b.id) ?? 0) - (quantities.get(a.id) ?? 0))
      .slice(0, limit);
  },
);

/** Admin listing — every item regardless of category state. */
export async function getAdminMenuItems(filter?: {
  categoryId?: string;
  search?: string;
}): Promise<MenuItemView[]> {
  const search = filter?.search?.trim();

  const items = await db.menuItem.findMany({
    where: {
      categoryId: filter?.categoryId || undefined,
      ...(search
        ? {
            OR: [
              { nameAr: { contains: search } },
              { nameDe: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    select: itemSelect,
  });

  return items.map(toMenuItemView);
}

export async function getMenuItemById(
  id: string,
): Promise<MenuItemView | null> {
  const item = await db.menuItem.findUnique({
    where: { id },
    select: itemSelect,
  });

  return item ? toMenuItemView(item) : null;
}

/**
 * Re-reads the authoritative price of each item at checkout. The browser only
 * ever sends ids and quantities — never prices.
 *
 * Scoped to active categories, exactly like the public menu: a dish whose
 * category the manager just switched off is off the menu, so a cart still
 * holding it must not go through.
 */
export async function getItemsForPricing(ids: string[]) {
  const items = await db.menuItem.findMany({
    where: { id: { in: ids }, category: { isActive: true } },
    select: itemSelect,
  });

  return new Map(items.map((item) => [item.id, toMenuItemView(item)]));
}
