import type { UserRole } from "@/lib/auth/roles";

/**
 * The two hidden dashboards, one per staff role.
 *
 * They are separate URL spaces on purpose: discovering the manager's address
 * tells you nothing about the owner's. That is the whole point of the owner's
 * door being hidden, and a single shared base would have thrown it away — one
 * leaked link and both are known.
 *
 * To move either: rename its folder under `src/app/(admin)/` and change the
 * constant to match. Everything else — proxy protection, every internal link,
 * every `revalidatePath` — reads these, so nothing else needs touching. Neither
 * path appears in robots.txt or the sitemap, both of which are public.
 *
 * Deliberately not NEXT_PUBLIC_ env vars: that would ship the secret paths to
 * every browser in the client bundle.
 */
export const MASTER_BASE = "/flex-iq-master";
export const MANAGER_BASE = "/manage-admin-9f3";

/** Both bases, for the guards that must recognise either. */
export const ADMIN_BASES = [MASTER_BASE, MANAGER_BASE] as const;

/** Builds one role's route map from its base. */
function routesFor(base: string) {
  return {
    root: base,
    login: `${base}/login`,
    dashboard: `${base}/dashboard`,
    items: `${base}/items`,
    availability: `${base}/availability`,
    newItem: `${base}/items/new`,
    categories: `${base}/categories`,
    orders: `${base}/orders`,
    settings: `${base}/settings`,
    staff: `${base}/staff`,
    reports: `${base}/reports`,
    reportsDaily: `${base}/reports/daily`,
    reportsMonthly: `${base}/reports/monthly`,
    editItem: (id: string) => `${base}/items/${id}`,
    order: (id: string) => `${base}/orders/${id}`,
    /** The daily report for one specific day, e.g. drilled into from a month row. */
    reportDay: (date: string) => `${base}/reports/daily?date=${date}`,
    /** The monthly report for one specific month (`YYYY-MM`). */
    reportMonth: (month: string) => `${base}/reports/monthly?month=${month}`,
  } as const;
}

export const MASTER_ROUTES = routesFor(MASTER_BASE);
export const MANAGER_ROUTES = routesFor(MANAGER_BASE);

/**
 * The route map for whoever is signed in.
 *
 * Anything that draws a link inside the dashboard goes through this, so a page
 * shared by both roles — the reports, the settings, the sell-out board — links
 * within the base its reader arrived on and never leaks the other one.
 */
export function adminRoutes(role: UserRole | undefined) {
  return role === "MASTER" ? MASTER_ROUTES : MANAGER_ROUTES;
}

/** Which base a path belongs to, or null when it is outside both. */
export function baseOf(pathname: string): string | null {
  return (
    ADMIN_BASES.find(
      (base) => pathname === base || pathname.startsWith(`${base}/`),
    ) ?? null
  );
}

/**
 * The route map for the base a page is *currently being viewed in*.
 *
 * For a component rendered under both bases — the report navigation, say — this
 * is safer than passing the base in as a prop: it reads where it actually is,
 * so it cannot be handed the wrong one and cannot link a manager into the
 * owner's space. Falls back to the manager's map for a path outside both,
 * which only happens if such a component is rendered somewhere it should not be.
 */
export function adminRoutesForPath(pathname: string) {
  return baseOf(pathname) === MASTER_BASE ? MASTER_ROUTES : MANAGER_ROUTES;
}
