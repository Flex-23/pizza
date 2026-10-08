"use server";

import {
  fail,
  fromZodError,
  ok,
  type ActionResult,
} from "@/lib/actions/result";
import { assertStaff } from "@/lib/auth/guards";
import { getOrderById } from "@/lib/data/orders";
import { requestPrint } from "@/lib/printing/queue";
import { idSchema } from "@/lib/schemas/common";

/**
 * Sends one receipt to the restaurant's printer.
 *
 * The printer is attached to the restaurant's PC, which is no longer the
 * machine serving this request, so the receipt is queued rather than printed
 * here: `agent/print-agent.mjs` polls every few seconds and prints it. That is
 * why this returns as soon as the order is marked and cannot report which
 * printer it came out on — the paper appears a moment after the click.
 *
 * The same mark is what a new order sets, so the automatic printing of incoming
 * orders and this button are one mechanism rather than two.
 */
export async function printOrderReceiptAction(
  rawId: unknown,
): Promise<ActionResult<null>> {
  const auth = await assertStaff();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) return fromZodError(parsed.error);

  const order = await getOrderById(parsed.data);
  if (!order) return fail("NOT_FOUND");

  await requestPrint(order.id);

  return ok(null);
}
