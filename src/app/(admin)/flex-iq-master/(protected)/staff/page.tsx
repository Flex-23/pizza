import { getTranslations } from "next-intl/server";

import { AdminPageHeader } from "@/components/admin/page-header";
import { StaffManager } from "@/components/admin/staff-manager";
import { requireMaster } from "@/lib/auth/guards";
import { db } from "@/lib/db";

// Roles change while the page is open; never serve a cached list of them.
export const dynamic = "force-dynamic";

/**
 * Who may enter the dashboard, and as what.
 *
 * Managers are created here, promoted here and removed here. It is the one
 * page a manager may never open, since it is what decides what a manager is.
 */
export default async function StaffPage() {
  const master = await requireMaster();

  const [rows, t] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      // Only the people who run the dashboard. Customers have no business on
      // this page: a shop account is not a step on the way to being staff.
      where: { role: { in: ["MASTER", "ADMIN"] } },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    }),
    getTranslations("admin.staff"),
  ]);

  return (
    <>
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />

      <StaffManager
        users={rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          role: row.role,
          createdAt: row.createdAt.toISOString(),
        }))}
        currentUserId={master.id}
      />
    </>
  );
}
