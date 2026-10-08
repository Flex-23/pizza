"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  BarChart3,
  ExternalLink,
  LayoutDashboard,
  ListOrdered,
  PackageX,
  LogOut,
  Menu,
  Settings,
  ShapesIcon,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { adminLogoutAction } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
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
import { adminRoutes } from "@/lib/admin-path";
import type { UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  userName: string;
  role: UserRole;
  todayOrderCount: number;
  children: React.ReactNode;
};

/**
 * `key` is the message key of the label, not the route name: `admin.settings`
 * is a whole message group (settings.title, settings.hoursTab, …), and asking
 * next-intl for a group instead of a string throws INSUFFICIENT_PATH.
 *
 * `masterOnly` keeps the manager's sidebar to what they may actually open, and
 * `managerOnly` keeps the shift work — the live order queue — out of the
 * owner's. Both mirror `canOpenAdminPath`, which is what enforces them; this
 * only decides what to draw.
 */
function navFor(role: UserRole) {
  // Each role's links are built from its own base, so the sidebar can never
  // point one role at the other's URL space.
  const r = adminRoutes(role);

  const all = [
    {
      href: r.dashboard,
      key: "dashboard",
      icon: LayoutDashboard,
      masterOnly: true,
    },
    { href: r.orders, key: "orders", icon: ListOrdered, managerOnly: true },
    { href: r.items, key: "items", icon: UtensilsCrossed, masterOnly: true },
    {
      href: r.categories,
      key: "categories",
      icon: ShapesIcon,
      masterOnly: true,
    },
    // Open to both: selling a dish out is shift work, and the owner needs it too.
    { href: r.availability, key: "availabilityNav", icon: PackageX },
    { href: r.staff, key: "staffNav", icon: Users, masterOnly: true },
    { href: r.reports, key: "reportsNav", icon: BarChart3 },
    { href: r.settings, key: "settingsNav", icon: Settings },
  ] as const;

  return all.filter((item) =>
    role === "MASTER" ? !("managerOnly" in item) : !("masterOnly" in item),
  );
}

export function AdminShell({
  userName,
  role,
  todayOrderCount,
  children,
}: AdminShellProps) {
  const t = useTranslations("admin");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // The drawer slides in from the same edge the hamburger sits on, which flips
  // with the writing direction.
  const drawerSide = localeMeta[locale]?.dir === "rtl" ? "right" : "left";

  async function handleLogout() {
    await adminLogoutAction();
    toast.success(tAuth("loggedOut"));
    // Each role lands back on the door it came in by.
    router.replace(adminRoutes(role).login);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh bg-muted/40">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-border bg-sidebar lg:flex">
        <SidebarContent
          todayOrderCount={todayOrderCount}
          userName={userName}
          role={role}
          onLogout={handleLogout}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("dashboard")}
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side={drawerSide} className="w-64 bg-sidebar p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>{t("dashboard")}</SheetTitle>
                <SheetDescription>{t("dashboard")}</SheetDescription>
              </SheetHeader>
              <SidebarContent
                todayOrderCount={todayOrderCount}
                userName={userName}
                role={role}
                onLogout={handleLogout}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <span className="font-extrabold">{t("dashboard")}</span>

          {todayOrderCount > 0 && (
            <Badge className="ms-auto bg-primary">{todayOrderCount}</Badge>
          )}
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  todayOrderCount,
  userName,
  role,
  onLogout,
  onNavigate,
}: {
  todayOrderCount: number;
  userName: string;
  role: UserRole;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-sidebar-border px-4 py-4">
        <span className="text-base font-extrabold text-sidebar-foreground">
          Pizza Day &amp; Night
        </span>
        <span className="text-xs text-muted-foreground">
          {t("signedInAs", { name: userName })}
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navFor(role).map(({ href, key, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{t(key)}</span>
              {key === "orders" && todayOrderCount > 0 && (
                <Badge
                  className={cn(
                    "px-1.5 text-[11px]",
                    isActive
                      ? "bg-sidebar-primary-foreground text-sidebar-primary"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {todayOrderCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border p-3">
        {/*
         * The owner only. Both dashboard sessions now stop at their own base,
         * so this would open the shop as a visitor for either of them — but a
         * manager is not offered the trip. Their place in the dashboard is the
         * order queue; the shop they see the way a customer does, by going
         * there themselves, signed out or with an account of their own.
         */}
        {role === "MASTER" && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            render={<Link href="/" target="_blank" />}
          >
            <ExternalLink data-icon="inline-start" />
            {t("viewSite")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-destructive hover:text-destructive"
          onClick={onLogout}
        >
          <LogOut data-icon="inline-start" />
          {t("logout")}
        </Button>
      </div>
    </>
  );
}
