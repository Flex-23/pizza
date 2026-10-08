"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { toast } from "sonner";

import { printOrderReceiptAction } from "@/app/actions/admin/orders";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActionResult } from "@/lib/actions/use-action-result";

/**
 * Sends one receipt to the restaurant's printer.
 *
 * Nothing opens here: the receipt is queued on the server and the print agent
 * next to the printer picks it up within seconds, so the toast confirms that it
 * was sent rather than that paper has already come out. It is a hook rather
 * than a button alone because the orders list prints from a menu item, where a
 * nested button would be invalid.
 */
export function useReceiptPrinter(orderId: string) {
  const t = useTranslations("admin.order");
  const { messageFor } = useActionResult();
  const [isPrinting, setIsPrinting] = useState(false);
  const [, startTransition] = useTransition();

  function print() {
    setIsPrinting(true);

    startTransition(async () => {
      const result = await printOrderReceiptAction(orderId);
      setIsPrinting(false);

      if (!result.ok) {
        toast.error(messageFor(result.code));
        return;
      }

      toast.success(t("printQueued"));
    });
  }

  return { print, isPrinting };
}

export function PrintReceiptButton({
  orderId,
  size = "default",
  variant = "secondary",
}: {
  orderId: string;
  size?: "default" | "sm";
  variant?: "default" | "secondary" | "outline";
}) {
  const t = useTranslations("admin.order");
  const { print, isPrinting } = useReceiptPrinter(orderId);

  return (
    <Button size={size} variant={variant} disabled={isPrinting} onClick={print}>
      {isPrinting ? <Spinner /> : <Printer data-icon="inline-start" />}
      {t("printReceipt")}
    </Button>
  );
}
