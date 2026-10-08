import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/guards";
import { adminHomeFor } from "@/lib/auth/roles";

/** The dashboard root sends each role to the first page it may open. */
export default async function AdminIndexPage() {
  const staff = await requireStaff();

  redirect(adminHomeFor(staff.role));
}
