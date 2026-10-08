import "server-only";

import { getBusinessDate } from "@/lib/business-day";

/**
 * The work shift — the "business day" the kitchen counts orders by.
 *
 * A shift ends at the hardcoded 05:00 cutoff (see `@/lib/business-day`): an
 * order placed after midnight but before 05:00 still belongs to the previous
 * business day, so a night that runs past midnight keeps one continuous ticket
 * sequence instead of flipping to #1 at 00:00. The cutoff is read on the
 * restaurant's clock, so a ticket is never counted into a different day than the
 * report it appears in — the sequence, the dashboard and the reports all key on
 * the `shiftDate` this returns.
 */
export function businessDayKeyOf(when: Date = new Date()): string {
  return getBusinessDate(when);
}
