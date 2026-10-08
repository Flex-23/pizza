import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountTabs } from "@/app/(site)/account/account-tabs";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { AddressView } from "@/lib/schemas/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AccountPage() {
  const user = await requireUser("/account");

  const [addressRows, t] = await Promise.all([
    db.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    getTranslations("account"),
  ]);

  const addresses: AddressView[] = addressRows.map((row) => ({
    id: row.id,
    label: row.label,
    street: row.street,
    postalCode: row.postalCode,
    city: row.city,
    district: row.district,
    notes: row.notes,
    isDefault: row.isDefault,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AccountTabs
        profile={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
        }}
        addresses={addresses}
      />
    </div>
  );
}
