"use server";

import { cookies } from "next/headers";

import {
  defaultLocale,
  isPublicLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n/config";

/**
 * The visitor's chosen public language (German today, English later). Stored in
 * a cookie rather than a URL prefix, so adding a language needs no route
 * restructuring — only a full `messages/<locale>.json`. A stale or non-public
 * value (e.g. an old "ar" cookie) falls back to the default, so Arabic can never
 * leak onto the storefront; it is reserved for the master panel in `resolve.ts`.
 */
export async function getUserLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isPublicLocale(value) ? value : defaultLocale;
}

export async function setUserLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
