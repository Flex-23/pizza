"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRoutesForPath } from "@/lib/admin-path";
import {
  addDays,
  addMonths,
  formatDayKey,
  formatMonthKey,
  parseDayKey,
  parseMonthKey,
} from "@/lib/reports/period";
import { cn } from "@/lib/utils";

type ReportView = "daily" | "monthly";

/**
 * The controls shared by both reports: the Daily / Monthly switch and a stepper
 * for the period on show.
 *
 * `todayKey` / `thisMonthKey` are handed down from the server so the "you can't
 * go past now" cap is decided in one place — the client never calls `new Date()`
 * for it, which also keeps the disabled state from flickering on hydration. The
 * native picker doubles as the current-value display and the jump-to-any-day
 * control; the human-readable period sits in the page heading, so it isn't
 * repeated here.
 */
export function ReportNav({
  view,
  value,
  todayKey,
  thisMonthKey,
}: {
  view: ReportView;
  value: string;
  todayKey: string;
  thisMonthKey: string;
}) {
  const t = useTranslations("admin.reports");
  const router = useRouter();
  // The base this nav is being viewed in, so its links stay inside it.
  const routes = adminRoutesForPath(usePathname());

  const isDaily = view === "daily";
  const atLatest = isDaily ? value === todayKey : value === thisMonthKey;

  const prevHref = isDaily
    ? routes.reportDay(formatDayKey(addDays(parseDayKey(value), -1)))
    : routes.reportMonth(formatMonthKey(addMonths(parseMonthKey(value), -1)));
  const nextHref = isDaily
    ? routes.reportDay(formatDayKey(addDays(parseDayKey(value), 1)))
    : routes.reportMonth(formatMonthKey(addMonths(parseMonthKey(value), 1)));
  const resetHref = isDaily
    ? routes.reportDay(todayKey)
    : routes.reportMonth(thisMonthKey);

  function jumpTo(next: string) {
    if (!next) return;
    router.push(isDaily ? routes.reportDay(next) : routes.reportMonth(next));
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {/* Daily / Monthly switch. */}
      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
        <ViewTab href={routes.reportsDaily} active={isDaily}>
          {t("daily")}
        </ViewTab>
        <ViewTab href={routes.reportsMonthly} active={!isDaily}>
          {t("monthly")}
        </ViewTab>
      </div>

      {/* Period stepper: previous · pick · next, then a jump back to now. */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("previousPeriod")}
          render={<Link href={prevHref} />}
        >
          <ChevronLeft className="rtl:rotate-180" />
        </Button>

        <Input
          type={isDaily ? "date" : "month"}
          value={value}
          max={isDaily ? todayKey : thisMonthKey}
          onChange={(event) => jumpTo(event.target.value)}
          aria-label={isDaily ? t("pickDay") : t("pickMonth")}
          className="h-8 w-auto min-w-[9.5rem] font-medium tabular-nums"
        />

        {atLatest ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("nextPeriod")}
            disabled
          >
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("nextPeriod")}
            render={<Link href={nextHref} />}
          >
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        )}
      </div>

      {!atLatest && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          render={<Link href={resetHref} />}
        >
          <RotateCcw data-icon="inline-start" />
          {isDaily ? t("today") : t("thisMonth")}
        </Button>
      )}
    </div>
  );
}

function ViewTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1 text-sm font-semibold transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
