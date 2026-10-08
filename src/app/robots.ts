import type { MetadataRoute } from "next";

/**
 * The dashboard path is deliberately absent here.
 *
 * robots.txt is public, so listing it under `disallow` would hand the hidden
 * URL to anyone who opens /robots.txt — the opposite of what it is for. Crawlers
 * are kept away by the `X-Robots-Tag: noindex` header that `proxy.ts` sets on
 * every admin response, and the area is unlinked and auth-gated on top of that.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/checkout",
          "/cart",
          "/account",
          "/orders",
          "/confirmation/",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
