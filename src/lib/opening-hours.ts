import type { OpeningHour, Weekday } from "@/lib/schemas/settings";
import { RESTAURANT_TIME_ZONE } from "@/lib/time-zone";

/**
 * Opening-hours maths for a kitchen that closes after midnight.
 *
 * "Mon 16:45–02:45" means Monday evening through early Tuesday, so a check at
 * 01:00 on Tuesday must look at Monday's window, not Tuesday's.
 */

const WEEKDAY_BY_INDEX: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function minutesToTime(minutes: number): string {
  const normalised = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(normalised / 60))}:${pad(normalised % 60)}`;
}

/** Local wall-clock time in Europe/Berlin regardless of where the server runs. */
export function berlinNow(now: Date = new Date()): {
  weekday: Weekday;
  minutes: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekdayShort =
    parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  const indexByShort: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: WEEKDAY_BY_INDEX[indexByShort[weekdayShort] ?? 0],
    // 24:00 is reported as hour 24 by some ICU builds.
    minutes: (hour % 24) * 60 + minute,
  };
}

function findDay(hours: OpeningHour[], day: Weekday): OpeningHour | undefined {
  return hours.find((entry) => entry.day === day);
}

function previousWeekday(day: Weekday): Weekday {
  const index = WEEKDAY_BY_INDEX.indexOf(day);
  if (index < 0) return day;
  return WEEKDAY_BY_INDEX[(index + 6) % 7];
}

export type OpenState = {
  isOpen: boolean;
  /** Next opening time as "HH:MM" when currently closed. */
  opensAt?: string;
  /** Closing time as "HH:MM" when currently open. */
  closesAt?: string;
};

export function getOpenState(
  hours: OpeningHour[],
  now: Date = new Date(),
): OpenState {
  const { weekday, minutes } = berlinNow(now);

  const today = findDay(hours, weekday);
  if (today && !today.isClosed) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    const closesAfterMidnight = close <= open;

    if (closesAfterMidnight) {
      if (minutes >= open) return { isOpen: true, closesAt: today.close };
    } else if (minutes >= open && minutes < close) {
      return { isOpen: true, closesAt: today.close };
    }
  }

  // Still inside yesterday's after-midnight window?
  const yesterday = findDay(hours, previousWeekday(weekday));
  if (yesterday && !yesterday.isClosed) {
    const open = toMinutes(yesterday.open);
    const close = toMinutes(yesterday.close);
    if (close <= open && minutes < close) {
      return { isOpen: true, closesAt: yesterday.close };
    }
  }

  // Closed: report when the next window starts.
  if (today && !today.isClosed && minutes < toMinutes(today.open)) {
    return { isOpen: false, opensAt: today.open };
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const index = (WEEKDAY_BY_INDEX.indexOf(weekday) + offset) % 7;
    const candidate = findDay(hours, WEEKDAY_BY_INDEX[index]);
    if (candidate && !candidate.isClosed) {
      return { isOpen: false, opensAt: candidate.open };
    }
  }

  return { isOpen: false };
}

/** Combines the manager's manual switch with the schedule. */
export function isAcceptingOrders(
  settingsIsOpen: boolean,
  hours: OpeningHour[],
  now: Date = new Date(),
): boolean {
  if (!settingsIsOpen) return false;
  return getOpenState(hours, now).isOpen;
}
