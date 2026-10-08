"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PUBLIC_LOCALES, localeMeta, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale";

export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const activeLocale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // With a single public language there is nothing to switch between (Arabic is
  // reserved for the master panel). The control returns once English lands.
  if (PUBLIC_LOCALES.length < 2) return null;

  function handleSelect(locale: Locale) {
    startTransition(async () => {
      await setUserLocale(locale);
      // The cookie decides `dir` and `lang` on <html>, so the whole tree re-renders.
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full"
            aria-label={t("language")}
            disabled={isPending}
          />
        }
      >
        <Globe className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {/* The label is a group label, so it has to live inside the radio group. */}
        <DropdownMenuRadioGroup
          value={activeLocale}
          onValueChange={(value) => handleSelect(value as Locale)}
        >
          <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
          {PUBLIC_LOCALES.map((locale) => (
            <DropdownMenuRadioItem
              key={locale}
              value={locale}
              closeOnClick
              className="*:data-[slot=dropdown-menu-radio-item-indicator]:text-primary"
            >
              {localeMeta[locale].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
