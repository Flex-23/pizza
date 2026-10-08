import { AdminShell } from "@/components/admin/admin-shell";
import { requireStaff } from "@/lib/auth/guards";
import { getBusinessDate } from "@/lib/business-day";
import { db } from "@/lib/db";

/**
 * Second, authoritative gate. The proxy already rejected requests without a
 * staff cookie; `requireStaff` re-reads the role from the database, so a
 * demoted account loses access on its very next request. Master-only pages add
 * `requireMaster` of their own — this layout only decides who gets a shell.
 */
export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const staff = await requireStaff();

  // How many orders are on this shift — the badge next to "Orders".
  //
  // Keyed on `shiftDate`, the same 05:00 business day the board itself lists and
  // the ticket numbers count against. It used to count from calendar midnight,
  // which disagreed with the board for the five hours after midnight: the badge
  // read 0 while last night's tickets were still on screen.
  const todayOrderCount = await db.order.count({
    where: { shiftDate: getBusinessDate() },
  });

  return (
    <AdminShell
      userName={staff.name}
      role={staff.role}
      todayOrderCount={todayOrderCount}
    >
      {children}
    </AdminShell>
  );
}
