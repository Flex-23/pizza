import { addDays, formatDayKey, minutesIntoDay } from "@/lib/reports/period";

/**
 * The hour the business day rolls over, on the restaurant's 24-hour clock.
 *
 * Hardcoded at 05:00: the kitchen runs a late shift (roughly 15:00 → 05:00), so
 * an order taken at 01:30 belongs to the evening still in progress, not to the
 * fresh calendar date. Everything that counts a "day" — the ticket sequence
 * (#N), the dashboard's "today", and the daily/monthly reports — is grouped by
 * this cutoff, through the `shiftDate` stamped on each order.
 */
export const BUSINESS_DAY_CUTOFF_HOUR = 5;

/**
 * The business date (`YYYY-MM-DD`) an instant belongs to. Anything before 05:00
 * is attributed to the previous calendar day.
 *
 * The boundary is read on the restaurant's wall clock (via the period helpers),
 * never the server's: a naive `getHours()` / `toISOString()` version would put
 * orders on the wrong day whenever the server and the restaurant sit in
 * different time zones, and for the hours around UTC midnight even when they do
 * not. `minutesIntoDay`, `addDays` and `formatDayKey` all resolve in
 * `RESTAURANT_TIME_ZONE`, so this key always matches the one the reports use.
 */
export function getBusinessDate(date: Date = new Date()): string {
  const cutoffMinutes = BUSINESS_DAY_CUTOFF_HOUR * 60;
  const beforeCutoff = minutesIntoDay(date) < cutoffMinutes;
  return formatDayKey(beforeCutoff ? addDays(date, -1) : date);
}
