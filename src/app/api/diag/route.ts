import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Deployment diagnostics.
 *
 * The shared host writes no error log into the application folder and Next
 * hides error detail in production, so a site that boots but cannot reach its
 * database gives nothing to work with. This reports the few facts that explain
 * almost every failed deploy — which Node is running, whether the environment
 * variables arrived, and whether Postgres answers — without exposing any of
 * their values.
 *
 * Guarded by a key in the query string rather than a login, because the case it
 * exists for is precisely the one where signing in does not work. The key lives
 * in the `DIAG_KEY` environment variable: when it is unset the endpoint answers
 * 404 and does not exist as far as a caller can tell, so production is closed by
 * default and only the operator who sets a key can reach it.
 */

export const dynamic = "force-dynamic";

function errInfo(error: unknown) {
  const e = error as { name?: string; message?: string; code?: string };

  return {
    name: e?.name ?? "Error",
    code: e?.code ?? null,
    message: e?.message ?? String(error),
  };
}

/** Reports whether a variable arrived, never what it says. */
function present(value: string | undefined) {
  return value ? "set ✓" : "MISSING ✗";
}

export async function GET(request: Request) {
  // Unset key: the endpoint is disabled and indistinguishable from a route that
  // was never deployed. A wrong key gets the same 404.
  if (
    !env.DIAG_KEY ||
    new URL(request.url).searchParams.get("key") !== env.DIAG_KEY
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const report: Record<string, unknown> = {
    time: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cwd: process.cwd(),
    env: {
      NODE_ENV: process.env.NODE_ENV ?? "MISSING ✗",
      DATABASE_URL: present(process.env.DATABASE_URL),
      AUTH_SECRET: present(process.env.AUTH_SECRET),
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "MISSING ✗",
      // Not secret, and the first thing to check when nothing prints.
      PRINT_AGENT_TOKEN: env.PRINT_AGENT_TOKEN
        ? "set ✓ (printing enabled)"
        : "MISSING ✗ — /api/print/* answer 404 and nothing will print",
      TMPDIR: process.env.TMPDIR ?? "not set",
    },
  };

  // Prisma 7 reaches Postgres through a JavaScript driver adapter, so there is
  // no native engine to load and the only thing that can fail here is the
  // connection itself.
  try {
    await db.$queryRaw`SELECT 1`;

    const [orders, users, settings] = await Promise.all([
      db.order.count(),
      db.user.count(),
      db.settings.count(),
    ]);

    report.database = { reachable: true, rows: { orders, users, settings } };
  } catch (error) {
    report.database = { reachable: false, error: errInfo(error) };
  }

  // A receipt stuck in the queue is the symptom the restaurant reports; this
  // says whether the agent is collecting them at all.
  try {
    const [pending, lastPrinted] = await Promise.all([
      db.order.count({
        where: {
          printRequestedAt: { not: null },
          OR: [
            { printedAt: null },
            { printedAt: { lt: db.order.fields.printRequestedAt } },
          ],
        },
      }),
      db.order.findFirst({
        where: { printedAt: { not: null } },
        orderBy: { printedAt: "desc" },
        select: { orderNumber: true, printedAt: true, printError: true },
      }),
    ]);

    report.printing = { pending, lastPrinted };
  } catch (error) {
    report.printing = { error: errInfo(error) };
  }

  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
