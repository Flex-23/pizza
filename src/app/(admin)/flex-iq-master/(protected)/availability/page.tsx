import { getTranslations } from "next-intl/server";

import { AvailabilityBoard } from "@/components/admin/availability-board";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/auth/guards";
import { getAdminMenuItems, getAllCategories } from "@/lib/data/menu";

/**
 * The sell-out board — the one menu screen a manager may open.
 *
 * `requireStaff` rather than `requireMaster`: running out of a dish mid-service
 * is the manager's problem to solve, and the board can only flip availability.
 * Creating, pricing and deleting dishes stay on the master's items screen.
 */
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  await requireStaff();

  const [items, categories, t] = await Promise.all([
    getAdminMenuItems(),
    getAllCategories(),
    getTranslations("admin.availability"),
  ]);

  return (
    <>
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />
      <AvailabilityBoard items={items} categories={categories} />
    </>
  );
}
