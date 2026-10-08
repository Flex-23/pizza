import { getTranslations } from "next-intl/server";

import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireStaff } from "@/lib/auth/guards";
import { getSettings } from "@/lib/data/settings";

export default async function AdminSettingsPage() {
  const [staff, settings, t] = await Promise.all([
    requireStaff(),
    getSettings(),
    getTranslations("admin.settings"),
  ]);

  return (
    <>
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsForm settings={settings} isMaster={staff.role === "MASTER"} />
    </>
  );
}
