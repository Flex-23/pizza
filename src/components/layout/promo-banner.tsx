import { getLocale } from "next-intl/server";
import { Sparkles } from "lucide-react";

import { getSettings } from "@/lib/data/settings";
import { pickLocalized } from "@/lib/localized";

/** Admin-managed strip above the header. Renders nothing until it is filled in. */
export async function PromoBanner() {
  const [settings, locale] = await Promise.all([getSettings(), getLocale()]);

  if (!settings.promoBannerEnabled) return null;

  const text = pickLocalized(
    locale,
    settings.promoBannerAr,
    settings.promoBannerDe,
  );
  if (!text) return null;

  return (
    <div className="bg-primary text-primary-foreground">
      <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold">
        <Sparkles className="size-4 shrink-0" aria-hidden />
        {text}
      </p>
    </div>
  );
}
