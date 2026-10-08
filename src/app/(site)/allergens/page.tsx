import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPage } from "@/components/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("allergens") };
}

export default function AllergensPage() {
  return <LegalPage page="allergens" />;
}
