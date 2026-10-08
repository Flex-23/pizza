/**
 * Grants or removes dashboard access.
 *
 *   npm run set:role -- master owner@example.com     ← full access + hidden login
 *   npm run set:role -- admin  manager@example.com   ← orders + settings only
 *   npm run set:role -- customer someone@example.com ← no dashboard at all
 *
 * The account must already exist: the master designates a manager by role, not
 * by creating one. Registering happens on the public /register page, or with
 * `npm run create:admin` for the very first account.
 */
import { createScriptClient, fail, runScript } from "./_client";

const ROLES = ["master", "admin", "customer"] as const;

type RoleArg = (typeof ROLES)[number];

function isRoleArg(value: string): value is RoleArg {
  return (ROLES as readonly string[]).includes(value);
}

async function main() {
  const [roleArg, emailArg] = process.argv.slice(2);
  const role = (roleArg ?? "").toLowerCase();
  const email = (emailArg ?? "").trim().toLowerCase();

  if (!isRoleArg(role) || !email.includes("@")) {
    fail(
      'Usage: npm run set:role -- <master|admin|customer> "user@example.com"',
    );
  }

  const db = createScriptClient();

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      fail(`No account with the e-mail ${email}. Have them register first.`);
    }

    const updated = await db.user.update({
      where: { email },
      data: { role: role.toUpperCase() as "MASTER" | "ADMIN" | "CUSTOMER" },
    });

    console.log(`✔ ${updated.email} is now ${updated.role}`);

    const masters = await db.user.count({ where: { role: "MASTER" } });
    if (masters === 0) {
      console.log(
        "\n⚠ No MASTER account left. The menu, the delivery zones and the\n" +
          "  hidden login are unreachable until one is designated again.\n",
      );
    }
  } finally {
    await db.$disconnect();
  }
}

void runScript(main);
