"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-8" aria-hidden />
      </span>
      <h1 className="text-2xl font-extrabold">{t("somethingWentWrong")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("tryAgain")}</p>
      <Button className="mt-2 rounded-full" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
