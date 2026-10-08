import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  CalendarDays,
  CalendarRange,
  Euro,
  ListOrdered,
  PackageX,
  Plus,
  ShapesIcon,
  UtensilsCrossed,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MASTER_ROUTES } from "@/lib/admin-path";
import { getDashboardStats } from "@/lib/data/orders";
import { formatPrice } from "@/lib/money";
import { requireMaster } from "@/lib/auth/guards";

export default async function AdminDashboardPage() {
  await requireMaster();

  const [stats, t, locale] = await Promise.all([
    getDashboardStats(),
    getTranslations("admin"),
    getLocale(),
  ]);

  return (
    <>
      <AdminPageHeader
        title={t("dashboard")}
        action={
          <Button
            render={<Link href={MASTER_ROUTES.newItem} />}
            className="rounded-full"
          >
            <Plus data-icon="inline-start" />
            {t("item.new")}
          </Button>
        }
      />

      {/* Opening and closing the restaurant is the manager's switch, on their
          settings page — it is a decision about tonight's shift, not about the
          business, so it is not on this screen. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {/* A count, not a way in: the queue itself belongs to the manager. */}
        <StatCard
          label={t("stats.todayOrders")}
          value={String(stats.todayOrders)}
          icon={<ListOrdered className="size-5" />}
        />
        <StatCard
          label={t("stats.todayRevenue")}
          value={formatPrice(stats.todayRevenue, locale)}
          icon={<Euro className="size-5" />}
        />
        <StatCard
          label={t("stats.totalItems")}
          value={String(stats.totalItems)}
          icon={<UtensilsCrossed className="size-5" />}
          href={MASTER_ROUTES.items}
        />
        <StatCard
          label={t("stats.unavailableItems")}
          value={String(stats.unavailableItems)}
          icon={<PackageX className="size-5" />}
        />
        <StatCard
          label={t("stats.totalCategories")}
          value={String(stats.totalCategories)}
          icon={<ShapesIcon className="size-5" />}
          href={MASTER_ROUTES.categories}
        />
      </div>

      {/* Where the day's takings are read. The live queue that produced them
          is the manager's screen, and no longer reachable from here. */}
      <Card className="gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold">{t("reportsNav")}</h2>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={MASTER_ROUTES.reportsDaily} />}
          >
            {t("reports.dailyTitle")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            render={<Link href={MASTER_ROUTES.reportsDaily} />}
          >
            <CalendarDays data-icon="inline-start" />
            {t("reports.dailyTitle")}
          </Button>
          <Button
            variant="outline"
            render={<Link href={MASTER_ROUTES.reportsMonthly} />}
          >
            <CalendarRange data-icon="inline-start" />
            {t("reports.monthlyTitle")}
          </Button>
        </div>
      </Card>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  emphasis,
  href,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  emphasis?: boolean;
  href?: string;
}) {
  const card = (
    <Card
      className={
        emphasis
          ? "gap-1 border-primary/40 bg-primary/5 p-5"
          : "gap-1 p-5 transition-shadow hover:shadow-sm"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <span className={emphasis ? "text-primary" : "text-muted-foreground"}>
          {icon}
        </span>
      </div>
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
    </Card>
  );

  return href ? (
    <Link href={href} className="focus-visible:outline-none">
      {card}
    </Link>
  ) : (
    card
  );
}
