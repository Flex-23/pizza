"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { pickLocalized } from "@/lib/localized";
import type { MenuItemView } from "@/lib/schemas/menu-item";
import { useCart, useCartActions } from "@/lib/store/use-cart";

/**
 * Keeps a stale localStorage cart honest.
 *
 * A cart can sit in a browser for days while the manager changes prices or
 * marks a dish as sold out. On every menu visit the lines are re-synced against
 * the live data, and anything that disappeared is removed with a notice — far
 * better than failing at checkout.
 */
export function CartReconciler({ items }: { items: MenuItemView[] }) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { reconcile } = useCartActions();
  const { hydrated, lines } = useCart();
  const alreadyRun = useRef(false);

  useEffect(() => {
    if (!hydrated || alreadyRun.current || lines.length === 0) return;
    alreadyRun.current = true;

    const { removed } = reconcile(items);

    for (const line of removed) {
      toast.warning(
        t("removed", { name: pickLocalized(locale, line.nameAr, line.nameDe) }),
      );
    }
  }, [hydrated, lines.length, items, reconcile, t, locale]);

  return null;
}
