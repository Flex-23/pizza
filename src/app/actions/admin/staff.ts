"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  fail,
  fromZodError,
  ok,
  type ActionResult,
} from "@/lib/actions/result";
import { MASTER_ROUTES } from "@/lib/admin-path";
import { assertMaster } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { USER_ROLES } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { managerCreateSchema } from "@/lib/schemas/auth";
import { idSchema } from "@/lib/schemas/common";

const roleChangeSchema = z.object({
  id: idSchema,
  role: z.enum(USER_ROLES),
});

/** "sami.k" out of "sami.k@example.com", capitalised, as the display name. */
function nameFromEmail(email: string): string {
  const local =
    email
      .split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .trim() || "Manager";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Creates a manager. Only the owner may — this is the account that will read
 * the restaurant's orders and settings, so it is never self-service.
 */
export async function createManagerAction(raw: unknown): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = managerCreateSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password } = parsed.data;

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return fail("EMAIL_TAKEN", { fieldErrors: { email: [""] } });
  }

  await db.user.create({
    data: {
      email,
      name: nameFromEmail(email),
      passwordHash: await hashPassword(password),
      role: "ADMIN",
    },
  });

  revalidatePath(MASTER_ROUTES.staff);
  return ok();
}

/**
 * Removes a staff account for good.
 *
 * The two refusals of `setUserRoleAction` apply here for the same reasons —
 * nobody deletes themselves, and the last master cannot be deleted. Orders the
 * account once took keep their own copy of the customer's details, so the
 * history a report reads is unaffected.
 */
export async function deleteStaffAction(rawId: unknown): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) return fromZodError(parsed.error);

  const id = parsed.data;
  if (id === auth.user.id) return fail("SELF_ROLE");

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) return fail("NOT_FOUND");

  if (target.role === "MASTER") {
    const masters = await db.user.count({ where: { role: "MASTER" } });
    if (masters <= 1) return fail("LAST_MASTER");
  }

  await db.user.delete({ where: { id } });

  revalidatePath(MASTER_ROUTES.staff);
  return ok();
}

/**
 * Who may open the dashboard, decided by the owner instead of by a terminal.
 *
 * Two things this refuses, because either would lock the dashboard away for
 * good: a master changing their own role — the browser they are sitting in
 * front of would lose the pages on the next click — and removing the last
 * master, which would leave the menu, the zones and the hidden login with no
 * one able to reach them. `npm run set:role` stays as the way back in if it
 * ever happens anyway.
 */
export async function setUserRoleAction(raw: unknown): Promise<ActionResult> {
  const auth = await assertMaster();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = roleChangeSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, role } = parsed.data;

  if (id === auth.user.id) return fail("SELF_ROLE");

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) return fail("NOT_FOUND");

  if (target.role === "MASTER" && role !== "MASTER") {
    const masters = await db.user.count({ where: { role: "MASTER" } });
    if (masters <= 1) return fail("LAST_MASTER");
  }

  if (target.role === role) return ok();

  await db.user.update({ where: { id }, data: { role } });

  revalidatePath(MASTER_ROUTES.staff);
  return ok();
}
