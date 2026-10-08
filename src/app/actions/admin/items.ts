"use server";

import { revalidatePath } from "next/cache";

import { MANAGER_ROUTES, MASTER_ROUTES } from "@/lib/admin-path";
import { clearable } from "@/lib/actions/clearable";
import {
  fail,
  fromZodError,
  ok,
  type ActionResult,
} from "@/lib/actions/result";
import { assertMaster, assertStaff } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  menuItemInputSchema,
  menuItemToggleSchema,
  menuItemUpdateSchema,
} from "@/lib/schemas/menu-item";
import { getStorage } from "@/lib/storage";

function revalidateEverywhere(id?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/menu");
  revalidatePath(MASTER_ROUTES.items);
  if (id) revalidatePath(MASTER_ROUTES.editItem(id));
  // The sell-out board lists the same dishes and lives under both bases, so a
  // change made on one has to clear the other's cache too.
  revalidatePath(MASTER_ROUTES.availability);
  revalidatePath(MANAGER_ROUTES.availability);
}

export async function createItemAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = menuItemInputSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const category = await db.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true },
  });
  if (!category) {
    return fail("VALIDATION", { fieldErrors: { categoryId: [""] } });
  }

  const item = await db.menuItem.create({
    data: {
      ...parsed.data,
      tags: parsed.data.tags,
      allergens: parsed.data.allergens,
    },
    select: { id: true },
  });

  revalidateEverywhere();
  return ok({ id: item.id });
}

export async function updateItemAction(raw: unknown): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = menuItemUpdateSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, data } = parsed.data;

  const existing = await db.menuItem.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });
  if (!existing) return fail("NOT_FOUND");

  const category = await db.category.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  });
  if (!category) {
    return fail("VALIDATION", { fieldErrors: { categoryId: [""] } });
  }

  await db.menuItem.update({
    where: { id },
    data: {
      ...clearable(data, ["descriptionAr", "descriptionDe", "imageUrl"]),
      tags: data.tags,
      allergens: data.allergens,
    },
  });

  // The old file is only unlinked once the row no longer points at it.
  if (existing.imageUrl && existing.imageUrl !== data.imageUrl) {
    await getStorage().remove(existing.imageUrl);
  }

  revalidateEverywhere(id);
  return ok();
}

export async function deleteItemAction(id: string): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const item = await db.menuItem.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  if (!item) return fail("NOT_FOUND");

  await db.menuItem.delete({ where: { id } });

  if (item.imageUrl) {
    await getStorage().remove(item.imageUrl);
  }

  revalidateEverywhere();
  return ok();
}

/**
 * Sells a dish out, or puts it back — the one menu change a manager may make.
 *
 * Availability is shift work: the kitchen runs out of dough at nine and the
 * dish has to leave the menu that minute, which cannot wait for the owner.
 * Everything else about a dish — its price, its name, its photo, whether it is
 * featured — stays with the master, so this is scoped to `isAvailable` alone
 * rather than opening the whole toggle action to staff.
 */
export async function toggleItemAvailabilityAction(
  raw: unknown,
): Promise<ActionResult> {
  const auth = await assertStaff();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = menuItemToggleSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, field, value } = parsed.data;

  // The schema allows `isFeatured` too, and that one is the owner's call. A
  // crafted payload naming it here is refused rather than honoured.
  if (field !== "isAvailable") return fail("UNAUTHORIZED");

  const item = await db.menuItem.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!item) return fail("NOT_FOUND");

  await db.menuItem.update({ where: { id }, data: { isAvailable: value } });

  revalidateEverywhere(id);
  return ok();
}

/** One-click availability / featured switch straight from the items table. */
export async function toggleItemFlagAction(
  raw: unknown,
): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = menuItemToggleSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, field, value } = parsed.data;

  const item = await db.menuItem.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!item) return fail("NOT_FOUND");

  await db.menuItem.update({
    where: { id },
    data: { [field]: value },
  });

  revalidateEverywhere(id);
  return ok();
}
