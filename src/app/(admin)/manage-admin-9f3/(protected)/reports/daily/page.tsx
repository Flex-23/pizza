import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ReceiptText, Store, Truck, Wallet } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";
import { ReportNav } from "@/components/admin/reports/report-nav";
import { ReportSummary } from "@/components/admin/reports/report-summary";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MANAGER_ROUTES } from "@/lib/admin-path";
import { requireStaff } from "@/lib/auth/guards";
import { getDailyReport } from "@/lib/data/reports";
import { formatPrice } from "@/lib/money";
import {
  formatDayKey,
  formatMonthKey,
  parseDayKey,
} from "@/lib/reports/period";
import { cn } from "@/lib/utils";

// The takings must always reflect the orders as they stand right now.
export const dynamic = "force-dynamic";

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const staff = await requireStaff();
  const isMaster = staff.role === "MASTER";

  const { date } = await searchParams;
  const day = parseDayKey(date);

  const [report, t, tOrders, format, locale] = await Promise.all([
    getDailyReport(day),
    getTranslations("admin.reports"),
    getTranslations("orders"),
    getFormatter(),
    getLocale(),
  ]);

  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title={t("dailyTitle")}
        subtitle={format.dateTime(day, { dateStyle: "full" })}
      />

      <ReportNav
        view="daily"
        value={report.date}
        todayKey={formatDayKey(now)}
        thisMonthKey={formatMonthKey(now)}
      />

      {report.orders.length === 0 ? (
        <Card className="items-center gap-3 border-dashed py-16 text-center">
          <ReceiptText className="size-9 text-muted-foreground" aria-hidden />
          <p className="text-lg font-bold">{t("emptyDay")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyDayBody")}
          </p>
        </Card>
      ) : (
        <Card className="mb-6 gap-0 p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-4 text-start text-xs text-muted-foreground">
                  {t("time")}
                </TableHead>
                <TableHead className="text-start text-xs text-muted-foreground">
                  {t("number")}
                </TableHead>
                <TableHead className="text-start text-xs text-muted-foreground">
                  {t("customer")}
                </TableHead>
                <TableHead className="text-start text-xs text-muted-foreground">
                  {t("orderType")}
                </TableHead>
                <TableHead className="hidden text-start text-xs text-muted-foreground sm:table-cell">
                  {t("payment")}
                </TableHead>
                <TableHead className="pe-4 text-end text-xs text-muted-foreground">
                  {t("amount")}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {report.orders.map((order) => {
                const isDelivery = order.orderType === "DELIVERY";

                return (
                  <TableRow key={order.id}>
                    <TableCell className="ps-4 text-muted-foreground tabular-nums">
                      {format.dateTime(new Date(order.createdAt), {
                        timeStyle: "short",
                      })}
                    </TableCell>

                    {/* The owner reads the takings but never the fulfilment
                        screen, so for them the number is text, not a way in. */}
                    <TableCell>
                      <OrderNumber
                        order={order}
                        href={isMaster ? null : MANAGER_ROUTES.order(order.id)}
                      />
                    </TableCell>

                    <TableCell className="font-semibold">
                      {order.customerName}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold",
                          isDelivery
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-sale/30 bg-sale/10 text-sale",
                        )}
                      >
                        {isDelivery ? (
                          <Truck aria-hidden />
                        ) : (
                          <Store aria-hidden />
                        )}
                        {tOrders(`type.${order.orderType}`)}
                      </Badge>
                    </TableCell>

                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {tOrders(`paymentMethod.${order.paymentMethod}`)}
                    </TableCell>

                    <TableCell className="pe-4 text-end font-bold tabular-nums">
                      {formatPrice(order.total, locale)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <ReportSummary
        figures={[
          {
            label: t("totalOrders"),
            value: format.number(report.orderCount),
            icon: <ReceiptText className="size-4" />,
          },
          {
            label: t("totalRevenue"),
            value: formatPrice(report.revenue, locale),
            icon: <Wallet className="size-4" />,
            emphasis: true,
          },
        ]}
      />
    </>
  );
}

/** The ticket number over its reference — a link only where one leads somewhere. */
function OrderNumber({
  order,
  href,
}: {
  order: { dailySeq: number | null; orderNumber: string };
  href: string | null;
}) {
  const body = (
    <>
      {order.dailySeq !== null && (
        <span className="font-bold tabular-nums">#{order.dailySeq}</span>
      )}
      <span className="block truncate font-mono text-xs text-muted-foreground">
        <bdi dir="ltr">{order.orderNumber}</bdi>
      </span>
    </>
  );

  if (!href) return <span className="block">{body}</span>;

  return (
    <Link
      href={href}
      className="block rounded hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {body}
    </Link>
  );
}
