"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { db } from "@/lib/db";
import { findStreet } from "@/lib/data/streets";
import { clearable } from "@/lib/actions/clearable";
import {
  fail,
  fromZodError,
  ok,
  type ActionResult,
} from "@/lib/actions/result";
import {
  fakeVerifyDelay,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { clearAttempts, consumeAttempt } from "@/lib/auth/rate-limit";
import {
  createSession,
  createStaffSession,
  destroySession,
  destroyStaffSession,
  getCurrentUser,
} from "@/lib/auth/session";
import {
  addressSchema,
  addressUpdateSchema,
  loginSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  registerSchema,
  type AddressInput,
} from "@/lib/schemas/auth";

export async function loginAction(
  raw: unknown,
): Promise<ActionResult<{ role: string }>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password } = parsed.data;

  // Ten tries per e-mail and client every fifteen minutes. Enough for a
  // forgetful customer, far too slow to guess the manager's password.
  const throttleKey = `login:${await clientAddress()}:${email}`;
  if (!consumeAttempt(throttleKey, 10, 15 * 60_000).allowed) {
    return fail("TOO_MANY_ATTEMPTS");
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    // Same latency as a real check, so timing cannot reveal which emails exist.
    await fakeVerifyDelay();
    return fail("INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return fail("INVALID_CREDENTIALS");

  clearAttempts(throttleKey);

  // Staff have doors of their own and this is not one of them: /login is the
  // customers' entrance and opens a session for CUSTOMER accounts only.
  //
  // Checked here, on the server, after the password: the shop's login must not
  // become a way to find out which addresses belong to staff, so a wrong
  // password stays a wrong password. Only someone who already proved they hold
  // those credentials is told they are knocking in the wrong place — and no
  // session is opened either way.
  if (user.role === "MASTER") return fail("MASTER_WRONG_DOOR");
  if (user.role === "ADMIN") return fail("ADMIN_WRONG_DOOR");

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  revalidatePath("/", "layout");
  return ok({ role: user.role });
}

/**
 * Best-effort client address for the login throttle. Behind Apache or nginx the
 * real address arrives in a forwarded header; locally there is none, and every
 * request shares one bucket, which only makes the limit stricter.
 */
async function clientAddress(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwarded || headerList.get("x-real-ip") || "local";
}

export async function registerAction(raw: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { name, email, phone, streetName, houseNumber, password } = parsed.data;

  // The schema already guaranteed the street is in the dataset; this second
  // lookup is what turns the picked street into an authoritative postal code,
  // city and district — none of which the browser is trusted to supply.
  const record = findStreet(streetName);
  if (!record) return fail("VALIDATION", { fieldErrors: { streetName: [""] } });

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return fail("EMAIL_TAKEN", { fieldErrors: { email: [""] } });

  const user = await db.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash: await hashPassword(password),
      // Role is never taken from the request — new accounts are always customers.
      role: "CUSTOMER",
      // The address from the form becomes the account's default, so checkout
      // is prefilled from the very first order. The canonical street name comes
      // from the dataset; only the house number is the customer's free text.
      addresses: {
        create: {
          street: `${record.street} ${houseNumber}`,
          postalCode: record.postalCode,
          city: record.city,
          district: record.district,
          isDefault: true,
        },
      },
    },
  });

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  revalidatePath("/", "layout");
  return ok();
}

export async function logoutAction(): Promise<ActionResult> {
  await destroySession();
  revalidatePath("/", "layout");
  return ok();
}

/**
 * The master's door.
 *
 * Two things separate it from `loginAction`: it refuses anyone who is not the
 * owner *on the server* — a wrong password and a customer's correct password
 * are equally useless here — and the session it opens lives in the dashboard's
 * own cookie, so signing in (or out) on the shop side leaves it alone.
 */
export async function adminLoginAction(raw: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password } = parsed.data;

  const throttleKey = `admin-login:${await clientAddress()}:${email}`;
  if (!consumeAttempt(throttleKey, 10, 15 * 60_000).allowed) {
    return fail("TOO_MANY_ATTEMPTS");
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    await fakeVerifyDelay();
    return fail("INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return fail("INVALID_CREDENTIALS");

  // Deliberately the same message as a bad password: this URL must not confirm
  // that an e-mail exists, nor that it belongs to staff.
  if (user.role !== "MASTER") return fail("INVALID_CREDENTIALS");

  clearAttempts(throttleKey);

  await createStaffSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return ok();
}

/**
 * The manager's door.
 *
 * Mirrors `adminLoginAction` exactly, but for the role it admits: only ADMIN,
 * because the owner has a page of their own and a customer has the shop's.
 *
 * The session it opens is the manager's own dashboard cookie, confined by its
 * path to the manager's base. It used to be the site's cookie, which made this
 * login a shop login too and left a manager walking the storefront signed in as
 * staff. Nothing is opened on the shop side here: out there a manager is a
 * customer with an account of their own, or a visitor like anyone else.
 *
 * A wrong role gets the same message as a wrong password, so this URL cannot be
 * used to discover which addresses are managers'.
 */
export async function managerLoginAction(raw: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password } = parsed.data;

  const throttleKey = `manager-login:${await clientAddress()}:${email}`;
  if (!consumeAttempt(throttleKey, 10, 15 * 60_000).allowed) {
    return fail("TOO_MANY_ATTEMPTS");
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    await fakeVerifyDelay();
    return fail("INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return fail("INVALID_CREDENTIALS");

  if (user.role !== "ADMIN") return fail("INVALID_CREDENTIALS");

  clearAttempts(throttleKey);

  await createStaffSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return ok();
}

/**
 * Leaves the dashboard — and only the dashboard.
 *
 * Both roles now hold a cookie of their own, so this drops exactly one session
 * and touches nothing else: whoever is shopping on this browser stays signed
 * in, and on the shared till the other role's dashboard is left alone.
 */
export async function adminLogoutAction(): Promise<ActionResult> {
  await destroyStaffSession();
  return ok();
}

export async function updateProfileAction(raw: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED");

  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone },
  });

  revalidatePath("/account");
  return ok();
}

export async function changePasswordAction(
  raw: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED");

  const parsed = passwordChangeSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return fail("UNAUTHORIZED");

  const valid = await verifyPassword(
    parsed.data.currentPassword,
    record.passwordHash,
  );
  if (!valid) {
    return fail("WRONG_PASSWORD", { fieldErrors: { currentPassword: [""] } });
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  return ok();
}

/**
 * Turns a validated address form into the columns a row needs: the street name
 * is resolved to its postal code, city and district from the dataset (the same
 * source the sign-up form uses), and the house number is joined onto the street.
 * Returns null only if the street somehow is not in the dataset — the schema
 * already rejects that, so this is a type guard more than a runtime path.
 */
function addressRowData(data: AddressInput) {
  const record = findStreet(data.streetName);
  if (!record) return null;

  return {
    label: data.label,
    street: `${record.street} ${data.houseNumber}`,
    postalCode: record.postalCode,
    city: record.city,
    district: record.district,
    notes: data.notes,
    isDefault: data.isDefault,
  };
}

export async function saveAddressAction(raw: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED");

  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const rowData = addressRowData(parsed.data);
  if (!rowData)
    return fail("VALIDATION", { fieldErrors: { streetName: [""] } });

  await db.$transaction(async (tx) => {
    if (rowData.isDefault) {
      await tx.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    await tx.address.create({
      data: { ...rowData, userId: user.id },
    });
  });

  revalidatePath("/account");
  return ok();
}

export async function updateAddressAction(raw: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED");

  const parsed = addressUpdateSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  // Scoped by userId so one customer can never edit another's address.
  const address = await db.address.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });
  if (!address) return fail("NOT_FOUND");

  const rowData = addressRowData(parsed.data.data);
  if (!rowData)
    return fail("VALIDATION", { fieldErrors: { streetName: [""] } });

  await db.$transaction(async (tx) => {
    if (rowData.isDefault) {
      await tx.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    await tx.address.update({
      where: { id: address.id },
      data: clearable(rowData, ["label", "notes"]),
    });
  });

  revalidatePath("/account");
  return ok();
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED");

  const result = await db.address.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0) return fail("NOT_FOUND");

  revalidatePath("/account");
  return ok();
}
