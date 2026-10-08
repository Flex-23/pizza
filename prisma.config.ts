import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local first, then .env. Mirror that order here so the
// Prisma CLI and the app always talk to the same database.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // The CLI runs schema changes, which the Supabase transaction pooler cannot
    // carry — it needs the direct connection. DATABASE_URL (the pooled one) is
    // the fallback so a plain local Postgres still works with one variable set.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
