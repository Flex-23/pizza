import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/app/(site)/login/login-form";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/safe-path";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, user, t] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getTranslations("auth"),
  ]);

  if (user) redirect(safeRedirectPath(next, "/account"));

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-extrabold">{t("loginTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("loginSubtitle")}</p>
      </div>

      <Card className="p-6">
        <LoginForm redirectTo={next} />
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/register"
          className="font-semibold text-primary hover:underline"
        >
          {t("registerButton")}
        </Link>
      </p>
    </div>
  );
}
