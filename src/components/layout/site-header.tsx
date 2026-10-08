import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Pizza } from "lucide-react";

import { CartSheet } from "@/components/layout/cart-sheet";
import { HistoryNav } from "@/components/layout/history-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { NavLink } from "@/components/layout/nav-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import { adminHomeFor, isStaffRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/settings";
import { pickLocalized } from "@/lib/localized";
import { isAcceptingOrders } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

/**
 * The dashboard link is rendered for staff only, and only inside their own
 * account menu — a customer's page never contains it, so the hidden path is
 * not in the footer, the sitemap, or any markup a customer can read.
 */
export async function SiteHeader() {
  const [settings, user, t, tStatus, locale] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    getTranslations("nav"),
    getTranslations("status"),
    getLocale(),
  ]);

  const canOrder = isAcceptingOrders(settings.isOpen, settings.openingHours);
  const brand = pickLocalized(
    locale,
    settings.restaurantNameAr,
    settings.restaurantNameDe,
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:h-16">
        <MobileNav phone={settings.phone} />

        <HistoryNav direction="back" />

        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Pizza className="size-5" aria-hidden />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-extrabold sm:text-base">{brand}</span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              Karlsruhe
            </span>
          </span>
        </Link>

        <Badge
          variant="secondary"
          className={cn(
            "ms-1 hidden shrink-0 gap-1.5 sm:flex",
            canOrder
              ? "bg-success/12 text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              canOrder ? "bg-success" : "bg-muted-foreground",
            )}
            aria-hidden
          />
          {canOrder ? tStatus("open") : tStatus("closed")}
        </Badge>

        <nav className="mx-auto hidden items-center gap-7 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-0.5 md:ms-0">
          <LanguageSwitcher />
          <ThemeToggle />
          <UserMenu
            user={user ? { name: user.name, email: user.email } : null}
            dashboardHref={
              isStaffRole(user?.role) ? adminHomeFor(user?.role) : undefined
            }
          />
          <CartSheet
            minOrderValue={settings.minOrderValue}
            deliveryFee={settings.deliveryFee}
            freeDeliveryFrom={settings.freeDeliveryFrom}
            canOrder={canOrder}
          />

          <HistoryNav direction="forward" />
        </div>
      </div>
    </header>
  );
}
