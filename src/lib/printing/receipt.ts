import { formatPrice, round2 } from "@/lib/money";
import { pickLocalized } from "@/lib/localized";
import type { OrderView } from "@/lib/schemas/order";
import type { SettingsView } from "@/lib/schemas/settings";

/**
 * The receipt as lines for the printer script.
 *
 * A thermal roll has no columns, so the layout travels with the text in a
 * deliberately small format the PowerShell side understands:
 *
 *   =text              centred and set large — the order number
 *   ~text              centred
 *   !label	value      the same two columns, in bold
 *   -                  a rule across the paper
 *   (empty)            blank line
 *   label\tvalue       label on the left, value on the right
 *   text               one plain line
 *   QR\tmm\tecl\turl   a QR code, `mm` wide, drawn as an image (see qr-image.ts)
 *
 * Text is drawn with GDI+, so an Arabic dish name still comes out shaped and
 * right-to-left wherever it appears. The *columns*, though, follow the document
 * rather than the individual string: these slips print in German (see
 * `queue.ts`), so a label leads at the left and its value closes at the right —
 * "Gesamt … 6,50 €". Deciding that per string instead would leave the price
 * column jumping sides down the page whenever a dish had an Arabic name.
 *
 * The two QR codes are the only images. Prices are read from the order, never
 * recomputed: a receipt has to say what the customer was charged, even if a
 * price changed since.
 */

export type ReceiptStrings = {
  /** Heads the receipt: what this piece of paper is. */
  documentTitle: string;
  orderNumber: string;
  /** Label for the per-shift ticket number ("#3") the kitchen calls out. */
  dailySeq: string;
  time: string;
  customer: string;
  phone: string;
  address: string;
  orderType: string;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  paymentMethod: string;
  notes: string;
  /** Says the slip is not a tax document. */
  disclaimer: string;
};

/** QR captions. Receipts print in German, so the labels do too. */
const DELIVERY_QR_LABEL = "Lieferadresse";
const SALES_QR_LABEL = "Online bestellen";

/**
 * Blank lines fed after the last printed row.
 *
 * These are belt-and-braces only. The real protection is the bottom margin in
 * `agent/print-receipt.ps1`: a blank line here draws no ink, and a thermal
 * printer ends its page at the last mark, so trailing empties alone never
 * advanced the paper — which is how the footer still came out sliced in half by
 * the cutter. They are kept because they cost nothing and do help on a printer
 * whose driver honours a form feed.
 */
const CUT_FEED_LINES = 4;

export function buildReceiptLines({
  order,
  settings,
  strings,
  locale,
  placedAt,
}: {
  order: OrderView;
  settings: SettingsView;
  strings: ReceiptStrings;
  locale: string;
  /** Already formatted in the reader's locale and time zone. */
  placedAt: string;
}): string[] {
  const brand = pickLocalized(
    locale,
    settings.restaurantNameAr,
    settings.restaurantNameDe,
  );

  // QR modules a touch smaller on the narrow roll so the quiet zone still fits.
  // Kept compact so the code stays sharp and quick to scan without eating roll.
  const qrMm = settings.receiptWidthMm === 58 ? 21 : 29;

  const isDelivery = order.orderType === "DELIVERY" && Boolean(order.street);

  // 1 — What the slip is, then who issued it. The title leads so the document
  // announces itself before the letterhead. One fact per line: on a 58 mm roll
  // a street and a postcode together ran off the paper and the second half was
  // lost.
  const lines: string[] = [
    `~${strings.documentTitle}`,
    `~${brand}`,
    `~${settings.street}`,
    `~${settings.postalCode} ${settings.city}`,
    `~${settings.phone}`,
    "-",
  ];

  // 2 — The order number, centred and set large, then type and time.
  //
  // It gets a line of its own rather than a label-and-value row: this is the one
  // string the kitchen and the driver hunt the slip for, and as a right-aligned
  // value beside "Nummer" it read no louder than the postcode above it. The
  // caption sits underneath in ordinary type, so the code itself is what the eye
  // lands on.
  //
  // Two numbers, kept visually apart so they cannot be mistaken for each other.
  // `orderNumber` is the code that identifies the order for life and appears in
  // the dashboard, the customer's confirmation and their history, so it leads in
  // the large type. `dailySeq` is the shift's ticket number — what the kitchen
  // calls the order across the counter — and rides in an ordinary labelled row
  // below, where restarting at 1 each shift cannot read as a rival order code.
  lines.push(`~${strings.orderType}`);
  lines.push(`=${order.orderNumber}`);
  lines.push(`~${strings.orderNumber}`);
  if (order.dailySeq !== null) {
    lines.push(`!${strings.dailySeq}\t#${order.dailySeq}`);
  }
  lines.push(`${strings.time}\t${placedAt}`);

  // 3 — Delivery-location QR: scanned by the driver to open Google Maps at the
  // customer's address. Delivery orders with an address only.
  if (isDelivery) {
    const query = encodeURIComponent(
      `${order.street}, ${order.postalCode ?? ""} ${order.city ?? ""}, Deutschland`,
    );
    lines.push(
      "-",
      `QR\t${qrMm}\tM\thttps://www.google.com/maps/search/?api=1&query=${query}`,
      `~${DELIVERY_QR_LABEL}`,
    );
  }

  // 4 — Customer data.
  lines.push("-", `${strings.customer}\t${order.customerName}`);
  lines.push(`${strings.phone}\t${order.phone}`);
  if (isDelivery) {
    lines.push(
      `${strings.address}\t${order.street}`,
      `\t${order.postalCode ?? ""} ${order.city ?? ""}`.trimEnd(),
    );
  }

  // 5 — Itemised list: one line per entry, "quantity × name" against what that
  // line costs in total.
  //
  // The unit price used to be spelled out on a second line under every item.
  // For "4 × Burger  200,00 €" that line said "50,00 € × 4" — the same sum
  // restated backwards, on a roll where every line costs paper. It is kept for
  // the one case where it is not a restatement: a discounted dish, where the
  // customer should be able to see the per-item price they were actually
  // charged rather than infer it by dividing.
  //
  // A dish ordered plain and the same dish ordered with a request are already
  // separate lines in the cart, so "4 × Burger" and "1 × Burger / ohne
  // Zwiebeln" print as two entries with their own totals — which is exactly
  // what the kitchen needs to read.
  lines.push("-");
  for (const line of order.items) {
    const name = pickLocalized(locale, line.nameAr, line.nameDe);
    const lineTotal = formatPrice(
      round2(line.unitPrice * line.quantity),
      locale,
    );
    lines.push(`${line.quantity} × ${name}\t${lineTotal}`);

    const isDiscounted = line.originalPrice > line.unitPrice;
    if (isDiscounted && line.quantity > 1) {
      lines.push(`${formatPrice(line.unitPrice, locale)} × ${line.quantity}`);
    }

    // The customer's request for this dish, directly under the dish it belongs
    // to — this is the line the kitchen cooks from, so it must not be collected
    // into a footnote away from the item it changes.
    if (line.note) lines.push(`* ${line.note}`);
  }

  // 6 — Financial summary.
  lines.push(
    "-",
    `${strings.subtotal}\t${formatPrice(order.subtotal, locale)}`,
  );
  if (order.discountTotal > 0) {
    lines.push(
      `${strings.discount}\t− ${formatPrice(order.discountTotal, locale)}`,
    );
  }
  if (isDelivery) {
    lines.push(
      `${strings.deliveryFee}\t${formatPrice(order.deliveryFee, locale)}`,
    );
  }
  // "!" prints the row in bold: the amount to collect is what the driver and
  // the customer both look for.
  lines.push("-", `!${strings.total}\t${formatPrice(order.total, locale)}`);

  // 7 — Payment method.
  lines.push("", `~${strings.paymentMethod}`);

  if (order.notes) {
    lines.push("-", `${strings.notes}\t${order.notes}`);
  }

  // 8 — Master online-sales QR at the foot of every receipt.
  if (settings.salesUrl) {
    lines.push(
      "-",
      `QR\t${qrMm}\tM\t${settings.salesUrl}`,
      `~${SALES_QR_LABEL}`,
    );
  }

  // 9 — The slip is a delivery note, not a tax receipt, and has to say so.
  lines.push("-", `~${strings.disclaimer}`);

  // Feed past the cutter so the disclaimer is not the line it slices through.
  for (let i = 0; i < CUT_FEED_LINES; i += 1) lines.push("");

  return lines;
}

/** The few labels the kitchen slip needs. */
export type KitchenStrings = {
  /** Heads the slip so it cannot be confused with the customer's copy. */
  documentTitle: string;
};

/** Closes the kitchen slip, matching the till the kitchen already reads. */
const KITCHEN_FOOTER = "-- c --";

/**
 * The kitchen's own slip, printed straight after the customer's copy.
 *
 * Deliberately austere: the cook needs to know which ticket this is, when it
 * came in, and what to make. Prices, the delivery fee, the payment method and
 * the customer's address are all omitted — none of them changes what goes in
 * the pan, and on a 58 mm roll every line they take is a line the food has to
 * share. The ticket number leads in the large type because that is what the
 * counter shouts.
 *
 * A dish's own note is the reason this slip exists, so it is set in bold
 * directly beneath the dish it belongs to rather than gathered into a footnote
 * the cook has to cross-reference mid-service.
 */
export function buildKitchenLines({
  order,
  strings,
  locale,
  placedAt,
}: {
  order: OrderView;
  strings: KitchenStrings;
  locale: string;
  /** Already formatted as `TT.MM.JJJJ - HH:MM:SS` on the restaurant's clock. */
  placedAt: string;
}): string[] {
  const lines: string[] = [`~${strings.documentTitle}`, ""];

  // The stamp line: when it came in on the left, which ticket on the right —
  // the arrangement the kitchen already reads off its own till. A tabbed row
  // now runs left-to-right like the German it carries, so that is simply the
  // order the two are written in.
  const ticket =
    order.dailySeq !== null ? `${order.dailySeq}` : order.orderNumber;
  lines.push(`!${placedAt}\t[ ${ticket} ]`);

  lines.push("--");
  for (const line of order.items) {
    const name = pickLocalized(locale, line.nameAr, line.nameDe);
    // No price column here, so the dish and its count get the whole width.
    lines.push(`!${name} [${line.quantity}]`);
    // The request for this dish, indented under it — the reason the slip exists.
    if (line.note) lines.push(`! * ${line.note}`);
  }

  // The order-level note from the checkout page is deliberately absent: it is
  // the customer's message about the delivery ("please ring the bell"), not an
  // instruction for the pan, and it already prints on their copy.

  lines.push("--", `~${KITCHEN_FOOTER}`);
  for (let i = 0; i < CUT_FEED_LINES; i += 1) lines.push("");

  return lines;
}
