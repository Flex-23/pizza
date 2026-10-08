import "server-only";

import { env } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import type { OrderLine } from "@/lib/schemas/order";

/**
 * Optional "new order" ping for the restaurant.
 *
 * Both channels are off unless NOTIFY_WHATSAPP / NOTIFY_EMAIL are set, and a
 * failure here must never fail the customer's order — the order row is already
 * committed by the time this runs.
 */
export type NewOrderNotification = {
  orderNumber: string;
  customerName: string;
  phone: string;
  total: number;
  items: OrderLine[];
  orderType: "DELIVERY" | "PICKUP";
  address?: string;
};

export function buildOrderMessage(order: NewOrderNotification): string {
  const lines = order.items
    .map((line) => `• ${line.quantity}× ${line.nameDe || line.nameAr}`)
    .join("\n");

  return [
    `Neue Bestellung ${order.orderNumber}`,
    `${order.customerName} — ${order.phone}`,
    order.orderType === "DELIVERY" && order.address
      ? `Lieferung: ${order.address}`
      : "Abholung",
    "",
    lines,
    "",
    `Gesamt: ${formatPrice(order.total)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** A click-to-send WhatsApp link the manager can open from the dashboard. */
export function whatsappLink(order: NewOrderNotification): string | null {
  if (!env.NOTIFY_WHATSAPP) return null;

  const number = env.NOTIFY_WHATSAPP.replace(/\D/g, "");
  if (!number) return null;

  return `https://wa.me/${number}?text=${encodeURIComponent(buildOrderMessage(order))}`;
}

export async function notifyNewOrder(
  order: NewOrderNotification,
): Promise<void> {
  if (!env.NOTIFY_WHATSAPP && !env.NOTIFY_EMAIL) return;

  try {
    // Wire an email/WhatsApp provider here. Until one is configured the order
    // is simply recorded in the server log so nothing is silently lost.
    console.info("[new-order]", buildOrderMessage(order));
  } catch (error) {
    console.error("[new-order] notification failed", error);
  }
}
