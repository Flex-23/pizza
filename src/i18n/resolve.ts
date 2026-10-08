import "server-only";

import type { Locale } from "@/i18n/config";
import { getUserLocale } from "@/i18n/locale";
import { hasMasterSession } from "@/lib/auth/session";

/**
 * The effective locale for a request.
 *
 * The master panel is Arabic-only: whenever the owner's dashboard session is
 * present, every message resolves in Arabic (RTL). Everyone else — customers and
 * standard managers — gets the public language (German). Both the request config
 * and the root layout call this, so `<html dir/lang>` and the messages can never
 * disagree. A failure reading the session degrades to the public language rather
 * than breaking the render.
 */
export async function resolveLocale(): Promise<Locale> {
  try {
    if (await hasMasterSession()) return "ar";
  } catch {
    // Fall through to the public language.
  }
  return getUserLocale();
}
