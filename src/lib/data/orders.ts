import "server-only";

import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { getBusinessDate } from "@/lib/business-day";
import {
  orderLinesSchema,
  type OrderLine,
  type OrderView,
} from "@/lib/schemas/order";

type OrderRow = {
  id: string;
  orderNumber: string;
  dailySeq: number | null;
  customerName: string;
  phone: string;
  email: string | null;
  orderType: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  items: unknown;
  subtotal: unknown;
  deliveryFee: unknown;
  discountTotal: unknown;
  total: unknown;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: Date;
};

/** The order's item snapshot, however the driver hands the JSON column back. */
export function parseOrderLines(raw: unknown): OrderLine[] {
  const value = typeof raw === "string" ? safeJsonParse(raw) : raw;
  const parsed = orderLinesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function toOrderView(row: OrderRow): OrderView {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    dailySeq: row.dailySeq,
    customerName: row.customerName,
    phone: row.phone,
    email: row.email,
    orderType: row.orderType as OrderView["orderType"],
    street: row.street,
    postalCode: row.postalCode,
    city: row.city,
    items: parseOrderLines(row.items),
    subtotal: toNumber(row.subtotal),
    deliveryFee: toNumber(row.deliveryFee),
    discountTotal: toNumber(row.discountTotal),
    total: toNumber(row.total),
    paymentMethod: row.paymentMethod as OrderView["paymentMethod"],
    paymentStatus: row.paymentStatus as OrderView["paymentStatus"],
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

/** How long a placed order stays visible in the customer's "My Orders" list. */
const CUSTOMER_ORDER_HISTORY_DAYS = 3;

export async function getOrdersForUser(userId: string): Promise<OrderView[]> {
  // Customer-facing history is a rolling 3-day (72-hour) window on placement:
  // older orders drop out of "My Orders" even while the row itself lives on for
  // the kitchen's reports until the retention job purges it.
  const cutoff = new Date(
    Date.now() - CUSTOMER_ORDER_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );

  const orders = await db.order.findMany({
    where: { userId, createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return orders.map(toOrderView);
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<OrderView | null> {
  const order = await db.order.findUnique({ where: { orderNumber } });
  return order ? toOrderView(order) : null;
}

/**
 * The order plus the customer it belongs to. `userId` stays out of `OrderView`
 * itself so it never travels to the browser; the confirmation page needs it
 * only to decide who may read the receipt.
 */
export async function getOrderWithOwner(
  orderNumber: string,
): Promise<{ order: OrderView; userId: string | null } | null> {
  const order = await db.order.findUnique({ where: { orderNumber } });
  if (!order) return null;

  return { order: toOrderView(order), userId: order.userId };
}

export async function getOrderById(id: string): Promise<OrderView | null> {
  const order = await db.order.findUnique({ where: { id } });
  return order ? toOrderView(order) : null;
}

/**
 * The live orders board.
 *
 * Scoped to the shift in progress: the board answers "what is on right now",
 * and at 05:00 the previous night's tickets stop being that. Keying on
 * `shiftDate` rather than a rolling time window is what makes the board go
 * empty *at* the cutoff and stay in step with the ticket numbers, which restart
 * at #1 against the very same key.
 *
 * Nothing is deleted to achieve this — the rows stay exactly where they are and
 * keep appearing in the daily and monthly reports, the master's figures and the
 * customer's own history. Only this one view narrows.
 *
 * A search is the exception: looking up a number or a phone means looking for
 * an order the manager already knows exists, which is usually last night's, so
 * searching deliberately reaches across shifts.
 */
export async function getAdminOrders(filter?: {
  search?: string;
}): Promise<OrderView[]> {
  const search = filter?.search?.trim();

  const orders = await db.order.findMany({
    where: search
      ? {
          OR: [
            { orderNumber: { contains: search } },
            { customerName: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : { shiftDate: getBusinessDate() },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return orders.map(toOrderView);
}

/**
 * Order-number alphabets.
 *
 * The letters drop I and O, and the digits drop 0 and 1: on a thermal receipt
 * and over the phone those four are the pairs that get misread, and an order
 * number exists to be read aloud. That leaves 24 letters and 8 digits.
 */
const NUMBER_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMBER_DIGITS = "23456789";

function pick(alphabet: string): string {
  return alphabet[Math.floor(Math.random() * alphabet.length)];
}

/**
 * A random order number in the form `DLLDLL`, e.g. "4AB8XY".
 *
 * Six characters, unbroken: short enough to read out at the door and to write
 * on a bag by hand. The separators it used to carry were pure decoration —
 * nothing parses this string, it is only ever compared, searched and printed —
 * and they cost two characters on every receipt and every spoken read-back.
 *
 * There is no date in it, so nothing about the number narrows down when it was
 * placed — the keyspace is the whole 8·24²·8·24² ≈ 21 million combinations
 * rather than that many per day. Dropping the dashes does not change that: the
 * same four symbols are drawn from the same alphabets.
 *
 * Collisions are still possible in principle, which is why the caller inserts
 * under a unique constraint and retries (see `placeOrderAction`); at a
 * restaurant's volume a repeat is vanishingly unlikely.
 */
export function generateOrderNumber(): string {
  const letters = () => `${pick(NUMBER_LETTERS)}${pick(NUMBER_LETTERS)}`;
  return `${pick(NUMBER_DIGITS)}${letters()}${pick(NUMBER_DIGITS)}${letters()}`;
}

export async function getDashboardStats() {
  // The same business day the reports and ticket numbers use (05:00 cutoff), so
  // "today" means one thing only — orders taken after midnight still count on
  // the shift in progress rather than flipping the dashboard to zero.
  const today = getBusinessDate();

  const [
    todayOrders,
    todayRevenue,
    totalItems,
    unavailableItems,
    totalCategories,
  ] = await Promise.all([
    db.order.count({ where: { shiftDate: today } }),
    db.order.aggregate({
      where: { shiftDate: today },
      _sum: { total: true },
    }),
    db.menuItem.count(),
    db.menuItem.count({ where: { isAvailable: false } }),
    db.category.count(),
  ]);

  return {
    todayOrders,
    todayRevenue: toNumber(todayRevenue._sum.total),
    totalItems,
    unavailableItems,
    totalCategories,
  };
}
