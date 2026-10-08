import "server-only";

import { db } from "@/lib/db";
import { businessDayKeyOf } from "@/lib/orders/shift";

export type ShiftNumber = {
  /** Business-date key (YYYY-MM-DD) the number belongs to. */
  shiftDate: string;
  /** The ticket number itself: 1, 2, 3 … within the shift. */
  dailySeq: number;
};

/**
 * Reserves the next ticket number for the current shift.
 *
 * The bump is a single atomic upsert on the shift's counter row, so two orders
 * placed at the same instant get two different numbers and never collide. A new
 * shift has no row yet, so the first order of the night creates it at 1; the
 * counter is never reset by hand — a new `shiftDate` simply starts a new row.
 */
export async function allocateShiftNumber(
  when: Date = new Date(),
): Promise<ShiftNumber> {
  const shiftDate = businessDayKeyOf(when);

  const counter = await db.orderCounter.upsert({
    where: { shiftDate },
    create: { shiftDate, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });

  return { shiftDate, dailySeq: counter.lastSeq };
}
