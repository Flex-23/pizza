"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { MANAGER_ROUTES, MASTER_ROUTES } from "@/lib/admin-path";
import {
  fail,
  fromZodError,
  ok,
  type ActionResult,
} from "@/lib/actions/result";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getItemsForPricing } from "@/lib/data/menu";
import { generateOrderNumber } from "@/lib/data/orders";
import { findZoneByPostalCode, getSettings } from "@/lib/data/settings";
import { formatPrice, round2 } from "@/lib/money";
import { notifyNewOrder } from "@/lib/notify";
import { rememberOrder } from "@/lib/orders/receipts";
import { allocateShiftNumber } from "@/lib/orders/sequence";
import { isAcceptingOrders } from "@/lib/opening-hours";
import { checkoutSchema, type OrderLine } from "@/lib/schemas/order";

/**
 * Places an order.
 *
 * The browser sends only menu item ids and quantities. Every price, discount,
 * delivery fee and total is recomputed here from the database, so a tampered
 * cart cannot buy a 20 € pizza for 2 €.
 */
export async function placeOrderAction(
  raw: unknown,
): Promise<ActionResult<{ orderNumber: string }>> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const settings = await getSettings();

  if (!isAcceptingOrders(settings.isOpen, settings.openingHours)) {
    return fail("RESTAURANT_CLOSED");
  }

  // The checkout only offers PayPal when the master has switched it on, but the
  // hidden card is not the gate — this re-checks the stored flag so a crafted
  // request cannot place an ONLINE order while PayPal is off (in which case it
  // would be recorded unpaid and never collected).
  if (input.paymentMethod === "ONLINE" && !settings.isPaypalEnabled) {
    return fail("PAYMENT_UNAVAILABLE");
  }

  const ids = [...new Set(input.items.map((line) => line.menuItemId))];
  const priced = await getItemsForPricing(ids);

  const lines: OrderLine[] = [];

  for (const requested of input.items) {
    const item = priced.get(requested.menuItemId);

    // Silently dropping an unavailable dish would surprise the customer at the
    // door, so the whole order is rejected instead.
    if (!item || !item.isAvailable) return fail("NOT_FOUND");

    lines.push({
      menuItemId: item.id,
      nameAr: item.nameAr,
      nameDe: item.nameDe,
      unitPrice: item.finalPrice,
      originalPrice: item.price,
      quantity: requested.quantity,
      imageUrl: item.imageUrl,
      // The note is kept only for a dish the menu says may carry one. The flag
      // is re-read here rather than trusted from the browser, exactly as prices
      // are: otherwise a crafted payload could staple a request onto a dish the
      // master deliberately left fixed.
      note: item.allowCustomNote ? (requested.note ?? null) : null,
    });
  }

  if (lines.length === 0) return fail("VALIDATION");

  const subtotal = round2(
    lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0),
  );
  const listTotal = round2(
    lines.reduce(
      (total, line) => total + line.originalPrice * line.quantity,
      0,
    ),
  );
  const discountTotal = round2(Math.max(0, listTotal - subtotal));

  const isDelivery = input.orderType === "DELIVERY";

  let deliveryFee = 0;
  let minOrder = settings.minOrderValue;

  if (isDelivery) {
    const zone = await findZoneByPostalCode(input.postalCode!);

    // Zones are only enforced once the manager has defined at least one.
    const zones = await db.deliveryZone.count({ where: { isActive: true } });
    if (zones > 0 && !zone) {
      return fail("ZONE_NOT_COVERED", { meta: { code: input.postalCode! } });
    }

    deliveryFee =
      zone && zone.deliveryFee > 0 ? zone.deliveryFee : settings.deliveryFee;
    if (zone && zone.minOrder > 0) minOrder = zone.minOrder;

    if (
      settings.freeDeliveryFrom !== null &&
      subtotal >= settings.freeDeliveryFrom
    ) {
      deliveryFee = 0;
    }
  }

  if (subtotal < minOrder) {
    return fail("BELOW_MINIMUM", { meta: { amount: formatPrice(minOrder) } });
  }

  const total = round2(subtotal + deliveryFee);
  const user = await getCurrentUser();

  const order = await createOrderWithUniqueNumber({
    userId: user?.id ?? null,
    customerName: input.customerName,
    phone: input.phone,
    email: input.email ?? null,
    orderType: input.orderType,
    street: isDelivery ? (input.street ?? null) : null,
    postalCode: isDelivery ? (input.postalCode ?? null) : null,
    city: isDelivery ? (input.city ?? null) : null,
    items: lines,
    subtotal,
    deliveryFee,
    discountTotal,
    total,
    paymentMethod: input.paymentMethod,
    notes: input.notes ?? null,
  });

  // Stamp the customer's last-order time so the inactive-account cleanup job can
  // tell a dormant account from an active one. Internal only — nothing
  // customer-facing reads it. Guest orders carry no user, so there is nothing to
  // stamp for them.
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { lastOrderAt: new Date() },
    });
  }

  // Lets this browser open the confirmation page for a guest order. Awaited
  // because it sets the receipt cookie the confirmation redirect relies on.
  await rememberOrder(order.orderNumber);

  // The "new order" ping is a side effect the customer must never wait on: the
  // order row is already committed, so this is scheduled to run after the
  // response is sent. Once a real email/WhatsApp provider is wired into
  // `notifyNewOrder`, its latency will no longer sit in the checkout round-trip.
  after(() =>
    notifyNewOrder({
      orderNumber: order.orderNumber,
      customerName: input.customerName,
      phone: input.phone,
      total,
      items: lines,
      orderType: input.orderType,
      address: isDelivery
        ? `${input.street}, ${input.postalCode} ${input.city}`
        : undefined,
    }),
  );

  revalidatePath(MANAGER_ROUTES.orders);
  revalidatePath(MASTER_ROUTES.dashboard);
  if (user) revalidatePath("/orders");

  return ok({ orderNumber: order.orderNumber });
}

type NewOrderData = {
  userId: string | null;
  customerName: string;
  phone: string;
  email: string | null;
  orderType: "DELIVERY" | "PICKUP";
  street: string | null;
  postalCode: string | null;
  city: string | null;
  items: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  discountTotal: number;
  total: number;
  paymentMethod: "CASH_ON_DELIVERY" | "CARD_ON_DELIVERY" | "ONLINE";
  notes: string | null;
};

/**
 * Order numbers carry a random suffix, so a collision is unlikely but possible
 * on a busy evening. Retry rather than surface a unique-constraint error.
 */
async function createOrderWithUniqueNumber(data: NewOrderData) {
  // One ticket number per order, reserved once for the shift it lands in — the
  // orderNumber may be retried below, but the shift sequence is not re-drawn.
  const { shiftDate, dailySeq } = await allocateShiftNumber();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = generateOrderNumber();

    const existing = await db.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });
    if (existing) continue;

    try {
      return await db.order.create({
        data: {
          ...data,
          orderNumber,
          shiftDate,
          dailySeq,
          items: data.items,
          // Queue the kitchen ticket the moment the order exists: the print
          // agent on the restaurant's PC prints it within seconds without
          // anyone opening the dashboard. Set here rather than as a column
          // default so the rows that predate the print queue stay unqueued.
          printRequestedAt: new Date(),
        },
        select: { id: true, orderNumber: true },
      });
    } catch (error) {
      // Only a number taken between the check and the insert is worth another
      // attempt; anything else (a dead connection, a bad column) must surface.
      if (!isUniqueViolation(error) || attempt === 4) throw error;
    }
  }

  throw new Error("Could not allocate a unique order number");
}

/** Prisma reports a duplicate key as P2002 whatever the driver underneath. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}
