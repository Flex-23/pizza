"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  LogIn,
  LogOut,
  ReceiptText,
  User as UserIcon,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  user: { name: string; email: string } | null;
  /**
   * Where staff enter the dashboard. The header only fills this in for a
   * manager or the owner, so the hidden path never reaches a customer's page —
   * not even as markup they could read.
   */
  dashboardHref?: string;
};

export function UserMenu({ user, dashboardHref }: UserMenuProps) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      toast.success(tAuth("loggedOut"));
      router.push("/");
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
            aria-label={t("account")}
            disabled={isPending}
          />
        }
      >
        <UserIcon className="size-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        {user ? (
          <>
            {/* Name and email are kept off this instant popover for privacy —
                the full account details live on the /account page only. */}
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/account" />}>
                <UserIcon className="size-4" aria-hidden />
                {t("account")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/orders" />}>
                <ReceiptText className="size-4" aria-hidden />
                {t("orders")}
              </DropdownMenuItem>

              {dashboardHref && (
                <DropdownMenuItem render={<Link href={dashboardHref} />}>
                  <LayoutDashboard className="size-4" aria-hidden />
                  {t("dashboard")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} variant="destructive">
              <LogOut className="size-4" aria-hidden />
              {t("logout")}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem render={<Link href="/login" />}>
              <LogIn className="size-4" aria-hidden />
              {t("login")}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/register" />}>
              <UserPlus className="size-4" aria-hidden />
              {t("register")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
