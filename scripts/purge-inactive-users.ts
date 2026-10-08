/**
 * Inactive-account cleanup: delete customer accounts that have gone a full year
 * without ordering, but only once the accounts table has grown past a threshold.
 *
 *   npm run users:purge                 ← run the purge
 *   npm run users:purge -- --dry-run    ← report what would be deleted, delete nothing
 *
 * Schedule it as a daily maintenance task (Windows Task Scheduler or cron calling
 * `npm run users:purge`). It is idempotent and safe to run repeatedly.
 *
 * Two thresholds gate it (see `src/lib/users/cleanup.ts`):
 *   • INACTIVE_USER_THRESHOLD (default 10,000) — below this the run is a no-op.
 *   • INACTIVE_USER_MAX_IDLE_DAYS (default 365) — the idle window per account.
 *
 * Deleting a dormant customer never touches sales history: `Order.userId` is
 * `onDelete: SetNull`, so every order keeps its immutable snapshot and only
 * loses the link to the person. Financial and tax reports are unaffected.
 */
import { createScriptClient, runScript } from "./_client";
import {
  INACTIVE_USER_MAX_IDLE_DAYS,
  INACTIVE_USER_PURGE_THRESHOLD,
  purgeInactiveUsers,
} from "../src/lib/users/cleanup";
import { formatDayKey } from "../src/lib/reports/period";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const threshold =
    Number(process.env.INACTIVE_USER_THRESHOLD) ||
    INACTIVE_USER_PURGE_THRESHOLD;
  const maxIdleDays =
    Number(process.env.INACTIVE_USER_MAX_IDLE_DAYS) ||
    INACTIVE_USER_MAX_IDLE_DAYS;

  const db = createScriptClient();

  try {
    const result = await purgeInactiveUsers(db, {
      threshold,
      maxIdleDays,
      dryRun,
    });

    if (result.skipped) {
      // The exact line the spec calls for, so log-scrapers can key on it.
      console.log(
        `Cleanup skipped: total users under 10k threshold ` +
          `(${result.totalUsers}/${result.threshold}).`,
      );
      return;
    }

    const cutoffKey = result.cutoff ? formatDayKey(result.cutoff) : "—";

    if (dryRun) {
      console.log(
        `(dry run) would purge ${result.purged} inactive customer account(s) ` +
          `with no order since ${cutoffKey} — ${maxIdleDays} days idle. ` +
          `Total users: ${result.totalUsers}.`,
      );
      return;
    }

    console.log(
      `✔ Purged ${result.purged} inactive customer account(s) with no order ` +
        `since ${cutoffKey} — ${maxIdleDays} days idle. ` +
        `Total users: ${result.totalUsers}.`,
    );
  } finally {
    await db.$disconnect();
  }
}

void runScript(main);
