import { getRequestConfig } from "next-intl/server";

import { resolveLocale } from "@/i18n/resolve";
import { RESTAURANT_TIME_ZONE } from "@/lib/time-zone";

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: RESTAURANT_TIME_ZONE,
    now: new Date(),
  };
});
