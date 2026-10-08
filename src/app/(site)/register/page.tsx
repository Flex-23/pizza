import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { RegisterForm } from "@/app/(site)/register/register-form";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("registerTitle") };
}

export default async function RegisterPage() {
  const [user, t] = await Promise.all([
    getCurrentUser(),
    getTranslations("auth"),
  ]);

  if (user) redirect("/account");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-extrabold">{t("registerTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("registerSubtitle")}</p>
      </div>

      <Card className="p-6">
        <RegisterForm />
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline"
        >
          {t("loginButton")}
        </Link>
      </p>
    </div>
  );
}
