/**
 * Optional convenience script:
 *
 *   npm run seed:categories
 *
 * Inserts the restaurant's real category list so the manager does not have to
 * type all 24 by hand before adding dishes. Categories only — no menu items,
 * no prices, no mock data. Skips any slug that already exists, so re-running it
 * never duplicates or overwrites edits made in the dashboard.
 *
 * Delete this file if you would rather create every category from the UI.
 */
import { createScriptClient, runScript } from "./_client";

const CATEGORIES: Array<{ slug: string; nameAr: string; nameDe: string }> = [
  { slug: "angebote", nameAr: "العروض", nameDe: "Angebote" },
  { slug: "pizza", nameAr: "بيتزا", nameDe: "Pizza" },
  { slug: "salate", nameAr: "سلطات", nameDe: "Salate" },
  { slug: "calzone", nameAr: "كالزوني", nameDe: "Calzone" },
  { slug: "pizzabroetchen", nameAr: "خبز البيتزا", nameDe: "Pizzabrötchen" },
  { slug: "flammkuchen", nameAr: "فلامكوخن", nameDe: "Flammkuchen" },
  { slug: "pasta", nameAr: "باستا", nameDe: "Pasta" },
  { slug: "al-forno", nameAr: "أطباق الفرن", nameDe: "Al Forno" },
  { slug: "schnitzel", nameAr: "شنيتزل", nameDe: "Schnitzel" },
  { slug: "steaks", nameAr: "ستيك", nameDe: "Steaks" },
  { slug: "gyros", nameAr: "جيروس", nameDe: "Gyros" },
  { slug: "ente", nameAr: "أطباق البط", nameDe: "Entengerichte" },
  { slug: "fisch", nameAr: "أسماك", nameDe: "Fischgerichte" },
  { slug: "bratnudeln", nameAr: "نودلز مقلي", nameDe: "Bratnudeln" },
  { slug: "reis", nameAr: "أطباق الأرز", nameDe: "Reisgerichte" },
  { slug: "indisch", nameAr: "أطباق هندية", nameDe: "Indische Gerichte" },
  { slug: "burritos", nameAr: "بوريتو", nameDe: "Burritos" },
  { slug: "snacks", nameAr: "وجبات خفيفة", nameDe: "Snacks" },
  { slug: "burger", nameAr: "برغر", nameDe: "Burger" },
  { slug: "burger-menues", nameAr: "وجبات البرغر", nameDe: "Burger-Menüs" },
  { slug: "saucen", nameAr: "الصلصات", nameDe: "Saucen" },
  { slug: "beilagen", nameAr: "المقبلات الجانبية", nameDe: "Beilagen" },
  { slug: "dessert-eis", nameAr: "حلويات وآيس كريم", nameDe: "Dessert & Eis" },
  { slug: "getraenke", nameAr: "مشروبات", nameDe: "Getränke" },
];

async function main() {
  const db = createScriptClient();

  try {
    let created = 0;
    let skipped = 0;

    for (const [index, category] of CATEGORIES.entries()) {
      const existing = await db.category.findUnique({
        where: { slug: category.slug },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      await db.category.create({
        data: {
          slug: category.slug,
          nameAr: category.nameAr,
          nameDe: category.nameDe,
          sortOrder: (index + 1) * 10,
          isActive: true,
        },
      });
      created += 1;
    }

    console.log(`✔ Categories created: ${created}, already present: ${skipped}`);
    console.log("\nNow add dishes from the dashboard — no menu item is ever seeded.\n");
  } finally {
    await db.$disconnect();
  }
}

void runScript(main);
