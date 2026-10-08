"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative px-1 py-1 text-sm font-semibold transition-colors",
        "after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-primary after:transition-transform after:duration-200",
        isActive
          ? "text-primary after:scale-x-100"
          : "text-foreground/75 hover:text-foreground after:scale-x-0",
      )}
    >
      {children}
    </Link>
  );
}
