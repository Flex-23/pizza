import { getTranslations } from "next-intl/server";

import { ItemsTable } from "@/components/admin/items-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getAdminMenuItems, getAllCategories } from "@/lib/data/menu";
import { requireMaster } from "@/lib/auth/guards";

export default async function AdminItemsPage() {
  await requireMaster();

  const [items, categories, t] = await Promise.all([
    getAdminMenuItems(),
    getAllCategories(),
    getTranslations("admin.item"),
  ]);

  return (
    <>
      <AdminPageHeader title={t("listTitle")} subtitle={t("listSubtitle")} />
      <ItemsTable items={items} categories={categories} />
    </>
  );
}
