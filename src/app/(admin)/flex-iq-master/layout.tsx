import type { Metadata } from "next";

/**
 * The dashboard is excluded from search engines two ways: this metadata block
 * and the X-Robots-Tag header that `proxy.ts` sets on every admin response. It
 * is deliberately *not* named in robots.txt — that file is public, so a Disallow
 * rule there would advertise the hidden path. It also never appears in the
 * sitemap or in any link on the public site.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  title: "—",
};

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
