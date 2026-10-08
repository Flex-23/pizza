import { getTranslations } from "next-intl/server";

import { CategoriesManager } from "@/components/admin/categories-manager";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getAllCategories } from "@/lib/data/menu";
import { requireMaster } from "@/lib/auth/guards";

export default async function AdminCategoriesPage() {
  await requireMaster();

  const [categories, t] = await Promise.all([
    getAllCategories(),
    getTranslations("admin.category"),
  ]);

  return (
    <>
      <AdminPageHeader title={t("listTitle")} subtitle={t("listSubtitle")} />
      <CategoriesManager categories={categories} />
    </>
  );
}
