/**
 * Creates (or resets) the owner's MASTER account.
 *
 *   npm run create:master
 *
 * Reads MASTER_EMAIL / MASTER_PASSWORD / MASTER_NAME from .env.local. Safe to
 * run repeatedly: the same e-mail is updated in place, which is also how a
 * forgotten master password gets reset.
 *
 * MASTER is the owner: the whole dashboard, and the only role the hidden login
 * page lets through. A day-to-day manager is an ADMIN instead — appoint one
 * from the dashboard's staff page, or with `npm run set:role`.
 */
import bcrypt from "bcryptjs";

import { createScriptClient, fail, runScript } from "./_client";

async function main() {
  const email = (process.env.MASTER_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.MASTER_PASSWORD ?? "";
  const name = (process.env.MASTER_NAME ?? "Master").trim();

  if (!email || !email.includes("@")) {
    fail("MASTER_EMAIL is missing or invalid in .env.local");
  }
  if (password.length < 8) {
    fail("MASTER_PASSWORD must be at least 8 characters long");
  }

  const db = createScriptClient();

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const master = await db.user.upsert({
      where: { email },
      update: { passwordHash, role: "MASTER", name },
      create: { email, passwordHash, role: "MASTER", name },
    });

    console.log(`✔ Master account ready: ${master.email}`);

    const masters = await db.user.count({ where: { role: "MASTER" } });
    console.log(`• MASTER accounts in the database: ${masters}`);
    console.log(
      "\nSign in at /manage-9f3a/login — that door accepts MASTER only.\n",
    );
  } finally {
    await db.$disconnect();
  }
}

void runScript(main);
