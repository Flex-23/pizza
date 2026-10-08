"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A single browser-style history control. Rendered twice in the header — "back"
 * pinned to the inline-start edge and "forward" to the inline-end edge — so the
 * two sit opposite each other like the browser's own chrome, handy on kiosks
 * and installed/PWA windows where that chrome is hidden.
 *
 * Both are hidden on phones, where the OS/browser already offers a back gesture
 * and header space is scarce. The chevrons follow the reading direction: in an
 * RTL layout "back" points to the right, so they are swapped for RTL.
 */
export function HistoryNav({ direction }: { direction: "back" | "forward" }) {
  const t = useTranslations("nav");
  const isBack = direction === "back";

  // "back" points to the inline-start edge, "forward" to the inline-end edge.
  const StartChevron = isBack ? ChevronLeft : ChevronRight;
  const EndChevron = isBack ? ChevronRight : ChevronLeft;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      className="hidden size-9 shrink-0 rounded-full text-muted-foreground shadow-xs hover:text-foreground sm:inline-flex"
      aria-label={t(isBack ? "back" : "forward")}
      onClick={() =>
        isBack ? window.history.back() : window.history.forward()
      }
    >
      <StartChevron className="size-5 rtl:hidden" />
      <EndChevron className="hidden size-5 rtl:block" />
    </Button>
  );
}
