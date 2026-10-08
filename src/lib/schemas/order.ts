import { z } from "zod";

import {
  emailSchema,
  idSchema,
  optionalText,
  phoneSchema,
  postalCodeSchema,
} from "@/lib/schemas/common";

export const PAYMENT_METHODS = [
  "CASH_ON_DELIVERY",
  "CARD_ON_DELIVERY",
  "ONLINE",
] as const;

export const ORDER_TYPES = ["DELIVERY", "PICKUP"] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];
export type OrderTypeValue = (typeof ORDER_TYPES)[number];

/**
 * A single ordered line. The name and price are snapshotted at checkout so a
 * later price change in the admin never rewrites a past order.
 */
/**
 * How long a per-dish note may be.
 *
 * 60 characters, deliberately tight: it fits "ohne Zwiebeln, extra scharf" with
 * room to spare while guaranteeing the request stays a single line on a 58 mm
 * receipt, which is the width the kitchen actually prints on. A longer box would
 * invite paragraphs the cook has to read mid-shift.
 */
export const ITEM_NOTE_MAX = 60;

export const orderLineSchema = z.object({
  menuItemId: idSchema,
  nameAr: z.string().min(1).max(160),
  nameDe: z.string().min(1).max(160),
  unitPrice: z.number().min(0).max(9999.99),
  originalPrice: z.number().min(0).max(9999.99),
  quantity: z
    .number()
    .int()
    .min(1, "Die Menge muss mindestens 1 betragen")
    .max(99),
  imageUrl: z.string().max(500).nullable().optional(),
  /** The customer's request for this dish. Optional so every order placed
   *  before per-item notes existed still parses. */
  note: z.string().max(ITEM_NOTE_MAX).nullable().optional(),
});

export const orderLinesSchema = z
  .array(orderLineSchema)
  .min(1, "Der Warenkorb ist leer")
  .max(100, "Zu viele Artikel in der Bestellung");

/** What the browser sends to /api/orders. Prices are recomputed server-side. */
export const checkoutSchema = z
  .object({
    customerName: z.string().trim().min(2, "Name erforderlich").max(120),
    phone: phoneSchema,
    email: z
      .union([z.literal(""), emailSchema])
      .optional()
      .transform((value) => (value ? value : undefined)),
    orderType: z.enum(ORDER_TYPES).default("DELIVERY"),
    street: optionalText(180),
    postalCode: z
      .union([z.literal(""), postalCodeSchema])
      .optional()
      .transform((value) => (value ? value : undefined)),
    city: optionalText(80),
    notes: optionalText(1000),
    paymentMethod: z.enum(PAYMENT_METHODS).default("CASH_ON_DELIVERY"),
    /**
     * Only ids, quantities and the customer's own note are trusted; the server
     * re-reads every price, and re-checks that the dish actually accepts a note
     * before keeping one.
     */
    items: z
      .array(
        z.object({
          menuItemId: idSchema,
          quantity: z.number().int().min(1).max(99),
          note: z
            .string()
            .trim()
            .max(ITEM_NOTE_MAX)
            .optional()
            .transform((value) => (value ? value : undefined)),
        }),
      )
      .min(1, "Der Warenkorb ist leer")
      .max(100),
  })
  .superRefine((data, ctx) => {
    if (data.orderType !== "DELIVERY") return;

    if (!data.street) {
      ctx.addIssue({
        code: "custom",
        path: ["street"],
        message: "Adresse für die Lieferung erforderlich",
      });
    }
    if (!data.postalCode) {
      ctx.addIssue({
        code: "custom",
        path: ["postalCode"],
        message: "PLZ für die Lieferung erforderlich",
      });
    }
    if (!data.city) {
      ctx.addIssue({
        code: "custom",
        path: ["city"],
        message: "Ort für die Lieferung erforderlich",
      });
    }
  });

export const orderFilterSchema = z.object({
  search: z.string().trim().max(80).optional(),
});

export type OrderLine = z.infer<typeof orderLineSchema>;
export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.infer<typeof checkoutSchema>;

export type OrderView = {
  id: string;
  orderNumber: string;
  /** Ticket number within the shift ("Order #N"); null for pre-counter orders. */
  dailySeq: number | null;
  customerName: string;
  phone: string;
  email: string | null;
  orderType: OrderTypeValue;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  items: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  discountTotal: number;
  total: number;
  paymentMethod: PaymentMethodValue;
  paymentStatus: "UNPAID" | "PAID" | "REFUNDED";
  notes: string | null;
  createdAt: string;
};
