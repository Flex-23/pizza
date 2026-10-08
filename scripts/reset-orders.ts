/**
 * Wipes the orders table clean — for clearing the leftover test orders during
 * setup so the dashboard and reports start from zero.
 *
 *   npm run orders:reset -- --yes
 *
 * Deletes every order, the shift counters and the daily archives. Guarded by
 * --yes because it cannot be undone. Real orders should never be removed this
 * way — the scheduled archive-and-purge job handles retention safely.
 */
import { createScriptClient, fail, runScript } from "./_client";

async function main() {
  if (!process.argv.includes("--yes")) {
    fail(
      "This permanently deletes ALL orders. Re-run with --yes to confirm:\n" +
        "    npm run orders:reset -- --yes",
    );
  }

  const db = createScriptClient();

  try {
    const orders = await db.order.deleteMany({});
    await db.orderCounter.deleteMany({});
    await db.orderDailyArchive.deleteMany({});

    console.log(
      `✔ Deleted ${orders.count} order(s), reset the shift counter and cleared the archive.`,
    );
  } finally {
    await db.$disconnect();
  }
}

void runScript(main);
