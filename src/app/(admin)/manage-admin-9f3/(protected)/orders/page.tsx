import { getTranslations } from "next-intl/server";

import { OrdersBoard } from "@/components/admin/orders-board";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getAdminOrders } from "@/lib/data/orders";

// Incoming orders must never be served from a cache.
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [orders, t] = await Promise.all([
    getAdminOrders(),
    getTranslations("admin.order"),
  ]);

  return (
    <>
      <AdminPageHeader title={t("listTitle")} subtitle={t("listSubtitle")} />
      <OrdersBoard orders={orders} />
    </>
  );
}
