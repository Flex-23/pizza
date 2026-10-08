import "server-only";

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

import { getSecretKey } from "@/lib/auth/jwt";

/**
 * Proof that this browser is the one that placed a given order.
 *
 * An order number is short and human-friendly ("250820-4F7K"), which makes it
 * guessable — and the confirmation page shows a name, a phone number and a
 * delivery address. So the page is not opened by order number alone: the
 * browser must either be signed in as the customer who owns the order, or
 * carry this cookie, which is signed with AUTH_SECRET and therefore cannot be
 * forged by someone who merely guessed the number.
 */

const RECEIPT_COOKIE = "pdn_receipts";
const RECEIPT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
/** Enough for a regular's recent orders; keeps the cookie small. */
const MAX_TRACKED = 20;

async function readReceipts(): Promise<string[]> {
  const token = (await cookies()).get(RECEIPT_COOKIE)?.value;
  if (!token) return [];

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    return Array.isArray(payload.orders)
      ? payload.orders.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** Called right after an order is created, so its confirmation stays reachable. */
export async function rememberOrder(orderNumber: string): Promise<void> {
  const previous = await readReceipts();
  const orders = [
    orderNumber,
    ...previous.filter((entry) => entry !== orderNumber),
  ].slice(0, MAX_TRACKED);

  const token = await new SignJWT({ orders })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${RECEIPT_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());

  (await cookies()).set(RECEIPT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RECEIPT_MAX_AGE_SECONDS,
  });
}

export async function hasReceiptFor(orderNumber: string): Promise<boolean> {
  return (await readReceipts()).includes(orderNumber);
}
