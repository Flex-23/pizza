import "server-only";

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same time as a real comparison when the account does not
 * exist, so response timing cannot be used to enumerate registered emails.
 */
export async function fakeVerifyDelay(): Promise<void> {
  await bcrypt.compare(
    "dummy-password",
    "$2a$12$C6UzMDM.H6dfI/f/IKcEe.WW6BpFPWQ.hEHGKz9BeC1dNPMlxq7Hy",
  );
}
