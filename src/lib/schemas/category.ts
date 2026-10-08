import { z } from "zod";

import { idSchema, slugSchema, sortOrderSchema } from "@/lib/schemas/common";

export const categoryInputSchema = z.object({
  nameAr: z.string().trim().min(2, "اسم الصنف بالعربية مطلوب").max(120),
  nameDe: z.string().trim().min(2, "اسم الصنف بالألمانية مطلوب").max(120),
  slug: slugSchema,
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  sortOrder: sortOrderSchema,
  isActive: z.coerce.boolean().default(true),
});

export const categoryUpdateSchema = categoryInputSchema.partial().extend({
  id: idSchema,
});

export const categoryReorderSchema = z.object({
  order: z.array(idSchema).min(1, "لا توجد أصناف لإعادة ترتيبها").max(200),
});

/**
 * Two types per schema: what the form holds while the user types (`…Values`,
 * where defaults and coercions have not run yet) and what the action receives
 * after parsing (`…Input`). react-hook-form needs both.
 */
export type CategoryValues = z.input<typeof categoryInputSchema>;
export type CategoryInput = z.output<typeof categoryInputSchema>;
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;
export type CategoryReorder = z.infer<typeof categoryReorderSchema>;

/** Shape sent to client components — plain values only, both languages included. */
export type CategoryView = {
  id: string;
  nameAr: string;
  nameDe: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  itemCount?: number;
};
