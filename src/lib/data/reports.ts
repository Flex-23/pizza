import "server-only";

import { toOrderView } from "@/lib/data/orders";
import { db } from "@/lib/db";
import { sum, toNumber } from "@/lib/money";
import {
  addDays,
  eachDayOfMonth,
  formatDayKey,
  formatMonthKey,
  monthRange,
} from "@/lib/reports/period";
import type { OrderView } from "@/lib/schemas/order";

/**
 * Reporting aggregation.
 *
 * Every figure comes from the `orders` still inside the asked-for range, with
 * one safety net: once the retention job has purged a day's detailed orders, the
 * per-day snapshot written when the day was archived (`OrderDailyArchive`) stands
 * in for them. So a report reads live orders while they exist and the archived
 * totals afterwards — it never breaks on missing history, and a purged day still
 * shows its takings, just without the itemised list.
 *
 * Revenue is the sum of every order's total. Orders no longer carry a status, so
 * there is nothing to exclude — what was ordered is what was earned.
 */

/** The narrow set of columns the month aggregate reads — keeps 30+ days cheap. */
const MONTH_SELECT = {
  shiftDate: true,
  total: true,
} as const;

/** The two figures every report row and footer is built from. */
export type DayTotals = {
  /** `YYYY-MM-DD`, local time. */
  date: string;
  orderCount: number;
  revenue: number;
};

export type DailyReport = DayTotals & {
  /** Every order of the day, oldest first — the daily page lists these. Empty
   *  when the day has been purged and only its archived totals remain. */
  orders: OrderView[];
};

export type MonthlyReport = {
  /** `YYYY-MM`, local time. */
  month: string;
  /** One entry per calendar day, in order; empty days are present as zeros. */
  days: DayTotals[];
  totalOrders: number;
  totalRevenue: number;
};

/**
 * Every order of one local day, plus its count and takings.
 *
 * The two figures are folded out of the very list they summarise, so the footer
 * total is always the sum of exactly the rows shown. When no live orders remain
 * — a purged day — the archived snapshot supplies the totals and the list is
 * empty.
 */
export async function getDailyReport(day: Date): Promise<DailyReport> {
  // Grouped by the order's business day (`shiftDate`, 05:00 cutoff), not its
  // calendar `createdAt`, so an order taken at 01:30 counts on the shift that
  // was still running — the same day its ticket number (#N) belongs to.
  const dateKey = formatDayKey(day);

  const rows = await db.order.findMany({
    where: { shiftDate: dateKey },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length > 0) {
    const orders = rows.map(toOrderView);
    return {
      date: dateKey,
      orderCount: orders.length,
      revenue: sum(orders.map((order) => order.total)),
      orders,
    };
  }

  const archived = await db.orderDailyArchive.findUnique({
    where: { day: dateKey },
  });

  return {
    date: dateKey,
    orderCount: archived?.orderCount ?? 0,
    revenue: archived ? toNumber(archived.revenue) : 0,
    orders: [],
  };
}

/**
 * Per-day totals across one local month, plus the month's grand total.
 *
 * The month's live orders are read once and bucketed by day; the archive is read
 * alongside so any day whose detail has been purged still contributes its saved
 * totals. Every calendar day is present, empty days as zeros, so the month
 * always reads as a full calendar.
 */
export async function getMonthlyReport(
  monthStart: Date,
): Promise<MonthlyReport> {
  const { start, end } = monthRange(monthStart);
  const dayKeys = eachDayOfMonth(start).map(formatDayKey);
  const firstKey = formatDayKey(start);
  const lastKey = formatDayKey(addDays(end, -1));

  const [rows, archives] = await Promise.all([
    // By business day (`shiftDate`), so a shift's post-midnight orders count on
    // the day their ticket numbers do, and never leak into the next month.
    db.order.findMany({
      where: { shiftDate: { gte: firstKey, lte: lastKey } },
      select: MONTH_SELECT,
      orderBy: { shiftDate: "asc" },
    }),
    db.orderDailyArchive.findMany({
      where: { day: { gte: firstKey, lte: lastKey } },
    }),
  ]);

  const live = new Map<string, { orderCount: number; revenues: number[] }>();
  for (const key of dayKeys) live.set(key, { orderCount: 0, revenues: [] });
  for (const row of rows) {
    if (!row.shiftDate) continue; // Pre-counter legacy rows carry no business day.
    const bucket = live.get(row.shiftDate);
    if (!bucket) continue; // Defensive: a boundary straggler outside the seed.
    bucket.orderCount += 1;
    bucket.revenues.push(toNumber(row.total));
  }

  const archived = new Map(
    archives.map((snapshot) => [snapshot.day, snapshot]),
  );

  // Live orders win; the archive fills a day only once its detail is gone.
  const days: DayTotals[] = dayKeys.map((date) => {
    const bucket = live.get(date);
    if (bucket && bucket.orderCount > 0) {
      return {
        date,
        orderCount: bucket.orderCount,
        revenue: sum(bucket.revenues),
      };
    }

    const snapshot = archived.get(date);
    return {
      date,
      orderCount: snapshot?.orderCount ?? 0,
      revenue: snapshot ? toNumber(snapshot.revenue) : 0,
    };
  });

  return {
    month: formatMonthKey(start),
    days,
    totalOrders: days.reduce((total, day) => total + day.orderCount, 0),
    totalRevenue: sum(days.map((day) => day.revenue)),
  };
}
