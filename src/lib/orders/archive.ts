import type { PrismaClient } from "@/generated/prisma/client";
import { round2, toNumber } from "@/lib/money";
import { addDays, addMonths, formatDayKey } from "@/lib/reports/period";

/**
 * Daily archiving and retention purge.
 *
 * The two stages of the pipeline the shift-end scheduler runs:
 *
 *  1. **Archive** — snapshot each day's order count and takings into
 *     `OrderDailyArchive`. This is what the reports fall back to once the
 *     detailed orders are gone, so the numbers outlive the rows.
 *  2. **Purge** — hard-delete detailed orders older than the retention window.
 *     Their day was already snapshotted while it was live, so nothing a report
 *     needs is lost.
 *
 * Everything here takes the Prisma client as an argument rather than importing
 * the app singleton, so the same functions run inside the app *and* inside the
 * standalone `scripts/archive-and-purge.ts` scheduler job (which builds its own
 * client). Every stage keys on the order's `shiftDate` (the 05:00 business day),
 * the very key the reports group by, so the snapshot and the reports can never
 * disagree — and the purge only ever removes whole business days.
 */

type ArchiveClient = Pick<PrismaClient, "order" | "orderDailyArchive">;

/**
 * Recompute one business day's totals from the live orders and upsert its
 * snapshot. A day with no live orders is left untouched — that is either an
 * empty day (nothing to record) or a day already purged (whose snapshot must be
 * preserved, not overwritten with zeros).
 */
export async function archiveDay(
  client: ArchiveClient,
  dayKey: string,
): Promise<boolean> {
  const totals = await client.order.aggregate({
    where: { shiftDate: dayKey },
    _count: { _all: true },
    _sum: { total: true },
  });

  const orderCount = totals._count._all;
  if (orderCount === 0) return false;

  const revenue = round2(toNumber(totals._sum.total));

  await client.orderDailyArchive.upsert({
    where: { day: dayKey },
    create: { day: dayKey, orderCount, revenue },
    update: { orderCount, revenue },
  });

  return true;
}

/**
 * Snapshot every business day that still has live orders. Reading the one
 * `shiftDate` column keeps this cheap, and re-archiving an unchanged day is a
 * harmless idempotent upsert — so the job is safe to run again after a missed
 * night without any special catch-up logic.
 */
export async function archiveAllLiveDays(
  client: ArchiveClient,
): Promise<string[]> {
  const rows = await client.order.findMany({ select: { shiftDate: true } });

  const days = new Set<string>();
  for (const row of rows) {
    if (row.shiftDate) days.add(row.shiftDate);
  }

  const archived: string[] = [];
  for (const day of days) {
    if (await archiveDay(client, day)) archived.push(day);
  }

  return archived.sort();
}

/** Restaurant-midnight `retentionDays` ago — the day-aligned cut-off for the purge. */
export function retentionCutoff(retentionDays: number, now = new Date()): Date {
  return addDays(now, -retentionDays);
}

/**
 * Hard-delete detailed orders whose business day falls before `cutoff`. Keyed on
 * `shiftDate` rather than `createdAt`, so a shift that runs past midnight is
 * removed whole — never split at midnight, which would leave a day both partly
 * live and partly archived and make its report under-count. Returns how many
 * rows were deleted.
 */
export async function purgeOrdersBefore(
  client: ArchiveClient,
  cutoff: Date,
): Promise<number> {
  const result = await client.order.deleteMany({
    where: { shiftDate: { lt: formatDayKey(cutoff) } },
  });
  return result.count;
}

/**
 * The day-aligned cut-off for the monthly-report retention purge: the first day
 * of the calendar month that sits `retentionMonths` whole months before `now`.
 *
 * A daily snapshot (`OrderDailyArchive`) is what the manager and master monthly
 * reports fall back to once the detailed orders are gone, so a snapshot *is* the
 * monthly-report record. Deleting every snapshot whose `day` falls before this
 * key drops exactly the months whose end is already more than `retentionMonths`
 * calendar months in the past, and keeps every more recent month whole. On
 * 24 Aug with a 3-month window the cut-off is `2026-05-01`: April and earlier
 * go, May onward stay. Month arithmetic runs on the restaurant clock, so the
 * boundary never drifts with the server's timezone.
 */
export function monthlyRetentionCutoff(
  retentionMonths: number,
  now = new Date(),
): Date {
  return addMonths(now, -retentionMonths);
}

/**
 * Hard-delete the daily snapshots that back monthly reports older than the
 * retention window. Keyed on the same `day` string the reports read, so a
 * purged month simply reads back as zeros rather than breaking. Returns how many
 * snapshots were deleted.
 */
export async function purgeMonthlyArchivesBefore(
  client: Pick<PrismaClient, "orderDailyArchive">,
  cutoff: Date,
): Promise<number> {
  const result = await client.orderDailyArchive.deleteMany({
    where: { day: { lt: formatDayKey(cutoff) } },
  });
  return result.count;
}

/**
 * The whole pipeline, in the order that keeps reports intact: archive first so
 * every live day is snapshotted, then purge the detailed orders past the order
 * window, and finally the monthly-report snapshots past the (longer) report
 * window.
 */
export async function runArchiveAndPurge(
  client: ArchiveClient,
  {
    retentionDays,
    retentionMonths,
    now = new Date(),
  }: { retentionDays: number; retentionMonths: number; now?: Date },
): Promise<{
  archivedDays: string[];
  purgedOrders: number;
  purgedArchives: number;
}> {
  const archivedDays = await archiveAllLiveDays(client);
  const purgedOrders = await purgeOrdersBefore(
    client,
    retentionCutoff(retentionDays, now),
  );
  const purgedArchives = await purgeMonthlyArchivesBefore(
    client,
    monthlyRetentionCutoff(retentionMonths, now),
  );
  return { archivedDays, purgedOrders, purgedArchives };
}
