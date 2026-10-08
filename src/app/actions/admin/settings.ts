"use server";

import { revalidatePath } from "next/cache";

import { MANAGER_ROUTES, MASTER_ROUTES } from "@/lib/admin-path";
import { clearable } from "@/lib/actions/clearable";
import {
  fail,
  fromZodError,
  ok,
  type ActionResult,
} from "@/lib/actions/result";
import { assertStaff } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { SETTINGS_ID } from "@/lib/data/settings";
import { settingsSchema } from "@/lib/schemas/settings";

export async function saveSettingsAction(raw: unknown): Promise<ActionResult> {
  const auth = await assertStaff();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { receiptWidthMm, salesUrl, isPaypalEnabled, ...rest } = parsed.data;

  // Owner-only settings: the paper width, the receipt QR link and the PayPal
  // switch. These outlive a shift and change how the business is paid, so they
  // stay with the owner. A manager's form does not show them, and a hand-made
  // request that carries them anyway is ignored rather than trusted — hiding a
  // control is not the same as protecting it. `salesUrl` clears to null when
  // emptied.
  //
  // The opening hours and the home-page gallery deliberately are *not* here.
  // They are what the person running the day actually needs: closing early on a
  // quiet night, or swapping a photo of tonight's special, should not wait on
  // the owner. Both roles may write them, so they ride along in `rest`.
  const masterOnly =
    auth.user.role === "MASTER"
      ? {
          receiptWidthMm,
          salesUrl: salesUrl ?? null,
          isPaypalEnabled,
        }
      : {};

  // The top-bar strip lost its separate switch: it now shows whenever the
  // single top-bar text is filled in, so derive the stored flag from the text.
  const withPromoFlag = {
    ...rest,
    promoBannerEnabled: Boolean((rest.promoBannerDe ?? "").trim()),
  };

  const data = clearable(withPromoFlag, [
    "promoBannerAr",
    "promoBannerDe",
    "phone2",
    "fax",
    "email",
    "facebookUrl",
    "mapEmbedUrl",
    "termsAr",
    "termsDe",
    "privacyAr",
    "privacyDe",
    "allergensAr",
    "allergensDe",
  ]);

  await db.settings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      ...data,
      ...masterOnly,
    },
    update: { ...data, ...masterOnly },
  });

  // Hours, prices and the open/closed switch appear in the header on every page.
  revalidatePath("/", "layout");
  // Settings is one page under two bases; both caches have to go.
  revalidatePath(MASTER_ROUTES.settings);
  revalidatePath(MANAGER_ROUTES.settings);

  return ok();
}

/** Fast toggle used by the dashboard's open/closed switch. */
