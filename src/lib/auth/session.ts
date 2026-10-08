import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/lib/db";
import { isStaffRole, type UserRole } from "@/lib/auth/roles";
import {
  MASTER_SESSION_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  staffCookieFor,
  verifySession,
  type SessionPayload,
} from "@/lib/auth/jwt";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
};

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * A dashboard session, kept apart from the site's and from the other role's.
 *
 * `path` is what does the separating: the browser sends this cookie only to the
 * base it was written for, and the site's cookie is a different name entirely.
 * So one person can be the owner in here and a customer out there at once, the
 * till can hold the manager's dashboard and somebody's shopping basket side by
 * side, and no login anywhere logs out any of the others.
 */
export async function createStaffSession(payload: SessionPayload) {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  const { name, path } = staffCookieFor(payload.role);

  cookieStore.set(name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  // Named with its path rather than left to default: a sign-out can be
  // submitted from any page, and a deletion written at the wrong path leaves
  // the real cookie standing.
  cookieStore.delete({ name: SESSION_COOKIE, path: "/" });
}

/**
 * Leaves whichever dashboard this request came from.
 *
 * Both roles are offered up, but only the cookie the browser actually sent can
 * be present — and because each is confined to its own base, that is only ever
 * the dashboard being signed out of. A manager logging off the till therefore
 * cannot end the owner's session on the same machine.
 */
export async function destroyStaffSession(): Promise<void> {
  const cookieStore = await cookies();

  for (const role of ["MASTER", "ADMIN"] as const) {
    const { name, path } = staffCookieFor(role);
    if (cookieStore.get(name)) cookieStore.delete({ name, path });
  }
}

/** The signed claims only — cheap, but the role may be stale after a demotion. */
export async function readSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(SESSION_COOKIE)?.value);
}

/** Whether this browser holds the owner's dashboard session. */
export async function hasMasterSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const payload = await verifySession(
    cookieStore.get(MASTER_SESSION_COOKIE)?.value,
  );
  return payload !== null;
}

/**
 * Who the dashboard is talking to.
 *
 * Only the two dashboard cookies are consulted, and the shop's is deliberately
 * not among them: a customer's session must never be able to authenticate a
 * dashboard, whatever role the account behind it later acquires. Both are read
 * because one function serves both bases; only one can ever have been sent,
 * since each is confined to its own path.
 */
export async function readStaffSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();

  for (const role of ["MASTER", "ADMIN"] as const) {
    const { name } = staffCookieFor(role);
    const payload = await verifySession(cookieStore.get(name)?.value);
    if (payload) return payload;
  }

  return null;
}

/**
 * The authoritative current user, re-read from the database on every request so
 * a revoked admin loses access immediately rather than when the token expires.
 * `cache` keeps it to one query per render pass.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = await userFor(await readSessionPayload());

  // The shop knows customers. Staff are turned away at `/login`, so a session
  // naming one should not exist — but it can outlive the rule that forbade it:
  // a cookie written before managers were given a dashboard cookie of their
  // own, or a customer promoted to staff while still signed in. Reading the
  // role from the database rather than the token catches both, and the answer
  // is the same in either case: out here they are nobody, and browse the shop
  // signed out or with a customer account of their own.
  if (user && isStaffRole(user.role)) return null;

  return user;
});

/**
 * The same, for the dashboard — read from that side's own cookie, so whoever is
 * signed in on the shop side neither displaces them here nor gets in.
 */
export const getCurrentStaff = cache(async (): Promise<CurrentUser | null> => {
  return userFor(await readStaffSessionPayload());
});

async function userFor(
  payload: SessionPayload | null,
): Promise<CurrentUser | null> {
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, phone: true, role: true },
  });

  return user ?? null;
}
