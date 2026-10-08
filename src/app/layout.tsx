import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { Providers } from "@/components/providers";
import { localeMeta } from "@/i18n/config";
import { resolveLocale } from "@/i18n/resolve";
import { THEME_SCRIPT } from "@/lib/theme";

import "./globals.css";

const arabic = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Pizza Day & Night — Lieferservice Karlsruhe",
    template: "%s | Pizza Day & Night",
  },
  description:
    "Pizza Day & Night — Lieferservice in Karlsruhe. Pizza, Pasta, Burger, Gyros, Schnitzel und indische Gerichte, täglich frisch bis spät in die Nacht.",
  keywords: [
    "Pizza Karlsruhe",
    "Lieferservice Karlsruhe",
    "Pizza Day and Night",
    "Essen bestellen Karlsruhe",
    "Pizza Lieferdienst",
  ],
  openGraph: {
    type: "website",
    siteName: "Pizza Day & Night",
    locale: "de_DE",
  },
  robots: {
    index: true,
    follow: true,
  },
  // The icon files in this folder are picked up by name, but the manifest is
  // only linked when it is named here — see `src/app/manifest.ts`.
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1412" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await resolveLocale();
  const messages = await getMessages();
  const { dir, htmlLang } = localeMeta[locale];

  return (
    <html
      lang={htmlLang}
      dir={dir}
      suppressHydrationWarning
      className={arabic.variable}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground">
        {/* Sets the theme class before first paint, so there is no flash of the
            wrong palette. Rendered by this server component (never re-rendered
            on the client), so React never has to run an inline script during a
            client render. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
