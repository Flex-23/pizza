import { NextResponse, type NextRequest } from "next/server";

import { baseOf } from "@/lib/admin-path";
import { staffCookieForBase, verifySession } from "@/lib/auth/jwt";
import { adminHomeFor, canOpenAdminPath, isStaffRole } from "@/lib/auth/roles";

/**
 * First line of defence for the two hidden dashboards. (Next.js 16 renamed the
 * `middleware` convention to `proxy`; the behaviour is the same.)
 *
 * Requests without a staff session never reach the pages at all, and neither
 * role reaches the other's URL space. Every page additionally re-checks the
 * role against the database (see `requireStaff`/`requireMaster`), because a JWT
 * claim alone must not grant access.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Which of the two dashboards was asked for, if either.
  const base = baseOf(pathname);
  if (!base) return NextResponse.next();

  const login = `${base}/login`;

  // Only the cookie belonging to the base that was asked for. The shop's
  // session is not consulted at all — a customer's cookie is not a key to any
  // dashboard — and neither is the other role's, which the browser would not
  // have sent here anyway: each is confined to its own base by its path.
  const cookie = request.cookies.get(staffCookieForBase(base))?.value;
  const session = await verifySession(cookie);
  const role = session?.role;

  // Already signed in *here*: skip the login screen and go to this base's home
  // page. Someone holding the other role's session sees the login page as a
  // stranger would, since their cookie never reached this path — which is the
  // right answer for a door that is meant to give nothing away.
  if (pathname === login) {
    if (isStaffRole(role)) {
      return NextResponse.redirect(new URL(adminHomeFor(role), request.url));
    }
    return withNoIndex(NextResponse.next());
  }

  // A stranger is offered the login of the base they asked for, and learns
  // nothing about the other one.
  if (!isStaffRole(role)) {
    return withNoIndex(NextResponse.redirect(new URL(login, request.url)));
  }

  // Wrong base, or a page this role may not open: back to their own start page.
  if (!canOpenAdminPath(role, pathname)) {
    return withNoIndex(
      NextResponse.redirect(new URL(adminHomeFor(role), request.url)),
    );
  }

  return withNoIndex(NextResponse.next());
}

function withNoIndex(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every path except Next internals, the uploads folder and static
     * files — the admin check itself narrows further inside the handler.
     */
    "/((?!_next/static|_next/image|uploads|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|avif)$).*)",
  ],
};
