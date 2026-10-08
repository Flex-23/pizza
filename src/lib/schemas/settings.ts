import { z } from "zod";

import {
  emailSchema,
  optionalText,
  optionalUrl,
  phoneSchema,
  postalCodeSchema,
  priceSchema,
} from "@/lib/schemas/common";

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "holiday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "الوقت يجب أن يكون بصيغة HH:MM");

/** The two thermal roll widths in use; the receipt layout follows this. */
export const RECEIPT_WIDTHS = [58, 80] as const;

export type ReceiptWidth = (typeof RECEIPT_WIDTHS)[number];

const RECEIPT_WIDTH_SCHEMA = z.coerce
  .number()
  .int()
  .refine(
    (value): value is ReceiptWidth => value === 58 || value === 80,
    "عرض ورق الطابعة يجب أن يكون 58 أو 80 ملم",
  )
  .default(58);

/**
 * A closed day needs no times.
 *
 * `<input type="time">` hands back an empty string when it is cleared, and a
 * day marked closed has no hours worth typing — so the strict `HH:MM` rule
 * rejected the whole form over a field the manager had every reason to leave
 * blank. Worse, the complaint surfaced against a time input on a row that reads
 * "closed", which looks like the form failing for no reason.
 *
 * An empty time on a closed day is therefore accepted and normalised to
 * midnight, which is what the opening-hours maths already treats as "no window"
 * for such a day. An open day still has to carry real times.
 */
const maybeTime = z.union([z.literal(""), timeSchema]);

export const openingHourSchema = z
  .object({
    day: z.enum(WEEKDAYS),
    /** Opening time, e.g. "16:45". Blank only on a closed day. */
    open: maybeTime,
    /** Closing time. May be past midnight — "02:45" means the next morning. */
    close: maybeTime,
    isClosed: z.boolean().default(false),
  })
  // The blank check runs here, on the raw value, and the fill-in below runs
  // after it — the other order let a blank on an *open* day be quietly turned
  // into 00:00 and accepted, which is a real mistake the form should catch.
  .superRefine((entry, ctx) => {
    if (entry.isClosed) return;

    for (const field of ["open", "close"] as const) {
      if (entry[field] !== "") continue;
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: "الوقت يجب أن يكون بصيغة HH:MM",
      });
    }
  })
  .transform((entry) => ({
    ...entry,
    // A closed day stores midnight rather than an empty string, which is what
    // the opening-hours maths already reads as "no window" for such a day.
    open: entry.open || "00:00",
    close: entry.close || "00:00",
  }));

export const openingHoursSchema = z.array(openingHourSchema).max(8);

/** Uploaded image paths for the home-page gallery, in display order. */
export const heroImagesSchema = z
  .array(z.string().trim().min(1).max(500))
  .max(10, "أقصى عدد لصور الواجهة هو 10")
  .default([]);

export const settingsSchema = z.object({
  isOpen: z.coerce.boolean().default(true),

  /** Master-only. Whether PayPal shows at checkout beside cash on delivery. */
  isPaypalEnabled: z.coerce.boolean().default(false),

  promoBannerEnabled: z.coerce.boolean().default(false),
  promoBannerAr: optionalText(255),
  promoBannerDe: optionalText(255),

  heroImages: heroImagesSchema,

  minOrderValue: priceSchema.default(0),
  deliveryFee: priceSchema.default(0),

  /** Receipt paper: 58 mm or 80 mm thermal roll. Only the master may change it. */
  receiptWidthMm: RECEIPT_WIDTH_SCHEMA,
  freeDeliveryFrom: z
    .union([z.literal(""), z.coerce.number().min(0).max(9999.99)])
    .optional()
    .transform((value) =>
      value === "" || value === undefined ? null : Number(value),
    ),

  restaurantNameAr: z.string().trim().min(2).max(160),
  restaurantNameDe: z.string().trim().min(2).max(160),
  street: z.string().trim().min(2).max(180),
  postalCode: postalCodeSchema,
  city: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  phone2: z
    .union([z.literal(""), phoneSchema])
    .optional()
    .transform((value) => (value ? value : undefined)),
  fax: z
    .union([z.literal(""), phoneSchema])
    .optional()
    .transform((value) => (value ? value : undefined)),
  email: z
    .union([z.literal(""), emailSchema])
    .optional()
    .transform((value) => (value ? value : undefined)),
  facebookUrl: optionalUrl(255),
  mapEmbedUrl: optionalUrl(1000),

  /** Master-only. Encoded into the QR code printed on receipts. */
  salesUrl: optionalUrl(500),

  openingHours: openingHoursSchema.default([]),

  termsAr: optionalText(20000),
  termsDe: optionalText(20000),
  privacyAr: optionalText(20000),
  privacyDe: optionalText(20000),
  allergensAr: optionalText(20000),
  allergensDe: optionalText(20000),
});

export type OpeningHour = z.infer<typeof openingHourSchema>;
export type SettingsValues = z.input<typeof settingsSchema>;
export type SettingsInput = z.output<typeof settingsSchema>;

export type SettingsView = SettingsInput & {
  id: string;
  freeDeliveryFrom: number | null;
};

/**
 * Zones are no longer edited anywhere: the master's page for them is gone and
 * so are the write schemas. What is left is read-only — checkout still reads
 * the rows to price a postcode and to know whether the address is covered.
 */
export type DeliveryZoneView = {
  id: string;
  postalCode: string;
  areaName: string;
  deliveryFee: number;
  minOrder: number;
  isActive: boolean;
  sortOrder: number;
};

/** Sensible defaults so the storefront renders before the manager saves anything. */
export const DEFAULT_OPENING_HOURS: OpeningHour[] = [
  { day: "monday", open: "16:45", close: "02:45", isClosed: false },
  { day: "tuesday", open: "16:45", close: "02:45", isClosed: false },
  { day: "wednesday", open: "16:45", close: "02:45", isClosed: false },
  { day: "thursday", open: "16:45", close: "02:45", isClosed: false },
  { day: "friday", open: "16:45", close: "02:45", isClosed: false },
  { day: "saturday", open: "14:45", close: "02:45", isClosed: false },
  { day: "sunday", open: "11:45", close: "01:45", isClosed: false },
  { day: "holiday", open: "12:00", close: "01:45", isClosed: false },
];
