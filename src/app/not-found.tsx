import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Pizza } from "lucide-react";

import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Pizza className="size-8" aria-hidden />
      </span>
      <p className="text-6xl font-extrabold text-muted-foreground/40">404</p>
      <h1 className="text-2xl font-extrabold">{t("notFoundTitle")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("notFoundBody")}
      </p>
      <Button className="mt-2 rounded-full" render={<Link href="/" />}>
        {t("backHome")}
      </Button>
    </div>
  );
}
