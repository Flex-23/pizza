/**
 * Renders every app icon from one source SVG.
 *
 * Next.js picks up `src/app/icon.png` and `src/app/apple-icon.png` by file
 * convention and writes the `<link rel="icon">` tags itself, so the only thing
 * that has to be right is the pixels. `favicon.ico` stays alongside them for
 * the browsers (and Google's crawler) that still ask for `/favicon.ico` at the
 * root before reading any HTML.
 *
 * Committed as generated files rather than built during `next build`: the
 * deployment host installs production dependencies only, and sharp is a
 * dev-time tool here. Re-run after editing the SVG:
 *
 *   node scripts/generate-icons.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const SOURCE = path.join(HERE, "assets", "pizza-icon.svg");
const APP_DIR = path.join(ROOT, "src", "app");
const PUBLIC_DIR = path.join(ROOT, "public");

/** The sizes packed into favicon.ico, smallest first. */
const ICO_SIZES = [16, 32, 48];

function render(size) {
  // `density` is what stops the SVG being rasterised at its nominal 512px and
  // then resampled — it tells librsvg to draw at the target size directly.
  return sharp(SOURCE, { density: (size / 512) * 96 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * A minimal ICO container around PNG frames.
 *
 * The format allows a PNG payload per frame (Vista onward, which is every
 * browser that matters here), so each entry is just the PNG bytes with a
 * 16-byte directory record pointing at them — no BMP encoding to hand-roll,
 * and no dependency to pull in for one file written once.
 */
function buildIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  const directory = Buffer.alloc(16 * frames.length);
  let offset = header.length + directory.length;

  frames.forEach((frame, index) => {
    const entry = 16 * index;
    // 256 is stored as 0; every size here is smaller, but keep the rule honest.
    directory.writeUInt8(frame.size >= 256 ? 0 : frame.size, entry);
    directory.writeUInt8(frame.size >= 256 ? 0 : frame.size, entry + 1);
    directory.writeUInt8(0, entry + 2); // palette colours (0 = truecolour)
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(frame.data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += frame.data.length;
  });

  return Buffer.concat([
    header,
    directory,
    ...frames.map((frame) => frame.data),
  ]);
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });

  const icoFrames = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, data: await render(size) })),
  );

  const outputs = [
    [path.join(APP_DIR, "favicon.ico"), buildIco(icoFrames)],
    // Google's result listing wants a square icon of at least 48px that is a
    // multiple of 48; 192 is the safe, widely-recommended size and doubles as
    // the PWA icon.
    [path.join(APP_DIR, "icon.png"), await render(192)],
    // iOS composites onto its own background and ignores transparency, which
    // is why the source carries an opaque plate of its own.
    [path.join(APP_DIR, "apple-icon.png"), await render(180)],
    // Served from the root for anything that asks for the file by path rather
    // than reading the tags — some crawlers and link unfurlers still do.
    [path.join(PUBLIC_DIR, "icon-512.png"), await render(512)],
  ];

  for (const [file, data] of outputs) {
    await writeFile(file, data);
    console.log(`  ${path.relative(ROOT, file)}  (${data.length} bytes)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
