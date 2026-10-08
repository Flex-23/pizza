import QRCode from "qrcode";
import path from "node:path";

/**
 * The user chose to keep the GDI+ text rendering (which shapes Arabic correctly)
 * and add the QR codes to the same direct print job as images. `buildReceiptLines`
 * therefore emits a `QR` directive rather than an image path:
 *
 *   QR<TAB>widthMm<TAB>errorCorrectionLevel<TAB>url
 *
 * This function turns each such directive into a real PNG on disk and rewrites
 * the line to an `IMG` directive the PowerShell script draws:
 *
 *   IMG<TAB>widthMm<TAB>absolutePngPath
 *
 * The PNGs are written into `dir` (the same temp directory that holds the
 * receipt file), so cleaning up that directory removes them too. Keeping the IO
 * here — out of `receipt.ts` — lets the receipt builder stay pure and testable.
 */

type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

const QR_PREFIX = "QR\t";

/** Roughly 8 dots/mm (~203 dpi thermal head) keeps the code crisp at 1:1. */
const DOTS_PER_MM = 8;

/** `QR<TAB>widthMm<TAB>ecl<TAB>url` — the url itself may contain no tab. */
function parseQrDirective(line: string) {
  const parts = line.split("\t");

  return {
    widthMm: Number(parts[1]) || 32,
    ecl: (parts[2] as ErrorCorrectionLevel) || "M",
    url: parts.slice(3).join("\t"),
  };
}

/** A QR code travelling to the print agent as bytes rather than a file path. */
export type ReceiptImage = { name: string; base64: string };

/**
 * The same rewrite as `materializeReceiptQr`, for the receipts that leave this
 * machine.
 *
 * The print agent runs on the restaurant's PC, so an absolute path produced
 * here would mean nothing to it. Each QR therefore becomes a named blob the
 * agent writes into its own temp directory, and the `IMG` directive carries
 * that *name*; the agent expands it to a local absolute path before handing the
 * file to `print-receipt.ps1`, which is why the script needs no changes at all.
 */
export async function renderReceiptQrToImages(
  lines: string[],
): Promise<{ lines: string[]; images: ReceiptImage[] }> {
  const out: string[] = [];
  const images: ReceiptImage[] = [];

  for (const line of lines) {
    if (!line.startsWith(QR_PREFIX)) {
      out.push(line);
      continue;
    }

    const { widthMm, ecl, url } = parseQrDirective(line);
    const name = `qr-${images.length}.png`;

    const buffer = await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: ecl,
      margin: 1,
      width: Math.round(widthMm * DOTS_PER_MM),
      color: { dark: "#000000", light: "#ffffff" },
    });

    images.push({ name, base64: buffer.toString("base64") });
    out.push(`IMG\t${widthMm}\t${name}`);
  }

  return { lines: out, images };
}

export async function materializeReceiptQr(
  lines: string[],
  dir: string,
): Promise<string[]> {
  const out: string[] = [];
  let count = 0;

  for (const line of lines) {
    if (!line.startsWith(QR_PREFIX)) {
      out.push(line);
      continue;
    }

    const { widthMm, ecl, url } = parseQrDirective(line);

    const pngPath = path.join(dir, `qr-${count++}.png`);
    await QRCode.toFile(pngPath, url, {
      type: "png",
      errorCorrectionLevel: ecl,
      margin: 1,
      width: Math.round(widthMm * DOTS_PER_MM),
      color: { dark: "#000000", light: "#ffffff" },
    });

    out.push(`IMG\t${widthMm}\t${pngPath}`);
  }

  return out;
}
