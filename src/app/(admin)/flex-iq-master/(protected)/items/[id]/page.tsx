import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ItemForm } from "@/components/admin/item-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getAllCategories, getMenuItemById } from "@/lib/data/menu";
import { requireMaster } from "@/lib/auth/guards";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMaster();

  const { id } = await params;

  const [item, categories, t] = await Promise.all([
    getMenuItemById(id),
    getAllCategories(),
    getTranslations("admin.item"),
  ]);

  if (!item) notFound();

  return (
    <>
      <AdminPageHeader title={t("edit")} subtitle={item.nameAr} />
      <ItemForm categories={categories} item={item} />
    </>
  );
}
