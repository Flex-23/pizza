import { redirect } from "next/navigation";

import { MASTER_ROUTES } from "@/lib/admin-path";
import { requireStaff } from "@/lib/auth/guards";

/** The reports root opens on the daily view — open to the manager and master. */
export default async function ReportsIndexPage() {
  await requireStaff();
  redirect(MASTER_ROUTES.reportsDaily);
}
