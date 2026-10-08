import "server-only";

import { getFormatter, getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { getOrderById } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import {
  renderReceiptQrToImages,
  type ReceiptImage,
} from "@/lib/printing/qr-image";
import { buildKitchenLines, buildReceiptLines } from "@/lib/printing/receipt";

/**
 * The print queue the restaurant PC's agent drains.
 *
 * Once the app is hosted, the machine serving the site and the machine holding
 * the XP-80C are no longer the same computer, so a receipt cannot be printed
 * inside the request that asks for it. Instead an order is *marked* for
 * printing here, and `agent/print-agent.mjs` — which does sit next to the
 * printer — polls, prints, and acknowledges.
 *
 * Everything about the receipt itself still happens on the server: the agent
 * receives finished lines and finished QR images and never touches the
 * database, so it stays a dependency-free script the restaurant can run without
 * understanding any of this.
 */

/** How many receipts one poll may carry. Enough to drain a backlog after the
 * restaurant's PC has been off, small enough that a stuck agent cannot pull the
 * whole day's orders into memory at once. */
const BATCH_SIZE = 10;

/** One receipt, ready to print, in the form the agent understands. */
export type PrintJob = {
  orderId: string;
  orderNumber: string;
  widthMm: 58 | 80;
  /** The customer's copy, as receipt directives — see `@/lib/printing/receipt`. */
  lines: string[];
  /**
   * The kitchen's slip, printed as a second job straight after the customer's.
   *
   * A separate array rather than more `lines`, for two reasons: two print jobs
   * mean two guaranteed cuts, where one long document would rely on the driver
   * cutting between pages; and an agent that predates this field simply ignores
   * it and keeps printing the customer copy alone, so an un-updated restaurant
   * PC degrades to the old behaviour instead of breaking.
   */
  kitchenLines: string[];
  /** QR codes referenced by the `IMG` directives, by file name. */
  images: ReceiptImage[];
};

/**
 * Receipts always print in German, whatever language the person looking at the
 * dashboard uses: the master's dashboard is Arabic, but the kitchen ticket and
 * the customer's copy have to read in the local language.
 */
const RECEIPT_LOCALE = "de";

/** Builds one order's receipt. Returns null when the order no longer exists. */
export async function buildPrintJob(orderId: string): Promise<PrintJob | null> {
  const locale = RECEIPT_LOCALE;
  const [order, settings, t, tOrders, tCart, format] = await Promise.all([
    getOrderById(orderId),
    getSettings(),
    getTranslations({ locale, namespace: "admin.order" }),
    getTranslations({ locale, namespace: "orders" }),
    getTranslations({ locale, namespace: "cart" }),
    getFormatter({ locale }),
  ]);

  if (!order) return null;

  const built = buildReceiptLines({
    order,
    settings,
    locale,
    placedAt: format.dateTime(new Date(order.createdAt), {
      dateStyle: "short",
      timeStyle: "short",
    }),
    strings: {
      documentTitle: t("receiptTitle"),
      orderNumber: t("number"),
      dailySeq: t("receiptDailySeq"),
      time: t("time"),
      customer: t("customer"),
      phone: t("phone"),
      address: t("address"),
      orderType: tOrders(`type.${order.orderType}`),
      subtotal: tCart("subtotal"),
      discount: tCart("discount"),
      deliveryFee: tCart("deliveryFee"),
      total: tCart("total"),
      paymentMethod: tOrders(`paymentMethod.${order.paymentMethod}`),
      notes: t("receiptNotes"),
      disclaimer: t("receiptDisclaimer"),
    },
  });

  const { lines, images } = await renderReceiptQrToImages(built);

  // The kitchen slip carries no QR codes, so it needs no image pass. Its stamp
  // is the full date and the seconds — a cook comparing two tickets a minute
  // apart needs to see which came first, which "18:06" on both cannot show.
  const placed = new Date(order.createdAt);
  const kitchenPlacedAt =
    `${format.dateTime(placed, { day: "2-digit", month: "2-digit", year: "numeric" })}` +
    ` - ${format.dateTime(placed, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`;

  const kitchenLines = buildKitchenLines({
    order,
    locale,
    placedAt: kitchenPlacedAt,
    strings: { documentTitle: t("kitchenTitle") },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    widthMm: settings.receiptWidthMm,
    lines,
    kitchenLines,
    images,
  };
}

/**
 * Marks an order for printing — for a new order, and again for every reprint.
 *
 * A reprint is the same single write as the first request: moving
 * `printRequestedAt` past `printedAt` is what puts the row back in the queue,
 * so there is no second job to create and no way to end up with two.
 */
export async function requestPrint(orderId: string) {
  await db.order.update({
    where: { id: orderId },
    data: { printRequestedAt: new Date(), printError: null },
  });
}

/**
 * The receipts waiting to be printed, oldest first.
 *
 * Pending means "requested, and not printed since that request". Orders whose
 * `printRequestedAt` is null — every row that predates the print queue — are
 * invisible here, so switching this on never dumps the back catalogue onto the
 * roll.
 */
export async function getPendingPrintJobs(): Promise<PrintJob[]> {
  const due = await db.order.findMany({
    where: {
      printRequestedAt: { not: null },
      OR: [
        { printedAt: null },
        // A reprint moves `printRequestedAt` past `printedAt`; comparing the
        // two columns is what makes that one write re-queue the row.
        { printedAt: { lt: db.order.fields.printRequestedAt } },
      ],
    },
    select: { id: true },
    orderBy: { printRequestedAt: "asc" },
    take: BATCH_SIZE,
  });

  const jobs = await Promise.all(due.map((order) => buildPrintJob(order.id)));

  return jobs.filter((job): job is PrintJob => job !== null);
}

/** The agent printed this receipt. */
export async function markPrinted(orderId: string, printer: string) {
  await db.order.update({
    where: { id: orderId },
    data: { printedAt: new Date(), printError: null },
  });

  console.log(`[print] ${orderId} printed on ${printer}`);
}

/**
 * The agent could not print this receipt.
 *
 * The row deliberately stays pending: the printer being out of paper or turned
 * off is exactly the case where the receipt must come out later rather than be
 * silently dropped. The message is kept so the dashboard can say why.
 */
export async function markPrintFailed(orderId: string, detail: string) {
  await db.order.update({
    where: { id: orderId },
    data: { printError: detail.slice(0, 400) },
  });

  console.error(`[print] ${orderId} failed: ${detail}`);
}
