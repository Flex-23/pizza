/**
 * First-run bootstrap.
 *
 *   npm run create:admin
 *
 * Creates (or updates) the manager account from ADMIN_EMAIL / ADMIN_PASSWORD in
 * .env.local, and fills the settings row with the restaurant's real details the
 * first time it runs. Safe to run repeatedly.
 *
 * It deliberately creates no categories and no menu items — those are entered
 * through the admin dashboard.
 */
import bcrypt from "bcryptjs";

import { createScriptClient, fail, runScript } from "./_client";

const DEFAULT_OPENING_HOURS = [
  { day: "monday", open: "16:45", close: "02:45", isClosed: false },
  { day: "tuesday", open: "16:45", close: "02:45", isClosed: false },
  { day: "wednesday", open: "16:45", close: "02:45", isClosed: false },
  { day: "thursday", open: "16:45", close: "02:45", isClosed: false },
  { day: "friday", open: "16:45", close: "02:45", isClosed: false },
  { day: "saturday", open: "14:45", close: "02:45", isClosed: false },
  { day: "sunday", open: "11:45", close: "01:45", isClosed: false },
  { day: "holiday", open: "12:00", close: "01:45", isClosed: false },
];

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = (process.env.ADMIN_NAME ?? "Manager").trim();

  if (!email || !email.includes("@")) {
    fail("ADMIN_EMAIL is missing or invalid in .env.local");
  }
  if (password.length < 8) {
    fail("ADMIN_PASSWORD must be at least 8 characters long");
  }

  const db = createScriptClient();

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await db.user.upsert({
      where: { email },
      update: { passwordHash, role: "ADMIN", name },
      create: { email, passwordHash, role: "ADMIN", name },
    });

    console.log(`✔ Admin account ready: ${admin.email}`);

    const existingSettings = await db.settings.findUnique({
      where: { id: "default" },
    });

    if (existingSettings) {
      console.log("• Settings row already exists — left untouched.");
    } else {
      await db.settings.create({
        data: {
          id: "default",
          isOpen: true,
          restaurantNameAr: "بيتزا داي أند نايت",
          restaurantNameDe: "Pizza Day & Night",
          street: "Hardtstraße 32",
          postalCode: "76185",
          city: "Karlsruhe",
          phone: "0721 8601726",
          phone2: "0721 8601836",
          fax: "0721 8601691",
          facebookUrl: "https://www.facebook.com/daynightkarlsruhe",
          minOrderValue: 10,
          deliveryFee: 1.5,
          openingHours: DEFAULT_OPENING_HOURS,
        },
      });
      console.log("✔ Settings row created with the restaurant's real details.");
    }

    console.log("\nNext step: sign in at /manage-9f3a/login and add your categories and dishes.\n");
  } finally {
    await db.$disconnect();
  }
}

void runScript(main);
