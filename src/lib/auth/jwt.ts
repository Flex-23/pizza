import { jwtVerify, SignJWT } from "jose";

import { MANAGER_BASE, MASTER_BASE } from "@/lib/admin-path";
import { isUserRole, type UserRole } from "@/lib/auth/roles";

/**
 * Session token helpers.
 *
 * Kept free of Node-only imports (no bcrypt, no Prisma, no `server-only`) so
 * middleware can verify a session on the Edge runtime.
 */

/**
 * The shop's session — and *only* the shop's.
 *
 * It is the one cookie the browser sends to `/`, so it is the one that decides
 * who is looking at the menu. It belongs to customers: staff are refused it at
 * `/login`, and `getCurrentUser` disowns it if it ever turns out to name a
 * member of staff anyway.
 */
export const SESSION_COOKIE = "pdn_session";

/**
 * Each dashboard has a cookie of its own, confined by its path to the base it
 * belongs to. Three separate sessions, three separate lifetimes.
 *
 * The confinement is doing two jobs.
 *
 * One is that everyone here is also a customer of this shop: the owner places a
 * test order, a manager orders their own lunch, and the till in the corner is
 * one browser they all share. With a single cookie for everything, whoever
 * signed in last owned the session — the owner was silently thrown out of their
 * dashboard, or thrown into it as somebody else.
 *
 * The other is the reverse direction, and it is the reason the manager's cookie
 * exists at all. A manager used to work the dashboard on the shop's own cookie,
 * which meant their dashboard login was also a shop login: they walked around
 * the storefront signed in as staff. Now the browser simply never sends this to
 * `/`. Out there they are a customer with an account of their own, or nobody —
 * the same two states as any other visitor.
 */
export const MASTER_SESSION_COOKIE = "pdn_admin";
export const MANAGER_SESSION_COOKIE = "pdn_manager";

/**
 * Which cookie carries a staff role's session, and the path that confines it.
 *
 * The name and the path travel together because they are only ever correct
 * together: setting one role's cookie on the other's path would put it where
 * its owner's browser never looks, and deleting it without the path it was
 * written at silently leaves the session standing.
 */
export function staffCookieFor(role: UserRole): {
  name: string;
  path: string;
} {
  return role === "MASTER"
    ? { name: MASTER_SESSION_COOKIE, path: MASTER_BASE }
    : { name: MANAGER_SESSION_COOKIE, path: MANAGER_BASE };
}

/** Which cookie a dashboard base accepts. Nothing else opens that base. */
export function staffCookieForBase(base: string): string {
  return base === MASTER_BASE ? MASTER_SESSION_COOKIE : MANAGER_SESSION_COOKIE;
}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
};

/** Shared by the session token and the guest receipt token. */
export function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short — set a value of at least 32 characters in .env.local",
    );
  }

  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/** Returns null for any invalid, expired or tampered token — never throws. */
export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      !isUserRole(payload.role)
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
