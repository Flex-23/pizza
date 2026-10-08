import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { ManagerLoginForm } from "@/app/(admin)/manage-admin-9f3/login/login-form";

/**
 * The manager's own door.
 *
 * Three entrances now, one per role: customers at /login, the manager here, and
 * the owner at the master page. Each refuses the other two roles, so a set of
 * credentials only ever works at one address.
 */
export default async function ManagerLoginPage() {
  const t = await getTranslations("admin");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">{t("managerLoginTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("managerLoginSubtitle")}
            </p>
          </div>
        </div>

        <ManagerLoginForm />

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
