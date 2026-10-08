import { NextResponse } from "next/server";
import { z } from "zod";

import { isPrintAgent } from "@/lib/printing/agent-auth";
import { markPrintFailed, markPrinted } from "@/lib/printing/queue";

/**
 * The print agent reporting back on one receipt.
 *
 * Acknowledgement is what takes an order out of the queue, so it is a separate
 * call from the poll: a receipt that was fetched but never printed — the PC lost
 * power mid-job — stays pending and comes out when the agent is back.
 */

export const dynamic = "force-dynamic";

const ackSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    orderId: z.string().min(1),
    printer: z.string().default("default"),
  }),
  z.object({
    ok: z.literal(false),
    orderId: z.string().min(1),
    detail: z.string().default("unknown error"),
  }),
]);

export async function POST(request: Request) {
  if (!isPrintAgent(request)) return new NextResponse(null, { status: 404 });

  const parsed = ackSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const ack = parsed.data;

  if (ack.ok) {
    await markPrinted(ack.orderId, ack.printer);
  } else {
    await markPrintFailed(ack.orderId, ack.detail);
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
