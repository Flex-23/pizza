import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Authenticates the restaurant PC's print agent.
 *
 * The agent has no session — it is a script on a machine somewhere else — so it
 * carries `PRINT_AGENT_TOKEN` as a bearer token. An unset token means the print
 * bridge was never configured, and the endpoints must then behave as if they do
 * not exist rather than as if they need no key.
 */
export function isPrintAgent(request: Request): boolean {
  const expected = env.PRINT_AGENT_TOKEN;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;

  const provided = Buffer.from(match[1]);
  const wanted = Buffer.from(expected);

  // Compare in constant time — the token is a password, and length alone must
  // not be readable from how quickly a guess is rejected.
  if (provided.length !== wanted.length) return false;

  return timingSafeEqual(provided, wanted);
}
