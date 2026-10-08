import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import {
  DEFAULT_OPENING_HOURS,
  heroImagesSchema,
  openingHoursSchema,
  type DeliveryZoneView,
  type OpeningHour,
  type SettingsView,
} from "@/lib/schemas/settings";

export const SETTINGS_ID = "default";

/**
 * The single settings row. Created lazily on first read so a fresh install
 * renders correctly before the manager has opened the dashboard.
 */
export const getSettings = cache(async (): Promise<SettingsView> => {
  const row =
    (await db.settings.findUnique({ where: { id: SETTINGS_ID } })) ??
    // upsert, not create: on a fresh database two requests can arrive together
    // and the second `create` would fail on the primary key.
    (await db.settings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    }));

  return {
    id: row.id,
    isOpen: row.isOpen,
    isPaypalEnabled: row.isPaypalEnabled,
    promoBannerEnabled: row.promoBannerEnabled,
    promoBannerAr: row.promoBannerAr ?? undefined,
    promoBannerDe: row.promoBannerDe ?? undefined,
    heroImages: parseHeroImages(row.heroImages),
    minOrderValue: toNumber(row.minOrderValue),
    deliveryFee: toNumber(row.deliveryFee),
    receiptWidthMm: row.receiptWidthMm === 80 ? 80 : 58,
    // Free delivery has been retired — always null so no surface (cart, home
    // page, checkout or the server-side total) waives the entered delivery fee,
    // even if an old threshold still sits in the column.
    freeDeliveryFrom: null,
    restaurantNameAr: row.restaurantNameAr,
    restaurantNameDe: row.restaurantNameDe,
    street: row.street,
    postalCode: row.postalCode,
    city: row.city,
    phone: row.phone,
    phone2: row.phone2 ?? undefined,
    fax: row.fax ?? undefined,
    email: row.email ?? undefined,
    facebookUrl: row.facebookUrl ?? undefined,
    mapEmbedUrl: row.mapEmbedUrl ?? undefined,
    salesUrl: row.salesUrl ?? undefined,
    openingHours: parseOpeningHours(row.openingHours),
    termsAr: row.termsAr ?? undefined,
    termsDe: row.termsDe ?? undefined,
    privacyAr: row.privacyAr ?? undefined,
    privacyDe: row.privacyDe ?? undefined,
    allergensAr: row.allergensAr ?? undefined,
    allergensDe: row.allergensDe ?? undefined,
  };
});

/** The JSON column may hold a real array or, on some drivers, its string form. */
function parseHeroImages(raw: unknown): string[] {
  const value = typeof raw === "string" ? safeJsonParse(raw) : raw;
  const parsed = heroImagesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function parseOpeningHours(raw: unknown): OpeningHour[] {
  const parsed = openingHoursSchema.safeParse(raw);
  if (parsed.success && parsed.data.length > 0) return parsed.data;
  return DEFAULT_OPENING_HOURS;
}

export const getDeliveryZones = cache(
  async (onlyActive = true): Promise<DeliveryZoneView[]> => {
    const zones = await db.deliveryZone.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { postalCode: "asc" }],
    });

    return zones.map((zone) => ({
      id: zone.id,
      postalCode: zone.postalCode,
      areaName: zone.areaName,
      deliveryFee: toNumber(zone.deliveryFee),
      minOrder: toNumber(zone.minOrder),
      isActive: zone.isActive,
      sortOrder: zone.sortOrder,
    }));
  },
);

/** Zone matching a postal code, or null when the address is outside the area. */
export async function findZoneByPostalCode(
  postalCode: string,
): Promise<DeliveryZoneView | null> {
  const zones = await getDeliveryZones(true);
  return zones.find((zone) => zone.postalCode === postalCode) ?? null;
}
