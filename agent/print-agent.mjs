/**
 * Pizza Day & Night — receipt print agent.
 *
 * Runs on the restaurant's PC, the machine the XP-80C is plugged into. The
 * website itself is hosted elsewhere and has no printer, so this script is the
 * last metre: it asks the site every few seconds whether a receipt is waiting,
 * prints whatever comes back with `print-receipt.ps1`, and reports the result.
 *
 * Deliberately dependency-free and single-file: it is copied onto a restaurant
 * computer and started by a shortcut, so `npm install` must never be part of
 * running it. Node 20+ (for the built-in `fetch`) is the only requirement.
 *
 *   node print-agent.mjs
 *
 * Configuration lives in `config.json` next to this file — see config.example.json.
 */

import { spawn } from "node:child_process";
import { appendFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRINT_SCRIPT = path.join(HERE, "print-receipt.ps1");

/** A print job that hangs must not stall the queue behind it. */
const PRINT_TIMEOUT_MS = 20_000;
/** Long enough that a slow site cannot look like a failure. */
const FETCH_TIMEOUT_MS = 15_000;
/** After a network error, back off to this before trying again. */
const ERROR_BACKOFF_MS = 30_000;

/**
 * How long to leave a receipt alone after it fails to print, per consecutive
 * failure, capped at the last value.
 *
 * A printer that is off stays off for minutes, not seconds: without this the
 * agent would retry the same receipt every poll, filling the window with the
 * same error and writing to the database several times a second. The receipt is
 * never dropped — only slowed down — and the first retry is quick because the
 * common case is someone putting a new roll in.
 */
const RETRY_BACKOFF_MS = [10_000, 30_000, 60_000, 300_000];

/**
 * Everything printed to the window is also appended here.
 *
 * Started from Task Scheduler the agent has no window at all, so this file is
 * the only way to answer "did it print, and if not why". Kept next to the agent
 * so the restaurant can find it without being told a path.
 */
const LOG_FILE = path.join(HERE, "agent.log");
/** Truncate past this so an agent left running for a year cannot fill the disk. */
const LOG_MAX_BYTES = 1_000_000;

function appendLog(line) {
  try {
    if (statSync(LOG_FILE, { throwIfNoEntry: false })?.size > LOG_MAX_BYTES) {
      // Keep the most recent half rather than deleting the lot: whatever went
      // wrong is usually near the end.
      const kept = readFileSync(LOG_FILE, "utf8").slice(-LOG_MAX_BYTES / 2);
      writeFileSync(LOG_FILE, `--- trimmed ---\n${kept}`);
    }

    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // A missing or locked log must never stop receipts printing.
  }
}

const stamp = () => new Date().toLocaleString();

const log = (message) => {
  const line = `[${stamp()}] ${message}`;
  console.log(line);
  appendLog(line);
};

const warn = (message) => {
  const line = `[${stamp()}] ${message}`;
  console.error(line);
  appendLog(line);
};

async function loadConfig() {
  const file = path.join(HERE, "config.json");
  let raw;

  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new Error(
      `config.json not found next to the agent.\n` +
        `Copy config.example.json to config.json and fill it in.`,
    );
  }

  const config = JSON.parse(raw);

  for (const key of ["siteUrl", "token"]) {
    if (!config[key]) throw new Error(`config.json: "${key}" is missing.`);
  }

  return {
    siteUrl: String(config.siteUrl).replace(/\/+$/, ""),
    token: String(config.token),
    /** Printer by name; empty means whatever Windows has set as default. */
    printerName: config.printerName ? String(config.printerName) : "",
    pollMs: Number(config.pollMs) > 0 ? Number(config.pollMs) : 3000,
    /**
     * Set to a file path to check the setup without paper: receipts are drawn
     * to that file instead of the printer, through the very same code, so a
     * successful run proves the whole chain up to the print spooler. Leave it
     * unset in normal operation — nothing comes out of the printer while it is
     * on. See section 5 of README.md.
     */
    testOutputFile: config.testOutputFile ? String(config.testOutputFile) : "",
  };
}

/** One authenticated call to the site, with a timeout so a hung socket cannot
 * wedge the loop for ever. */
async function callSite(config, endpoint, init = {}) {
  const response = await fetch(`${config.siteUrl}/api/print/${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (response.status === 404) {
    // The endpoints answer 404 when the token is wrong or PRINT_AGENT_TOKEN is
    // unset on the server — both are configuration, not a passing glitch.
    throw new Error(
      "the site rejected the token (check `token` here and PRINT_AGENT_TOKEN on the server)",
    );
  }

  if (!response.ok) {
    throw new Error(`${endpoint} returned HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Prints one document — one roll's worth, cut at the end.
 *
 * The lines and the QR images arrive already rendered by the server; all that
 * happens here is writing them into a temp directory, pointing the `IMG`
 * directives at their local paths, and handing the file to the PowerShell
 * script — which is byte-for-byte the one the app used when the site ran on
 * this same machine, so the receipt looks exactly as it always did.
 */
async function printDocument(lines, job, config, name) {
  const directory = await mkdtemp(path.join(tmpdir(), "pdn-receipt-"));
  const file = path.join(directory, `${name}.txt`);

  try {
    for (const image of job.images ?? []) {
      await writeFile(
        path.join(directory, image.name),
        Buffer.from(image.base64, "base64"),
      );
    }

    // `IMG<TAB>mm<TAB>name` → `IMG<TAB>mm<TAB>absolute path`.
    const resolved = lines.map((line) => {
      if (!line.startsWith("IMG\t")) return line;
      const [directive, mm, imageName] = line.split("\t");
      return `${directive}\t${mm}\t${path.join(directory, imageName)}`;
    });

    // A BOM makes Windows tooling read the file as UTF-8 without guessing.
    await writeFile(file, `﻿${resolved.join("\r\n")}\r\n`, "utf8");

    const args = [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      PRINT_SCRIPT,
      "-Path",
      file,
      "-WidthMm",
      String(job.widthMm),
    ];

    if (config.printerName) args.push("-PrinterName", config.printerName);
    if (config.testOutputFile) args.push("-OutputFile", config.testOutputFile);

    const result = await run("powershell.exe", args);

    if (result.code !== 0) {
      return {
        ok: false,
        detail: (result.stderr || result.stdout || "").trim().slice(0, 400),
      };
    }

    const printed = /printed:(.+)/.exec(result.stdout);

    return {
      ok: true,
      printer: printed?.[1]?.trim() || config.printerName || "default",
    };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Prints one order: the customer's copy, then the kitchen slip.
 *
 * Two separate print jobs rather than one long document, because two jobs mean
 * two guaranteed cuts — a single document would leave the two slips joined
 * unless the driver happens to cut between pages.
 *
 * `kitchenLines` is optional on purpose: a server that predates the kitchen slip
 * simply does not send it, and this agent then behaves exactly as it used to.
 * The kitchen slip is also never allowed to fail the order — the customer's copy
 * is the one the receipt state tracks, so a jam while printing the second slip
 * is logged and left there rather than re-queueing an order that already
 * printed.
 */
async function printJob(job, config) {
  const receipt = await printDocument(job.lines, job, config, "receipt");
  if (!receipt.ok) return receipt;

  if (job.kitchenLines?.length) {
    const kitchen = await printDocument(
      job.kitchenLines,
      job,
      config,
      "kitchen",
    );
    if (!kitchen.ok) {
      warn(
        `  ${job.orderNumber}: the customer receipt printed but the kitchen slip did not` +
          ` — ${firstLine(kitchen.detail)}`,
      );
    }
  }

  return receipt;
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));

    // A printer that is off or waiting on a dialog must not hold the queue open
    // for ever; the job is abandoned and reported, and the order stays pending.
    const timer = setTimeout(() => {
      child.kill();
      resolve({
        code: 1,
        stdout,
        stderr: `${stderr}\nTimed out after ${PRINT_TIMEOUT_MS} ms`,
      });
    }, PRINT_TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * PowerShell reports a failure as a message followed by its own stack trace,
 * which is pages of noise on a restaurant's screen. The first line is the part
 * that says what to fix.
 */
function firstLine(detail) {
  return (detail ?? "").split(/\r?\n/, 1)[0].trim() || "unknown error";
}

/**
 * Receipts that have failed, and when they may be tried again.
 *
 * Held in memory rather than on the server: it is this machine's printer that
 * is misbehaving, and a restart of the agent is exactly the moment to try
 * everything once more.
 */
const failures = new Map();

/** Drains whatever is waiting. Returns how many receipts were printed. */
async function drainQueue(config) {
  const { jobs } = await callSite(config, "queue");
  if (!jobs?.length) return 0;

  const now = Date.now();
  const due = jobs.filter((job) => (failures.get(job.orderId)?.nextTry ?? 0) <= now);

  if (due.length === 0) return 0;

  log(`${due.length} receipt(s) waiting.`);

  let printed = 0;

  for (const job of due) {
    const result = await printJob(job, config);

    // Acknowledge before moving on: a receipt reported as printed is one that
    // really came out, and a failure leaves the order queued for the next pass
    // rather than dropping it.
    await callSite(config, "ack", {
      method: "POST",
      body: JSON.stringify(
        result.ok
          ? { ok: true, orderId: job.orderId, printer: result.printer }
          : { ok: false, orderId: job.orderId, detail: firstLine(result.detail) },
      ),
    });

    if (result.ok) {
      printed += 1;
      failures.delete(job.orderId);
      log(`✓ ${job.orderNumber} printed on ${result.printer}`);
      continue;
    }

    const attempt = (failures.get(job.orderId)?.attempt ?? 0) + 1;
    const wait = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];

    failures.set(job.orderId, { attempt, nextTry: Date.now() + wait });

    warn(
      `✗ ${job.orderNumber} failed: ${firstLine(result.detail)}` +
        ` — retrying in ${Math.round(wait / 1000)}s (attempt ${attempt})`,
    );
  }

  return printed;
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error(
      `The print agent needs Windows (it drives the printer through PowerShell); this is ${process.platform}.`,
    );
  }

  const config = await loadConfig();

  log(`Print agent started.`);
  log(`  site:    ${config.siteUrl}`);
  log(`  printer: ${config.printerName || "Windows default"}`);
  log(`  polling: every ${config.pollMs} ms`);

  if (config.testOutputFile) {
    warn(`  TEST MODE — receipts go to ${config.testOutputFile}, NOT to paper.`);
    warn(`  Remove "testOutputFile" from config.json to print for real.`);
  }

  // Only the first failure of a run is logged in full: the restaurant's
  // internet dropping for an hour should not fill the window with the same
  // line, but the recovery must be visible.
  let quiet = false;

  for (;;) {
    let wait = config.pollMs;

    try {
      await drainQueue(config);

      if (quiet) {
        log("Connection to the site is back.");
        quiet = false;
      }
    } catch (error) {
      if (!quiet) {
        warn(`Cannot reach the site: ${error instanceof Error ? error.message : error}`);
        warn(`Retrying quietly every ${ERROR_BACKOFF_MS / 1000}s — receipts are not lost.`);
        quiet = true;
      }
      wait = ERROR_BACKOFF_MS;
    }

    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

main().catch((error) => {
  warn(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
