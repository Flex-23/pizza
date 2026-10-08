import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/** Standalone Prisma client for CLI scripts (no Next.js runtime around it). */
export function createScriptClient() {
  // Scripts write as much as they read (creating accounts, purging orders), so
  // they use the direct connection when one is configured rather than the
  // pooler the app runs on.
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local first.",
    );
  }

  const adapter = new PrismaPg({
    connectionString: url,
    // A script is one process doing one job; it never needs a pool.
    max: 2,
    connectionTimeoutMillis: 8000,
  });

  return new PrismaClient({ adapter });
}

export function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const CONNECTION_HINTS = [
  "pool timeout",
  "ECONNREFUSED",
  "ENOTFOUND",
  "Can't reach database",
  "password authentication failed",
  "does not exist",
  "timeout expired",
];

/**
 * Runs a script and turns the most common setup failure — the database being
 * unreachable — into an instruction rather than a Prisma stack trace.
 */
export async function runScript(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (CONNECTION_HINTS.some((hint) => message.includes(hint))) {
      console.error("\n✖ Could not reach the database.\n");
      console.error("  1. Check DATABASE_URL (and DIRECT_URL) in .env.local:");
      console.error(`     ${process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "(not set)"}`);
      console.error("  2. In Supabase → Project Settings → Database, confirm the project");
      console.error("     is running (free projects pause when idle) and the password is right.");
      console.error("  3. If the tables do not exist yet, run: npm run db:push\n");
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  }
}
