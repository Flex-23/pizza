import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * The database is PostgreSQL on Supabase, reached through Prisma's driver
 * adapter — plain JavaScript, so nothing native has to be built for whichever
 * platform the app is deployed to.
 *
 * `DATABASE_URL` must be Supabase's **pooled** connection string (the one whose
 * host contains `pooler` and whose port is 6543). A serverless deployment opens
 * a new instance per request, and the direct connection runs out of Postgres
 * connections long before traffic becomes interesting. `DIRECT_URL` — the
 * unpooled one — is what `prisma db push` and `migrate` use, and is not needed
 * at runtime.
 */
/**
 * How many connections this *process* may hold.
 *
 * There is no single right number, because the two hosting shapes fail in
 * opposite directions:
 *
 *  - **Serverless (Vercel).** Every warm instance keeps a pool of its own, so
 *    the real figure is `max × instances`. Supabase's pooler caps client
 *    connections by compute size — 200 on Micro, 400 on Small — and blowing
 *    through that takes the whole project down, not one request. Small is
 *    right here.
 *  - **One long-running server** (a VPS, or `next start`). A single process
 *    serves all traffic through this one pool, so the number *is* the site's
 *    concurrency ceiling. Measured at 3, twenty simultaneous visitors queued
 *    past the connect timeout and the homepage returned 500s.
 *
 * Defaulting per host means neither deployment inherits the other's number by
 * accident. `DB_POOL_MAX` overrides both when the traffic warrants it.
 */
function poolSize(): number {
  if (env.DB_POOL_MAX) return env.DB_POOL_MAX;
  return env.VERCEL ? 4 : 10;
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: poolSize(),
    // Fail fast when the database cannot be reached rather than holding the
    // request open — a slow page is worse than a clear error.
    connectionTimeoutMillis: 5000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Next.js clears the module registry on every hot reload in development, which
// would otherwise open a new connection pool per edit.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
