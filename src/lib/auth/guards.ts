import "server-only";

import { notFound, redirect } from "next/navigation";

import { MANAGER_ROUTES } from "@/lib/admin-path";
import { isStaffRole } from "@/lib/auth/roles";
import {
  getCurrentStaff,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth/session";

/**
 * Server-side gates for the hidden dashboard. `proxy.ts` already turned away
 * requests whose cookie carries the wrong role; these are the authoritative
 * checks, because they read the role straight from the database — a demoted
 * account loses access on its very next request, not when its token expires.
 *
 * A signed-in customer who guesses a URL gets a 404, not a redirect to the
 * login page: nothing here should confirm that the route exists.
 */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentStaff();

  if (!user) {
    // The proxy already sends a signed-out visitor to the login of whichever
    // base they asked for, so reaching this line means the cookie was valid a
    // moment ago and the account has since gone — a deletion mid-session. The
    // manager's door is the safe landing: it is the less privileged of the two,
    // so this can never volunteer the owner's address to someone who did not
    // already have it.
    redirect(MANAGER_ROUTES.login);
  }

  if (!isStaffRole(user.role)) {
    notFound();
  }

  return user;
}

/** Pages only the owner may open: the menu, delivery zones, the takings. */
export async function requireMaster(): Promise<CurrentUser> {
  const user = await requireStaff();

  if (user.role !== "MASTER") {
    notFound();
  }

  return user;
}

/** Gate for customer-only pages (account, order history). */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    const target = returnTo
      ? `/login?next=${encodeURIComponent(returnTo)}`
      : "/login";
    redirect(target);
  }

  return user;
}

type AuthCheck = { ok: true; user: CurrentUser } | { ok: false; status: 404 };

/**
 * Guards for server actions: they return an error instead of redirecting.
 *
 * Every action re-checks on its own. The dashboard hides what a manager may not
 * touch, but hiding a button is not a permission — the action is what actually
 * decides.
 */
export async function assertStaff(): Promise<AuthCheck> {
  const user = await getCurrentStaff();

  if (!user || !isStaffRole(user.role)) {
    return { ok: false, status: 404 };
  }

  return { ok: true, user };
}

export async function assertMaster(): Promise<AuthCheck> {
  const user = await getCurrentStaff();

  if (!user || user.role !== "MASTER") {
    return { ok: false, status: 404 };
  }

  return { ok: true, user };
}
