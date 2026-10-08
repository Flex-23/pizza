/**
 * Password hash generator.
 *
 *   npm run hash:password -- "the password"
 *
 * Prints a bcrypt hash for the `passwordHash` column. A hand-written SQL INSERT
 * needs it because MySQL cannot compute bcrypt itself, and the app never stores
 * a plain password.
 *
 * For the manager account `npm run create:admin` is simpler — it hashes and
 * inserts in one step. Use this when you want to write the row yourself.
 */
import bcrypt from "bcryptjs";

// Same cost factor as src/lib/auth/password.ts, so the hashes are equivalent.
const SALT_ROUNDS = 12;

async function main() {
  const password = process.argv.slice(2).join(" ");

  if (password.length < 8) {
    console.error('\n✖ Usage: npm run hash:password -- "at least 8 characters"\n');
    process.exit(1);
  }

  console.log(await bcrypt.hash(password, SALT_ROUNDS));
}

void main();
