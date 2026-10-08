import "server-only";

import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const envSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is missing — copy .env.example to .env.local"),

    /**
     * Supabase's unpooled connection string. Only the Prisma CLI and the
     * maintenance scripts use it — `db push` cannot run through the transaction
     * pooler — so the app itself never needs it set.
     */
    DIRECT_URL: z.string().default(""),

    /**
     * Database connections this one process may hold. Empty picks the default
     * for the host it is running on — see `@/lib/db`.
     */
    DB_POOL_MAX: z
      .union([z.literal(""), z.coerce.number().int().positive().max(100)])
      .optional(),

    /**
     * Set by Vercel on every deployment; nothing sets it elsewhere. Used only
     * to size the connection pool, since serverless multiplies pools across
     * instances while a single server does not.
     */
    VERCEL: z.string().default(""),
    AUTH_SECRET: z
      .string()
      .min(32, "AUTH_SECRET must be at least 32 characters long"),
    NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

    /**
     * Where uploaded menu images go.
     *
     * `local` writes into ./public/uploads and is right for a server with a disk
     * of its own. On a serverless host the filesystem is wiped on every deploy,
     * so anything uploaded there disappears — use `supabase` there.
     */
    STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
    MAX_UPLOAD_MB: z.coerce.number().int().positive().max(20).default(5),

    /** Supabase project URL, e.g. https://abcdefgh.supabase.co. */
    SUPABASE_URL: z.string().default(""),
    /**
     * The project's **secret** key (`sb_secret_…`, shown as "secret" in Project
     * Settings → API Keys), not the publishable one: uploads are performed by the
     * server on behalf of a signed-in admin and must bypass row-level security.
     *
     * It grants full access to the project, so it must never reach the browser —
     * hence no `NEXT_PUBLIC_` prefix. Older projects call this the service_role
     * key; either works here.
     */
    SUPABASE_SECRET_KEY: z.string().default(""),
    /** Storage bucket for menu images. Must be created as a **public** bucket. */
    SUPABASE_STORAGE_BUCKET: z.string().default("menu-images"),

    PAYMENTS_ENABLED: boolish,
    PAYMENT_PROVIDER: z.enum(["none", "stripe", "paypal"]).default("none"),

    NOTIFY_WHATSAPP: z.string().default(""),
    NOTIFY_EMAIL: z.string().default(""),

    /** Receipt printer by name. Empty means the machine's default printer. */
    RECEIPT_PRINTER: z.string().default(""),

    /**
     * Shared secret the restaurant PC's print agent authenticates with. The agent
     * is not a logged-in user — it is a machine on the other side of the internet
     * polling `/api/print/*` — so it carries this as a bearer token instead of a
     * session cookie.
     *
     * Empty disables the print endpoints outright (they answer 404), which is the
     * right default: an unset token must never mean "no auth required". Generate
     * with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
     */
    PRINT_AGENT_TOKEN: z.string().default(""),

    /**
     * URL guard for the read-only deploy-diagnostics endpoint (`/api/diag`).
     *
     * Empty disables the endpoint outright — it answers 404 — which is the right
     * default: the diagnostics must never be reachable in production unless the
     * operator deliberately sets a key. Not a password (everything it returns is
     * non-secret), but an unset value must not mean "open to everyone". Generate
     * with `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.
     */
    DIAG_KEY: z.string().default(""),

    /**
     * The work shift ends at a hardcoded 05:00 (see `@/lib/business-day`): the
     * daily order counter resets and the day closes for archiving then, so an
     * order placed after midnight still belongs to the previous business day.
     */

    /**
     * How many days of detailed orders to keep before the archive-and-purge job
     * hard-deletes them. The day's aggregate takings survive in the archive, so
     * reports are unaffected. Configurable; defaults to 90 days.
     */
    ORDER_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .max(3650)
      .default(90),

    /**
     * How many whole calendar months of monthly-report snapshots
     * (`OrderDailyArchive`) to keep before the archive-and-purge job deletes them.
     * A month is dropped once its end is more than this many months in the past.
     * Defaults to 3.
     */
    REPORT_RETENTION_MONTHS: z.coerce
      .number()
      .int()
      .positive()
      .max(120)
      .default(3),
  })
  // Choosing the Supabase driver without its credentials would fail only when
  // an admin first tries to upload a photo — long after deployment, and looking
  // like a broken form rather than a missing setting.
  .refine(
    (env) =>
      env.STORAGE_DRIVER !== "supabase" ||
      (env.SUPABASE_URL !== "" && env.SUPABASE_SECRET_KEY !== ""),
    {
      path: ["STORAGE_DRIVER"],
      message:
        'STORAGE_DRIVER is "supabase" but SUPABASE_URL and/or SUPABASE_SECRET_KEY are missing',
    },
  );

function readEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed.data;
}

export const env = readEnv();

export type Env = typeof env;
