"use server";

import { revalidatePath } from "next/cache";

import { MASTER_ROUTES } from "@/lib/admin-path";
import {
  fail,
  fromZodError,
  ok,
  type ActionResult,
} from "@/lib/actions/result";
import { assertMaster } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  categoryInputSchema,
  categoryReorderSchema,
  categoryUpdateSchema,
} from "@/lib/schemas/category";

/**
 * Every write below re-checks the admin role on the server before touching the
 * database, so calling these endpoints directly without a session does nothing.
 */

function revalidateEverywhere() {
  // Storefront and dashboard both need to reflect the change immediately.
  revalidatePath("/", "layout");
  revalidatePath(MASTER_ROUTES.categories);
  revalidatePath(MASTER_ROUTES.items);
}

export async function createCategoryAction(
  raw: unknown,
): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = categoryInputSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const existing = await db.category.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  });
  if (existing) return fail("SLUG_TAKEN", { fieldErrors: { slug: [""] } });

  await db.category.create({ data: parsed.data });

  revalidateEverywhere();
  return ok();
}

export async function updateCategoryAction(
  raw: unknown,
): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = categoryUpdateSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, ...data } = parsed.data;

  if (data.slug) {
    const clash = await db.category.findFirst({
      where: { slug: data.slug, NOT: { id } },
      select: { id: true },
    });
    if (clash) return fail("SLUG_TAKEN", { fieldErrors: { slug: [""] } });
  }

  const category = await db.category.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!category) return fail("NOT_FOUND");

  await db.category.update({ where: { id }, data });

  revalidateEverywhere();
  return ok();
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const category = await db.category.findUnique({
    where: { id },
    select: { _count: { select: { items: true } } },
  });
  if (!category) return fail("NOT_FOUND");

  // Deleting would cascade to the dishes; make that an explicit decision
  // instead of a silent data loss.
  if (category._count.items > 0) return fail("CATEGORY_HAS_ITEMS");

  await db.category.delete({ where: { id } });

  revalidateEverywhere();
  return ok();
}

export async function reorderCategoriesAction(
  raw: unknown,
): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = categoryReorderSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  await db.$transaction(
    parsed.data.order.map((id, index) =>
      db.category.update({
        where: { id },
        data: { sortOrder: (index + 1) * 10 },
      }),
    ),
  );

  revalidateEverywhere();
  return ok();
}

export async function toggleCategoryActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const category = await db.category.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!category) return fail("NOT_FOUND");

  await db.category.update({ where: { id }, data: { isActive } });

  revalidateEverywhere();
  return ok();
}
