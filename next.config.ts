import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Derived from SUPABASE_URL rather than hard-coded, so moving to another
 * Supabase project is one environment variable and not a code change.
 *
 * Read straight from `process.env`: this file is evaluated by the Next CLI
 * before the app's own validated `env` module exists, and an unset value here
 * simply means the local storage driver is in use.
 */
const supabaseImagePattern = (() => {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;

  try {
    return {
      protocol: "https" as const,
      hostname: new URL(url).hostname,
      pathname: "/storage/v1/object/public/**",
    };
  } catch {
    return null;
  }
})();

/**
 * A conservative Content-Security-Policy that matches what the site actually
 * loads and nothing more.
 *
 * `'unsafe-inline'` stays on `script-src` for one reason only: the no-flash
 * theme script (`THEME_SCRIPT`) is rendered inline by the root layout, and the
 * app carries no nonce pipeline. It is the single inline script on the site.
 * `style-src` needs it too — Tailwind, `motion`, and the theme's transition-kill
 * `<style>` tag all set inline styles. `img-src` allows the Supabase bucket and
 * `data:`/`blob:` so `next/image` optimisation works either way; `frame-src`
 * allows only the Google Maps embed the settings form accepts; `frame-ancestors
 * 'none'` is the clickjacking guard that supersedes `X-Frame-Options`.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
]
  .join("; ")
  .concat(";");

/**
 * Sent on every response. These are the headers a pre-launch review expects and
 * none of them depend on the request, so they belong here rather than in the
 * proxy (which only runs on the admin area anyway). HSTS is inert over plain
 * HTTP, so it is harmless in local development and takes effect once the site is
 * served over TLS.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // `standalone` bundles the app with only the `node_modules` it needs, which
  // is what lets `npm run cpanel:pack` ship a single upload to a host that
  // cannot run `npm install`.
  //
  // Vercel must NOT get it. It builds its own functions from the trace files
  // Next leaves in `.next/`, and standalone moves those into `.next/standalone`
  // instead — the build then dies on a missing `next-server.js.nft.json`.
  // `VERCEL` is set by their build environment, so each host gets the layout it
  // expects with nothing to remember.
  output: process.env.VERCEL ? undefined : "standalone",

  // File tracing walks imports to decide what to copy. These are things it can
  // reach but must never bundle: the restaurant's own uploads, and the deploy
  // artefacts themselves (which would otherwise nest a package inside a
  // package and double in size on every run).
  outputFileTracingExcludes: {
    "/*": [
      "./public/uploads/**",
      "./deploy-package/**",
      "./*-deploy.zip",
      // The print agent is copied to the restaurant's PC, not to the server —
      // it must never travel inside the site's bundle.
      "./agent/**",
    ],
  },

  images: {
    // With STORAGE_DRIVER=local the images come from /public/uploads and no
    // remote host is involved. With STORAGE_DRIVER=supabase they are served
    // from the project's public bucket, which `next/image` will only optimise
    // if the host is allowed here.
    remotePatterns: supabaseImagePattern ? [supabaseImagePattern] : [],
    formats: ["image/avif", "image/webp"],
  },
  serverExternalPackages: ["pg", "bcryptjs"],
  experimental: {
    // Keeps server action payloads (image uploads) within a sane bound.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },

  // Applied to every route, ahead of the filesystem. The admin area keeps its
  // own `X-Robots-Tag` from the proxy on top of these.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
