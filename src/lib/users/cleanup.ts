import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { addDays } from "@/lib/reports/period";

/**
 * Inactive-account cleanup.
 *
 * A housekeeping pass that deletes customer accounts which have gone a full year
 * without ordering — but only once the accounts table is genuinely large, so a
 * small restaurant never has its handful of dormant customers swept away.
 *
 * Two rules gate it, both deliberately conservative:
 *
 *  1. **Threshold** — the purge does nothing until there are at least
 *     `PURGE_THRESHOLD` accounts. Below that the table is small enough that the
 *     rows are not worth reclaiming and a mistaken delete would hurt more than
 *     the storage it saves.
 *  2. **Idle window** — an account is only in scope when its `lastOrderAt` is at
 *     least `MAX_IDLE_DAYS` in the past. `lastOrderAt` is seeded at sign-up and
 *     bumped on every order, so this is "no order, ever, in a year".
 *
 * Data safety is the whole point of the delete strategy: `Order.userId` is
 * `onDelete: SetNull`, so removing a customer never removes their orders. Every
 * order keeps its immutable snapshot — customer name, phone, line items, totals
 * — and merely loses the back-link to the person, so sales and tax reports read
 * exactly the same before and after. The customer's saved addresses cascade
 * away with them, which is the right outcome for personal data on a purged
 * account. Staff and owner accounts (ADMIN / MASTER) are never in scope.
 *
 * Takes the Prisma client as an argument (like the archive pipeline) so the same
 * function runs inside the app and inside the standalone
 * `scripts/purge-inactive-users.ts` scheduler job.
 */

/** Below this many accounts the purge is a no-op. */
export const INACTIVE_USER_PURGE_THRESHOLD = 10_000;

/** An account must be idle at least this long to be eligible for deletion. */
export const INACTIVE_USER_MAX_IDLE_DAYS = 365;

type CleanupClient = Pick<PrismaClient, "user" | "$transaction">;

export type InactiveUserCleanupResult = {
  /** True when the threshold guard stopped the run before any delete. */
  skipped: boolean;
  totalUsers: number;
  threshold: number;
  /** The idle cut-off applied, or null when the run was skipped. */
  cutoff: Date | null;
  /** Accounts deleted — or, in a dry run, that would be deleted. */
  purged: number;
};

/**
 * Delete (or, in a dry run, count) the dormant customer accounts. Returns what
 * happened so the caller can log it. Idempotent: a second run simply finds
 * fewer, or no, matching rows.
 */
export async function purgeInactiveUsers(
  client: CleanupClient,
  {
    threshold = INACTIVE_USER_PURGE_THRESHOLD,
    maxIdleDays = INACTIVE_USER_MAX_IDLE_DAYS,
    now = new Date(),
    dryRun = false,
  }: {
    threshold?: number;
    maxIdleDays?: number;
    now?: Date;
    dryRun?: boolean;
  } = {},
): Promise<InactiveUserCleanupResult> {
  const totalUsers = await client.user.count();

  if (totalUsers < threshold) {
    return { skipped: true, totalUsers, threshold, cutoff: null, purged: 0 };
  }

  const cutoff = addDays(now, -maxIdleDays);

  // Customers only, and only those idle past the cut-off. A NULL `lastOrderAt`
  // never satisfies `lte`, so an unstamped account is left alone, not deleted.
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    lastOrderAt: { lte: cutoff },
  };

  if (dryRun) {
    const purged = await client.user.count({ where });
    return { skipped: false, totalUsers, threshold, cutoff, purged };
  }

  const purged = await client.$transaction(async (tx) => {
    const result = await tx.user.deleteMany({ where });
    return result.count;
  });

  return { skipped: false, totalUsers, threshold, cutoff, purged };
}
