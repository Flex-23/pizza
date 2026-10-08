import {
  MANAGER_BASE,
  MANAGER_ROUTES,
  MASTER_BASE,
  MASTER_ROUTES,
} from "@/lib/admin-path";

/**
 * Who may open what inside the dashboards.
 *
 * MASTER is the owner's account, at its own hidden base: the whole dashboard
 * except the live order queue, which is the manager's shift work.
 *
 * ADMIN is the restaurant's day-to-day manager, at a *different* hidden base:
 * incoming orders, the daily and monthly reports, the sell-out board, and the
 * restaurant's settings. The menu itself — dishes, categories, delivery zones —
 * and the overview dashboard stay with the owner.
 *
 * The base is now the first gate: a manager's URL is not the owner's, so a
 * manager reaching into the owner's space is refused before any page-level rule
 * is consulted. That is what keeps one leaked link from exposing both doors.
 *
 * Kept free of Node-only imports so `proxy.ts` can use it on the Edge runtime.
 * It decides *what a role may open*, never *what a request carries*: the pages
 * and server actions re-check the role against the database.
 */

export const USER_ROLES = ["CUSTOMER", "ADMIN", "MASTER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

/** Anyone allowed into a dashboard at all. */
export function isStaffRole(role: unknown): role is "ADMIN" | "MASTER" {
  return role === "ADMIN" || role === "MASTER";
}

/** The base a role signs in to and works in. */
export function baseForRole(role: unknown): string {
  return role === "MASTER" ? MASTER_BASE : MANAGER_BASE;
}

/** The sections a manager may open inside their own base. */
const MANAGER_SECTIONS = [
  MANAGER_ROUTES.orders,
  MANAGER_ROUTES.reports,
  MANAGER_ROUTES.settings,
  // Selling a dish out is shift work — the kitchen runs out at nine and the
  // menu has to say so that minute. The board only flips availability; the
  // dishes themselves stay under `items`, which is master-only.
  MANAGER_ROUTES.availability,
];

/**
 * The one part of the dashboard the owner stays out of.
 *
 * Live orders are the manager's shift work — taken, cooked, sent out. The
 * owner sees what the day earned in the reports; the queue itself is not their
 * screen, so it is out of their navigation and out of their reach.
 */
const MASTER_FORBIDDEN = [MASTER_ROUTES.orders];

function inSection(pathname: string, sections: string[]): boolean {
  return sections.some(
    (section) => pathname === section || pathname.startsWith(`${section}/`),
  );
}

export function canOpenAdminPath(role: unknown, pathname: string): boolean {
  if (role === "MASTER") {
    // Wrong base: the owner has no business in the manager's URL space.
    if (!pathname.startsWith(MASTER_BASE)) return false;
    return !inSection(pathname, MASTER_FORBIDDEN);
  }

  if (role !== "ADMIN") return false;
  if (!pathname.startsWith(MANAGER_BASE)) return false;

  return inSection(pathname, MANAGER_SECTIONS);
}

/** Where a role lands when it enters its dashboard without naming a page. */
export function adminHomeFor(role: unknown): string {
  return role === "MASTER" ? MASTER_ROUTES.dashboard : MANAGER_ROUTES.orders;
}
