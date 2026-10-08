import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ItemForm } from "@/components/admin/item-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MASTER_ROUTES } from "@/lib/admin-path";
import { getAllCategories } from "@/lib/data/menu";
import { requireMaster } from "@/lib/auth/guards";

export default async function NewItemPage() {
  await requireMaster();

  const [categories, t, tCategory] = await Promise.all([
    getAllCategories(),
    getTranslations("admin.item"),
    getTranslations("admin.category"),
  ]);

  if (categories.length === 0) {
    return (
      <>
        <AdminPageHeader title={t("createTitle")} />
        <Card className="items-center gap-3 border-dashed py-14 text-center">
          <p className="text-lg font-bold">{tCategory("empty")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {tCategory("emptyBody")}
          </p>
          <Button
            className="mt-1 rounded-full"
            render={<Link href={MASTER_ROUTES.categories} />}
          >
            {tCategory("new")}
          </Button>
        </Card>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title={t("createTitle")} />
      <ItemForm categories={categories} />
    </>
  );
}
