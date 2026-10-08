/**
 * Reporting periods — one day or one whole month — as pure, timezone-consistent
 * helpers shared by the report pages, the links between them and the aggregation
 * layer.
 *
 * Every boundary is computed on the restaurant's wall clock
 * (`RESTAURANT_TIME_ZONE`), never on the server's own timezone. That distinction
 * is the whole point of this module: `createdAt` is an instant, the pages format
 * it in Karlsruhe time, and a boundary built from `setHours(0,0,0,0)` on a
 * machine set to any other zone lands somewhere in the middle of a Karlsruhe
 * day. An hour east of Berlin is enough for the first row of August to be read
 * back as 31 July — the month's opening midnight was still yesterday evening
 * there. Anchoring both the boundaries and the day keys to one zone removes the
 * drift for good, wherever the server runs.
 *
 * The parse helpers never throw: a report reached from a hand-edited or stale
 * URL still renders (today / this month). That matters once the planned
 * retention job starts purging old orders — a bookmarked link to a long-gone day
 * must degrade to an empty report, not a crash.
 *
 * No `server-only` here on purpose: the client stepper builds prev/next links
 * with the very same maths, and `Intl` resolves the zone identically in the
 * browser.
 */

import { RESTAURANT_TIME_ZONE } from "@/lib/time-zone";

/** A calendar day key, `YYYY-MM-DD`, always Latin digits (URL-safe). */
export type DayKey = string;
/** A calendar month key, `YYYY-MM`, always Latin digits (URL-safe). */
export type MonthKey = string;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * `en-US` only picks the digits' script here — every part is read back as a
 * number, so the locale never reaches a user. `h23` keeps midnight at hour 0
 * instead of the 24 some ICU builds report for `hour12: false`.
 */
const ZONED = new Intl.DateTimeFormat("en-US", {
  timeZone: RESTAURANT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type Clock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** What the restaurant's clock reads at `date`. */
function clockAt(date: Date): Clock {
  const parts: Record<string, number> = {};
  for (const part of ZONED.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour % 24,
    minute: parts.minute,
    second: parts.second,
  };
}

/** How far the restaurant's clock runs ahead of UTC at `date`, in ms. */
function offsetAt(date: Date): number {
  const clock = clockAt(date);
  const asUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  );
  return asUtc - (date.getTime() - date.getMilliseconds());
}

/**
 * The instant at which the restaurant's clock reads the given calendar date at
 * 00:00. The offset is resolved twice: the first guess is read at the wrong
 * side of a daylight-saving switch on the two nights a year one moves, and the
 * second pass — taken at the corrected instant — settles it.
 */
function zonedMidnight(year: number, month: number, day: number): Date {
  const utcGuess = Date.UTC(year, month - 1, day);
  const firstPass = new Date(utcGuess - offsetAt(new Date(utcGuess)));
  return new Date(utcGuess - offsetAt(firstPass));
}

/**
 * Midnight of the calendar day `delta` days from the one `date` falls in.
 * The rollover itself is plain UTC arithmetic on the calendar numbers — no
 * offset involved — so month ends and leap days come out right, and only the
 * final midnight is resolved back into a real instant.
 */
function shiftDays(date: Date, delta: number): Date {
  const clock = clockAt(date);
  const rolled = new Date(
    Date.UTC(clock.year, clock.month - 1, clock.day + delta),
  );
  return zonedMidnight(
    rolled.getUTCFullYear(),
    rolled.getUTCMonth() + 1,
    rolled.getUTCDate(),
  );
}

/** Restaurant-midnight of the day `date` falls in, as a fresh Date. */
export function startOfDay(date: Date): Date {
  const clock = clockAt(date);
  return zonedMidnight(clock.year, clock.month, clock.day);
}

/** Minutes since midnight on the restaurant's clock — used to place a shift. */
export function minutesIntoDay(date: Date): number {
  const clock = clockAt(date);
  return clock.hour * 60 + clock.minute;
}

export function formatDayKey(date: Date): DayKey {
  const { year, month, day } = clockAt(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatMonthKey(date: Date): MonthKey {
  const { year, month } = clockAt(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * A `YYYY-MM-DD` key as that day's restaurant-midnight, falling back to today
 * when the value is missing or malformed. Rejects impossible dates (e.g.
 * `2026-02-31`) that the Date constructor would otherwise roll forward into
 * March — the round trip through the key catches them.
 */
export function parseDayKey(value: string | undefined, now = new Date()): Date {
  if (value && DAY_RE.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const midnight = zonedMidnight(year, month, day);
      if (formatDayKey(midnight) === value) return midnight;
    }
  }
  return startOfDay(now);
}

/** A `YYYY-MM` key as the first restaurant-midnight of that month, or this one. */
export function parseMonthKey(
  value: string | undefined,
  now = new Date(),
): Date {
  if (value && MONTH_RE.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (month >= 1 && month <= 12) {
      return zonedMidnight(year, month, 1);
    }
  }

  const clock = clockAt(now);
  return zonedMidnight(clock.year, clock.month, 1);
}

/** Half-open range `[start, end)` covering one restaurant day. */
export function dayRange(date: Date): { start: Date; end: Date } {
  const start = startOfDay(date);
  return { start, end: shiftDays(start, 1) };
}

/**
 * Half-open range `[start, end)` covering the whole month `monthStart` sits in:
 * from the 1st at 00:00 up to — but never including — the 1st of the next
 * month. Every order of the last day is inside it, and not one instant of an
 * adjacent month can be.
 */
export function monthRange(monthStart: Date): { start: Date; end: Date } {
  const clock = clockAt(monthStart);
  const start = zonedMidnight(clock.year, clock.month, 1);
  const next = new Date(Date.UTC(clock.year, clock.month, 1));
  const end = zonedMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
  return { start, end };
}

/** Every day of the month as an ordered list of restaurant-midnight Dates. */
export function eachDayOfMonth(monthStart: Date): Date[] {
  const { start, end } = monthRange(monthStart);
  const days: Date[] = [];

  for (let cursor = start; cursor < end; cursor = shiftDays(cursor, 1)) {
    days.push(cursor);
  }

  return days;
}

export function addDays(date: Date, delta: number): Date {
  return shiftDays(date, delta);
}

export function addMonths(monthStart: Date, delta: number): Date {
  const clock = clockAt(monthStart);
  const rolled = new Date(Date.UTC(clock.year, clock.month - 1 + delta, 1));
  return zonedMidnight(rolled.getUTCFullYear(), rolled.getUTCMonth() + 1, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return formatDayKey(a) === formatDayKey(b);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return formatMonthKey(a) === formatMonthKey(b);
}
