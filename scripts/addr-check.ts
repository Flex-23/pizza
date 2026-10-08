import { createScriptClient } from "./_client";

async function main() {
  const db = createScriptClient();
  const users = await db.user.findMany({
    select: { id: true, email: true, role: true, phone: true },
  });
  const addresses = await db.address.findMany({
    select: { userId: true, street: true, postalCode: true, city: true, isDefault: true },
  });

  console.log("users:", users.length);
  for (const u of users) {
    const mine = addresses.filter((a) => a.userId === u.id);
    console.log(` - ${u.email} [${u.role}] phone=${u.phone ?? "-"} addresses=${mine.length}`);
    for (const a of mine) {
      console.log(`     ${a.street} / ${a.postalCode} ${a.city} default=${a.isDefault}`);
    }
  }
  console.log("total addresses:", addresses.length);
}

main();
