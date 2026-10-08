/**
 * Shift-end pipeline: archive each day's takings, then purge the detailed orders
 * that have aged past the retention window.
 *
 *   npm run archive                 ← archive live days, then purge old detail
 *   npm run archive -- --dry-run    ← show what would be purged, delete nothing
 *
 * Schedule it to run once per shift at the shift-end time — Windows Task
 * Scheduler or cron calling `npm run archive`. It is idempotent: running it
 * twice, or catching up after a missed night, is safe, because archiving a day
 * only ever rewrites that day's snapshot and the purge is bounded by date.
 *
 * Two retention windows apply, longest last:
 *   • ORDER_RETENTION_DAYS (default 90) bounds the detailed orders.
 *   • REPORT_RETENTION_MONTHS (default 3) bounds the daily snapshots that back
 *     the manager and master monthly reports. A month's snapshots are dropped
 *     once its end is more than that many calendar months in the past.
 * The day's aggregate takings live on in `order_daily_archives` until the report
 * window closes, so the reports keep working after the order detail is gone.
 */
import { createScriptClient, runScript } from "./_client";
import {
  archiveAllLiveDays,
  monthlyRetentionCutoff,
  purgeMonthlyArchivesBefore,
  purgeOrdersBefore,
  retentionCutoff,
} from "../src/lib/orders/archive";
import { formatDayKey } from "../src/lib/reports/period";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const retentionDays = Number(process.env.ORDER_RETENTION_DAYS) || 90;
  const retentionMonths = Number(process.env.REPORT_RETENTION_MONTHS) || 3;

  const db = createScriptClient();

  try {
    const archived = await archiveAllLiveDays(db);
    console.log(
      `✔ Archived ${archived.length} day(s): ${archived.join(", ") || "—"}`,
    );

    const cutoff = retentionCutoff(retentionDays);
    const reportCutoff = monthlyRetentionCutoff(retentionMonths);

    if (dryRun) {
      const [orderCount, archiveCount] = await Promise.all([
        db.order.count({
          where: { shiftDate: { lt: formatDayKey(cutoff) } },
        }),
        db.orderDailyArchive.count({
          where: { day: { lt: formatDayKey(reportCutoff) } },
        }),
      ]);
      console.log(
        `(dry run) would purge ${orderCount} order(s) placed before ${formatDayKey(
          cutoff,
        )} — retention ${retentionDays} days.`,
      );
      console.log(
        `(dry run) would purge ${archiveCount} report snapshot(s) before ${formatDayKey(
          reportCutoff,
        )} — retention ${retentionMonths} months.`,
      );
      return;
    }

    const purged = await purgeOrdersBefore(db, cutoff);
    console.log(
      `✔ Purged ${purged} order(s) placed before ${formatDayKey(
        cutoff,
      )} — retention ${retentionDays} days.`,
    );

    const purgedArchives = await purgeMonthlyArchivesBefore(db, reportCutoff);
    console.log(
      `✔ Purged ${purgedArchives} report snapshot(s) before ${formatDayKey(
        reportCutoff,
      )} — retention ${retentionMonths} months.`,
    );
  } finally {
    await db.$disconnect();
  }
}

void runScript(main);
