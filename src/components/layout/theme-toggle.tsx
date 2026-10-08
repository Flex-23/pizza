"use client";

import { useTheme, type Theme } from "@/lib/theme";
import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsClient } from "@/lib/use-is-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { theme, setTheme } = useTheme();
  // The active theme is unknown until the client has read localStorage.
  const mounted = useIsClient();

  const options = [
    { value: "light", label: t("themeLight"), icon: Sun },
    { value: "dark", label: t("themeDark"), icon: Moon },
    { value: "system", label: t("themeSystem"), icon: Monitor },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full"
            aria-label={t("theme")}
          />
        }
      >
        <Sun className="size-5 dark:hidden" />
        <Moon className="hidden size-5 dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {/* The label is a group label, so it has to live inside the radio group.
            `value` stays null until mounted: the active theme is unknown during
            the server render and would otherwise mismatch on hydration. */}
        <DropdownMenuRadioGroup
          value={mounted ? theme : null}
          onValueChange={(value) => setTheme(value as Theme)}
        >
          <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
          {options.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              closeOnClick
              className="gap-2 *:data-[slot=dropdown-menu-radio-item-indicator]:text-primary"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
