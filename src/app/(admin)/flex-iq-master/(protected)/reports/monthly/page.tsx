import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, ReceiptText, Wallet } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";
import { ReportNav } from "@/components/admin/reports/report-nav";
import { ReportSummary } from "@/components/admin/reports/report-summary";
import { Card } from "@/components/ui/card";
import { MASTER_ROUTES } from "@/lib/admin-path";
import { requireStaff } from "@/lib/auth/guards";
import { getMonthlyReport } from "@/lib/data/reports";
import { formatPrice } from "@/lib/money";
import {
  formatDayKey,
  formatMonthKey,
  parseDayKey,
  parseMonthKey,
} from "@/lib/reports/period";
import { cn } from "@/lib/utils";

// Revenue must always reflect the orders as they stand right now.
export const dynamic = "force-dynamic";

/** Header and every row share these tracks so their columns line up exactly. */
const MONTH_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_4rem_7rem_1rem] items-center gap-3 sm:gap-4";

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireStaff();

  const { month } = await searchParams;
  const monthStart = parseMonthKey(month);

  const [report, t, format, locale] = await Promise.all([
    getMonthlyReport(monthStart),
    getTranslations("admin.reports"),
    getFormatter(),
    getLocale(),
  ]);

  const now = new Date();
  const todayKey = formatDayKey(now);

  return (
    <>
      <AdminPageHeader
        title={t("monthlyTitle")}
        subtitle={format.dateTime(monthStart, {
          month: "long",
          year: "numeric",
        })}
      />

      <ReportNav
        view="monthly"
        value={report.month}
        todayKey={todayKey}
        thisMonthKey={formatMonthKey(now)}
      />

      <Card className="mb-6 gap-0 p-0">
        <div
          className={`${MONTH_COLUMNS} border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground`}
        >
          <span>{t("date")}</span>
          <span className="text-end">{t("orders")}</span>
          <span className="text-end">{t("revenue")}</span>
          <span aria-hidden />
        </div>

        <ul className="flex flex-col divide-y divide-border">
          {report.days.map((day) => {
            const date = parseDayKey(day.date);
            const isToday = day.date === todayKey;
            const hadOrders = day.orderCount > 0;

            return (
              <li key={day.date}>
                <Link
                  href={MASTER_ROUTES.reportDay(day.date)}
                  className={cn(
                    "group/day px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                    MONTH_COLUMNS,
                    isToday && "bg-primary/5",
                    !hadOrders && "text-muted-foreground",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="truncate">
                      {format.dateTime(date, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {isToday && (
                      <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-bold text-primary">
                        {t("todayTag")}
                      </span>
                    )}
                  </span>

                  <span
                    className={cn(
                      "text-end tabular-nums",
                      hadOrders ? "font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {format.number(day.orderCount)}
                  </span>

                  <span
                    className={cn(
                      "text-end tabular-nums",
                      hadOrders ? "font-bold" : "text-muted-foreground/60",
                    )}
                  >
                    {hadOrders ? formatPrice(day.revenue, locale) : "—"}
                  </span>

                  <ChevronRight
                    className="size-4 text-muted-foreground/50 transition-colors group-hover/day:text-foreground rtl:rotate-180"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <ReportSummary
        figures={[
          {
            label: t("monthOrders"),
            value: format.number(report.totalOrders),
            icon: <ReceiptText className="size-4" />,
          },
          {
            label: t("grandTotalRevenue"),
            value: formatPrice(report.totalRevenue, locale),
            icon: <Wallet className="size-4" />,
            emphasis: true,
          },
        ]}
      />
    </>
  );
}
