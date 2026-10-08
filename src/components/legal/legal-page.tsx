import { getLocale, getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getSettings } from "@/lib/data/settings";
import { pickLocalized } from "@/lib/localized";
import type { SettingsView } from "@/lib/schemas/settings";

type LegalKey = "terms" | "privacy" | "allergens";

const FIELDS: Record<LegalKey, [keyof SettingsView, keyof SettingsView]> = {
  terms: ["termsAr", "termsDe"],
  privacy: ["privacyAr", "privacyDe"],
  allergens: ["allergensAr", "allergensDe"],
};

/**
 * Renders one of the three legal pages. The body text lives in the settings
 * row, so the manager edits it from the dashboard rather than in code.
 */
export async function LegalPage({ page }: { page: LegalKey }) {
  const [settings, t, locale] = await Promise.all([
    getSettings(),
    getTranslations("legal"),
    getLocale(),
  ]);

  const [arField, deField] = FIELDS[page];
  const body = pickLocalized(
    locale,
    settings[arField] as string | undefined,
    settings[deField] as string | undefined,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="mb-6 flex items-center gap-3 text-3xl font-extrabold">
        <FileText className="size-7 text-primary" aria-hidden />
        {t(page)}
      </h1>

      <Card className="p-6 sm:p-8">
        {body ? (
          // Plain text from the dashboard: rendered with preserved line breaks
          // rather than as HTML, so nothing the manager pastes can inject markup.
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {body}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("emptyNotice")}
          </p>
        )}
      </Card>
    </div>
  );
}
