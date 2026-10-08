/**
 * Test print — checks the receipt printer without going through the dashboard.
 *
 *   npm run print:test                     ← newest order, real printer
 *   npm run print:test -- 250822-4F7K      ← that order, real printer
 *   npm run print:test -- --png out.png    ← no paper: an image of the receipt
 *   npm run print:test -- --pdf out.bin    ← no paper: the raw printer job
 *
 * Prints through the same PowerShell script and the same receipt builder the
 * dashboard uses, so a receipt that comes out right here comes out right there.
 * Use it after connecting the printer, or when the manager reports a failure.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createScriptClient, fail, runScript } from "./_client";
import { buildReceiptLines } from "../src/lib/printing/receipt";
import { materializeReceiptQr } from "../src/lib/printing/qr-image";
import { toNumber } from "../src/lib/money";
import { orderLinesSchema } from "../src/lib/schemas/order";
import type { OrderView } from "../src/lib/schemas/order";
import type { SettingsView } from "../src/lib/schemas/settings";

async function main() {
  const args = process.argv.slice(2);
  const pdfIndex = args.indexOf("--pdf");
  const pngIndex = args.indexOf("--png");
  const outputFile =
    pdfIndex >= 0 ? path.resolve(args[pdfIndex + 1] ?? "receipt.pdf") : "";
  const preview =
    pngIndex >= 0 ? path.resolve(args[pngIndex + 1] ?? "receipt.png") : "";
  const consumed = [args[pdfIndex + 1], args[pngIndex + 1]];
  const orderNumber = args.find(
    (arg) => !arg.startsWith("--") && !consumed.includes(arg),
  );

  const db = createScriptClient();

  try {
    const row = orderNumber
      ? await db.order.findUnique({ where: { orderNumber } })
      : await db.order.findFirst({ orderBy: { createdAt: "desc" } });

    if (!row) {
      fail(
        orderNumber
          ? `No order with the number ${orderNumber}.`
          : "There are no orders yet — place one first, or pass an order number.",
      );
    }

    const settingsRow = await db.settings.findUnique({
      where: { id: "default" },
    });
    if (!settingsRow)
      fail("The settings row is missing — run npm run create:admin.");

    const items = orderLinesSchema.safeParse(
      typeof row.items === "string" ? JSON.parse(row.items) : row.items,
    );

    const order = {
      ...row,
      items: items.success ? items.data : [],
      subtotal: toNumber(row.subtotal),
      deliveryFee: toNumber(row.deliveryFee),
      discountTotal: toNumber(row.discountTotal),
      total: toNumber(row.total),
      createdAt: row.createdAt.toISOString(),
    } as unknown as OrderView;

    const settings = {
      ...settingsRow,
      minOrderValue: toNumber(settingsRow.minOrderValue),
      deliveryFee: toNumber(settingsRow.deliveryFee),
    } as unknown as SettingsView;

    const lines = buildReceiptLines({
      order,
      settings,
      locale: "de",
      placedAt: row.createdAt.toLocaleString("de", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      strings: {
        documentTitle: "Lieferschein",
        orderNumber: "Bestellnr.",
        dailySeq: "Tagesnummer",
        time: "Zeit",
        customer: "Kunde",
        phone: "Telefon",
        address: "Adresse",
        orderType: order.orderType === "DELIVERY" ? "Lieferung" : "Abholung",
        subtotal: "Zwischensumme",
        discount: "Rabatt",
        deliveryFee: "Liefergebühr",
        total: "Gesamt",
        paymentMethod: "Barzahlung bei Erhalt",
        notes: "Hinweise",
        disclaimer: "- Dies ist keine Rechnung -",
      },
    });

    console.log(lines.join("\n"));
    console.log("\n— sending to printer —\n");

    // The QR directives become PNGs beside the receipt file, exactly as the
    // dashboard's printer does, so the test exercises the same path.
    const dir = mkdtempSync(path.join(tmpdir(), "pdn-test-receipt-"));
    const resolved = await materializeReceiptQr(lines, dir);
    const file = path.join(dir, "receipt.txt");
    writeFileSync(file, `﻿${resolved.join("\r\n")}\r\n`, "utf8");

    const scriptArgs = [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      // The script lives with the agent that ships to the restaurant's PC —
      // one copy, so a layout fix proved out here is the one that prints there.
      path.join(process.cwd(), "agent", "print-receipt.ps1"),
      "-Path",
      file,
    ];

    if (process.env.RECEIPT_PRINTER) {
      scriptArgs.push("-PrinterName", process.env.RECEIPT_PRINTER);
    }
    scriptArgs.push("-WidthMm", String(settingsRow.receiptWidthMm ?? 58));
    if (outputFile) scriptArgs.push("-OutputFile", outputFile);
    if (preview) scriptArgs.push("-Preview", preview);

    const code = await new Promise<number>((resolve) => {
      const child = spawn("powershell.exe", scriptArgs, { stdio: "inherit" });
      child.on("close", (value) => resolve(value ?? 1));
    });

    if (code !== 0) fail("The print job failed — see the message above.");
    console.log(
      preview
        ? `✔ Preview written to ${preview}`
        : outputFile
          ? `✔ Written to ${outputFile}`
          : "✔ Sent to the printer",
    );
  } finally {
    await db.$disconnect();
  }
}

void runScript(main);
