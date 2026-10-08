import { z } from "zod";

import {
  csvToArraySchema,
  idSchema,
  optionalText,
  priceSchema,
  sortOrderSchema,
} from "@/lib/schemas/common";

const discountPercentSchema = z.coerce
  .number()
  .int("نسبة الخصم يجب أن تكون رقماً صحيحاً")
  .min(0, "نسبة الخصم لا يمكن أن تكون سالبة")
  .max(90, "أقصى نسبة خصم هي 90%")
  .default(0);

const discountPriceSchema = z
  .union([z.literal(""), z.coerce.number().min(0).max(9999.99)])
  .optional()
  .transform((value) =>
    value === "" || value === undefined ? null : Number(value),
  );

export const menuItemInputSchema = z
  .object({
    categoryId: idSchema,
    nameAr: z.string().trim().min(2, "اسم الطبق بالعربية مطلوب").max(160),
    nameDe: z.string().trim().min(2, "اسم الطبق بالألمانية مطلوب").max(160),
    descriptionAr: optionalText(1000),
    descriptionDe: optionalText(1000),
    price: priceSchema,
    discountPercent: discountPercentSchema,
    discountPrice: discountPriceSchema,
    imageUrl: optionalText(500),
    isAvailable: z.coerce.boolean().default(true),
    isFeatured: z.coerce.boolean().default(false),
    allowCustomNote: z.coerce.boolean().default(false),
    tags: csvToArraySchema,
    allergens: csvToArraySchema,
    sortOrder: sortOrderSchema,
  })
  .refine(
    (data) =>
      data.discountPrice === null ||
      data.discountPrice === 0 ||
      data.discountPrice < data.price,
    {
      message: "سعر الخصم يجب أن يكون أقل من السعر الأصلي",
      path: ["discountPrice"],
    },
  );

export const menuItemUpdateSchema = z.object({
  id: idSchema,
  data: menuItemInputSchema,
});

export const menuItemToggleSchema = z.object({
  id: idSchema,
  field: z.enum(["isAvailable", "isFeatured"]),
  value: z.boolean(),
});

export const menuItemFilterSchema = z.object({
  categoryId: z.string().optional(),
  search: z.string().trim().max(80).optional(),
  onlyDiscounted: z.coerce.boolean().optional(),
});

export type MenuItemValues = z.input<typeof menuItemInputSchema>;
export type MenuItemInput = z.output<typeof menuItemInputSchema>;
export type MenuItemUpdate = z.infer<typeof menuItemUpdateSchema>;
export type MenuItemFilter = z.infer<typeof menuItemFilterSchema>;

/**
 * Serialisable menu item for client components. `finalPrice` and
 * `discountPercentage` are computed server-side so the card never re-derives
 * money and the two can never disagree.
 */
export type MenuItemView = {
  id: string;
  categoryId: string;
  categorySlug: string;
  nameAr: string;
  nameDe: string;
  descriptionAr: string | null;
  descriptionDe: string | null;
  price: number;
  finalPrice: number;
  discountPercentage: number;
  hasDiscount: boolean;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  /** Whether the card offers a free-text note field for this dish. */
  allowCustomNote: boolean;
  tags: string[];
  allergens: string[];
  sortOrder: number;
};
