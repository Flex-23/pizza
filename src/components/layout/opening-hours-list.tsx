import { getTranslations } from "next-intl/server";

import { berlinNow } from "@/lib/opening-hours";
import { WEEKDAYS, type OpeningHour } from "@/lib/schemas/settings";
import { cn } from "@/lib/utils";

export async function OpeningHoursList({
  hours,
  className,
  spread = false,
}: {
  hours: OpeningHour[];
  className?: string;
  /**
   * Fills the parent's height and spaces the days evenly down it, instead of
   * stacking them at the top. For a card whose height is set by a taller
   * neighbour — the map on the home page — where the days would otherwise sit
   * in a clump above a large empty gap.
   */
  spread?: boolean;
}) {
  const t = await getTranslations("hours");
  const { weekday: today } = berlinNow();

  const byDay = new Map(hours.map((entry) => [entry.day, entry]));

  return (
    <dl
      className={cn(
        "flex flex-col gap-1.5 text-sm",
        spread && "h-full justify-between gap-0",
        className,
      )}
    >
      {WEEKDAYS.map((day) => {
        const entry = byDay.get(day);
        const isToday = day === today;

        return (
          <div
            key={day}
            className={cn(
              "flex items-center justify-between gap-4 rounded-md px-1.5 py-0.5",
              // Even bands rather than even gaps: each day keeps the same
              // share of the column, so the highlight on today stays a
              // consistent size however tall the card gets.
              spread && "flex-1 py-1",
              isToday && "bg-primary/10 font-semibold text-primary",
            )}
          >
            <dt className={cn(!isToday && "text-muted-foreground")}>
              {t(day)}
            </dt>
            <dd
              className={cn("tabular-nums", !isToday && "text-foreground/80")}
            >
              {!entry || entry.isClosed ? (
                t("closed")
              ) : (
                <span dir="ltr">
                  {t("range", { open: entry.open, close: entry.close })}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
