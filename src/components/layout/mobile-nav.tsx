"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Menu, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { localeMeta, type Locale } from "@/i18n/config";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function MobileNav({ phone }: { phone: string }) {
  const t = useTranslations("nav");
  const tContact = useTranslations("contact");
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);

  // The drawer slides in from the same edge the hamburger sits on, which flips
  // with the writing direction.
  const side = localeMeta[locale]?.dir === "rtl" ? "right" : "left";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full md:hidden"
            aria-label={t("openMenu")}
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>

      <SheetContent side={side} className="w-72 p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>{t("openMenu")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("openMenu")}
          </SheetDescription>
        </SheetHeader>

        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-base font-semibold transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border p-4">
          <Button
            className="w-full rounded-full"
            render={<a href={`tel:${phone.replace(/\s/g, "")}`} />}
          >
            <Phone data-icon="inline-start" />
            {tContact("callNow")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
