import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { AdminLoginForm } from "@/app/(admin)/flex-iq-master/login/login-form";

export default async function AdminLoginPage() {
  const t = await getTranslations("admin");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">{t("loginTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("loginSubtitle")}
            </p>
          </div>
        </div>

        <AdminLoginForm />

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {t("goToWebsite")}
          </Link>
        </div>
      </div>
    </div>
  );
}
