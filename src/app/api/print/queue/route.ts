import { NextResponse } from "next/server";

import { isPrintAgent } from "@/lib/printing/agent-auth";
import { getPendingPrintJobs } from "@/lib/printing/queue";

/**
 * The receipts waiting for the restaurant's printer.
 *
 * Polled by `agent/print-agent.mjs` on the PC the XP-80C is attached to. Each
 * job arrives fully rendered — finished lines, finished QR images — so the
 * agent only has to write two files and call `print-receipt.ps1`.
 */

// A queue read must never be served from a cache: the whole point is that it
// reflects the orders placed seconds ago.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // 404 rather than 401: an unconfigured or wrongly-keyed bridge should not
  // confirm that a print endpoint is here at all.
  if (!isPrintAgent(request)) return new NextResponse(null, { status: 404 });

  const jobs = await getPendingPrintJobs();

  return NextResponse.json(
    { jobs },
    { headers: { "Cache-Control": "no-store" } },
  );
}
